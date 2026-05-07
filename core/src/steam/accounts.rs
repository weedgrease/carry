//! Discover Steam accounts known to this install (loginusers + userdata).

use crate::error::AppResult;
use crate::steam::install::SteamInstall;
use crate::steam::vdf::parse_loginusers;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::PathBuf;

/// SteamID64 base offset; subtract from a 64-bit ID to get the 32-bit form.
const STEAM_ID_OFFSET: u64 = 76_561_197_960_265_728;

/// A Steam account combined with its userdata presence and resolved display name.
#[derive(Debug, Clone, Serialize)]
pub struct Account {
    pub steam_id_64: String,
    pub steam_id_32: u32,
    pub account_name: String,
    pub persona_name: String,
    pub display_name: String,
    pub avatar_path: Option<PathBuf>,
    pub last_login: Option<DateTime<Utc>>,
    pub has_userdata: bool,
}

/// Convert a SteamID64 to its 32-bit form (the userdata folder name).
pub fn steam_id_64_to_32(id64: u64) -> u32 {
    (id64 - STEAM_ID_OFFSET) as u32
}

/// Build a list of accounts from `loginusers.vdf`, sorted most-recent first.
pub fn discover(install: &SteamInstall) -> AppResult<Vec<Account>> {
    let entries = parse_loginusers(&install.loginusers_vdf())?;
    let mut accounts = Vec::with_capacity(entries.len());
    for e in entries {
        let id64: u64 = match e.steam_id_64.parse() { Ok(v) => v, Err(_) => continue };
        let id32 = steam_id_64_to_32(id64);
        let userdata_dir = install.userdata_dir().join(id32.to_string());
        let has_userdata = userdata_dir.is_dir();
        let avatar = install.avatar_cache_dir().join(format!("{}.png", e.steam_id_64));
        let display_name = if !e.persona_name.is_empty() {
            e.persona_name.clone()
        } else if !e.account_name.is_empty() {
            e.account_name.clone()
        } else {
            format!("Steam ID {}", e.steam_id_64)
        };
        accounts.push(Account {
            steam_id_64: e.steam_id_64,
            steam_id_32: id32,
            account_name: e.account_name,
            persona_name: e.persona_name,
            display_name,
            avatar_path: if avatar.exists() { Some(avatar) } else { None },
            last_login: e.timestamp,
            has_userdata,
        });
    }
    accounts.sort_by(|a, b| b.last_login.cmp(&a.last_login));
    Ok(accounts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    fn write(p: &std::path::Path, s: &str) {
        if let Some(parent) = p.parent() { std::fs::create_dir_all(parent).unwrap(); }
        std::fs::write(p, s).unwrap();
    }

    #[test]
    fn id_conversion() {
        assert_eq!(steam_id_64_to_32(76561198000000001), 39734273);
    }

    #[test]
    fn discovers_accounts_and_marks_userdata_presence() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/39734273")).unwrap();
        let vdf = r#"
"users"
{
	"76561198000000001"
	{
		"AccountName" "alice"
		"PersonaName" "Alice"
		"MostRecent" "1"
		"Timestamp" "1714521600"
	}
	"76561198000000002"
	{
		"AccountName" "bob"
		"PersonaName" "Bob"
		"MostRecent" "0"
		"Timestamp" "1714435200"
	}
}
"#;
        write(&root.join("config/loginusers.vdf"), vdf);
        let install = validate_steam_root(root).unwrap();
        let accounts = discover(&install).unwrap();
        assert_eq!(accounts.len(), 2);
        let alice = accounts.iter().find(|a| a.persona_name == "Alice").unwrap();
        assert!(alice.has_userdata);
        let bob = accounts.iter().find(|a| a.persona_name == "Bob").unwrap();
        assert!(!bob.has_userdata);
    }

    #[test]
    fn display_name_falls_back_through_persona_account_steam_id() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/100")).unwrap();
        std::fs::create_dir_all(root.join("userdata/200")).unwrap();
        std::fs::create_dir_all(root.join("userdata/300")).unwrap();
        let vdf = r#"
"users"
{
	"76561197960265828"
	{
		"AccountName" "alice"
		"PersonaName" "Alice"
	}
	"76561197960265928"
	{
		"AccountName" "bob_login"
		"PersonaName" ""
	}
	"76561197960266028"
	{
		"AccountName" ""
		"PersonaName" ""
	}
}
"#;
        write(&root.join("config/loginusers.vdf"), vdf);
        let install = validate_steam_root(root).unwrap();
        let accounts = discover(&install).unwrap();
        let by_id: std::collections::HashMap<_, _> = accounts.iter()
            .map(|a| (a.steam_id_64.as_str(), a)).collect();
        assert_eq!(by_id["76561197960265828"].display_name, "Alice");
        assert_eq!(by_id["76561197960265928"].display_name, "bob_login");
        assert_eq!(by_id["76561197960266028"].display_name, "Steam ID 76561197960266028");
    }
}
