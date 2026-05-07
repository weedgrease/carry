/** Typed wrappers around every Tauri command exposed by the Rust bridge. */
import { invoke } from "@tauri-apps/api/core";
import type {
  Account, GameView, BackupRecord, TransferPair, TransferOutcome,
  Settings, AppError, UpdateInfo,
} from "@/types/domain";

/** Coerce an arbitrary thrown Tauri rejection into the typed `{ code, message }` shape. */
function unwrap<T>(p: Promise<T>): Promise<T> {
  return p.catch((raw) => {
    const err: AppError = typeof raw === "object" && raw && "code" in raw
      ? raw as AppError
      : { code: "Unknown", message: String(raw) };
    throw err;
  });
}

/** Pull a user-facing string out of an unknown thrown value (AppError, Error, anything). */
export function toErrorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (
    typeof e === "object" && e !== null
    && "message" in e && typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return fallback;
}

/** Typed facade over `invoke()` for every Tauri command, with normalized errors. */
export const api = {
  listAccounts: () => unwrap(invoke<Account[]>("list_accounts")),
  listGames: (steam_id_32: number) =>
    unwrap(invoke<GameView[]>("list_games", { steamId32: steam_id_32 })),
  clearGamesCache: () => unwrap(invoke<void>("clear_games_cache")),
  ensureAvatar: (steam_id_64: string) =>
    unwrap(invoke<string>("ensure_avatar", { steamId64: steam_id_64 })),
  openPathInExplorer: (path: string) =>
    unwrap(invoke<void>("open_path_in_explorer", { path })),
  listBackups: () => unwrap(invoke<BackupRecord[]>("list_backups")),
  createManualBackup: (args: {
    steam_id_64: string; steam_id_32: number; persona_name: string;
    app_id: number; game_name: string;
  }) => unwrap(invoke<string>("create_manual_backup", {
    steamId64: args.steam_id_64, steamId32: args.steam_id_32,
    personaName: args.persona_name, appId: args.app_id, gameName: args.game_name,
  })),
  deleteBackup: (archive_path: string) =>
    unwrap(invoke<void>("delete_backup", { archivePath: archive_path })),
  runTransfer: (pairs: TransferPair[]) =>
    unwrap(invoke<TransferOutcome[]>("run_transfer_cmd", { pairs })),
  restoreBackup: (archive_path: string, target_steam_id_32: number) =>
    unwrap(invoke<string>("restore_backup", {
      archivePath: archive_path, targetSteamId32: target_steam_id_32,
    })),
  getSettings: () => unwrap(invoke<Settings>("get_settings")),
  updateSettings: (settings: Settings) =>
    unwrap(invoke<void>("update_settings", { settings })),
  pickSteamPath: () => unwrap(invoke<string | null>("pick_steam_path")),
  checkForUpdate: () => unwrap(invoke<UpdateInfo>("check_for_update")),
  installUpdate: () => unwrap(invoke<void>("install_update")),
};
