use crate::archive::list::{BackupRecord, list_for_pair, delete};
use crate::archive::manifest::BackupReason;
use crate::error::AppResult;
use std::path::Path;

/// Prune auto-backups for a (account, app) pair down to `keep` most recent.
/// `keep == 0` is the "never prune" sentinel — auto-backups accumulate
/// indefinitely. Manual backups are never pruned regardless.
pub fn prune_for_pair(
    backup_root: &Path,
    steam_id_64: &str,
    app_id: u32,
    keep: u32,
) -> AppResult<Vec<BackupRecord>> {
    if keep == 0 {
        return Ok(Vec::new());
    }
    let mut records = list_for_pair(backup_root, steam_id_64, app_id)?;
    let auto: Vec<&BackupRecord> = records.iter()
        .filter(|r| r.manifest.reason != BackupReason::Manual)
        .collect();
    let keep = keep as usize;
    let to_delete: Vec<BackupRecord> = if auto.len() > keep {
        auto.iter().skip(keep).map(|r| (*r).clone()).collect()
    } else { Vec::new() };
    for r in &to_delete { delete(r)?; }
    records.retain(|r| !to_delete.iter().any(|d| d.archive_path == r.archive_path));
    Ok(to_delete)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::create::{create, CreateRequest};
    use tempfile::tempdir;

    #[test]
    fn keep_zero_means_never_prune() {
        let dir = tempdir().unwrap();
        let backups = dir.path().join("backups");
        let src = dir.path().join("src/570");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.txt"), "x").unwrap();
        for _ in 0..3 {
            create(CreateRequest {
                source_dir: &src, steam_id_64: "76561198000000001", persona_name: "Alice",
                app_id: 570, game_name: "Dota 2", reason: BackupReason::PreCopy,
                backup_root: &backups,
            }).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(1100));
        }
        let deleted = prune_for_pair(&backups, "76561198000000001", 570, 0).unwrap();
        assert!(deleted.is_empty(), "keep=0 must not delete anything");
        let remaining = list_for_pair(&backups, "76561198000000001", 570).unwrap();
        assert_eq!(remaining.len(), 3);
    }

    #[test]
    fn keeps_manual_and_drops_oldest_auto_over_limit() {
        let dir = tempdir().unwrap();
        let backups = dir.path().join("backups");
        let src = dir.path().join("src/570");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.txt"), "x").unwrap();
        let mk = |reason| {
            create(CreateRequest {
                source_dir: &src, steam_id_64: "76561198000000001", persona_name: "Alice",
                app_id: 570, game_name: "Dota 2", reason, backup_root: &backups,
            }).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(1100));
        };
        mk(BackupReason::Manual);
        mk(BackupReason::PreCopy);
        mk(BackupReason::PreCopy);
        mk(BackupReason::PreCopy);

        let deleted = prune_for_pair(&backups, "76561198000000001", 570, 2).unwrap();
        assert_eq!(deleted.len(), 1);
        assert_eq!(deleted[0].manifest.reason, BackupReason::PreCopy);
    }
}
