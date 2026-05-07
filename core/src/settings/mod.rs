//! User-editable application settings persisted as JSON in the app data dir.

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Persisted user preferences. Defaults: retention 20, hide-untitled on.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settings {
    pub steam_path_override: Option<PathBuf>,
    pub backup_retention_per_pair: u32,
    pub last_update_check: Option<chrono::DateTime<chrono::Utc>>,
    /// When true, apps without Steam store metadata are filtered out of the
    /// games list. Serde default keeps older settings.json files working.
    #[serde(default = "default_true")]
    pub hide_untitled_apps: bool,
}

fn default_true() -> bool { true }

impl Default for Settings {
    fn default() -> Self {
        Self {
            steam_path_override: None,
            backup_retention_per_pair: 20,
            last_update_check: None,
            hide_untitled_apps: true,
        }
    }
}

/// Load settings from disk, returning defaults if the file doesn't exist.
pub fn load(path: &Path) -> AppResult<Settings> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let bytes = std::fs::read(path)?;
    Ok(serde_json::from_slice(&bytes)?)
}

/// Persist settings as pretty JSON, creating parent dirs as needed.
pub fn save(path: &Path, settings: &Settings) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(settings)?;
    std::fs::write(path, bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn returns_default_when_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("missing.json");
        let settings = load(&path).unwrap();
        assert_eq!(settings, Settings::default());
    }

    #[test]
    fn round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Settings::default();
        s.backup_retention_per_pair = 50;
        s.steam_path_override = Some(PathBuf::from("C:/Steam"));
        s.hide_untitled_apps = false;
        save(&path, &s).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded, s);
    }

    #[test]
    fn legacy_settings_without_hide_untitled_defaults_to_true() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("legacy.json");
        std::fs::write(
            &path,
            r#"{"steam_path_override":null,"backup_retention_per_pair":20,"last_update_check":null}"#,
        ).unwrap();
        let loaded = load(&path).unwrap();
        assert!(loaded.hide_untitled_apps);
    }
}
