#!/usr/bin/env bash
#
# Cross-compile a portable Windows .exe of Carry from Linux/WSL2 using cargo-xwin.
# Output: core/target/x86_64-pc-windows-msvc/release/carry.exe
#
# Caveats:
#  - Produces the bare binary, NOT the NSIS/MSI installer (those require a Windows
#    runner because the bundling step uses Windows-side tooling). For installers,
#    use the GitHub Release workflow.
#  - The .exe needs WebView2 runtime on the target Windows machine. Windows 11 and
#    recent Windows 10 ship with it; older Windows may need the bootstrapper.
#

set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Make sure the Windows MSVC target is installed
if ! rustup target list --installed | grep -q '^x86_64-pc-windows-msvc$'; then
  echo "Installing rustup target x86_64-pc-windows-msvc..."
  rustup target add x86_64-pc-windows-msvc
fi

# 2. Make sure cargo-xwin is installed
if ! command -v cargo-xwin >/dev/null 2>&1; then
  echo "Installing cargo-xwin..."
  cargo install cargo-xwin
fi

# 3. Frontend production build (Tauri embeds it at build time)
echo ">>> pnpm build (frontend)"
pnpm build

# 4. Cross-compile the Tauri Rust binary
echo ">>> cargo xwin build --release --target x86_64-pc-windows-msvc"
( cd core && cargo xwin build --release --target x86_64-pc-windows-msvc )

EXE="core/target/x86_64-pc-windows-msvc/release/carry.exe"
if [ ! -f "$EXE" ]; then
  echo "ERROR: expected $EXE but file does not exist." >&2
  exit 1
fi

# 5. Zip it as a portable artifact
VERSION=$(node -p "require('./package.json').version")
OUT_ZIP="carry-${VERSION}-portable.zip"
( cd "core/target/x86_64-pc-windows-msvc/release" && \
  zip -j "$OLDPWD/$OUT_ZIP" carry.exe >/dev/null )

echo ""
echo "==================================="
echo "  Portable Windows .exe built:"
echo "    $EXE"
echo "  Zipped:"
echo "    $OUT_ZIP"
echo "==================================="
