# Steam Config Transfer

Windows desktop utility for copying Steam game configs between accounts on the same machine, with automatic and manual backups, and signed auto-updates via GitHub Releases.

## Tech stack

- Tauri 2 (Rust) + React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui
- Zustand + TanStack Query
- tauri-plugin-updater for auto-updates

## Project structure

- `ui/` — React frontend (Bulletproof React layout)
- `core/` — Rust backend (Tauri commands, Steam discovery, backup/restore, sync)
- `docs/superpowers/` — design spec + implementation plan

## Local development

Linux dev hosts must install Tauri's WebKit deps once:

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libdbus-1-dev librsvg2-dev libgtk-3-dev libsoup-3.0-dev build-essential
```

Then:

```bash
pnpm install
pnpm tauri:dev   # launches the desktop window
pnpm build       # frontend production build
cd core && cargo test  # Rust unit tests
```

## Release process

1. Bump version in `package.json` and `core/tauri.conf.json` (`version` field).
2. Replace the placeholders in `core/tauri.conf.json` `plugins.updater`:
   - `REPLACE_OWNER` → your GitHub username/org
   - `REPLACE_WITH_BASE64_PUBLIC_KEY` → output of `pnpm tauri signer generate`
3. Tag and push:
   ```bash
   git tag v0.1.0
   git push --tags
   ```
4. GitHub Actions builds, signs, and drafts a release. Edit and publish.

## Required secrets

For the Release workflow:

- `TAURI_SIGNING_PRIVATE_KEY` — output of `pnpm tauri signer generate`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password used for the keypair

## Distribution caveat

v1 ships unsigned. Windows SmartScreen will warn the user on first run. Click "More info" → "Run anyway" to install. Code signing can be added later.

## Status

See `docs/superpowers/specs/2026-05-05-steam-config-transfer-design.md` for the full design and v1 scope (and explicit non-goals).
