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

# 3. Verify clang-cl + lld-link are on PATH (cargo-xwin invokes them by name and
#    overrides any CC_* env we'd export from this shell, so versioned-binary
#    fallback doesn't help — they actually have to be installed unversioned).
if ! command -v clang-cl >/dev/null 2>&1 || ! command -v lld-link >/dev/null 2>&1; then
  CLANG_VER=$(ls /usr/bin/clang-cl-* 2>/dev/null | sed -n 's|.*/clang-cl-||p' | sort -n | tail -1)
  echo "ERROR: clang-cl and lld-link must be on PATH." >&2
  if [ -n "${CLANG_VER:-}" ]; then
    echo "Found versioned binaries — wire them up with update-alternatives:" >&2
    echo "    sudo update-alternatives --install /usr/bin/clang-cl clang-cl /usr/bin/clang-cl-$CLANG_VER 100" >&2
    echo "    sudo update-alternatives --install /usr/bin/lld-link lld-link /usr/bin/lld-link-$CLANG_VER 100" >&2
  else
    echo "Install clang + lld first:" >&2
    echo "    sudo apt install -y clang-21 lld-21" >&2
    echo "  Then wire up unversioned names with update-alternatives." >&2
  fi
  exit 1
fi

# 4. Build via the Tauri CLI with cargo-xwin as the cargo runner. We skip the
#    NSIS/MSI bundlers (--bundles none) since those need Windows-side tooling.
#    The Tauri CLI handles `pnpm build` (beforeBuildCommand), the
#    generate_context!() asset embedding, and the release-mode flags so the
#    resulting .exe loads embedded frontend assets instead of falling back to
#    devUrl. (Bare `cargo xwin build` skips that wiring and produces an .exe
#    that tries to load http://localhost:1420 at startup.)
echo ">>> pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles none"
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles none

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
