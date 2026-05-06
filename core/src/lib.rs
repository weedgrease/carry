pub mod archive;
pub mod bridge;
pub mod error;
pub mod settings;
pub mod steam;
pub mod sync;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("app_data_dir");
            let state = bridge::state::AppState::new(data_dir).expect("initialize state");
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::commands::list_accounts,
            bridge::commands::list_games,
            bridge::commands::clear_games_cache,
            bridge::commands::ensure_avatar,
            bridge::commands::open_path_in_explorer,
            bridge::commands::list_backups,
            bridge::commands::create_manual_backup,
            bridge::commands::delete_backup,
            bridge::commands::run_transfer_cmd,
            bridge::commands::restore_backup,
            bridge::commands::get_settings,
            bridge::commands::update_settings,
            bridge::commands::pick_steam_path,
            bridge::commands::check_for_update,
            bridge::commands::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
