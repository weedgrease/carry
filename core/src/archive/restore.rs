//! Extract a backup zip back into a Steam userdata config tree.

use crate::archive::create::{create, CreateRequest};
use crate::archive::list::{read_manifest, BackupRecord};
use crate::archive::manifest::{BackupReason, MANIFEST_FILENAME};
use crate::error::{AppError, AppResult};
use crate::steam::install::SteamInstall;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

/// Restore `record` into `userdata/<target_steam_id_32>/<app_id>/`, taking a
/// `PreRestore` safety backup of the existing target first and rolling back
/// from it if extraction fails.
pub fn restore(
    install: &SteamInstall,
    record: &BackupRecord,
    target_steam_id_32: u32,
    backup_root: &Path,
) -> AppResult<PathBuf> {
    let manifest = read_manifest(&record.archive_path)?;
    let target_dir = install.userdata_dir()
        .join(target_steam_id_32.to_string())
        .join(manifest.app_id.to_string());

    let safety_backup = if target_dir.is_dir() {
        Some(create(CreateRequest {
            source_dir: &target_dir,
            steam_id_64: &manifest.steam_id_64,
            persona_name: &manifest.persona_name_at_backup,
            app_id: manifest.app_id,
            game_name: &manifest.game_name_at_backup,
            reason: BackupReason::PreRestore,
            backup_root,
        })?.archive_path)
    } else { None };

    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir)
            .map_err(|e| AppError::RestoreFailed(format!("clear target: {e}")))?;
    }
    if let Some(parent) = target_dir.parent() { std::fs::create_dir_all(parent)?; }
    std::fs::create_dir_all(&target_dir)?;

    let extract_result = extract_into(&record.archive_path, &target_dir, manifest.app_id);
    if let Err(e) = extract_result {
        if let Some(safety) = &safety_backup {
            let _ = std::fs::remove_dir_all(&target_dir);
            let _ = std::fs::create_dir_all(&target_dir);
            let _ = extract_into(safety, &target_dir, manifest.app_id);
        }
        return Err(AppError::RestoreFailed(e.to_string()));
    }

    Ok(target_dir)
}

fn extract_into(archive: &Path, target_dir: &Path, app_id: u32) -> AppResult<()> {
    let f = File::open(archive)?;
    let mut zip = zip::ZipArchive::new(f)?;
    let app_prefix = format!("{app_id}/");
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if name == MANIFEST_FILENAME { continue; }
        let rel = match name.strip_prefix(&app_prefix) {
            Some(r) => r.to_string(),
            None => continue,
        };
        if rel.is_empty() { continue; }
        let dest = target_dir.join(&rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent)?; }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            std::fs::write(&dest, &buf)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::create::{create, CreateRequest};
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn restores_into_target_account() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/100/570/local")).unwrap();
        std::fs::write(root.join("userdata/100/570/local/cfg.txt"), "saved").unwrap();
        let backup_root = root.join("backups");

        let res = create(CreateRequest {
            source_dir: &root.join("userdata/100/570"),
            steam_id_64: "76561198000000001",
            persona_name: "Alice",
            app_id: 570,
            game_name: "Dota 2",
            reason: BackupReason::Manual,
            backup_root: &backup_root,
        }).unwrap();

        let install = validate_steam_root(root).unwrap();
        let manifest = read_manifest(&res.archive_path).unwrap();
        let record = BackupRecord {
            archive_path: res.archive_path,
            size_bytes: res.size_bytes,
            manifest,
        };
        std::fs::create_dir_all(root.join("userdata/200")).unwrap();
        let restored = restore(&install, &record, 200, &backup_root).unwrap();
        assert!(restored.join("local/cfg.txt").exists());
        assert_eq!(std::fs::read_to_string(restored.join("local/cfg.txt")).unwrap(), "saved");
    }
}
