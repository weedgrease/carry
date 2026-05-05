use crate::bridge::state::AppState;
use crate::error::{AppError, AppResult};
use crate::steam::accounts::Account;
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
