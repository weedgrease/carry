# Steam Config Transfer — Design

**Date:** 2026-05-05
**Status:** Approved (pre-implementation)
**Owner:** kevin.murphy@proof.com

## Overview

A Windows desktop utility that copies Steam game configuration data (the contents of `userdata/<steamId32>/<appId>/`) between Steam accounts on the same machine, with automatic and manual backups. The app shows all known accounts with their persona names and profile pictures and lets the user transfer any subset of game configs from one source account to one or more target accounts in a single operation.

The app is offline-first: it reads everything it needs from local Steam files and the public Steam CDN. No Steam Web API key is required.

## Goals

- Show every account that has logged in on this machine, with avatar and persona name.
- For a selected source account, show its game library with header art and which games actually have config data on disk.
- Copy game config from a source account to one or more target accounts, with automatic safety backups before any overwrite.
- Provide a backup history view with manual backup, one-click restore, and reveal-in-explorer.
- Ship as a small, signed, auto-updating Windows installer.

## Non-Goals (v1)

- macOS or Linux builds.
- Steam Web API integration (no API keys required).
- Account switching (the user explicitly excluded this).
- Cloud-stored backups.
- Selective sub-file copy within a game's config tree.
- Telemetry.
- Beta / nightly update channels.
- In-app rollback to a prior app version.

## Stack

- **Tauri 2** (Rust runtime, isolated webview frontend).
- **React 19 + TypeScript + Vite** for the UI.
- **shadcn/ui + Tailwind CSS v4** for components, installed via `pnpm dlx shadcn@latest add ...`. The `ui/components/ui/` directory is owned by the CLI; we never hand-edit primitives.
- **Zustand** for frontend state.
- **Rust crates:** `keyvalues-parser` (VDF), `walkdir`, `zip`, `serde`, `serde_json`, `tokio`, `reqwest`, `winreg` (registry lookups), `uuid`, `tempfile`, `thiserror`, `chrono`.
- **Tauri plugins:** `tauri-plugin-updater`, `tauri-plugin-os`, `tauri-plugin-dialog`, `tauri-plugin-shell` (for "reveal in Explorer"). All filesystem work happens in Rust, so `tauri-plugin-fs` is intentionally not used.

## Project Layout

The default Tauri folders `src/` and `src-tauri/` are renamed to `ui/` and `core/` via `tauri.conf.json` (`build.frontendDist`, `build.devUrl`) and `vite.config.ts`.

```
ui/                        # React frontend (Bulletproof React structure)
  app/                     # Shell, providers, router, root layout
    providers/             # ThemeProvider, QueryClientProvider, ErrorBoundary
    globals.css            # Tailwind + shadcn CSS vars (light/dark)
  assets/
  components/
    ui/                    # shadcn primitives (CLI-managed; do not hand-edit)
    layout/                # AppShell, Header, Sidebar
  config/                  # Constants, env
  features/
    accounts/              # api/ components/ hooks/ stores/ types/ index.ts
    library/               # Games per account
    transfer/              # Source/target/transfer flow
    backups/               # History, manual backup, restore
    settings/              # Steam path override, retention, theme
  hooks/                   # Shared hooks
  lib/                     # tauri-client, theme, formatters
  stores/                  # Global stores
  types/                   # Shared types

core/                      # Rust backend
  src/
    bridge/                # Tauri commands (the JS<->Rust boundary)
    steam/                 # Install detection, accounts, avatars, games, VDF
    archive/               # Backup zip creation, restore, listing
    sync/                  # Copy-between-accounts with pre-copy safety backup
    settings/              # App preferences persistence
    error.rs               # AppError + serde-friendly conversions
    lib.rs
  tauri.conf.json
  Cargo.toml
  build.rs
  icons/

.github/workflows/         # CI: build + release
docs/superpowers/specs/    # This spec and future revisions
docs/manual-test.md        # Manual smoke checklist
```

## Steam Discovery

### Install path detection (Windows)

Resolve in this order, stopping at the first match:

1. `HKCU\Software\Valve\Steam\SteamPath` (authoritative; handles non-default installs).
2. `HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath`.
3. `C:\Program Files (x86)\Steam`.
4. Prompt the user to pick the folder via a native dialog.

The resolved path is cached in app settings and overridable from the Settings view.

### Account discovery

- Parse `<Steam>/config/loginusers.vdf` to get every account that has logged in on this machine: `{ steamId64, accountName, personaName, mostRecent, timestamp }`.
- Cross-reference with directories under `<Steam>/userdata/<steamId32>/`. An account is "known" if the VDF entry exists. An account is "usable as source" if at least one numeric `<appId>` subfolder exists.
- `steamId32 = steamId64 - 76561197960265728` (lower 32 bits of the SteamID).

### Profile pictures

- **Primary:** `<Steam>/config/avatarcache/<steamId64>.png` — Steam keeps these locally for any account that has logged in here.
- **Fallback:** fetch the public profile XML at `https://steamcommunity.com/profiles/<steamId64>?xml=1`, extract the `<avatarFull>` URL, download the JPG. No API key required.
- Avatars are cached to `<AppData>/SteamConfigTransfer/avatars/<steamId64>.png` so we hit the network at most once per account.

### Game discovery per account

- Subfolders of `<Steam>/userdata/<steamId32>/` named with all-digit IDs are appIds. Skip non-numeric folders (`config`, `0`, `ac`, etc.).
- Game name + header art come from the public Steam CDN (no API key):
  - **Name:** `https://store.steampowered.com/api/appdetails?appids=<id>&filters=basic`. Steam throttles this to ~200 requests / 5 minutes; we fetch one at a time with a small delay on first scan and cache forever in `<AppData>/SteamConfigTransfer/games.json`. Subsequent scans are instant.
  - **Header art:** `https://cdn.cloudflare.steamstatic.com/steam/apps/<id>/header.jpg` (no rate limit; cached locally).
- If `appdetails` fails for an appId we display the numeric ID as a placeholder name and show a generic image; the user can retry from the Settings view.

## Data Model

Shared types live in Rust and are exposed to the frontend via `tauri-specta`-generated bindings (preferred) or hand-mirrored TypeScript interfaces (acceptable fallback if specta integration becomes friction).

```rust
pub struct Account {
    pub steam_id_64: String,        // string to avoid JS BigInt issues
    pub steam_id_32: u32,
    pub account_name: String,       // login name
    pub persona_name: String,       // display name
    pub avatar_path: PathBuf,       // local file path
    pub last_login: Option<DateTime<Utc>>,
    pub has_userdata: bool,         // any <appId> subfolder exists
}

pub struct Game {
    pub app_id: u32,
    pub name: String,
    pub header_image_url: String,
    pub has_config: bool,           // <appId>/ folder exists for the account
    pub config_size_bytes: u64,
    pub last_modified: DateTime<Utc>,
}

pub struct Backup {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub source_steam_id_64: String,
    pub app_id: u32,
    pub archive_path: PathBuf,
    pub size_bytes: u64,
    pub reason: BackupReason,
}

pub enum BackupReason { Manual, PreCopy, PreRestore }
```

## UI Design

The app has three top-level routes: **Transfer** (default), **Backups**, **Settings**. Routing via `react-router` v7 with a top-level `AppShell` containing `Header` + a route outlet.

### Transfer view

```
┌─────────────────────────────────────────────────────┐
│  Header: app title         theme toggle   settings  │
├──────────────────────────┬──────────────────────────┤
│  SOURCE                  │  TARGETS                 │
│  ┌──────────────┐        │  [x] persona_a (avatar)  │
│  │ avatar       │ ▼      │  [x] persona_b (avatar)  │
│  │ persona_x    │        │  [ ] persona_c (avatar)  │
│  └──────────────┘        │                          │
│                          │                          │
│  Games (grid):           │                          │
│  [header.jpg] [header]   │                          │
│  [header]    [header]    │                          │
│  [x] Dota 2  [x] CS2     │                          │
│  [ ] Skyrim  [ ] ...     │                          │
└──────────────────────────┴──────────────────────────┘
│ Sticky action bar:                                  │
│ "Transfer 2 games to 2 accounts. 4 configs will be  │
│  auto-backed-up."         [Cancel]   [Transfer ->]  │
└─────────────────────────────────────────────────────┘
```

- Source account: single-select chip with avatar + persona name.
- Targets: multi-select list, source is hidden from targets.
- Game grid: multi-select cards, each card shows header.jpg, persona-localized game name, last-modified, and a "no config" empty state for games owned but never configured.
- Sticky action bar always shows the next click's effect, including the implicit auto-backup count.

### Backups view

shadcn `Table` with sortable columns: **Date · Account · Game · Reason · Size · Actions**. Filters: account, game, reason. Row actions: **Restore**, **Reveal in Explorer**, **Delete**. Empty state for first-run users.

### Settings view

- **Steam path** with native folder picker override.
- **Backup retention**: keep last N per (account, game), default 20. Manual backups never auto-deleted.
- **Theme**: System / Light / Dark.
- **Check for updates** button + current version + last-checked timestamp.

## Transfer Flow & Safety Semantics

The core invariant: **never lose user data, even on partial failure.**

For each `(sourceGame, targetAccount)` pair:

1. **Pre-flight**: Steam process not running; source readable; target writable; free disk space ≥ 2× source size.
2. **Steam-running guard**: if `steam.exe` is detected, hard-block with a dialog explaining why (Steam overwrites `userdata/` on quit).
3. **Auto-backup** of target's existing `<appId>/` if present, with `reason: PreCopy`. The backup must succeed before the copy proceeds.
4. **Two-phase copy**: copy source tree to `<targetParent>/<appId>.tmp_<uuid>/`. On success, atomically replace `<appId>/` with the temp dir (delete old, rename temp). On any mid-copy failure, delete the temp dir, restore from the PreCopy backup, surface the error.
5. Each `(sourceGame, targetAccount)` pair is a discrete unit. One failed pair does not abort the rest; the user gets a per-pair result list at the end.

## Restore Flow

Same shape:

1. Pre-flight checks (same as transfer).
2. Pre-restore safety backup of current target state, `reason: PreRestore`.
3. Wipe target `<appId>/` folder.
4. Extract zip contents.
5. Verify (manifest matches extracted tree). If verification fails, automatically restore from the PreRestore safety backup and surface the error.

## Backup Format

**Path:** `<AppData>/SteamConfigTransfer/backups/<steamId64>/<appId>/<timestamp>_<reason>.zip`

**Contents:** the `<appId>/` directory tree at the root of the zip, plus `manifest.json`:

```json
{
  "schema_version": 1,
  "created_at": "2026-05-05T18:00:00Z",
  "steam_id_64": "76561198000000000",
  "persona_name_at_backup": "example_persona",
  "app_id": 570,
  "game_name_at_backup": "Dota 2",
  "reason": "PreCopy",
  "source_path": "C:/Program Files (x86)/Steam/userdata/39734272/570",
  "byte_size": 12345678
}
```

`schema_version` lets us evolve the format without breaking old backups.

## Backup Retention

- Default: keep the last 20 per `(account, app_id)`. `Manual` backups are never auto-deleted.
- Configurable in Settings.
- Disk-space-based eviction is out of scope for v1.

## Theming

- shadcn CSS variables in `ui/app/globals.css` define `--background`, `--foreground`, `--primary`, etc. for `.light` and `.dark`.
- Custom `ThemeProvider` (`ui/app/providers/theme.tsx`) reads `prefers-color-scheme`, allows user override, persists choice to `localStorage`. Toggle (sun/moon) lives in the header.
- Tauri window background syncs at startup via `tauri-plugin-os` to prevent a white flash when launching in dark mode.
- Default accent: shadcn's `slate`. Easy to change later via `pnpm dlx shadcn theme`.

## Error Handling

**Rust (`core::error`)**: a single `AppError` enum with variants for each failure class (`SteamNotFound`, `SteamRunning`, `AccountNotFound`, `IoFailure`, `VdfParse`, `BackupFailed`, `Network`, `InsufficientDiskSpace`, `Cancelled`). Implements `serde::Serialize` so it crosses the IPC boundary cleanly. Every Tauri command returns `Result<T, AppError>`.

**Frontend**: thin wrapper in `ui/lib/tauri-client.ts` invokes commands and normalizes errors into a typed `AppError`. Top-level `ErrorBoundary` catches render errors. User-facing errors render via shadcn `Sonner` toasts; destructive operations (transfer, restore, delete) use `AlertDialog` for confirmation, never silent toasts.

## Testing

**Rust (`core/`)**: `cargo test`.

- VDF parsing fixtures.
- Path detection with `tempfile`-built fake `<Steam>` trees.
- Backup zip create/extract round-trip.
- Two-phase copy semantics with failure injection (verify rollback restores prior state byte-for-byte).
- Never reads or writes the user's real Steam install during tests.

**Frontend (`ui/`)**: Vitest + React Testing Library.

- Component-level tests for transfer flow, target multi-select, backup list filtering.
- The `tauri-client` wrapper is mockable so feature components test against fake account / game data.

**Manual smoke checklist** (`docs/manual-test.md`): real Steam install, real transfer between two test accounts, restore round-trip. Run before each release.

## Distribution & Auto-Updates

- `tauri build` produces an MSI and an NSIS installer. We ship the NSIS one (smaller, friendlier).
- Code signing is out of scope for v1. Users see SmartScreen on first run; this is documented in the README.
- **`tauri-plugin-updater`** wired up at app startup. Silent check on launch; non-modal toast if an update is available ("Update v1.2.0 available — Install now / Later"). User-initiated check from Settings.
- **Releases hosted on GitHub Releases.** A `latest.json` manifest in the latest release points at signed installer + signature URLs.
- **Update signing**: a Tauri update keypair (`tauri signer generate`). Public key in `core/tauri.conf.json`. Private key + password as GitHub Actions secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`); never committed.
- **CI release flow**: `.github/workflows/release.yml` triggered on tag push (`v*`). Uses `tauri-apps/tauri-action@v0` with `tagName`, `releaseName`, and signing secrets. Builds the NSIS installer, signs it, creates a draft GitHub release with the artifact + `latest.json`. Maintainer flips the draft to published.
- **Endpoint config** in `tauri.conf.json`:
  ```json
  "plugins": {
    "updater": {
      "endpoints": ["https://github.com/<owner>/<repo>/releases/latest/download/latest.json"],
      "pubkey": "<base64-public-key>"
    }
  }
  ```
- **Channel**: single stable channel for v1. A beta channel can be added later by introducing a second endpoint and a Settings toggle.
- **Rollback**: if a bad release ships, we yank the GitHub release. Users on the bad version stay on it until the next good release. Acceptable tradeoff for v1.

## Open Questions

None at design freeze. Items deferred to implementation phase:

- Whether to integrate `tauri-specta` for type-safe IPC bindings or hand-mirror types in TypeScript. Default: try `tauri-specta` first; fall back to hand-mirroring if it adds friction.
- Exact wording of the "Steam is running" guard dialog.
- Final accent color (slate is the default; can be swapped pre-launch).
