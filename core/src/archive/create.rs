use crate::archive::manifest::{Manifest, BackupReason, MANIFEST_FILENAME, SCHEMA_VERSION};
use crate::error::{AppError, AppResult};
use chrono::Utc;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

pub struct CreateRequest<'a> {
    pub source_dir: &'a Path,
    pub steam_id_64: &'a str,
    pub persona_name: &'a str,
    pub app_id: u32,
    pub game_name: &'a str,
    pub reason: BackupReason,
    pub backup_root: &'a Path,
}

pub struct CreateResult {
    pub archive_path: PathBuf,
    pub size_bytes: u64,
}

pub fn create(req: CreateRequest) -> AppResult<CreateResult> {
    if !req.source_dir.is_dir() {
        return Err(AppError::PathMissing(req.source_dir.to_path_buf()));
    }
    let now = Utc::now();
    let timestamp = now.format("%Y%m%dT%H%M%SZ");
    let reason_str = match req.reason {
        BackupReason::Manual => "manual",
        BackupReason::PreCopy => "precopy",
        BackupReason::PreRestore => "prerestore",
        BackupReason::Source => "source",
    };
    let dir = req.backup_root.join(req.steam_id_64).join(req.app_id.to_string());
    std::fs::create_dir_all(&dir)?;
    let archive_path = dir.join(format!("{timestamp}_{reason_str}.zip"));

    let file = File::create(&archive_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut total_bytes = 0u64;
    let prefix = req.source_dir;
    let app_id_dir = req.app_id.to_string();
    for entry in WalkDir::new(prefix) {
        let entry = entry.map_err(|e| AppError::BackupFailed(e.to_string()))?;
        let rel = entry.path().strip_prefix(prefix)
            .map_err(|e| AppError::BackupFailed(e.to_string()))?;
        let name_in_zip = if rel.as_os_str().is_empty() {
            PathBuf::from(&app_id_dir)
        } else {
            PathBuf::from(&app_id_dir).join(rel)
        };
        let name_str = name_in_zip.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            zip.add_directory(&name_str, opts)?;
        } else if entry.file_type().is_file() {
            zip.start_file(&name_str, opts)?;
            let mut f = File::open(entry.path())?;
            let mut buf = [0u8; 16 * 1024];
            loop {
                let n = f.read(&mut buf)?;
                if n == 0 { break; }
                zip.write_all(&buf[..n])?;
                total_bytes += n as u64;
            }
        }
    }

    let manifest = Manifest {
        schema_version: SCHEMA_VERSION,
        created_at: now,
        steam_id_64: req.steam_id_64.into(),
        persona_name_at_backup: req.persona_name.into(),
        app_id: req.app_id,
        game_name_at_backup: req.game_name.into(),
        reason: req.reason,
        source_path: req.source_dir.to_path_buf(),
        byte_size: total_bytes,
    };
    zip.start_file(MANIFEST_FILENAME, opts)?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
    zip.finish()?;

    let size_bytes = std::fs::metadata(&archive_path)?.len();
    Ok(CreateResult { archive_path, size_bytes })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use tempfile::tempdir;

    #[test]
    fn creates_archive_with_manifest() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("570");
        std::fs::create_dir_all(src.join("local")).unwrap();
        std::fs::write(src.join("local/cfg.txt"), b"hello").unwrap();
        let backup_root = dir.path().join("backups");
        let res = create(CreateRequest {
            source_dir: &src, steam_id_64: "76561198000000001",
            persona_name: "Alice", app_id: 570, game_name: "Dota 2",
            reason: BackupReason::Manual, backup_root: &backup_root,
        }).unwrap();
        assert!(res.archive_path.exists());
        assert!(res.size_bytes > 0);

        let f = File::open(&res.archive_path).unwrap();
        let mut zip = zip::ZipArchive::new(f).unwrap();
        let names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string()).collect();
        assert!(names.iter().any(|n| n == "manifest.json"));
        assert!(names.iter().any(|n| n == "570/local/cfg.txt"));

        let mut mf = String::new();
        zip.by_name("manifest.json").unwrap().read_to_string(&mut mf).unwrap();
        let manifest: Manifest = serde_json::from_str(&mf).unwrap();
        assert_eq!(manifest.app_id, 570);
        assert_eq!(manifest.reason, BackupReason::Manual);
    }
}
