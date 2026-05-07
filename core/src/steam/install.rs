//! Locate and describe a Steam installation on disk.

use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

/// A validated Steam install rooted at `root`, with helpers for the standard subpaths.
#[derive(Debug, Clone)]
pub struct SteamInstall {
    pub root: PathBuf,
}

impl SteamInstall {
    pub fn userdata_dir(&self) -> PathBuf { self.root.join("userdata") }
    pub fn config_dir(&self) -> PathBuf { self.root.join("config") }
    pub fn avatar_cache_dir(&self) -> PathBuf { self.config_dir().join("avatarcache") }
    pub fn loginusers_vdf(&self) -> PathBuf { self.config_dir().join("loginusers.vdf") }
    pub fn localconfig_vdf(&self, steam_id_32: u32) -> PathBuf {
        self.userdata_dir().join(steam_id_32.to_string()).join("config/localconfig.vdf")
    }
}

/// Treat `p` as a Steam root, requiring `userdata/` and `config/` subdirs.
pub fn validate_steam_root(p: &Path) -> AppResult<SteamInstall> {
    if !p.exists() { return Err(AppError::PathMissing(p.to_path_buf())); }
    let userdata = p.join("userdata");
    let config = p.join("config");
    if !userdata.exists() || !config.exists() {
        return Err(AppError::SteamNotFound);
    }
    Ok(SteamInstall { root: p.to_path_buf() })
}

/// Detect Steam from registry (HKCU then HKLM), falling back to the default
/// `C:\Program Files (x86)\Steam` path. Returns `SteamNotFound` on non-Windows.
#[cfg(target_os = "windows")]
pub fn detect() -> AppResult<SteamInstall> {
    use winreg::enums::*;
    use winreg::RegKey;

    if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(p) = hkcu.get_value::<String, _>("SteamPath") {
            if let Ok(install) = validate_steam_root(Path::new(&p)) { return Ok(install); }
        }
    }
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam")
    {
        if let Ok(p) = hklm.get_value::<String, _>("InstallPath") {
            if let Ok(install) = validate_steam_root(Path::new(&p)) { return Ok(install); }
        }
    }
    let default = Path::new("C:\\Program Files (x86)\\Steam");
    validate_steam_root(default)
}

#[cfg(not(target_os = "windows"))]
pub fn detect() -> AppResult<SteamInstall> {
    Err(AppError::SteamNotFound)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn validate_succeeds_with_correct_layout() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("userdata")).unwrap();
        std::fs::create_dir_all(dir.path().join("config")).unwrap();
        let install = validate_steam_root(dir.path()).unwrap();
        assert_eq!(install.root, dir.path());
        assert_eq!(install.loginusers_vdf(), dir.path().join("config/loginusers.vdf"));
    }

    #[test]
    fn validate_fails_when_userdata_missing() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("config")).unwrap();
        let err = validate_steam_root(dir.path()).unwrap_err();
        assert!(matches!(err, AppError::SteamNotFound));
    }
}
