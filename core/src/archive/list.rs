//! Discover and read backup zips from the on-disk archive tree.

use crate::archive::manifest::{Manifest, MANIFEST_FILENAME};
use crate::error::AppResult;
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

/// A single backup zip together with its parsed manifest.
#[derive(Debug, Clone, Serialize)]
pub struct BackupRecord {
    pub archive_path: PathBuf,
    pub size_bytes: u64,
    pub manifest: Manifest,
}

/// Open `archive` and parse the embedded `manifest.json`.
pub fn read_manifest(archive: &Path) -> AppResult<Manifest> {
    let f = File::open(archive)?;
    let mut zip = zip::ZipArchive::new(f)?;
    let mut entry = zip.by_name(MANIFEST_FILENAME)?;
    let mut s = String::new();
    entry.read_to_string(&mut s)?;
    Ok(serde_json::from_str(&s)?)
}

/// Walk every `<steam_id_64>/<app_id>/*.zip` and return records sorted newest first.
pub fn list_all(backup_root: &Path) -> AppResult<Vec<BackupRecord>> {
    let mut out = Vec::new();
    if !backup_root.is_dir() { return Ok(out); }
    for steam_id_entry in std::fs::read_dir(backup_root)? {
        let steam_id_dir = steam_id_entry?.path();
        if !steam_id_dir.is_dir() { continue; }
        for app_entry in std::fs::read_dir(&steam_id_dir)? {
            let app_dir = app_entry?.path();
            if !app_dir.is_dir() { continue; }
            for file in std::fs::read_dir(&app_dir)? {
                let path = file?.path();
                if path.extension().and_then(|s| s.to_str()) != Some("zip") { continue; }
                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                if let Ok(manifest) = read_manifest(&path) {
                    out.push(BackupRecord { archive_path: path, size_bytes: size, manifest });
                }
            }
        }
    }
    out.sort_by(|a, b| b.manifest.created_at.cmp(&a.manifest.created_at));
    Ok(out)
}

/// Backups for one (account, app) pair, sorted newest first.
pub fn list_for_pair(backup_root: &Path, steam_id_64: &str, app_id: u32) -> AppResult<Vec<BackupRecord>> {
    Ok(list_all(backup_root)?
        .into_iter()
        .filter(|r| r.manifest.steam_id_64 == steam_id_64 && r.manifest.app_id == app_id)
        .collect())
}

/// Remove the zip on disk for `record`.
pub fn delete(record: &BackupRecord) -> AppResult<()> {
    std::fs::remove_file(&record.archive_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::create::{create, CreateRequest};
    use crate::archive::manifest::BackupReason;
    use tempfile::tempdir;

    fn setup_backup(root: &Path, app_id: u32, reason: BackupReason) -> PathBuf {
        let src = root.join(format!("source_{app_id}_{reason:?}"));
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.txt"), b"x").unwrap();
        let backups = root.join("backups");
        let res = create(CreateRequest {
            source_dir: &src,
            steam_id_64: "76561198000000001",
            persona_name: "Alice",
            app_id,
            game_name: "Game",
            reason,
            backup_root: &backups,
        }).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1100));
        res.archive_path
    }

    #[test]
    fn lists_and_filters_pairs() {
        let dir = tempdir().unwrap();
        setup_backup(dir.path(), 570, BackupReason::Manual);
        setup_backup(dir.path(), 730, BackupReason::Manual);
        let backup_root = dir.path().join("backups");
        assert_eq!(list_all(&backup_root).unwrap().len(), 2);
        let dota = list_for_pair(&backup_root, "76561198000000001", 570).unwrap();
        assert_eq!(dota.len(), 1);
        assert_eq!(dota[0].manifest.app_id, 570);
    }
}
