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

# 3. Locate clang-cl + lld-link. Prefer unversioned (e.g. apt's `clang` meta-package
#    or update-alternatives); otherwise fall back to the highest installed
#    `clang-cl-N` / `lld-link-N` pair we can find.
if command -v clang-cl >/dev/null 2>&1 && command -v lld-link >/dev/null 2>&1; then
  : # unversioned binaries exist on PATH; cargo-xwin's defaults will work
else
  CLANG_VER=$(ls /usr/bin/clang-cl-* 2>/dev/null | sed -n 's|.*/clang-cl-||p' | sort -n | tail -1)
  if [ -z "${CLANG_VER:-}" ]; then
    echo "ERROR: clang-cl is not installed. Install with:" >&2
    echo "    sudo apt install clang-21 lld-21" >&2
    echo "  (or use the highest version your distro has)" >&2
    exit 1
  fi
  if ! command -v "lld-link-$CLANG_VER" >/dev/null 2>&1; then
    echo "ERROR: clang-cl-$CLANG_VER is installed but lld-link-$CLANG_VER is not." >&2
    echo "    sudo apt install lld-$CLANG_VER" >&2
    exit 1
  fi
  echo ">>> Using clang-cl-$CLANG_VER + lld-link-$CLANG_VER"
  export CC_x86_64_pc_windows_msvc="clang-cl-$CLANG_VER"
  export CXX_x86_64_pc_windows_msvc="clang-cl-$CLANG_VER"
  export CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER="lld-link-$CLANG_VER"
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
