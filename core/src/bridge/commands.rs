use crate::archive::list::BackupRecord;
use crate::archive::manifest::BackupReason;
use crate::bridge::state::AppState;
use crate::error::{AppError, AppResult};
use crate::settings::Settings;
use crate::steam::accounts::Account;
use crate::steam::games::GameRef;
use crate::steam::metadata::GameMetadata;
use crate::sync::transfer::{run_transfer, TransferOptions, TransferOutcome, TransferPair};
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;
use tauri_plugin_updater::UpdaterExt;

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

#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> AppResult<Vec<BackupRecord>> {
    let backups_root = state.backups_root();
    crate::archive::list::list_all(&backups_root)
}

#[tauri::command]
pub async fn create_manual_backup(
    state: State<'_, AppState>,
    steam_id_64: String,
    steam_id_32: u32,
    persona_name: String,
    app_id: u32,
    game_name: String,
) -> AppResult<PathBuf> {
    let install = state
        .steam
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::SteamNotFound)?;
    let source = install
        .userdata_dir()
        .join(steam_id_32.to_string())
        .join(app_id.to_string());
    let backups_root = state.backups_root();
    let res = crate::archive::create::create(crate::archive::create::CreateRequest {
        source_dir: &source,
        steam_id_64: &steam_id_64,
        persona_name: &persona_name,
        app_id,
        game_name: &game_name,
        reason: BackupReason::Manual,
        backup_root: &backups_root,
    })?;
    Ok(res.archive_path)
}

#[tauri::command]
pub async fn delete_backup(archive_path: PathBuf) -> AppResult<()> {
    std::fs::remove_file(archive_path)?;
    Ok(())
}

#[tauri::command]
pub async fn run_transfer_cmd(
    state: State<'_, AppState>,
    pairs: Vec<TransferPair>,
) -> AppResult<Vec<TransferOutcome>> {
    let install = state
        .steam
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::SteamNotFound)?;
    let backups_root = state.backups_root();
    let retention = state.settings.lock().unwrap().backup_retention_per_pair;
    run_transfer(
        &install,
        &pairs,
        TransferOptions {
            backup_root: &backups_root,
            retention_per_pair: retention,
        },
    )
}

#[tauri::command]
pub async fn restore_backup(
    state: State<'_, AppState>,
    archive_path: PathBuf,
    target_steam_id_32: u32,
) -> AppResult<PathBuf> {
    let install = state
        .steam
        .lock()
        .unwrap()
        .clone()
        .ok_or(AppError::SteamNotFound)?;
    let manifest = crate::archive::list::read_manifest(&archive_path)?;
    let size = std::fs::metadata(&archive_path).map(|m| m.len()).unwrap_or(0);
    let record = BackupRecord {
        archive_path,
        size_bytes: size,
        manifest,
    };
    let backup_root = state.backups_root();
    crate::archive::restore::restore(&install, &record, target_steam_id_32, &backup_root)
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
pub async fn update_settings(state: State<'_, AppState>, settings: Settings) -> AppResult<()> {
    let path = state.settings_path();
    crate::settings::save(&path, &settings)?;
    *state.settings.lock().unwrap() = settings.clone();
    if let Some(p) = settings.steam_path_override.as_ref() {
        if let Ok(install) = crate::steam::install::validate_steam_root(p) {
            *state.steam.lock().unwrap() = Some(install);
        }
    } else if let Ok(install) = crate::steam::install::detect() {
        *state.steam.lock().unwrap() = Some(install);
    }
    Ok(())
}

#[tauri::command]
pub async fn pick_steam_path(handle: tauri::AppHandle) -> AppResult<Option<PathBuf>> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    handle.dialog().file().pick_folder(move |p| {
        let _ = tx.send(p);
    });
    let chosen = rx.recv().ok().flatten();
    Ok(chosen.and_then(|p| p.into_path().ok()))
}

#[derive(Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(handle: tauri::AppHandle) -> AppResult<UpdateInfo> {
    let current_version = handle.package_info().version.to_string();
    let updater = handle
        .updater()
        .map_err(|e| AppError::BackupFailed(format!("updater init: {e}")))?;
    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            current_version,
            notes: update.body.clone(),
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            version: None,
            current_version,
            notes: None,
        }),
        Err(e) => Err(AppError::BackupFailed(format!("update check: {e}"))),
    }
}

#[tauri::command]
pub async fn install_update(handle: tauri::AppHandle) -> AppResult<()> {
    let updater = handle
        .updater()
        .map_err(|e| AppError::BackupFailed(format!("updater init: {e}")))?;
    if let Some(update) = updater
        .check()
        .await
        .map_err(|e| AppError::BackupFailed(format!("update check: {e}")))?
    {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| AppError::BackupFailed(format!("install: {e}")))?;
        handle.restart();
    }
    Ok(())
}
