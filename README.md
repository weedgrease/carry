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

Releases are cut from the GitHub Actions UI — no local tagging or version bumping needed.

1. Go to **Actions → Release → Run workflow** at <https://github.com/weedgrease/carry/actions/workflows/release.yml>.
2. Pick the bump type (`patch`, `minor`, `major`) — or paste an explicit version (e.g., `1.0.0`) to override.
3. Click **Run workflow**.

The workflow:

- Bumps `package.json`, `core/tauri.conf.json`, and `core/Cargo.toml` to the new version
- Commits as `chore(release): vX.Y.Z`
- Creates and pushes the matching `vX.Y.Z` tag
- Builds the Windows installer on a Windows runner
- Signs it with the Tauri update key
- Drafts a release at <https://github.com/weedgrease/carry/releases> — review and click **Publish** when ready

### One-time setup for releases

Generate the Tauri update signing key:

```bash
pnpm tauri signer generate -w ~/.tauri/carry.key
chmod 600 ~/.tauri/carry.key
```

Paste the public key (from `~/.tauri/carry.key.pub`) into `core/tauri.conf.json` at `plugins.updater.pubkey`. Add these repo secrets at <https://github.com/weedgrease/carry/settings/secrets/actions>:

- `TAURI_SIGNING_PRIVATE_KEY` — full contents of `~/.tauri/carry.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password used when generating the key

Back up both somewhere safe (password manager). If you lose them, you can't issue updates that older installs of Carry will accept.

## Distribution caveat

v1 ships unsigned. Windows SmartScreen will warn the user on first run. Click "More info" → "Run anyway" to install. Code signing can be added later.

## Status

All 35 implementation tasks are complete on `feat/initial-implementation`. The Rust unit suite (25 tests) is green; `pnpm build` is clean. Real Steam end-to-end testing must happen on Windows before tagging v0.1.0.

See `docs/superpowers/specs/2026-05-05-steam-config-transfer-design.md` for the full design and v1 scope (and explicit non-goals). For an at-a-glance project overview optimized for AI assistants, see `CLAUDE.md`.
