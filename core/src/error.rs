//! Crate-wide error type. Serializes to `{ code, message }` for the frontend.

use serde::Serialize;
use std::path::PathBuf;
use thiserror::Error;

/// Every fallible operation surfaced through the Tauri bridge maps to one of
/// these variants. The `Serialize` impl exposes `{ code, message }` so the
/// frontend can branch on `code` without parsing prose.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Steam installation not found")]
    SteamNotFound,
    #[error("Steam is currently running. Please quit Steam before continuing.")]
    SteamRunning,
    #[error("Account {0} not found")]
    AccountNotFound(String),
    #[error("Insufficient disk space: need {need} bytes, have {have}")]
    InsufficientDiskSpace { need: u64, have: u64 },
    #[error("VDF parse error: {0}")]
    VdfParse(String),
    #[error("Backup failed: {0}")]
    BackupFailed(String),
    #[error("Restore failed: {0}")]
    RestoreFailed(String),
    #[error("Path does not exist: {0}")]
    PathMissing(PathBuf),
    #[error("Operation cancelled")]
    Cancelled,
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Serialize)]
struct SerializedError<'a> {
    code: &'a str,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let code = match self {
            AppError::SteamNotFound => "SteamNotFound",
            AppError::SteamRunning => "SteamRunning",
            AppError::AccountNotFound(_) => "AccountNotFound",
            AppError::InsufficientDiskSpace { .. } => "InsufficientDiskSpace",
            AppError::VdfParse(_) => "VdfParse",
            AppError::BackupFailed(_) => "BackupFailed",
            AppError::RestoreFailed(_) => "RestoreFailed",
            AppError::PathMissing(_) => "PathMissing",
            AppError::Cancelled => "Cancelled",
            AppError::Io(_) => "Io",
            AppError::Network(_) => "Network",
            AppError::Zip(_) => "Zip",
            AppError::Json(_) => "Json",
        };
        SerializedError { code, message: self.to_string() }.serialize(s)
    }
}

/// Shorthand for `Result<T, AppError>`.
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_code_and_message() {
        let err = AppError::SteamRunning;
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\":\"SteamRunning\""));
        assert!(json.contains("Steam is currently running"));
    }

    #[test]
    fn account_not_found_carries_id() {
        let err = AppError::AccountNotFound("123".into());
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("Account 123 not found"));
    }
}
