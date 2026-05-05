use crate::error::{AppError, AppResult};
use crate::steam::install::SteamInstall;
use std::path::{Path, PathBuf};

pub fn local_avatar(install: &SteamInstall, steam_id_64: &str) -> Option<PathBuf> {
    let p = install.avatar_cache_dir().join(format!("{steam_id_64}.png"));
    if p.exists() { Some(p) } else { None }
}

#[derive(Debug)]
struct ProfileXml { avatar_full: Option<String> }

fn parse_profile_xml(xml: &str) -> ProfileXml {
    use quick_xml::events::Event;
    use quick_xml::Reader;
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut in_avatar_full = false;
    let mut avatar_full = None;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"avatarFull" => in_avatar_full = true,
            Ok(Event::CData(t)) if in_avatar_full => {
                avatar_full = Some(String::from_utf8_lossy(t.as_ref()).to_string());
                in_avatar_full = false;
            }
            Ok(Event::Text(t)) if in_avatar_full => {
                avatar_full = Some(t.unescape().unwrap_or_default().to_string());
                in_avatar_full = false;
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    ProfileXml { avatar_full }
}

pub async fn fetch_remote_avatar(
    client: &reqwest::Client,
    steam_id_64: &str,
    cache_dir: &Path,
) -> AppResult<PathBuf> {
    std::fs::create_dir_all(cache_dir)?;
    let dest = cache_dir.join(format!("{steam_id_64}.png"));
    if dest.exists() { return Ok(dest); }

    let xml_url = format!("https://steamcommunity.com/profiles/{steam_id_64}?xml=1");
    let xml = client.get(xml_url).send().await?.error_for_status()?.text().await?;
    let parsed = parse_profile_xml(&xml);
    let url = parsed.avatar_full.ok_or_else(|| {
        AppError::BackupFailed(format!("avatar URL missing for {steam_id_64}"))
    })?;
    let bytes = client.get(url).send().await?.error_for_status()?.bytes().await?;
    std::fs::write(&dest, &bytes)?;
    Ok(dest)
}

pub fn resolve(install: &SteamInstall, steam_id_64: &str) -> Option<PathBuf> {
    local_avatar(install, steam_id_64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn local_avatar_hit() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("config/avatarcache")).unwrap();
        std::fs::create_dir_all(dir.path().join("userdata")).unwrap();
        let path = dir.path().join("config/avatarcache/76561198000000001.png");
        std::fs::write(&path, b"fake-png").unwrap();
        let install = validate_steam_root(dir.path()).unwrap();
        let resolved = local_avatar(&install, "76561198000000001").unwrap();
        assert_eq!(resolved, path);
    }

    #[test]
    fn local_avatar_miss() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("config/avatarcache")).unwrap();
        std::fs::create_dir_all(dir.path().join("userdata")).unwrap();
        let install = validate_steam_root(dir.path()).unwrap();
        assert!(local_avatar(&install, "76561198000000001").is_none());
    }

    #[test]
    fn parses_avatar_full_from_xml() {
        let xml = r#"<?xml version="1.0"?>
<profile>
  <avatarFull><![CDATA[https://avatars.steamstatic.com/abc_full.jpg]]></avatarFull>
</profile>"#;
        let parsed = parse_profile_xml(xml);
        assert_eq!(parsed.avatar_full.as_deref(), Some("https://avatars.steamstatic.com/abc_full.jpg"));
    }
}
