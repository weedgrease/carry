use crate::bridge::state::AppState;
use crate::error::{AppError, AppResult};
use crate::steam::accounts::Account;
use crate::steam::games::GameRef;
use crate::steam::metadata::GameMetadata;
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn list_accounts(state: State<'_, AppState>) -> AppResult<Vec<Account>> {
    let install = state
        .steam
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::SteamNotFound)?;
    let accounts = crate::steam::accounts::discover(&install)?;
    Ok(accounts)
}

#[derive(Serialize)]
pub struct GameView {
    #[serde(flatten)]
    pub game: GameRef,
    pub name: String,
    pub header_image_url: String,
}

#[tauri::command]
pub async fn list_games(
    state: State<'_, AppState>,
    steam_id_32: u32,
) -> AppResult<Vec<GameView>> {
    let install = state
        .steam
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::SteamNotFound)?;
    let games = crate::steam::games::list_for_account(&install, steam_id_32)?;
    let cache_path = state.games_cache_path();
    let mut cache = crate::steam::metadata::load_cache(&cache_path)?;
    let ids: Vec<u32> = games.iter().map(|g| g.app_id).collect();
    crate::steam::metadata::ensure_cached(&state.http, &cache_path, &mut cache, &ids).await?;
    Ok(games
        .into_iter()
        .map(|g| {
            let meta = cache.get(&g.app_id).cloned().unwrap_or_else(|| GameMetadata {
                app_id: g.app_id,
                name: format!("App {}", g.app_id),
                header_image_url: crate::steam::metadata::header_image_url(g.app_id),
            });
            GameView {
                game: g,
                name: meta.name,
                header_image_url: meta.header_image_url,
            }
        })
        .collect())
}

#[tauri::command]
pub async fn ensure_avatar(
    state: State<'_, AppState>,
    steam_id_64: String,
) -> AppResult<PathBuf> {
    let install = state
        .steam
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::SteamNotFound)?;
    if let Some(p) = crate::steam::avatars::local_avatar(&install, &steam_id_64) {
        return Ok(p);
    }
    let avatars_dir = state.avatars_dir();
    crate::steam::avatars::fetch_remote_avatar(&state.http, &steam_id_64, &avatars_dir).await
}

#[tauri::command]
pub async fn open_path_in_explorer(path: PathBuf) -> AppResult<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(path).spawn()?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Ok(())
    }
}
