use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMetadata {
    pub app_id: u32,
    pub name: String,
    pub header_image_url: String,
}

pub fn header_image_url(app_id: u32) -> String {
    format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/header.jpg")
}

pub fn load_cache(path: &Path) -> AppResult<HashMap<u32, GameMetadata>> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    Ok(serde_json::from_slice(&std::fs::read(path)?)?)
}

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
}

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
            r.data.as_ref().map(|d| GameMetadata {
                app_id,
                name: d.name.clone(),
                header_image_url: header_image_url(app_id),
            })
        } else {
            None
        }
    }))
}

pub async fn ensure_cached(
    client: &reqwest::Client,
    cache_path: &PathBuf,
    cache: &mut HashMap<u32, GameMetadata>,
    app_ids: &[u32],
) -> AppResult<()> {
    let missing: Vec<u32> = app_ids
        .iter()
        .copied()
        .filter(|id| !cache.contains_key(id))
        .collect();
    for id in missing {
        match fetch_one(client, id).await {
            Ok(Some(meta)) => {
                cache.insert(id, meta);
            }
            Ok(None) => {
                cache.insert(
                    id,
                    GameMetadata {
                        app_id: id,
                        name: format!("App {id}"),
                        header_image_url: header_image_url(id),
                    },
                );
            }
            Err(_) => continue,
        }
        tokio::time::sleep(Duration::from_millis(1500)).await;
    }
    save_cache(cache_path, cache)?;
    Ok(())
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
        cache.insert(
            570,
            GameMetadata {
                app_id: 570,
                name: "Dota 2".into(),
                header_image_url: header_image_url(570),
            },
        );
        save_cache(&path, &cache).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert_eq!(loaded.get(&570).unwrap().name, "Dota 2");
    }
}
