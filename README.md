# Carry

A Windows desktop utility that transfers Steam game configs between accounts on the same machine, with automatic and manual backups and signed auto-updates via GitHub Releases.

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

Before the first release, generate the Tauri update signing key:

```bash
pnpm tauri signer generate -w ~/.tauri/carry.key
```

Paste the printed **public key** into `core/tauri.conf.json` at `plugins.updater.pubkey` (currently `REPLACE_WITH_BASE64_PUBLIC_KEY`). Save the **private key** to GitHub Actions secrets as `TAURI_SIGNING_PRIVATE_KEY` and the password as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

To cut a release:

1. Bump `version` in `package.json` and `core/tauri.conf.json`.
2. Tag and push:
   ```bash
   git tag v0.1.0
   git push --tags
   ```
3. GitHub Actions builds, signs, and drafts a release at <https://github.com/weedgrease/carry/releases>. Edit and publish.

## Required secrets

For the Release workflow:

- `TAURI_SIGNING_PRIVATE_KEY` — output of `pnpm tauri signer generate`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password used for the keypair

## Distribution caveat

v1 ships unsigned. Windows SmartScreen will warn the user on first run. Click "More info" → "Run anyway" to install. Code signing can be added later.

## Status

All 35 implementation tasks are complete on `feat/initial-implementation`. The Rust unit suite (25 tests) is green; `pnpm build` is clean. Real Steam end-to-end testing must happen on Windows before tagging v0.1.0.

See `docs/superpowers/specs/2026-05-05-steam-config-transfer-design.md` for the full design and v1 scope (and explicit non-goals). For an at-a-glance project overview optimized for AI assistants, see `CLAUDE.md`.
