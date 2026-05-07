//! Enumerate the per-game config folders inside an account's userdata tree.

use crate::error::AppResult;
use crate::steam::install::SteamInstall;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::PathBuf;

/// AppIds that show up under `userdata/<id32>/` but aren't real games — Steam's
/// own internal apps. Add new entries here if more surface in the wild.
const STEAM_INTERNAL_APP_IDS: &[u32] = &[
    7,      // Steam client itself
    760,    // Steam Screenshots
    241100, // Steam Input controller configs
    744350, // Steam awards / events
];

/// A single game's config directory under an account.
#[derive(Debug, Clone, Serialize)]
pub struct GameRef {
    pub app_id: u32,
    pub config_path: PathBuf,
    pub config_size_bytes: u64,
    pub last_modified: Option<DateTime<Utc>>,
}

/// All games under `userdata/<steam_id_32>/`, sorted most-recently-played first.
pub fn list_for_account(install: &SteamInstall, steam_id_32: u32) -> AppResult<Vec<GameRef>> {
    let account_dir = install.userdata_dir().join(steam_id_32.to_string());
    if !account_dir.is_dir() { return Ok(Vec::new()); }

    // localconfig.vdf's per-app LastPlayed is the real recency signal. The
    // userdata folder mtime is unreliable: cloud sync, remotecache.vdf
    // rewrites, and unrelated config touches all bump it.
    let last_played = crate::steam::vdf::parse_localconfig_last_played(
        &install.localconfig_vdf(steam_id_32),
    ).unwrap_or_default();

    let mut games = Vec::new();
    for entry in std::fs::read_dir(&account_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() { continue; }
        let name = entry.file_name();
        let s = match name.to_str() { Some(s) => s, None => continue };
        let app_id: u32 = match s.parse() { Ok(v) if v > 0 => v, _ => continue };
        if STEAM_INTERNAL_APP_IDS.contains(&app_id) { continue; }
        let path = entry.path();
        let (size, mtime) = dir_stats(&path)?;
        // Fall back to mtime so never-launched games still get an ordering.
        let last_modified = last_played.get(&app_id).copied().or(mtime);
        games.push(GameRef {
            app_id,
            config_path: path,
            config_size_bytes: size,
            last_modified,
        });
    }
    games.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(games)
}

fn dir_stats(p: &std::path::Path) -> AppResult<(u64, Option<DateTime<Utc>>)> {
    let mut total = 0u64;
    let mut latest: Option<std::time::SystemTime> = None;
    for e in walkdir::WalkDir::new(p) {
        let e = match e { Ok(e) => e, Err(_) => continue };
        if !e.file_type().is_file() { continue; }
        let md = match e.metadata() { Ok(m) => m, Err(_) => continue };
        total = total.saturating_add(md.len());
        if let Ok(modified) = md.modified() {
            latest = Some(latest.map_or(modified, |cur| cur.max(modified)));
        }
    }
    Ok((total, latest.map(DateTime::<Utc>::from)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn lists_numeric_subfolders() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/570/local")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/730")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/ac")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/0")).unwrap();
        std::fs::write(root.join("userdata/12345/570/local/cfg.txt"), "x").unwrap();
        let install = validate_steam_root(root).unwrap();
        let games = list_for_account(&install, 12345).unwrap();
        let ids: Vec<u32> = games.iter().map(|g| g.app_id).collect();
        assert!(ids.contains(&570));
        assert!(ids.contains(&730));
        assert!(!ids.contains(&0));
    }

    #[test]
    fn filters_steam_internal_app_ids() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/570")).unwrap();
        // Each internal id gets a fake file so dir_stats sees something.
        for internal in [7u32, 760, 241100, 744350] {
            let dir = root.join(format!("userdata/12345/{internal}/local"));
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("foo.txt"), "x").unwrap();
        }
        let install = validate_steam_root(root).unwrap();
        let games = list_for_account(&install, 12345).unwrap();
        let ids: Vec<u32> = games.iter().map(|g| g.app_id).collect();
        assert!(ids.contains(&570));
        assert!(!ids.contains(&7), "app id 7 (Steam client) should be filtered");
        assert!(!ids.contains(&760), "app id 760 (Steam Screenshots) should be filtered");
        assert!(!ids.contains(&241100), "app id 241100 (Steam Input) should be filtered");
        assert!(!ids.contains(&744350), "app id 744350 (Steam awards) should be filtered");
    }
}
