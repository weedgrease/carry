use crate::error::{AppError, AppResult};
use chrono::{DateTime, TimeZone, Utc};
use std::path::Path;

#[derive(Debug, Clone, PartialEq)]
pub struct LoginUserEntry {
    pub steam_id_64: String,
    pub account_name: String,
    pub persona_name: String,
    pub most_recent: bool,
    pub timestamp: Option<DateTime<Utc>>,
}

pub fn parse_loginusers(path: &Path) -> AppResult<Vec<LoginUserEntry>> {
    let text = std::fs::read_to_string(path)?;
    parse_loginusers_str(&text)
}

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
}
