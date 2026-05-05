# Carry — agent context

Carry is a Windows-only desktop utility that copies Steam game config files (the contents of Steam's `userdata/<steamId32>/<appId>/` tree) between Steam accounts on the same machine, with automatic and manual backups and signed auto-updates via GitHub Releases.

Spec: `docs/superpowers/specs/2026-05-05-steam-config-transfer-design.md`
Plan: `docs/superpowers/plans/2026-05-05-steam-config-transfer.md`

## Stack

- **Tauri 2** (Rust) + **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** — CSS-first config in `ui/app/globals.css`. No `tailwind.config.js`.
- **shadcn/ui** primitives in `ui/components/ui/` — CLI-managed, never hand-edit
- **TanStack Query** for server state, **Zustand** for transfer-page selection state
- **react-router** v7
- **tauri-plugin-updater**, **-dialog**, **-shell**, **-os**

## Project layout

The default Tauri folders are renamed:

- `ui/` — React frontend, Bulletproof React structure (`app/`, `components/`, `features/`, `hooks/`, `lib/`, `stores/`, `types/`)
- `core/` — Rust backend (modules: `error`, `settings`, `steam/*`, `archive/*`, `sync/*`, `bridge/*`)
- `docs/superpowers/` — design spec + implementation plan
- `docs/manual-test.md` — pre-release smoke checklist

The Tauri CLI auto-discovers `core/tauri.conf.json` from the project root by walking subdirectories. We deliberately did **not** put `"tauri.configPath"` in `package.json` — that field is not part of the Tauri 2 schema.

## Key Rust modules (in `core/src/`)

- `error.rs` — single `AppError` enum with a custom `Serialize` impl emitting `{ code, message }`. Every Tauri command returns `AppResult<T>`.
- `settings/mod.rs` — JSON-backed `Settings` struct (steam_path_override, backup_retention_per_pair, last_update_check). Default retention: 20.
- `steam/install.rs` — registry + fallback Steam path detection (Windows-only `detect()`, cross-platform `validate_steam_root`).
- `steam/vdf.rs` — parses `loginusers.vdf` via `keyvalues_parser::parse(text)` (note: it's a free function, not `Vdf::parse`).
- `steam/accounts.rs` — combines login users with `userdata/<id32>/` to produce typed `Account`s.
- `steam/avatars.rs` — local cache lookup + Steam community profile XML fetch fallback (no API key).
- `steam/games.rs` — enumerates numeric `<appId>/` subdirectories under an account.
- `steam/metadata.rs` — `appdetails` API fetch with persistent JSON cache. Rate-limited (1.5s sleep per appId on first scan).
- `archive/manifest.rs` — `Manifest` + `BackupReason` (Manual, PreCopy, PreRestore). `schema_version = 1`.
- `archive/create.rs`, `list.rs`, `retention.rs`, `restore.rs` — zip-based backup/restore. Retention never deletes `Manual`.
- `sync/preflight.rs` — Steam-running detection (sysinfo), Windows `GetDiskFreeSpaceExW` for disk space.
- `sync/copy.rs` — `TwoPhaseCopy`: stage to `<target>.tmp_<uuid>`, then atomic rename swap with rollback on failure.
- `sync/transfer.rs` — orchestrates per-pair transfer: preflight → PreCopy backup → two-phase copy → retention prune.
- `bridge/state.rs` — `AppState` with `Mutex<Option<SteamInstall>>`, `Mutex<Settings>`, `reqwest::Client`.
- `bridge/commands.rs` — 14 Tauri commands. All registered in `lib.rs` `tauri::generate_handler!`.

## Frontend conventions

- All filesystem and network work happens in Rust; the frontend never touches the FS directly. We do **not** use `tauri-plugin-fs`.
- IPC arg keys are `camelCase` (Tauri auto-maps `steamId32` → Rust `steam_id_32`). Domain *field* shapes use `snake_case` because that's what Rust serde emits.
- All `invoke` calls go through `ui/lib/tauri-client.ts` `api` object, which normalizes errors into `{ code, message }` before re-throwing.
- shadcn-on-Tailwind-v4 needs a `@theme inline { --color-background: var(--background); ... }` block in `globals.css` to make `bg-background`, `border-border`, etc. compile.
- `ThemeProvider` is custom (no `next-themes`) with a pre-paint script in `index.html` to prevent flash-of-light on dark-mode launch. localStorage key: `carry.theme`.

## Build & test

Linux dev needs the Tauri WebKit deps once (passwordless sudo not available, so the user runs this):

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libdbus-1-dev librsvg2-dev libgtk-3-dev libsoup-3.0-dev build-essential
```

Then from the project root:

- `pnpm tauri:dev` — launches the desktop window (when not headless)
- `pnpm build` — frontend production build (TS check + Vite)
- `cd core && cargo test` — 25 Rust unit tests
- `cd core && cargo check` — type/borrow check the Rust crate

## Release

- Tag push (`v*`) triggers `.github/workflows/release.yml` which uses `tauri-apps/tauri-action@v0` to build, sign, and draft a GitHub release.
- Tauri update signing key is generated once via `pnpm tauri signer generate`. Public key lives in `core/tauri.conf.json` `plugins.updater.pubkey`. Private key + password are GHA secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Bundle identifier: `com.weedgrease.carry`. Cargo package: `carry`. Lib: `carry_lib`.

## Intentional non-goals (v1)

- macOS / Linux builds — Windows-only
- Steam Web API integration — 100% offline-first + public CDN
- Account switching (TcNo's main feature — explicitly excluded)
- Cloud-stored backups
- Selective sub-file copy within a game's config tree
- Telemetry
- Beta / nightly update channel
- In-app rollback to a prior version

## Gotchas

- `keyvalues-parser` 0.2.x: use `keyvalues_parser::parse(text)`, not `Vdf::parse(text)`.
- Tauri scaffold's `tauri-plugin-opener` was removed; if you re-scaffold or upgrade Tauri, double-check `core/src/lib.rs` and `core/capabilities/default.json` don't reintroduce references to it.
- Linux fallback for `GetDiskFreeSpaceExW` returns `u64::MAX` so the disk-space preflight trivially passes during dev. Real check happens on Windows.
- `is_steam_running` looks for both `steam.exe` and `steam` process names. Transfer tests on Linux only work when no `steam` process is running.
- We use `BackupFailed(String)` as a generic carrier for updater errors. If a dedicated `Updater` variant gets added later, update `check_for_update` and `install_update`.
- `tauri-plugin-dialog`'s `pick_folder` callback is `FnOnce(Option<FilePath>)`; `FilePath::into_path()` returns `Result<PathBuf>`.
- shadcn CLI's `--base-color` flag was removed in recent versions; the manual `components.json` approach is what we use.

## Status

All 35 plan tasks are implemented on branch `feat/initial-implementation`. 25/25 Rust tests pass; `pnpm build` is clean. Real Steam testing must happen on Windows before tagging v0.1.0.
