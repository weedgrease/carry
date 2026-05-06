<div align="center">

# carry

**Move Steam game configs between accounts on the same machine — automatically backed up before every change.**

[![Latest release](https://img.shields.io/github/v/release/weedgrease/carry?include_prereleases&display_name=tag&label=release)](https://github.com/weedgrease/carry/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d4.svg)](#install)

</div>

---

Steam doesn't let you share game configs — keybinds, video settings, hotkey layouts, anything else under `userdata/<id>/<appId>/` — across the multiple Steam accounts you might own. carry does, safely.

Pick a source account. Pick the games whose configs you want to copy. Pick one or more target accounts. carry takes a backup of every existing target config before overwriting it, so a transfer you regret is two clicks away from being undone.

## Highlights

- **Multi-account, multi-game transfers** in a single click
- **Automatic backups before every overwrite** — both the target's existing config (`PreCopy`) and the source side (`Source`) are zipped to `%APPDATA%\SteamConfigTransfer\backups\` before any write
- **Restore with rollback** — restoring a backup creates a `PreRestore` safety snapshot first, so even an undo is undoable
- **Manual backups** — snapshot any (account, game) pair on demand
- **Real Steam profile pictures and game cover art** — pulled from Steam's local avatar cache and public CDN. No API keys, no logins.
- **Signed auto-updates** via GitHub Releases — the app verifies each update's signature before installing
- **Custom title bar, light + dark mode, responsive layout** — feels like a native app, not a browser pretending to be one
- **Offline-first** — carry only hits the network to (a) fetch a profile picture for an account that hasn't logged in on this machine, or (b) fetch a game's display name + header art on first scan. Both cached forever

## What carry doesn't touch

This is a tool that writes to your Steam install. It earns trust by being narrow:

- `loginusers.vdf` is **read-only**. carry never adds, removes, or edits Steam accounts. If an account "disappears" from the list, Steam itself removed it (e.g. you signed out).
- During a transfer, the **source account's userdata is read-only** — only the target's `<id32>/<appId>/` folder gets written.
- Other accounts' userdata folders are **untouched** during a transfer — only the specific targets you select.
- Games you didn't tick are **untouched**.
- **No telemetry. No analytics. No phoning home.** Network access is limited to Steam's public endpoints listed above.

Every destructive write is preceded by a backup, and `Manual` backups are never auto-deleted regardless of retention settings.

## Install

Download the latest release for Windows:

➡️ [**github.com/weedgrease/carry/releases/latest**](https://github.com/weedgrease/carry/releases/latest)

| File | When to use |
|---|---|
| `carry_<version>_x64-setup.exe` | NSIS installer — typical "next-next-finish" wizard |
| `carry_<version>_x64_en-US.msi` | MSI installer — for IT / silent installs |
| `carry-<version>-portable.zip` | Bare `.exe`, no installer — extract anywhere |

> **First-run note:** the installer isn't yet code-signed for Windows SmartScreen, so on first launch you'll see a warning. Click "More info" → "Run anyway". Update signatures (Tauri's signing key, separate from Microsoft's code signing) are verified automatically and protect you on every subsequent update.

After install, carry checks for updates on launch and prompts you when one is available. Updates are signed and verified before installation.

## Usage

1. **Open carry.** It auto-detects your Steam install via the Windows registry. If it can't find Steam, set the path under Settings → Steam install path.
2. **Transfer page → pick a source account.** The Games section reveals once a source is chosen.
3. **Pick the games you want to copy.** Cards show real Steam header art for known apps. Internal Steam apps (the Steam client itself, Steam Input, etc.) are filtered out by default — toggle "Hide untitled apps" in Settings if you want to see them.
4. **Pick one or more target accounts.** Source is hidden from the targets list automatically.
5. **Click Transfer.** A confirmation dialog summarizes what will happen, then a results dialog shows per-pair outcomes.
6. **Need to roll back?** Backups page → pick the affected account → click ⋯ on a row → Restore.

## Build from source

Requires [Rust](https://rustup.rs/) (stable), [pnpm](https://pnpm.io/), Node 20+. Clone the repo:

```bash
git clone https://github.com/weedgrease/carry.git
cd carry
pnpm install
```

### Run in development

```bash
pnpm tauri:dev
```

On Linux/WSL hosts, you'll need Tauri's WebKit toolchain once:

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libdbus-1-dev librsvg2-dev libgtk-3-dev libsoup-3.0-dev build-essential
```

### Build a release artifact

```bash
pnpm tauri:build
```

Produces NSIS + MSI installers in `core/target/release/bundle/`.

### Cross-compile a portable Windows .exe from Linux/WSL

```bash
# one-time toolchain setup
sudo apt install -y clang-21 lld-21 llvm-21
sudo update-alternatives --install /usr/bin/clang-cl  clang-cl  /usr/bin/clang-cl-21  100
sudo update-alternatives --install /usr/bin/lld-link  lld-link  /usr/bin/lld-link-21  100
sudo update-alternatives --install /usr/bin/llvm-lib  llvm-lib  /usr/bin/llvm-lib-21  100

# build
pnpm build:windows-portable
```

Outputs `core/target/x86_64-pc-windows-msvc/release/carry.exe` plus a zipped `carry-<version>-portable.zip` at the project root.

### Run the test suite

```bash
cd core && cargo test    # 33+ Rust unit tests
pnpm build               # frontend type check + production build
```

## Tech stack

- **[Tauri 2](https://tauri.app)** — Rust-backed native desktop runtime
- **[React 19](https://react.dev)** + **[TypeScript](https://www.typescriptlang.org)** + **[Vite](https://vite.dev)**
- **[Tailwind CSS v4](https://tailwindcss.com)** + **[shadcn/ui](https://ui.shadcn.com)**
- **[TanStack Query](https://tanstack.com/query)** for server state, **[Zustand](https://zustand-demo.pmnd.rs)** for client state
- **[react-router](https://reactrouter.com) v7** for routing
- Rust crates: `tauri-plugin-updater`, `keyvalues-parser`, `walkdir`, `zip`, `reqwest`, `quick-xml`, `winreg`, `sysinfo`, `chrono`, `uuid`, `serde`, `tokio`, `thiserror`

## Releasing (maintainers)

Releases are cut from the GitHub Actions UI:

1. **Actions → Release → Run workflow**
2. Pick `patch` / `minor` / `major` (or paste an explicit version)
3. **Run workflow**

The workflow bumps `package.json`, `core/tauri.conf.json`, and `core/Cargo.toml`, commits the bump, tags it, then builds + signs the Windows installer + portable .zip and drafts a GitHub release. Review and click **Publish**.

### One-time signing setup

```bash
pnpm tauri signer generate -w ~/.tauri/carry.key
chmod 600 ~/.tauri/carry.key
```

Paste the **public** key from `~/.tauri/carry.key.pub` into `core/tauri.conf.json` `plugins.updater.pubkey`. Set the **private** key contents and password as repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY` — full contents of `~/.tauri/carry.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password used when generating the key

The public key is committed to the repo *by design* — that's how every installed copy of carry verifies that an update was genuinely signed by you. The private key is the only secret.

## Contributing

Bug reports and feature requests are welcome via [Issues](https://github.com/weedgrease/carry/issues). For non-trivial changes, please open an issue first to discuss.

## License

[MIT](LICENSE) © 2026 Kevin Murphy
