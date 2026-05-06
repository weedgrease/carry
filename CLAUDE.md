# Carry — agent context

Carry is a Windows desktop utility that copies Steam game config files (the contents of Steam's `userdata/<steamId32>/<appId>/` tree) between Steam accounts on the same machine, with automatic and manual backups and signed auto-updates via GitHub Releases.

The user-facing README is the canonical description of what the app does and how to install/build it. This file exists to give an AI assistant the architectural lay of the land.

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
- `scripts/` — local-dev shell scripts (e.g. `build-windows-portable.sh`)
- `.github/workflows/` — release CI

The Tauri CLI auto-discovers `core/tauri.conf.json` from the project root by walking subdirectories. We deliberately did **not** put `"tauri.configPath"` in `package.json` — that field is not part of the Tauri 2 schema.

## Key Rust modules (in `core/src/`)

- `error.rs` — single `AppError` enum with a custom `Serialize` impl emitting `{ code, message }`. Every Tauri command returns `AppResult<T>`.
- `settings/mod.rs` — JSON-backed `Settings` struct (`steam_path_override`, `backup_retention_per_pair`, `last_update_check`, `hide_untitled_apps`). Default retention: 20. Default `hide_untitled_apps`: true.
- `steam/install.rs` — registry + fallback Steam path detection (Windows-only `detect()`, cross-platform `validate_steam_root`).
- `steam/vdf.rs` — parses `loginusers.vdf` via `keyvalues_parser::parse(text)` (note: it's a free function, not `Vdf::parse`).
- `steam/accounts.rs` — combines login users with `userdata/<id32>/` to produce typed `Account`s. Computes `display_name` with a `persona_name → account_name → "Steam ID …"` fallback.
- `steam/avatars.rs` — local Steam avatar cache lookup + Steam community profile XML fetch fallback (no API key). Falls back through `avatarFull → avatarMedium → avatarIcon` URLs.
- `steam/games.rs` — enumerates numeric `<appId>/` subdirectories under an account. Filters a `STEAM_INTERNAL_APP_IDS` deny-list (currently `7, 760, 241100, 744350`).
- `steam/metadata.rs` — `appdetails` API fetch with persistent JSON cache. Rate-limited (1.5s sleep per appId on first scan). `is_known: bool` distinguishes apps with public Steam store entries.
- `archive/manifest.rs` — `Manifest` + `BackupReason` (`Manual`, `PreCopy`, `PreRestore`, `Source`). `schema_version = 1`.
- `archive/create.rs`, `list.rs`, `retention.rs`, `restore.rs` — zip-based backup/restore. Retention auto-prunes everything except `Manual` per `(account, game)`.
- `sync/preflight.rs` — Steam-running detection (sysinfo), Windows `GetDiskFreeSpaceExW` for disk space. Steam-running check is no longer enforced in the transfer/restore paths but the function is kept `pub` for future use (e.g. soft warnings).
- `sync/copy.rs` — `TwoPhaseCopy`: stage to `<target>.tmp_<uuid>`, then atomic rename swap with rollback on failure.
- `sync/transfer.rs` — orchestrates per-pair transfer: source-side `Source` snapshot (deduped per `(source, app_id)`) → target's `PreCopy` backup → two-phase copy → retention prune.
- `bridge/state.rs` — `AppState` with `Mutex<Option<SteamInstall>>`, `Mutex<Settings>`, `reqwest::Client`.
- `bridge/commands.rs` — 16 Tauri commands. All registered in `lib.rs` `tauri::generate_handler!`. `list_games` filters by `Settings.hide_untitled_apps` when on.

## Frontend conventions

- All filesystem and network work happens in Rust; the frontend never touches the FS directly. We do **not** use `tauri-plugin-fs`. Asset protocol is enabled (`app.security.assetProtocol`) so `convertFileSrc()` can serve avatar PNGs from arbitrary Steam paths.
- IPC arg keys are `camelCase` (Tauri auto-maps `steamId32` → Rust `steam_id_32`). Domain *field* shapes use `snake_case` because that's what Rust serde emits.
- All `invoke` calls go through `ui/lib/tauri-client.ts` `api` object, which normalizes errors into `{ code, message }` before re-throwing.
- shadcn-on-Tailwind-v4 needs a `@theme inline { --color-background: var(--background); ... }` block in `globals.css` (including `--popover` / `--popover-foreground` for `DropdownMenuContent` and `SelectContent`).
- Custom title bar: window decorations are off (`tauri.conf.json` `app.windows[0].decorations: false`). The app `Header` is a `data-tauri-drag-region` and contains custom Minimize/Maximize/Close buttons via `@tauri-apps/api/window`. Capabilities (`core/capabilities/default.json`) explicitly grant `core:window:allow-{close, minimize, maximize, unmaximize, toggle-maximize, start-dragging}`.
- `ThemeProvider` is custom (no `next-themes`) with a pre-paint script in `index.html` to prevent flash-of-light on dark-mode launch. localStorage key: `carry.theme`.
- Page layout pattern: every page is a vertical canvas of `<Section title="…" description="…">` blocks. `AccountGrid` (single or multi mode) is the shared "pick an account" primitive used in three places: Transfer source, Transfer targets, Backups account picker.

## Build & test

Linux dev needs the Tauri WebKit deps once:

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libdbus-1-dev librsvg2-dev libgtk-3-dev libsoup-3.0-dev build-essential
```

Cross-compile to Windows from Linux/WSL needs a versioned LLVM toolchain (the unversioned `clang` apt meta-package may not install on dev releases — use specific versions and `update-alternatives`). See `scripts/build-windows-portable.sh` for the full setup.

Day-to-day:

- `pnpm tauri:dev` — launches the desktop window (uses WSLg on WSL2)
- `pnpm build` — frontend production build (TS check + Vite, lazy-loaded routes)
- `pnpm build:windows-portable` — cross-compile portable .exe via `cargo-xwin`
- `cd core && cargo test` — Rust unit tests (33+ today)
- `cd core && cargo check` — type/borrow check the Rust crate

## Release

- Releases are cut from the GitHub Actions UI (`Actions → Release → Run workflow`) with a `patch`/`minor`/`major` choice or explicit version.
- The workflow bumps `package.json`, `core/tauri.conf.json`, and `core/Cargo.toml`, commits, tags, then builds + signs the Windows installer + portable zip.
- Tauri update signing key generated once via `pnpm tauri signer generate -w ~/.tauri/carry.key`. Public key in `core/tauri.conf.json` `plugins.updater.pubkey` (committed; this is correct — public keys are *meant* to be public). Private key + password as GHA secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Bundle identifier: `com.weedgrease.carry`. Cargo package: `carry`. Lib: `carry_lib`.

## Intentional non-goals (v1)

- macOS / Linux builds — Windows-only
- Steam Web API integration — 100% offline-first + public CDN
- Account switching (TcNo's main feature — explicitly excluded)
- Cloud-stored backups
- Selective sub-file copy within a game's config tree
- Telemetry
- Beta / nightly update channel
- In-app rollback to a prior app version

## Gotchas

- `keyvalues-parser` 0.2.x: use `keyvalues_parser::parse(text)`, not `Vdf::parse(text)`.
- Tauri scaffold's `tauri-plugin-opener` was removed; if you re-scaffold or upgrade Tauri, double-check `core/src/lib.rs` and `core/capabilities/default.json` don't reintroduce references to it.
- Linux fallback for `GetDiskFreeSpaceExW` returns `u64::MAX` so the disk-space preflight trivially passes during dev. Real check happens on Windows.
- We use `BackupFailed(String)` as a generic carrier for updater errors. If a dedicated `Updater` variant gets added later, update `check_for_update` and `install_update`.
- `tauri-plugin-dialog`'s `pick_folder` callback is `FnOnce(Option<FilePath>)`; `FilePath::into_path()` returns `Result<PathBuf>`.
- shadcn CLI's `--base-color` flag was removed in recent versions; the manual `components.json` approach is what we use.
- `cargo-xwin` hardcodes `clang-cl` / `lld-link` / `llvm-lib` as unversioned binary names — env-var overrides like `CC_x86_64_pc_windows_msvc=clang-cl-21` are clobbered before cargo runs. Use `update-alternatives` to provide unversioned symlinks.
- The settings asset-protocol scope is broad (`["**"]`) because the Steam install path is user-configurable. Tighten only if a security review demands it.
