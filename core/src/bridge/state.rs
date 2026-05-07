//! Tauri-managed application state shared across all command handlers.

use crate::error::AppResult;
use crate::settings::Settings;
use crate::steam::install::{detect, SteamInstall};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Shared mutable state held by the Tauri runtime and accessed by every command.
pub struct AppState {
    pub steam: Mutex<Option<SteamInstall>>,
    pub settings: Mutex<Settings>,
    pub data_dir: PathBuf,
    pub http: reqwest::Client,
    /// AppIds currently being fetched by a background metadata task. Prevents
    /// duplicate requests for the same id across rapid frontend polls.
    pub games_fetch_in_progress: Arc<Mutex<HashSet<u32>>>,
}

impl AppState {
    /// Initialize state, loading persisted settings and detecting Steam.
    pub fn new(data_dir: PathBuf) -> AppResult<Self> {
        std::fs::create_dir_all(&data_dir)?;
        let settings_path = data_dir.join("settings.json");
        let settings = crate::settings::load(&settings_path)?;
        let steam = match settings.steam_path_override.as_ref() {
            Some(p) => crate::steam::install::validate_steam_root(p).ok(),
            None => detect().ok(),
        };
        let http = reqwest::Client::builder()
            .user_agent("carry/0.1")
            .build()?;
        Ok(Self {
            steam: Mutex::new(steam),
            settings: Mutex::new(settings),
            data_dir,
            http,
            games_fetch_in_progress: Arc::new(Mutex::new(HashSet::new())),
        })
    }

    pub fn settings_path(&self) -> PathBuf {
        self.data_dir.join("settings.json")
    }
    pub fn games_cache_path(&self) -> PathBuf {
        self.data_dir.join("games.json")
    }
    pub fn avatars_dir(&self) -> PathBuf {
        self.data_dir.join("avatars")
    }
    pub fn backups_root(&self) -> PathBuf {
        self.data_dir.join("backups")
    }
}
