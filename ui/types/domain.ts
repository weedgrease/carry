export type Account = {
  steam_id_64: string;
  steam_id_32: number;
  account_name: string;
  persona_name: string;
  display_name: string;
  avatar_path: string | null;
  last_login: string | null;
  has_userdata: boolean;
};

export type GameView = {
  app_id: number;
  config_path: string;
  config_size_bytes: number;
  last_modified: string | null;
  name: string;
  header_image_url: string;
  is_known: boolean;
  is_pending_fetch: boolean;
};

export type BackupReason = "Manual" | "PreCopy" | "PreRestore" | "Source";

export type Manifest = {
  schema_version: number;
  created_at: string;
  steam_id_64: string;
  persona_name_at_backup: string;
  app_id: number;
  game_name_at_backup: string;
  reason: BackupReason;
  source_path: string;
  byte_size: number;
};

export type BackupRecord = {
  archive_path: string;
  size_bytes: number;
  manifest: Manifest;
};

export type TransferPair = {
  source_steam_id_64: string;
  target_steam_id_64: string;
  source_steam_id_32: number;
  target_steam_id_32: number;
  source_persona: string;
  target_persona: string;
  app_id: number;
  game_name: string;
};

export type TransferOutcome = {
  pair: TransferPair;
  success: boolean;
  error: string | null;
  backup_path: string | null;
};

export type Settings = {
  steam_path_override: string | null;
  backup_retention_per_pair: number;
  last_update_check: string | null;
  hide_untitled_apps: boolean;
};

export type AppError = { code: string; message: string };

export type UpdateInfo = {
  available: boolean;
  version: string | null;
  current_version: string;
  notes: string | null;
};

export type UpdateProgress =
  | { phase: "progress"; downloaded: number; total: number | null }
  | { phase: "finished" };
