//! Persistent JSON cache of Steam appdetails responses (game name + cover art).

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Cached metadata for one app. `is_known=false` means appdetails returned no
/// store entry (typical for internal/private apps).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMetadata {
    pub app_id: u32,
    pub name: String,
    pub header_image_url: String,
    #[serde(default = "default_true")]
    pub is_known: bool,
}

fn default_true() -> bool { true }

/// Legacy Steam CDN header URL. Returns a 1.4kB placeholder (HTTP 200, not
/// 404) for many newer apps, so a plain `<img>` can't detect the failure. Used
/// only as a fallback for unknown apps and for migrating stale cache entries.
pub fn header_image_url(app_id: u32) -> String {
    format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/header.jpg")
}

fn is_legacy_placeholder_url(url: &str) -> bool {
    url.starts_with("https://cdn.cloudflare.steamstatic.com/steam/apps/")
        || url.starts_with("https://cdn.akamai.steamstatic.com/steam/apps/")
}

/// Load the appdetails cache and migrate stale entries.
///
/// Drops `is_known` entries whose URL was built from the legacy CDN template
/// (older builds did this); they get re-fetched into the proper content-hashed
/// URL on next `ensure_cached`. Untitled (`is_known=false`) entries are kept
/// as-is — the UI renders a placeholder for them anyway.
pub fn load_cache(path: &Path) -> AppResult<HashMap<u32, GameMetadata>> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let parsed: HashMap<u32, GameMetadata> = serde_json::from_slice(&std::fs::read(path)?)?;
    let migrated: HashMap<u32, GameMetadata> = parsed
        .into_iter()
        .filter(|(_, v)| !(v.is_known && is_legacy_placeholder_url(&v.header_image_url)))
        .collect();
    Ok(migrated)
}

/// Persist the appdetails cache as pretty JSON.
pub fn save_cache(path: &Path, cache: &HashMap<u32, GameMetadata>) -> AppResult<()> {
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(cache)?)?;
    Ok(())
}

#[derive(Deserialize)]
struct AppDetailsEnvelope {
    #[serde(flatten)]
    inner: HashMap<String, AppDetailsResp>,
}
#[derive(Deserialize)]
struct AppDetailsResp {
    success: bool,
    data: Option<AppDetailsData>,
}
#[derive(Deserialize)]
struct AppDetailsData {
    name: String,
    // Modern apps return a content-hashed `shared.akamai.steamstatic.com/...`
    // URL; older apps still resolve to the legacy CDN path. Either is trusted.
    #[serde(default)]
    header_image: String,
}

/// Fetch a single appdetails entry. Returns `Ok(None)` when Steam reports the
/// app has no public store entry.
pub async fn fetch_one(client: &reqwest::Client, app_id: u32) -> AppResult<Option<GameMetadata>> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={app_id}&filters=basic"
    );
    let env: AppDetailsEnvelope = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let resp = env.inner.get(&app_id.to_string());
    Ok(resp.and_then(|r| {
        if r.success {
            r.data.as_ref().map(|d| {
                let header = if d.header_image.is_empty() {
                    header_image_url(app_id)
                } else {
                    d.header_image.clone()
                };
                GameMetadata {
                    app_id,
                    name: d.name.clone(),
                    header_image_url: header,
                    is_known: true,
                }
            })
        } else {
            None
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn header_url_format() {
        assert_eq!(
            header_image_url(570),
            "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg"
        );
    }

    #[test]
    fn cache_round_trip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        let mut cache = HashMap::new();
        // Content-hashed URL so the load_cache migration leaves it alone.
        cache.insert(
            570,
            GameMetadata {
                app_id: 570,
                name: "Dota 2".into(),
                header_image_url:
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/abc/header.jpg".into(),
                is_known: true,
            },
        );
        save_cache(&path, &cache).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert_eq!(loaded.get(&570).unwrap().name, "Dota 2");
    }

    #[test]
    fn is_known_false_round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        let mut cache = HashMap::new();
        cache.insert(7, GameMetadata {
            app_id: 7, name: "App 7".into(), header_image_url: header_image_url(7),
            is_known: false,
        });
        save_cache(&path, &cache).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert!(!loaded.get(&7).unwrap().is_known);
    }

    #[test]
    fn legacy_cache_without_is_known_defaults_to_true() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        // URL is not the legacy placeholder pattern, so the migration leaves
        // it intact — this test isolates the serde default.
        std::fs::write(&path, r#"{"570":{"app_id":570,"name":"Dota 2","header_image_url":"https://example/570.jpg"}}"#).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert!(loaded.get(&570).unwrap().is_known);
    }

    #[test]
    fn migration_drops_legacy_placeholder_url_entries() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        let mut cache = HashMap::new();
        // Stale: known + legacy URL — dropped on load.
        cache.insert(2807960, GameMetadata {
            app_id: 2807960,
            name: "Battlefield 6".into(),
            header_image_url: "https://cdn.cloudflare.steamstatic.com/steam/apps/2807960/header.jpg".into(),
            is_known: true,
        });
        // Fresh: known + content-hashed URL — kept.
        cache.insert(570, GameMetadata {
            app_id: 570,
            name: "Dota 2".into(),
            header_image_url: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/abc/header.jpg".into(),
            is_known: true,
        });
        // Untitled: legacy URL is fine because the placeholder masks it.
        cache.insert(7, GameMetadata {
            app_id: 7,
            name: "App 7".into(),
            header_image_url: header_image_url(7),
            is_known: false,
        });
        save_cache(&path, &cache).unwrap();

        let loaded = load_cache(&path).unwrap();
        assert!(!loaded.contains_key(&2807960), "stale legacy-URL entry should be migrated out");
        assert!(loaded.contains_key(&570), "content-hashed URL entry should be kept");
        assert!(loaded.contains_key(&7), "untitled entry should be kept regardless of URL");
    }
}
