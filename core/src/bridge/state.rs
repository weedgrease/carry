//! Tauri-managed application state shared across all command handlers.

use crate::error::AppResult;
use crate::settings::Settings;
use crate::steam::install::{detect, SteamInstall};
use crate::steam::metadata::GameMetadata;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Shared mutable state held by the Tauri runtime and accessed by every command.
pub struct AppState {
    pub(crate) steam: Mutex<Option<SteamInstall>>,
    pub(crate) settings: Mutex<Settings>,
    pub(crate) data_dir: PathBuf,
    pub(crate) http: reqwest::Client,
    /// AppIds currently being fetched by a background metadata task. Prevents
    /// duplicate requests for the same id across rapid frontend polls.
    pub(crate) games_fetch_in_progress: Arc<Mutex<HashSet<u32>>>,
    /// Authoritative in-memory copy of the persisted games metadata cache.
    /// Held behind a single lock to serialize concurrent updates from the
    /// background fetcher (read-modify-write of the JSON file would otherwise
    /// race when multiple `list_games` calls overlap).
    pub(crate) games_cache: Arc<Mutex<HashMap<u32, GameMetadata>>>,
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
            .user_agent(concat!("carry/", env!("CARGO_PKG_VERSION")))
            .build()?;
        let games_cache_path = data_dir.join("games.json");
        let games_cache = crate::steam::metadata::load_cache(&games_cache_path)
            .unwrap_or_default();
        Ok(Self {
            steam: Mutex::new(steam),
            settings: Mutex::new(settings),
            data_dir,
            http,
            games_fetch_in_progress: Arc::new(Mutex::new(HashSet::new())),
            games_cache: Arc::new(Mutex::new(games_cache)),
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
