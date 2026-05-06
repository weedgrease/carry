use crate::archive::create::{create, CreateRequest};
use crate::archive::manifest::BackupReason;
use crate::archive::retention::prune_for_pair;
use crate::error::{AppError, AppResult};
use crate::steam::install::SteamInstall;
use crate::sync::copy::TwoPhaseCopy;
use crate::sync::preflight::{dir_size, ensure_disk_space};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferPair {
    pub source_steam_id_64: String,
    pub target_steam_id_64: String,
    pub source_steam_id_32: u32,
    pub target_steam_id_32: u32,
    pub source_persona: String,
    pub target_persona: String,
    pub app_id: u32,
    pub game_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransferOutcome {
    pub pair: TransferPair,
    pub success: bool,
    pub error: Option<String>,
    pub backup_path: Option<PathBuf>,
}

pub struct TransferOptions<'a> {
    pub backup_root: &'a Path,
    pub retention_per_pair: u32,
}

pub fn run_transfer(
    install: &SteamInstall,
    pairs: &[TransferPair],
    opts: TransferOptions,
) -> AppResult<Vec<TransferOutcome>> {
    // Note: we deliberately do NOT block on Steam being open. Steam usually
    // only writes to a userdata/<id>/<appId>/ tree while THAT specific game
    // is launched (cloud sync) or while the account is the actively-logged-
    // in one (login/exit sync). The pre-copy auto-backup is the safety net
    // — if Steam clobbers the new config, the user can restore from it.
    let mut results = Vec::with_capacity(pairs.len());
    for pair in pairs {
        results.push(run_single(install, pair, &opts));
    }
    Ok(results)
}

fn run_single(install: &SteamInstall, pair: &TransferPair, opts: &TransferOptions) -> TransferOutcome {
    let source_dir = install.userdata_dir()
        .join(pair.source_steam_id_32.to_string())
        .join(pair.app_id.to_string());
    let target_dir = install.userdata_dir()
        .join(pair.target_steam_id_32.to_string())
        .join(pair.app_id.to_string());

    let outcome = (|| -> AppResult<Option<PathBuf>> {
        if !source_dir.is_dir() {
            return Err(AppError::PathMissing(source_dir.clone()));
        }
        let target_parent = target_dir.parent()
            .ok_or_else(|| AppError::PathMissing(target_dir.clone()))?;
        std::fs::create_dir_all(target_parent)?;
        ensure_disk_space(target_parent, dir_size(&source_dir))?;

        let backup_path = if target_dir.is_dir() {
            let res = create(CreateRequest {
                source_dir: &target_dir,
                steam_id_64: &pair.target_steam_id_64,
                persona_name: &pair.target_persona,
                app_id: pair.app_id,
                game_name: &pair.game_name,
                reason: BackupReason::PreCopy,
                backup_root: opts.backup_root,
            })?;
            Some(res.archive_path)
        } else { None };

        TwoPhaseCopy { src: &source_dir, target: &target_dir }.execute()?;

        let _ = prune_for_pair(opts.backup_root, &pair.target_steam_id_64, pair.app_id, opts.retention_per_pair);
        Ok(backup_path)
    })();

    match outcome {
        Ok(backup_path) => TransferOutcome {
            pair: pair.clone(), success: true, error: None, backup_path,
        },
        Err(e) => TransferOutcome {
            pair: pair.clone(), success: false, error: Some(e.to_string()), backup_path: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn transfers_a_single_pair_with_pre_copy_backup() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/100/570")).unwrap();
        std::fs::create_dir_all(root.join("userdata/200/570")).unwrap();
        std::fs::write(root.join("userdata/100/570/cfg.txt"), "src").unwrap();
        std::fs::write(root.join("userdata/200/570/cfg.txt"), "dst").unwrap();

        let install = validate_steam_root(root).unwrap();
        let backup_root = dir.path().join("backups");
        let pair = TransferPair {
            source_steam_id_64: "76561198000000001".into(),
            target_steam_id_64: "76561198000000002".into(),
            source_steam_id_32: 100, target_steam_id_32: 200,
            source_persona: "Alice".into(), target_persona: "Bob".into(),
            app_id: 570, game_name: "Dota 2".into(),
        };
        let outs = run_transfer(&install, &[pair], TransferOptions {
            backup_root: &backup_root, retention_per_pair: 20,
        }).unwrap();
        assert_eq!(outs.len(), 1);
        assert!(outs[0].success, "transfer should succeed: {:?}", outs[0].error);
        assert!(outs[0].backup_path.is_some());
        let copied = std::fs::read_to_string(root.join("userdata/200/570/cfg.txt")).unwrap();
        assert_eq!(copied, "src");
    }
}
