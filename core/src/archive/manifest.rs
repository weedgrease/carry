//! On-disk schema for the JSON manifest embedded in every backup zip.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Why a backup was created. Drives retention (only `Manual` survives pruning).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum BackupReason {
    /// User clicked "Backup now".
    Manual,
    /// Auto-snapshot of the target's config before a transfer overwrites it.
    PreCopy,
    /// Auto-snapshot of the target's config before a restore replaces it.
    PreRestore,
    /// Auto-snapshot of the source's config at the start of a transfer.
    Source,
}

/// Metadata embedded in a backup zip alongside the config payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct Manifest {
    pub schema_version: u32,
    pub created_at: DateTime<Utc>,
    pub steam_id_64: String,
    pub persona_name_at_backup: String,
    pub app_id: u32,
    pub game_name_at_backup: String,
    pub reason: BackupReason,
    pub source_path: PathBuf,
    pub byte_size: u64,
}

/// Filename of the manifest entry inside each backup zip.
pub const MANIFEST_FILENAME: &str = "manifest.json";
/// Current manifest schema. Bump when [`Manifest`]'s shape changes.
pub const SCHEMA_VERSION: u32 = 1;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips() {
        let m = Manifest {
            schema_version: SCHEMA_VERSION,
            created_at: Utc::now(),
            steam_id_64: "76561198000000001".into(),
            persona_name_at_backup: "Alice".into(),
            app_id: 570,
            game_name_at_backup: "Dota 2".into(),
            reason: BackupReason::PreCopy,
            source_path: PathBuf::from("C:/Steam/userdata/39734273/570"),
            byte_size: 1024,
        };
        let s = serde_json::to_string(&m).unwrap();
        assert!(s.contains("\"reason\":\"PreCopy\""));
        let parsed: Manifest = serde_json::from_str(&s).unwrap();
        assert_eq!(parsed, m);
    }

    #[test]
    fn source_reason_round_trips() {
        let m = Manifest {
            schema_version: SCHEMA_VERSION,
            created_at: Utc::now(),
            steam_id_64: "76561198000000001".into(),
            persona_name_at_backup: "Alice".into(),
            app_id: 570,
            game_name_at_backup: "Dota 2".into(),
            reason: BackupReason::Source,
            source_path: PathBuf::from("C:/Steam/userdata/39734273/570"),
            byte_size: 1024,
        };
        let s = serde_json::to_string(&m).unwrap();
        assert!(s.contains("\"reason\":\"Source\""));
        let parsed: Manifest = serde_json::from_str(&s).unwrap();
        assert_eq!(parsed, m);
    }
}
