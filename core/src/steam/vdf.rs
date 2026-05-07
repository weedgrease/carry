//! Parsers for Steam's VDF (KeyValues) configuration files.

use crate::error::{AppError, AppResult};
use chrono::{DateTime, TimeZone, Utc};
use std::collections::HashMap;
use std::path::Path;

/// One entry in `config/loginusers.vdf`.
#[derive(Debug, Clone, PartialEq)]
pub struct LoginUserEntry {
    pub steam_id_64: String,
    pub account_name: String,
    pub persona_name: String,
    pub most_recent: bool,
    pub timestamp: Option<DateTime<Utc>>,
}

/// Read and parse `loginusers.vdf` from disk.
pub fn parse_loginusers(path: &Path) -> AppResult<Vec<LoginUserEntry>> {
    let text = std::fs::read_to_string(path)?;
    parse_loginusers_str(&text)
}

/// Parse the contents of a `loginusers.vdf` payload.
pub fn parse_loginusers_str(text: &str) -> AppResult<Vec<LoginUserEntry>> {
    let vdf = keyvalues_parser::parse(text).map_err(|e| AppError::VdfParse(e.to_string()))?;
    let users_obj = vdf
        .value
        .get_obj()
        .ok_or_else(|| AppError::VdfParse("expected top-level object".into()))?;

    let mut entries = Vec::new();
    for (id, vals) in users_obj.iter() {
        let val = vals
            .first()
            .ok_or_else(|| AppError::VdfParse("empty entry".into()))?;
        let obj = val
            .get_obj()
            .ok_or_else(|| AppError::VdfParse("expected entry obj".into()))?;
        let s = |k: &str| -> Option<String> {
            obj.get(k)
                .and_then(|v| v.first())
                .and_then(|v| v.get_str())
                .map(|s| s.to_string())
        };
        let timestamp_secs: Option<i64> = s("Timestamp").and_then(|t| t.parse().ok());
        entries.push(LoginUserEntry {
            steam_id_64: id.to_string(),
            account_name: s("AccountName").unwrap_or_default(),
            persona_name: s("PersonaName").unwrap_or_default(),
            most_recent: s("MostRecent").as_deref() == Some("1"),
            timestamp: timestamp_secs.and_then(|t| Utc.timestamp_opt(t, 0).single()),
        });
    }
    Ok(entries)
}

/// Per-app last-played timestamps from `userdata/<id32>/config/localconfig.vdf`.
///
/// More accurate than userdata folder mtime, which gets bumped by Steam Cloud
/// sync and `remotecache.vdf` rewrites even when the user never launches the
/// game.
pub fn parse_localconfig_last_played(path: &Path) -> AppResult<HashMap<u32, DateTime<Utc>>> {
    let text = std::fs::read_to_string(path)?;
    parse_localconfig_last_played_str(&text)
}

/// Parse the contents of a `localconfig.vdf` payload for last-played timestamps.
pub fn parse_localconfig_last_played_str(text: &str) -> AppResult<HashMap<u32, DateTime<Utc>>> {
    let vdf = keyvalues_parser::parse(text).map_err(|e| AppError::VdfParse(e.to_string()))?;
    let root = vdf
        .value
        .get_obj()
        .ok_or_else(|| AppError::VdfParse("expected top-level object".into()))?;

    // Steam varies the casing of these keys in the wild (e.g. lowercase
    // "valve"), so descend case-insensitively.
    let apps = match walk_ci(root, &["Software", "Valve", "Steam", "apps"]) {
        Some(o) => o,
        None => return Ok(HashMap::new()),
    };

    let mut out = HashMap::new();
    for (key, vals) in apps.iter() {
        let app_id: u32 = match key.parse() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let val = match vals.first() {
            Some(v) => v,
            None => continue,
        };
        let obj = match val.get_obj() {
            Some(o) => o,
            None => continue,
        };
        let last_played: Option<&str> = obj
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("LastPlayed"))
            .and_then(|(_, vs)| vs.first())
            .and_then(|v| v.get_str());
        if let Some(s) = last_played {
            if let Ok(secs) = s.parse::<i64>() {
                if secs > 0 {
                    if let Some(dt) = Utc.timestamp_opt(secs, 0).single() {
                        out.insert(app_id, dt);
                    }
                }
            }
        }
    }
    Ok(out)
}

fn walk_ci<'a, 'b: 'a>(
    obj: &'b keyvalues_parser::Obj<'a>,
    keys: &[&str],
) -> Option<&'b keyvalues_parser::Obj<'a>> {
    let mut cur = obj;
    for k in keys {
        let entry = cur.iter().find(|(key, _)| key.eq_ignore_ascii_case(k))?;
        let val = entry.1.first()?;
        cur = val.get_obj()?;
    }
    Some(cur)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    #[test]
    fn parses_two_users() {
        let entries = parse_loginusers(&fixture("loginusers.vdf")).unwrap();
        assert_eq!(entries.len(), 2);
        let alice = entries
            .iter()
            .find(|e| e.steam_id_64 == "76561198000000001")
            .unwrap();
        assert_eq!(alice.account_name, "alice_login");
        assert_eq!(alice.persona_name, "Alice");
        assert!(alice.most_recent);
        assert!(alice.timestamp.is_some());
    }

    #[test]
    fn handles_empty_object() {
        let entries = parse_loginusers_str("\"users\" { }").unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn parses_last_played_from_localconfig() {
        let text = r#"
        "UserLocalConfigStore"
        {
            "Software"
            {
                "Valve"
                {
                    "Steam"
                    {
                        "apps"
                        {
                            "570"
                            {
                                "LastPlayed"  "1726000000"
                                "Playtime"  "450"
                            }
                            "730"
                            {
                                "LastPlayed"  "1700000000"
                            }
                            "999"
                            {
                                "Playtime"  "5"
                            }
                            "111"
                            {
                                "LastPlayed"  "0"
                            }
                        }
                    }
                }
            }
        }
        "#;
        let map = parse_localconfig_last_played_str(text).unwrap();
        // 999 lacks LastPlayed; 111 has 0 (never played); both excluded.
        assert_eq!(map.len(), 2);
        assert!(map.contains_key(&570));
        assert!(map.contains_key(&730));
        assert!(map[&570] > map[&730]);
    }

    #[test]
    fn last_played_path_is_case_insensitive() {
        let text = r#"
        "UserLocalConfigStore"
        {
            "Software"
            {
                "valve"
                {
                    "STEAM"
                    {
                        "Apps"
                        {
                            "570" { "lastplayed"  "1726000000" }
                        }
                    }
                }
            }
        }
        "#;
        let map = parse_localconfig_last_played_str(text).unwrap();
        assert!(map.contains_key(&570));
    }

    #[test]
    fn last_played_returns_empty_when_apps_missing() {
        let text = r#""UserLocalConfigStore" { "Software" { } }"#;
        let map = parse_localconfig_last_played_str(text).unwrap();
        assert!(map.is_empty());
    }
}
