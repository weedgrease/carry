# Steam Config Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop utility (Tauri 2 + React + shadcn) that copies Steam game configs between accounts on the same machine, with automatic and manual backups, signed GitHub Releases auto-updates, and a Bulletproof React frontend layout.

**Architecture:** Tauri 2 with the default `src/` and `src-tauri/` directories renamed to `ui/` and `core/`. All filesystem and network work happens in Rust; the frontend is a thin client over Tauri commands. Bulletproof React structure organizes the UI by feature; shadcn primitives live in `ui/components/ui/` and are CLI-managed. Steam discovery is offline-first (registry + local VDF parsing + local avatar cache) with a single public-CDN fallback for game metadata.

**Tech Stack:** Tauri 2, React 19, TypeScript 5, Vite 6, shadcn/ui, Tailwind CSS v4, Zustand, react-router v7, keyvalues-parser, walkdir, zip, serde, tokio, reqwest, winreg, thiserror, chrono, uuid, sysinfo.

**Reference spec:** `docs/superpowers/specs/2026-05-05-steam-config-transfer-design.md`

---

## Phase 0 — Scaffolding & Frontend Shell

### Task 0.1: Scaffold Tauri 2 project

**Files:**
- Create: project root files (`package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/`, `src-tauri/`)

- [ ] **Step 1: Create project**

Run from inside `/home/kevin/repositories/steam-config-transfer`:

```bash
pnpm create tauri-app@latest . --template react-ts --manager pnpm --identifier com.kevinmurphy.steamconfigtransfer --yes
pnpm install
```

When prompted with "directory is not empty" (because of `docs/`), accept and continue.

- [ ] **Step 2: Verify scaffold runs**

```bash
pnpm tauri dev
```

Expected: Tauri opens a window showing the default Tauri+React greeting. Close it once confirmed.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri 2 + React + TS project"
```

---

### Task 0.2: Rename `src` → `ui` and `src-tauri` → `core`

**Files:**
- Rename: `src/` → `ui/`, `src-tauri/` → `core/`
- Modify: `index.html`, `vite.config.ts`, `package.json`, `core/tauri.conf.json`, `core/Cargo.toml`

- [ ] **Step 1: Rename directories**

```bash
git mv src ui
git mv src-tauri core
```

- [ ] **Step 2: Update `index.html` script src**

Change `<script type="module" src="/src/main.tsx"></script>` to `<script type="module" src="/ui/main.tsx"></script>`.

- [ ] **Step 3: Update `vite.config.ts`**

Replace the file with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "ui") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/core/**"] },
  },
  build: {
    outDir: "dist",
  },
}));
```

- [ ] **Step 4: Update `core/tauri.conf.json`**

Set `build.frontendDist` to `"../dist"` and ensure `build.devUrl` is `"http://localhost:1420"`. Set `build.beforeDevCommand` to `"pnpm dev"` and `build.beforeBuildCommand` to `"pnpm build"`.

- [ ] **Step 5: Update `package.json` scripts**

Replace the `scripts` block with:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

- [ ] **Step 6: Update `tsconfig.json`**

Set `include` to `["ui"]`. Add to `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["ui/*"] }
```

- [ ] **Step 7: Verify**

```bash
pnpm tauri:dev
```

Expected: app launches as before. Close.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: rename src→ui and src-tauri→core"
```

---

### Task 0.3: Bulletproof React directory structure

**Files:**
- Create: `ui/app/`, `ui/app/providers/`, `ui/components/layout/`, `ui/config/`, `ui/features/accounts/`, `ui/features/library/`, `ui/features/transfer/`, `ui/features/backups/`, `ui/features/settings/`, `ui/hooks/`, `ui/lib/`, `ui/stores/`, `ui/types/`, `ui/assets/`

- [ ] **Step 1: Create directories with `.gitkeep`**

```bash
cd /home/kevin/repositories/steam-config-transfer
for d in app app/providers components/layout config features/accounts features/library features/transfer features/backups features/settings hooks lib stores types assets; do
  mkdir -p "ui/$d"
  touch "ui/$d/.gitkeep"
done
```

- [ ] **Step 2: Move existing scaffold files**

Move `ui/main.tsx` and `ui/App.tsx` to follow the new structure: `ui/main.tsx` stays at the top level (it's the Vite entry); `ui/App.tsx` becomes `ui/app/App.tsx`.

```bash
git mv ui/App.tsx ui/app/App.tsx
```

Update `ui/main.tsx` import: change `import App from "./App"` to `import App from "./app/App"`.

- [ ] **Step 3: Verify**

```bash
pnpm tauri:dev
```

Expected: app still launches. Close.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: set up Bulletproof React directory structure"
```

---

### Task 0.4: Install Tailwind CSS v4 + shadcn

**Files:**
- Create: `ui/app/globals.css`, `components.json`
- Modify: `ui/main.tsx`, `vite.config.ts`, `package.json`

- [ ] **Step 1: Install Tailwind v4 + Vite plugin**

```bash
pnpm add -D tailwindcss@latest @tailwindcss/vite@latest
```

- [ ] **Step 2: Update `vite.config.ts`** to include the Tailwind plugin

Add `import tailwindcss from "@tailwindcss/vite";` at the top and add `tailwindcss()` to the `plugins` array next to `react()`.

- [ ] **Step 3: Create `ui/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.985 0 0);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --radius: 0.625rem;
  }

  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.396 0.141 25.723);
    --destructive-foreground: oklch(0.985 0 0);
    --border: oklch(0.269 0 0);
    --input: oklch(0.269 0 0);
    --ring: oklch(0.439 0 0);
  }

  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}
```

- [ ] **Step 4: Import globals.css in `ui/main.tsx`**

Add `import "./app/globals.css";` and remove the existing `import "./App.css"` (delete `ui/App.css` too).

- [ ] **Step 5: Run shadcn init**

```bash
pnpm dlx shadcn@latest init
```

Answers when prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes
- Tailwind CSS file: `ui/app/globals.css`
- Components alias: `@/components`
- Utils alias: `@/lib/utils`
- React Server Components: No

This creates `components.json` and `ui/lib/utils.ts`.

- [ ] **Step 6: Verify dark mode swap works**

In `ui/app/App.tsx`, temporarily set the root div's `className` to `"min-h-screen p-8"` and test toggling `<html class="dark">` from devtools. The background and text should invert.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: install Tailwind v4 and shadcn with light/dark CSS variables"
```

---

### Task 0.5: Add core shadcn components

**Files:**
- Created by CLI: `ui/components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `sonner.tsx`, `table.tsx`, `tabs.tsx`, `checkbox.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `tooltip.tsx`, `avatar.tsx`, `badge.tsx`, `progress.tsx`, `scroll-area.tsx`

- [ ] **Step 1: Add components**

```bash
pnpm dlx shadcn@latest add button card dialog alert-dialog dropdown-menu sonner table tabs checkbox input label select tooltip avatar badge progress scroll-area
```

- [ ] **Step 2: Install sonner peer dep if prompted**

If shadcn asks, install `sonner` directly:

```bash
pnpm add sonner
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: TypeScript compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add core shadcn UI primitives"
```

---

### Task 0.6: Theme provider + system theme sync

**Files:**
- Create: `ui/app/providers/theme-provider.tsx`, `ui/components/layout/theme-toggle.tsx`
- Modify: `ui/main.tsx`, `ui/app/App.tsx`

- [ ] **Step 1: Write theme provider**

Create `ui/app/providers/theme-provider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "steam-config-transfer.theme";

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(theme));

  useEffect(() => {
    const root = document.documentElement;
    const next = resolve(theme);
    root.classList.toggle("dark", next === "dark");
    setResolved(next);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      setResolved(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: Pre-paint script in `index.html`**

Insert this `<script>` tag just inside `<head>` (before any stylesheet) to avoid a flash of light when launching in dark mode:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem("steam-config-transfer.theme");
      var theme = stored || "system";
      var resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
          : theme;
      if (resolved === "dark") document.documentElement.classList.add("dark");
    } catch (e) {}
  })();
</script>
```

- [ ] **Step 3: Wire provider in `ui/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ThemeProvider } from "./app/providers/theme-provider";
import "./app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 4: Add theme toggle component**

Create `ui/components/layout/theme-toggle.tsx`:

```tsx
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/app/providers/theme-provider";

export function ThemeToggle() {
  const { setTheme, resolved } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          {resolved === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="size-4 mr-2" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="size-4 mr-2" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="size-4 mr-2" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Install lucide-react**

```bash
pnpm add lucide-react
```

- [ ] **Step 6: Smoke test**

```bash
pnpm tauri:dev
```

Expected: app launches; toggling theme via the button (once we add it to App in next task) cycles light/dark/system. For now just confirm no runtime errors. Close.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: theme provider with system sync and pre-paint flash prevention"
```

---

### Task 0.7: Routing + AppShell + Header

**Files:**
- Create: `ui/app/router.tsx`, `ui/components/layout/app-shell.tsx`, `ui/components/layout/header.tsx`, `ui/features/transfer/components/transfer-page.tsx`, `ui/features/backups/components/backups-page.tsx`, `ui/features/settings/components/settings-page.tsx`
- Modify: `ui/app/App.tsx`

- [ ] **Step 1: Install react-router**

```bash
pnpm add react-router
```

- [ ] **Step 2: Create page placeholders**

`ui/features/transfer/components/transfer-page.tsx`:

```tsx
export function TransferPage() {
  return <div className="p-6">Transfer (placeholder)</div>;
}
```

`ui/features/backups/components/backups-page.tsx`:

```tsx
export function BackupsPage() {
  return <div className="p-6">Backups (placeholder)</div>;
}
```

`ui/features/settings/components/settings-page.tsx`:

```tsx
export function SettingsPage() {
  return <div className="p-6">Settings (placeholder)</div>;
}
```

- [ ] **Step 3: Create Header**

`ui/components/layout/header.tsx`:

```tsx
import { NavLink } from "react-router";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Transfer", end: true },
  { to: "/backups", label: "Backups" },
  { to: "/settings", label: "Settings" },
];

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center px-6 gap-6">
        <h1 className="font-semibold tracking-tight">Steam Config Transfer</h1>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create AppShell**

`ui/components/layout/app-shell.tsx`:

```tsx
import { Outlet } from "react-router";
import { Header } from "./header";

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 5: Create router**

`ui/app/router.tsx`:

```tsx
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { TransferPage } from "@/features/transfer/components/transfer-page";
import { BackupsPage } from "@/features/backups/components/backups-page";
import { SettingsPage } from "@/features/settings/components/settings-page";

const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: TransferPage },
      { path: "backups", Component: BackupsPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 6: Update App.tsx**

`ui/app/App.tsx`:

```tsx
import { Toaster } from "@/components/ui/sonner";
import { Router } from "./router";

export default function App() {
  return (
    <>
      <Router />
      <Toaster richColors closeButton />
    </>
  );
}
```

- [ ] **Step 7: Smoke test**

```bash
pnpm tauri:dev
```

Expected: app shows header with three nav links and theme toggle; clicking nav switches the placeholder page. Close.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: app shell with routing, header, and theme toggle"
```

---

## Phase 1 — Rust Foundation

### Task 1.1: Cargo dependencies

**Files:**
- Modify: `core/Cargo.toml`

- [ ] **Step 1: Add deps**

Replace `[dependencies]` block in `core/Cargo.toml` with:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-os = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }
keyvalues-parser = "0.2"
walkdir = "2"
zip = { version = "2", default-features = false, features = ["deflate"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
sysinfo = "0.32"
tempfile = "3"
url = "2"
quick-xml = { version = "0.36", features = ["serialize"] }

[target.'cfg(windows)'.dependencies]
winreg = "0.52"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: Verify build**

```bash
cd core && cargo check && cd ..
```

Expected: `cargo check` succeeds (downloading deps). Fix any version conflicts before proceeding.

- [ ] **Step 3: Commit**

```bash
git add core/Cargo.toml core/Cargo.lock
git commit -m "chore: add Rust dependencies"
```

---

### Task 1.2: AppError enum

**Files:**
- Create: `core/src/error.rs`
- Modify: `core/src/lib.rs`

- [ ] **Step 1: Write failing test**

Create `core/src/error.rs`:

```rust
use serde::Serialize;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Steam installation not found")]
    SteamNotFound,
    #[error("Steam is currently running. Please quit Steam before continuing.")]
    SteamRunning,
    #[error("Account {0} not found")]
    AccountNotFound(String),
    #[error("Insufficient disk space: need {need} bytes, have {have}")]
    InsufficientDiskSpace { need: u64, have: u64 },
    #[error("VDF parse error: {0}")]
    VdfParse(String),
    #[error("Backup failed: {0}")]
    BackupFailed(String),
    #[error("Restore failed: {0}")]
    RestoreFailed(String),
    #[error("Path does not exist: {0}")]
    PathMissing(PathBuf),
    #[error("Operation cancelled")]
    Cancelled,
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Serialize)]
struct SerializedError<'a> {
    code: &'a str,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let code = match self {
            AppError::SteamNotFound => "SteamNotFound",
            AppError::SteamRunning => "SteamRunning",
            AppError::AccountNotFound(_) => "AccountNotFound",
            AppError::InsufficientDiskSpace { .. } => "InsufficientDiskSpace",
            AppError::VdfParse(_) => "VdfParse",
            AppError::BackupFailed(_) => "BackupFailed",
            AppError::RestoreFailed(_) => "RestoreFailed",
            AppError::PathMissing(_) => "PathMissing",
            AppError::Cancelled => "Cancelled",
            AppError::Io(_) => "Io",
            AppError::Network(_) => "Network",
            AppError::Zip(_) => "Zip",
            AppError::Json(_) => "Json",
        };
        SerializedError { code, message: self.to_string() }.serialize(s)
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_code_and_message() {
        let err = AppError::SteamRunning;
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\":\"SteamRunning\""));
        assert!(json.contains("Steam is currently running"));
    }

    #[test]
    fn account_not_found_carries_id() {
        let err = AppError::AccountNotFound("123".into());
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("Account 123 not found"));
    }
}
```

- [ ] **Step 2: Add to lib.rs**

In `core/src/lib.rs`, add:

```rust
pub mod error;
```

- [ ] **Step 3: Run tests**

```bash
cd core && cargo test error:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add core/src/error.rs core/src/lib.rs
git commit -m "feat: AppError with serde-friendly serialization"
```

---

### Task 1.3: Settings module

**Files:**
- Create: `core/src/settings/mod.rs`
- Modify: `core/src/lib.rs`

- [ ] **Step 1: Write failing test**

Create `core/src/settings/mod.rs`:

```rust
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settings {
    pub steam_path_override: Option<PathBuf>,
    pub backup_retention_per_pair: u32,
    pub last_update_check: Option<chrono::DateTime<chrono::Utc>>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            steam_path_override: None,
            backup_retention_per_pair: 20,
            last_update_check: None,
        }
    }
}

pub fn load(path: &Path) -> AppResult<Settings> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let bytes = std::fs::read(path)?;
    Ok(serde_json::from_slice(&bytes)?)
}

pub fn save(path: &Path, settings: &Settings) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(settings)?;
    std::fs::write(path, bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn returns_default_when_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("missing.json");
        let settings = load(&path).unwrap();
        assert_eq!(settings, Settings::default());
    }

    #[test]
    fn round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Settings::default();
        s.backup_retention_per_pair = 50;
        s.steam_path_override = Some(PathBuf::from("C:/Steam"));
        save(&path, &s).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded, s);
    }
}
```

- [ ] **Step 2: Add to lib.rs**

```rust
pub mod settings;
```

- [ ] **Step 3: Run tests**

```bash
cd core && cargo test settings:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add core/src/settings/mod.rs core/src/lib.rs
git commit -m "feat: settings persistence with sane defaults"
```

---

## Phase 2 — Steam Discovery (Rust)

### Task 2.1: Steam install path detection

**Files:**
- Create: `core/src/steam/mod.rs`, `core/src/steam/install.rs`
- Modify: `core/src/lib.rs`

- [ ] **Step 1: Write failing test**

Create `core/src/steam/install.rs`:

```rust
use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SteamInstall {
    pub root: PathBuf,
}

impl SteamInstall {
    pub fn userdata_dir(&self) -> PathBuf { self.root.join("userdata") }
    pub fn config_dir(&self) -> PathBuf { self.root.join("config") }
    pub fn avatar_cache_dir(&self) -> PathBuf { self.config_dir().join("avatarcache") }
    pub fn loginusers_vdf(&self) -> PathBuf { self.config_dir().join("loginusers.vdf") }
}

pub fn validate_steam_root(p: &Path) -> AppResult<SteamInstall> {
    if !p.exists() { return Err(AppError::PathMissing(p.to_path_buf())); }
    let userdata = p.join("userdata");
    let config = p.join("config");
    if !userdata.exists() || !config.exists() {
        return Err(AppError::SteamNotFound);
    }
    Ok(SteamInstall { root: p.to_path_buf() })
}

#[cfg(target_os = "windows")]
pub fn detect() -> AppResult<SteamInstall> {
    use winreg::enums::*;
    use winreg::RegKey;

    if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(p) = hkcu.get_value::<String, _>("SteamPath") {
            if let Ok(install) = validate_steam_root(Path::new(&p)) { return Ok(install); }
        }
    }
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam")
    {
        if let Ok(p) = hklm.get_value::<String, _>("InstallPath") {
            if let Ok(install) = validate_steam_root(Path::new(&p)) { return Ok(install); }
        }
    }
    let default = Path::new("C:\\Program Files (x86)\\Steam");
    validate_steam_root(default)
}

#[cfg(not(target_os = "windows"))]
pub fn detect() -> AppResult<SteamInstall> {
    Err(AppError::SteamNotFound)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn validate_succeeds_with_correct_layout() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("userdata")).unwrap();
        std::fs::create_dir_all(dir.path().join("config")).unwrap();
        let install = validate_steam_root(dir.path()).unwrap();
        assert_eq!(install.root, dir.path());
        assert_eq!(install.loginusers_vdf(), dir.path().join("config/loginusers.vdf"));
    }

    #[test]
    fn validate_fails_when_userdata_missing() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("config")).unwrap();
        let err = validate_steam_root(dir.path()).unwrap_err();
        assert!(matches!(err, AppError::SteamNotFound));
    }
}
```

- [ ] **Step 2: Create mod.rs**

`core/src/steam/mod.rs`:

```rust
pub mod install;
```

- [ ] **Step 3: Add to lib.rs**

```rust
pub mod steam;
```

- [ ] **Step 4: Run tests**

```bash
cd core && cargo test steam::install:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/steam core/src/lib.rs
git commit -m "feat: Steam install path detection with registry + fallbacks"
```

---

### Task 2.2: VDF parsing for loginusers

**Files:**
- Create: `core/src/steam/vdf.rs`, `core/tests/fixtures/loginusers.vdf`
- Modify: `core/src/steam/mod.rs`

- [ ] **Step 1: Create test fixture**

`core/tests/fixtures/loginusers.vdf`:

```
"users"
{
	"76561198000000001"
	{
		"AccountName"		"alice_login"
		"PersonaName"		"Alice"
		"RememberPassword"		"1"
		"MostRecent"		"1"
		"Timestamp"		"1714521600"
	}
	"76561198000000002"
	{
		"AccountName"		"bob_login"
		"PersonaName"		"Bob"
		"RememberPassword"		"1"
		"MostRecent"		"0"
		"Timestamp"		"1714435200"
	}
}
```

- [ ] **Step 2: Write failing test**

Create `core/src/steam/vdf.rs`:

```rust
use crate::error::{AppError, AppResult};
use chrono::{DateTime, TimeZone, Utc};
use keyvalues_parser::Vdf;
use std::path::Path;

#[derive(Debug, Clone, PartialEq)]
pub struct LoginUserEntry {
    pub steam_id_64: String,
    pub account_name: String,
    pub persona_name: String,
    pub most_recent: bool,
    pub timestamp: Option<DateTime<Utc>>,
}

pub fn parse_loginusers(path: &Path) -> AppResult<Vec<LoginUserEntry>> {
    let text = std::fs::read_to_string(path)?;
    parse_loginusers_str(&text)
}

pub fn parse_loginusers_str(text: &str) -> AppResult<Vec<LoginUserEntry>> {
    let vdf = Vdf::parse(text).map_err(|e| AppError::VdfParse(e.to_string()))?;
    let users_obj = vdf.value.get_obj()
        .ok_or_else(|| AppError::VdfParse("expected top-level object".into()))?;

    let mut entries = Vec::new();
    for (id, vals) in users_obj.iter() {
        let val = vals.first().ok_or_else(|| AppError::VdfParse("empty entry".into()))?;
        let obj = val.get_obj().ok_or_else(|| AppError::VdfParse("expected entry obj".into()))?;
        let s = |k: &str| -> Option<String> {
            obj.get(k).and_then(|v| v.first()).and_then(|v| v.get_str()).map(|s| s.to_string())
        };
        let timestamp_secs: Option<i64> = s("Timestamp").and_then(|t| t.parse().ok());
        entries.push(LoginUserEntry {
            steam_id_64: id.to_string(),
            account_name: s("AccountName").unwrap_or_default(),
            persona_name: s("PersonaName").unwrap_or_default(),
            most_recent: s("MostRecent").as_deref() == Some("1"),
            timestamp: timestamp_secs.and_then(|t| Utc.timestamp_opt(t, 0).single()),
        });
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name)
    }

    #[test]
    fn parses_two_users() {
        let entries = parse_loginusers(&fixture("loginusers.vdf")).unwrap();
        assert_eq!(entries.len(), 2);
        let alice = entries.iter().find(|e| e.steam_id_64 == "76561198000000001").unwrap();
        assert_eq!(alice.account_name, "alice_login");
        assert_eq!(alice.persona_name, "Alice");
        assert!(alice.most_recent);
        assert!(alice.timestamp.is_some());
    }

    #[test]
    fn handles_empty_object() {
        let entries = parse_loginusers_str("\"users\" { }").unwrap();
        assert!(entries.is_empty());
    }
}
```

- [ ] **Step 3: Add to mod.rs**

In `core/src/steam/mod.rs`:

```rust
pub mod install;
pub mod vdf;
```

- [ ] **Step 4: Run tests**

```bash
cd core && cargo test steam::vdf:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/steam/vdf.rs core/src/steam/mod.rs core/tests/fixtures/
git commit -m "feat: parse loginusers.vdf into typed entries"
```

---

### Task 2.3: Account discovery

**Files:**
- Create: `core/src/steam/accounts.rs`
- Modify: `core/src/steam/mod.rs`

- [ ] **Step 1: Define type + write failing test**

Create `core/src/steam/accounts.rs`:

```rust
use crate::error::AppResult;
use crate::steam::install::SteamInstall;
use crate::steam::vdf::parse_loginusers;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::PathBuf;

const STEAM_ID_OFFSET: u64 = 76561197960265728;

#[derive(Debug, Clone, Serialize)]
pub struct Account {
    pub steam_id_64: String,
    pub steam_id_32: u32,
    pub account_name: String,
    pub persona_name: String,
    pub avatar_path: Option<PathBuf>,
    pub last_login: Option<DateTime<Utc>>,
    pub has_userdata: bool,
}

pub fn steam_id_64_to_32(id64: u64) -> u32 {
    (id64 - STEAM_ID_OFFSET) as u32
}

pub fn discover(install: &SteamInstall) -> AppResult<Vec<Account>> {
    let entries = parse_loginusers(&install.loginusers_vdf())?;
    let mut accounts = Vec::with_capacity(entries.len());
    for e in entries {
        let id64: u64 = match e.steam_id_64.parse() { Ok(v) => v, Err(_) => continue };
        let id32 = steam_id_64_to_32(id64);
        let userdata_dir = install.userdata_dir().join(id32.to_string());
        let has_userdata = userdata_dir.is_dir();
        let avatar = install.avatar_cache_dir().join(format!("{}.png", e.steam_id_64));
        accounts.push(Account {
            steam_id_64: e.steam_id_64,
            steam_id_32: id32,
            account_name: e.account_name,
            persona_name: e.persona_name,
            avatar_path: if avatar.exists() { Some(avatar) } else { None },
            last_login: e.timestamp,
            has_userdata,
        });
    }
    accounts.sort_by(|a, b| b.last_login.cmp(&a.last_login));
    Ok(accounts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    fn write(p: &std::path::Path, s: &str) {
        if let Some(parent) = p.parent() { std::fs::create_dir_all(parent).unwrap(); }
        std::fs::write(p, s).unwrap();
    }

    #[test]
    fn id_conversion() {
        assert_eq!(steam_id_64_to_32(76561198000000001), 39734273);
    }

    #[test]
    fn discovers_accounts_and_marks_userdata_presence() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/39734273")).unwrap();
        // Note: no userdata dir for the second account
        let vdf = r#"
"users"
{
	"76561198000000001"
	{
		"AccountName" "alice"
		"PersonaName" "Alice"
		"MostRecent" "1"
		"Timestamp" "1714521600"
	}
	"76561198000000002"
	{
		"AccountName" "bob"
		"PersonaName" "Bob"
		"MostRecent" "0"
		"Timestamp" "1714435200"
	}
}
"#;
        write(&root.join("config/loginusers.vdf"), vdf);
        let install = validate_steam_root(root).unwrap();
        let accounts = discover(&install).unwrap();
        assert_eq!(accounts.len(), 2);
        let alice = accounts.iter().find(|a| a.persona_name == "Alice").unwrap();
        assert!(alice.has_userdata);
        let bob = accounts.iter().find(|a| a.persona_name == "Bob").unwrap();
        assert!(!bob.has_userdata);
    }
}
```

- [ ] **Step 2: Register module**

`core/src/steam/mod.rs`:

```rust
pub mod accounts;
pub mod install;
pub mod vdf;
```

- [ ] **Step 3: Run tests**

```bash
cd core && cargo test steam::accounts:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add core/src/steam/accounts.rs core/src/steam/mod.rs
git commit -m "feat: account discovery with userdata cross-reference"
```

---

### Task 2.4: Avatar resolution + network fallback

**Files:**
- Create: `core/src/steam/avatars.rs`
- Modify: `core/src/steam/mod.rs`

- [ ] **Step 1: Write failing test for local cache hit**

Create `core/src/steam/avatars.rs`:

```rust
use crate::error::AppResult;
use crate::steam::install::SteamInstall;
use std::path::{Path, PathBuf};

pub fn local_avatar(install: &SteamInstall, steam_id_64: &str) -> Option<PathBuf> {
    let p = install.avatar_cache_dir().join(format!("{steam_id_64}.png"));
    if p.exists() { Some(p) } else { None }
}

#[derive(Debug)]
struct ProfileXml { avatar_full: Option<String> }

fn parse_profile_xml(xml: &str) -> ProfileXml {
    use quick_xml::events::Event;
    use quick_xml::Reader;
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut in_avatar_full = false;
    let mut avatar_full = None;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"avatarFull" => in_avatar_full = true,
            Ok(Event::CData(t)) if in_avatar_full => {
                avatar_full = Some(String::from_utf8_lossy(t.as_ref()).to_string());
                in_avatar_full = false;
            }
            Ok(Event::Text(t)) if in_avatar_full => {
                avatar_full = Some(t.unescape().unwrap_or_default().to_string());
                in_avatar_full = false;
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    ProfileXml { avatar_full }
}

pub async fn fetch_remote_avatar(
    client: &reqwest::Client,
    steam_id_64: &str,
    cache_dir: &Path,
) -> AppResult<PathBuf> {
    std::fs::create_dir_all(cache_dir)?;
    let dest = cache_dir.join(format!("{steam_id_64}.png"));
    if dest.exists() { return Ok(dest); }

    let xml_url = format!("https://steamcommunity.com/profiles/{steam_id_64}?xml=1");
    let xml = client.get(xml_url).send().await?.error_for_status()?.text().await?;
    let parsed = parse_profile_xml(&xml);
    let url = parsed.avatar_full.ok_or_else(|| {
        crate::error::AppError::Network(reqwest::Error::from(
            client.get("https://invalid").build().unwrap_err()
        ))
    })?;
    let bytes = client.get(url).send().await?.error_for_status()?.bytes().await?;
    std::fs::write(&dest, &bytes)?;
    Ok(dest)
}

pub fn resolve(install: &SteamInstall, steam_id_64: &str) -> Option<PathBuf> {
    local_avatar(install, steam_id_64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn local_avatar_hit() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("config/avatarcache")).unwrap();
        std::fs::create_dir_all(dir.path().join("userdata")).unwrap();
        let path = dir.path().join("config/avatarcache/76561198000000001.png");
        std::fs::write(&path, b"fake-png").unwrap();
        let install = validate_steam_root(dir.path()).unwrap();
        let resolved = local_avatar(&install, "76561198000000001").unwrap();
        assert_eq!(resolved, path);
    }

    #[test]
    fn local_avatar_miss() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("config/avatarcache")).unwrap();
        std::fs::create_dir_all(dir.path().join("userdata")).unwrap();
        let install = validate_steam_root(dir.path()).unwrap();
        assert!(local_avatar(&install, "76561198000000001").is_none());
    }

    #[test]
    fn parses_avatar_full_from_xml() {
        let xml = r#"<?xml version="1.0"?>
<profile>
  <avatarFull><![CDATA[https://avatars.steamstatic.com/abc_full.jpg]]></avatarFull>
</profile>"#;
        let parsed = parse_profile_xml(xml);
        assert_eq!(parsed.avatar_full.as_deref(), Some("https://avatars.steamstatic.com/abc_full.jpg"));
    }
}
```

- [ ] **Step 2: Register module**

In `core/src/steam/mod.rs` add `pub mod avatars;`.

- [ ] **Step 3: Run tests**

```bash
cd core && cargo test steam::avatars:: && cd ..
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add core/src/steam/avatars.rs core/src/steam/mod.rs
git commit -m "feat: avatar resolution from local cache + remote fetch"
```

---

### Task 2.5: Game discovery per account

**Files:**
- Create: `core/src/steam/games.rs`
- Modify: `core/src/steam/mod.rs`

- [ ] **Step 1: Write failing test**

Create `core/src/steam/games.rs`:

```rust
use crate::error::AppResult;
use crate::steam::install::SteamInstall;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct GameRef {
    pub app_id: u32,
    pub config_path: PathBuf,
    pub config_size_bytes: u64,
    pub last_modified: Option<DateTime<Utc>>,
}

pub fn list_for_account(install: &SteamInstall, steam_id_32: u32) -> AppResult<Vec<GameRef>> {
    let account_dir = install.userdata_dir().join(steam_id_32.to_string());
    if !account_dir.is_dir() { return Ok(Vec::new()); }
    let mut games = Vec::new();
    for entry in std::fs::read_dir(&account_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() { continue; }
        let name = entry.file_name();
        let s = match name.to_str() { Some(s) => s, None => continue };
        let app_id: u32 = match s.parse() { Ok(v) if v > 0 => v, _ => continue };
        let path = entry.path();
        let (size, modified) = dir_stats(&path)?;
        games.push(GameRef {
            app_id,
            config_path: path,
            config_size_bytes: size,
            last_modified: modified,
        });
    }
    games.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(games)
}

fn dir_stats(p: &std::path::Path) -> AppResult<(u64, Option<DateTime<Utc>>)> {
    let mut total = 0u64;
    let mut latest: Option<std::time::SystemTime> = None;
    for e in walkdir::WalkDir::new(p) {
        let e = match e { Ok(e) => e, Err(_) => continue };
        if !e.file_type().is_file() { continue; }
        let md = match e.metadata() { Ok(m) => m, Err(_) => continue };
        total = total.saturating_add(md.len());
        if let Ok(modified) = md.modified() {
            latest = Some(latest.map_or(modified, |cur| cur.max(modified)));
        }
    }
    Ok((total, latest.map(DateTime::<Utc>::from)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn lists_numeric_subfolders() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/570/local")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/730")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/ac")).unwrap();
        std::fs::create_dir_all(root.join("userdata/12345/0")).unwrap();
        std::fs::write(root.join("userdata/12345/570/local/cfg.txt"), "x").unwrap();
        let install = validate_steam_root(root).unwrap();
        let games = list_for_account(&install, 12345).unwrap();
        let ids: Vec<u32> = games.iter().map(|g| g.app_id).collect();
        assert!(ids.contains(&570));
        assert!(ids.contains(&730));
        assert!(!ids.contains(&0));
    }
}
```

- [ ] **Step 2: Register module + run tests**

In `core/src/steam/mod.rs` add `pub mod games;`. Then:

```bash
cd core && cargo test steam::games:: && cd ..
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add core/src/steam/games.rs core/src/steam/mod.rs
git commit -m "feat: per-account game discovery from userdata folders"
```

---

### Task 2.6: Game metadata fetch + cache

**Files:**
- Create: `core/src/steam/metadata.rs`
- Modify: `core/src/steam/mod.rs`

- [ ] **Step 1: Write code + test**

Create `core/src/steam/metadata.rs`:

```rust
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMetadata {
    pub app_id: u32,
    pub name: String,
    pub header_image_url: String,
}

pub fn header_image_url(app_id: u32) -> String {
    format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/header.jpg")
}

pub fn load_cache(path: &Path) -> AppResult<HashMap<u32, GameMetadata>> {
    if !path.exists() { return Ok(HashMap::new()); }
    Ok(serde_json::from_slice(&std::fs::read(path)?)?)
}

pub fn save_cache(path: &Path, cache: &HashMap<u32, GameMetadata>) -> AppResult<()> {
    if let Some(p) = path.parent() { std::fs::create_dir_all(p)?; }
    std::fs::write(path, serde_json::to_vec_pretty(cache)?)?;
    Ok(())
}

#[derive(Deserialize)]
struct AppDetailsEnvelope { #[serde(flatten)] inner: HashMap<String, AppDetailsResp> }
#[derive(Deserialize)]
struct AppDetailsResp { success: bool, data: Option<AppDetailsData> }
#[derive(Deserialize)]
struct AppDetailsData { name: String }

pub async fn fetch_one(client: &reqwest::Client, app_id: u32) -> AppResult<Option<GameMetadata>> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={app_id}&filters=basic"
    );
    let env: AppDetailsEnvelope = client.get(url).send().await?.error_for_status()?.json().await?;
    let resp = env.inner.get(&app_id.to_string());
    Ok(resp.and_then(|r| {
        if r.success { r.data.as_ref().map(|d| GameMetadata {
            app_id, name: d.name.clone(), header_image_url: header_image_url(app_id),
        }) } else { None }
    }))
}

pub async fn ensure_cached(
    client: &reqwest::Client,
    cache_path: &PathBuf,
    cache: &mut HashMap<u32, GameMetadata>,
    app_ids: &[u32],
) -> AppResult<()> {
    let missing: Vec<u32> = app_ids.iter().copied().filter(|id| !cache.contains_key(id)).collect();
    for id in missing {
        match fetch_one(client, id).await {
            Ok(Some(meta)) => { cache.insert(id, meta); }
            Ok(None) => {
                cache.insert(id, GameMetadata {
                    app_id: id, name: format!("App {id}"),
                    header_image_url: header_image_url(id),
                });
            }
            Err(_) => continue,
        }
        tokio::time::sleep(Duration::from_millis(1500)).await;
    }
    save_cache(cache_path, cache)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn header_url_format() {
        assert_eq!(
            header_image_url(570),
            "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg"
        );
    }

    #[test]
    fn cache_round_trip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        let mut cache = HashMap::new();
        cache.insert(570, GameMetadata {
            app_id: 570, name: "Dota 2".into(), header_image_url: header_image_url(570),
        });
        save_cache(&path, &cache).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert_eq!(loaded.get(&570).unwrap().name, "Dota 2");
    }
}
```

- [ ] **Step 2: Register module + run tests**

Add `pub mod metadata;` to `core/src/steam/mod.rs`, then:

```bash
cd core && cargo test steam::metadata:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add core/src/steam/metadata.rs core/src/steam/mod.rs
git commit -m "feat: game metadata fetch with persistent cache"
```

---

## Phase 3 — Backups

### Task 3.1: Manifest + backup zip creation

**Files:**
- Create: `core/src/archive/mod.rs`, `core/src/archive/manifest.rs`, `core/src/archive/create.rs`
- Modify: `core/src/lib.rs`

- [ ] **Step 1: Manifest type with test**

Create `core/src/archive/manifest.rs`:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum BackupReason { Manual, PreCopy, PreRestore }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct Manifest {
    pub schema_version: u32,
    pub created_at: DateTime<Utc>,
    pub steam_id_64: String,
    pub persona_name_at_backup: String,
    pub app_id: u32,
    pub game_name_at_backup: String,
    pub reason: BackupReason,
    pub source_path: PathBuf,
    pub byte_size: u64,
}

pub const MANIFEST_FILENAME: &str = "manifest.json";
pub const SCHEMA_VERSION: u32 = 1;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips() {
        let m = Manifest {
            schema_version: SCHEMA_VERSION,
            created_at: Utc::now(),
            steam_id_64: "76561198000000001".into(),
            persona_name_at_backup: "Alice".into(),
            app_id: 570,
            game_name_at_backup: "Dota 2".into(),
            reason: BackupReason::PreCopy,
            source_path: PathBuf::from("C:/Steam/userdata/39734273/570"),
            byte_size: 1024,
        };
        let s = serde_json::to_string(&m).unwrap();
        assert!(s.contains("\"reason\":\"PreCopy\""));
        let parsed: Manifest = serde_json::from_str(&s).unwrap();
        assert_eq!(parsed, m);
    }
}
```

- [ ] **Step 2: Zip creation with test**

Create `core/src/archive/create.rs`:

```rust
use crate::archive::manifest::{Manifest, BackupReason, MANIFEST_FILENAME, SCHEMA_VERSION};
use crate::error::{AppError, AppResult};
use chrono::Utc;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

pub struct CreateRequest<'a> {
    pub source_dir: &'a Path,
    pub steam_id_64: &'a str,
    pub persona_name: &'a str,
    pub app_id: u32,
    pub game_name: &'a str,
    pub reason: BackupReason,
    pub backup_root: &'a Path,
}

pub struct CreateResult {
    pub archive_path: PathBuf,
    pub size_bytes: u64,
}

pub fn create(req: CreateRequest) -> AppResult<CreateResult> {
    if !req.source_dir.is_dir() {
        return Err(AppError::PathMissing(req.source_dir.to_path_buf()));
    }
    let now = Utc::now();
    let timestamp = now.format("%Y%m%dT%H%M%SZ");
    let reason_str = match req.reason {
        BackupReason::Manual => "manual",
        BackupReason::PreCopy => "precopy",
        BackupReason::PreRestore => "prerestore",
    };
    let dir = req.backup_root.join(req.steam_id_64).join(req.app_id.to_string());
    std::fs::create_dir_all(&dir)?;
    let archive_path = dir.join(format!("{timestamp}_{reason_str}.zip"));

    let file = File::create(&archive_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut total_bytes = 0u64;
    let prefix = req.source_dir;
    let app_id_dir = req.app_id.to_string();
    for entry in WalkDir::new(prefix) {
        let entry = entry.map_err(|e| AppError::BackupFailed(e.to_string()))?;
        let rel = entry.path().strip_prefix(prefix)
            .map_err(|e| AppError::BackupFailed(e.to_string()))?;
        let name_in_zip = if rel.as_os_str().is_empty() {
            PathBuf::from(&app_id_dir)
        } else {
            PathBuf::from(&app_id_dir).join(rel)
        };
        let name_str = name_in_zip.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            zip.add_directory(&name_str, opts)?;
        } else if entry.file_type().is_file() {
            zip.start_file(&name_str, opts)?;
            let mut f = File::open(entry.path())?;
            let mut buf = [0u8; 16 * 1024];
            loop {
                let n = f.read(&mut buf)?;
                if n == 0 { break; }
                zip.write_all(&buf[..n])?;
                total_bytes += n as u64;
            }
        }
    }

    let manifest = Manifest {
        schema_version: SCHEMA_VERSION,
        created_at: now,
        steam_id_64: req.steam_id_64.into(),
        persona_name_at_backup: req.persona_name.into(),
        app_id: req.app_id,
        game_name_at_backup: req.game_name.into(),
        reason: req.reason,
        source_path: req.source_dir.to_path_buf(),
        byte_size: total_bytes,
    };
    zip.start_file(MANIFEST_FILENAME, opts)?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
    zip.finish()?;

    let size_bytes = std::fs::metadata(&archive_path)?.len();
    Ok(CreateResult { archive_path, size_bytes })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use tempfile::tempdir;

    #[test]
    fn creates_archive_with_manifest() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("570");
        std::fs::create_dir_all(src.join("local")).unwrap();
        std::fs::write(src.join("local/cfg.txt"), b"hello").unwrap();
        let backup_root = dir.path().join("backups");
        let res = create(CreateRequest {
            source_dir: &src, steam_id_64: "76561198000000001",
            persona_name: "Alice", app_id: 570, game_name: "Dota 2",
            reason: BackupReason::Manual, backup_root: &backup_root,
        }).unwrap();
        assert!(res.archive_path.exists());
        assert!(res.size_bytes > 0);

        let f = File::open(&res.archive_path).unwrap();
        let mut zip = zip::ZipArchive::new(f).unwrap();
        let names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string()).collect();
        assert!(names.iter().any(|n| n == "manifest.json"));
        assert!(names.iter().any(|n| n == "570/local/cfg.txt"));

        let mut mf = String::new();
        zip.by_name("manifest.json").unwrap().read_to_string(&mut mf).unwrap();
        let manifest: Manifest = serde_json::from_str(&mf).unwrap();
        assert_eq!(manifest.app_id, 570);
        assert_eq!(manifest.reason, BackupReason::Manual);
    }
}
```

- [ ] **Step 3: Module wiring**

`core/src/archive/mod.rs`:

```rust
pub mod create;
pub mod manifest;
```

Add to `core/src/lib.rs`:

```rust
pub mod archive;
```

- [ ] **Step 4: Run tests**

```bash
cd core && cargo test archive:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/archive core/src/lib.rs
git commit -m "feat: backup zip creation with manifest"
```

---

### Task 3.2: Backup listing + retention + delete

**Files:**
- Create: `core/src/archive/list.rs`, `core/src/archive/retention.rs`
- Modify: `core/src/archive/mod.rs`

- [ ] **Step 1: List with manifest reads + retention pruning**

Create `core/src/archive/list.rs`:

```rust
use crate::archive::manifest::{Manifest, BackupReason, MANIFEST_FILENAME};
use crate::error::AppResult;
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct BackupRecord {
    pub archive_path: PathBuf,
    pub size_bytes: u64,
    pub manifest: Manifest,
}

pub fn read_manifest(archive: &Path) -> AppResult<Manifest> {
    let f = File::open(archive)?;
    let mut zip = zip::ZipArchive::new(f)?;
    let mut entry = zip.by_name(MANIFEST_FILENAME)?;
    let mut s = String::new();
    entry.read_to_string(&mut s)?;
    Ok(serde_json::from_str(&s)?)
}

pub fn list_all(backup_root: &Path) -> AppResult<Vec<BackupRecord>> {
    let mut out = Vec::new();
    if !backup_root.is_dir() { return Ok(out); }
    for steam_id_entry in std::fs::read_dir(backup_root)? {
        let steam_id_dir = steam_id_entry?.path();
        if !steam_id_dir.is_dir() { continue; }
        for app_entry in std::fs::read_dir(&steam_id_dir)? {
            let app_dir = app_entry?.path();
            if !app_dir.is_dir() { continue; }
            for file in std::fs::read_dir(&app_dir)? {
                let path = file?.path();
                if path.extension().and_then(|s| s.to_str()) != Some("zip") { continue; }
                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                if let Ok(manifest) = read_manifest(&path) {
                    out.push(BackupRecord { archive_path: path, size_bytes: size, manifest });
                }
            }
        }
    }
    out.sort_by(|a, b| b.manifest.created_at.cmp(&a.manifest.created_at));
    Ok(out)
}

pub fn list_for_pair(backup_root: &Path, steam_id_64: &str, app_id: u32) -> AppResult<Vec<BackupRecord>> {
    Ok(list_all(backup_root)?
        .into_iter()
        .filter(|r| r.manifest.steam_id_64 == steam_id_64 && r.manifest.app_id == app_id)
        .collect())
}

pub fn delete(record: &BackupRecord) -> AppResult<()> {
    std::fs::remove_file(&record.archive_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::create::{create, CreateRequest};
    use tempfile::tempdir;

    fn setup_backup(root: &Path, app_id: u32, reason: BackupReason) -> PathBuf {
        let src = root.join(format!("source_{app_id}_{reason:?}"));
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.txt"), b"x").unwrap();
        let backups = root.join("backups");
        let res = create(CreateRequest {
            source_dir: &src,
            steam_id_64: "76561198000000001",
            persona_name: "Alice",
            app_id,
            game_name: "Game",
            reason,
            backup_root: &backups,
        }).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1100));
        res.archive_path
    }

    #[test]
    fn lists_and_filters_pairs() {
        let dir = tempdir().unwrap();
        setup_backup(dir.path(), 570, BackupReason::Manual);
        setup_backup(dir.path(), 730, BackupReason::Manual);
        let backup_root = dir.path().join("backups");
        assert_eq!(list_all(&backup_root).unwrap().len(), 2);
        let dota = list_for_pair(&backup_root, "76561198000000001", 570).unwrap();
        assert_eq!(dota.len(), 1);
        assert_eq!(dota[0].manifest.app_id, 570);
    }
}
```

- [ ] **Step 2: Retention pruner**

Create `core/src/archive/retention.rs`:

```rust
use crate::archive::list::{BackupRecord, list_for_pair, delete};
use crate::archive::manifest::BackupReason;
use crate::error::AppResult;
use std::path::Path;

pub fn prune_for_pair(
    backup_root: &Path,
    steam_id_64: &str,
    app_id: u32,
    keep: u32,
) -> AppResult<Vec<BackupRecord>> {
    let mut records = list_for_pair(backup_root, steam_id_64, app_id)?;
    let auto: Vec<&BackupRecord> = records.iter()
        .filter(|r| r.manifest.reason != BackupReason::Manual)
        .collect();
    let to_delete: Vec<BackupRecord> = if (auto.len() as u32) > keep {
        auto.iter().skip(keep as usize).map(|r| (*r).clone()).collect()
    } else { Vec::new() };
    for r in &to_delete { delete(r)?; }
    records.retain(|r| !to_delete.iter().any(|d| d.archive_path == r.archive_path));
    Ok(to_delete)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::create::{create, CreateRequest};
    use crate::archive::manifest::BackupReason;
    use tempfile::tempdir;

    #[test]
    fn keeps_manual_and_drops_oldest_auto_over_limit() {
        let dir = tempdir().unwrap();
        let backups = dir.path().join("backups");
        let src = dir.path().join("src/570");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.txt"), "x").unwrap();
        let mk = |reason| {
            create(CreateRequest {
                source_dir: &src, steam_id_64: "76561198000000001", persona_name: "Alice",
                app_id: 570, game_name: "Dota 2", reason, backup_root: &backups,
            }).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(1100));
        };
        mk(BackupReason::Manual);
        mk(BackupReason::PreCopy);
        mk(BackupReason::PreCopy);
        mk(BackupReason::PreCopy);

        let deleted = prune_for_pair(&backups, "76561198000000001", 570, 2).unwrap();
        assert_eq!(deleted.len(), 1);
        assert_eq!(deleted[0].manifest.reason, BackupReason::PreCopy);
    }
}
```

- [ ] **Step 3: Module wiring**

`core/src/archive/mod.rs`:

```rust
pub mod create;
pub mod list;
pub mod manifest;
pub mod retention;
```

- [ ] **Step 4: Run tests**

```bash
cd core && cargo test archive:: && cd ..
```

Expected: previous tests still pass + 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add core/src/archive
git commit -m "feat: backup listing, filter-per-pair, and retention pruning"
```

---

## Phase 4 — Sync (Transfer)

### Task 4.1: Steam-running detection

**Files:**
- Create: `core/src/sync/mod.rs`, `core/src/sync/preflight.rs`
- Modify: `core/src/lib.rs`

- [ ] **Step 1: Write preflight module**

Create `core/src/sync/preflight.rs`:

```rust
use crate::error::{AppError, AppResult};
use std::path::Path;
use sysinfo::System;

pub fn is_steam_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes().values().any(|p| {
        let name = p.name().to_string_lossy().to_lowercase();
        name == "steam.exe" || name == "steam"
    })
}

pub fn ensure_steam_not_running() -> AppResult<()> {
    if is_steam_running() { Err(AppError::SteamRunning) } else { Ok(()) }
}

pub fn dir_size(p: &Path) -> u64 {
    let mut total = 0u64;
    for e in walkdir::WalkDir::new(p) {
        if let Ok(e) = e {
            if e.file_type().is_file() {
                if let Ok(md) = e.metadata() { total = total.saturating_add(md.len()); }
            }
        }
    }
    total
}

pub fn ensure_disk_space(target_parent: &Path, need_bytes: u64) -> AppResult<()> {
    let available = fs2_available(target_parent)?;
    if available < need_bytes.saturating_mul(2) {
        return Err(AppError::InsufficientDiskSpace { need: need_bytes * 2, have: available });
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn fs2_available(p: &Path) -> AppResult<u64> {
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    let mut wide: Vec<u16> = p.as_os_str().encode_wide().collect();
    wide.push(0);
    let mut free: u64 = 0;
    let ok = unsafe {
        windows_sys_get_disk_free_space_ex(wide.as_ptr(), &mut free, ptr::null_mut(), ptr::null_mut())
    };
    if ok == 0 {
        Err(AppError::Io(std::io::Error::last_os_error()))
    } else {
        Ok(free)
    }
}

#[cfg(target_os = "windows")]
extern "system" {
    #[link_name = "GetDiskFreeSpaceExW"]
    fn windows_sys_get_disk_free_space_ex(
        lpDirectoryName: *const u16,
        lpFreeBytesAvailableToCaller: *mut u64,
        lpTotalNumberOfBytes: *mut u64,
        lpTotalNumberOfFreeBytes: *mut u64,
    ) -> i32;
}

#[cfg(not(target_os = "windows"))]
fn fs2_available(_p: &Path) -> AppResult<u64> { Ok(u64::MAX) }

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn dir_size_sums_files() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("a"), b"hello").unwrap();
        std::fs::write(dir.path().join("b"), b"world!").unwrap();
        assert_eq!(dir_size(dir.path()), 11);
    }
}
```

- [ ] **Step 2: Module wiring**

`core/src/sync/mod.rs`:

```rust
pub mod preflight;
```

`core/src/lib.rs`:

```rust
pub mod sync;
```

- [ ] **Step 3: Run tests**

```bash
cd core && cargo test sync::preflight:: && cd ..
```

Expected: 1 test passes (the others depend on running Steam / disk and are skipped).

- [ ] **Step 4: Commit**

```bash
git add core/src/sync core/src/lib.rs
git commit -m "feat: pre-flight checks (steam-running, disk space, dir size)"
```

---

### Task 4.2: Two-phase copy with rollback

**Files:**
- Create: `core/src/sync/copy.rs`
- Modify: `core/src/sync/mod.rs`

- [ ] **Step 1: Write copy with test**

Create `core/src/sync/copy.rs`:

```rust
use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

pub fn copy_tree(src: &Path, dst: &Path) -> AppResult<()> {
    if !src.is_dir() { return Err(AppError::PathMissing(src.to_path_buf())); }
    std::fs::create_dir_all(dst)?;
    for entry in WalkDir::new(src) {
        let entry = entry.map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        let rel = entry.path().strip_prefix(src)
            .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target)?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target.parent() { std::fs::create_dir_all(parent)?; }
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

pub fn replace_directory(target: &Path, new_contents: &Path) -> AppResult<()> {
    let backup = target.with_extension(format!("old_{}", Uuid::new_v4()));
    let target_existed = target.exists();
    if target_existed { std::fs::rename(target, &backup)?; }
    if let Err(e) = std::fs::rename(new_contents, target) {
        if target_existed { let _ = std::fs::rename(&backup, target); }
        return Err(AppError::Io(e));
    }
    if target_existed { let _ = std::fs::remove_dir_all(&backup); }
    Ok(())
}

pub struct TwoPhaseCopy<'a> {
    pub src: &'a Path,
    pub target: &'a Path,
}

impl<'a> TwoPhaseCopy<'a> {
    pub fn execute(&self) -> AppResult<()> {
        let parent = self.target.parent()
            .ok_or_else(|| AppError::PathMissing(self.target.to_path_buf()))?;
        std::fs::create_dir_all(parent)?;
        let temp_name = format!("{}.tmp_{}",
            self.target.file_name().and_then(|s| s.to_str()).unwrap_or("copy"),
            Uuid::new_v4());
        let temp = parent.join(temp_name);

        if let Err(e) = copy_tree(self.src, &temp) {
            let _ = std::fs::remove_dir_all(&temp);
            return Err(e);
        }
        if let Err(e) = replace_directory(self.target, &temp) {
            let _ = std::fs::remove_dir_all(&temp);
            return Err(e);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn read(p: &Path) -> String { std::fs::read_to_string(p).unwrap() }

    #[test]
    fn two_phase_replaces_existing_target() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("file.txt"), "new").unwrap();
        let target = dir.path().join("target");
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(target.join("file.txt"), "old").unwrap();

        TwoPhaseCopy { src: &src, target: &target }.execute().unwrap();
        assert_eq!(read(&target.join("file.txt")), "new");
    }

    #[test]
    fn copy_tree_preserves_subdirs() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        std::fs::create_dir_all(src.join("a/b")).unwrap();
        std::fs::write(src.join("a/b/c.txt"), "deep").unwrap();
        let dst = dir.path().join("dst");
        copy_tree(&src, &dst).unwrap();
        assert_eq!(read(&dst.join("a/b/c.txt")), "deep");
    }
}
```

- [ ] **Step 2: Wire + run tests**

Add `pub mod copy;` to `core/src/sync/mod.rs`. Then:

```bash
cd core && cargo test sync::copy:: && cd ..
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add core/src/sync
git commit -m "feat: two-phase directory copy with rollback"
```

---

### Task 4.3: Transfer orchestration

**Files:**
- Create: `core/src/sync/transfer.rs`
- Modify: `core/src/sync/mod.rs`

- [ ] **Step 1: Orchestration code with test**

Create `core/src/sync/transfer.rs`:

```rust
use crate::archive::create::{create, CreateRequest};
use crate::archive::manifest::BackupReason;
use crate::archive::retention::prune_for_pair;
use crate::error::{AppError, AppResult};
use crate::steam::install::SteamInstall;
use crate::sync::copy::TwoPhaseCopy;
use crate::sync::preflight::{dir_size, ensure_disk_space, ensure_steam_not_running};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct TransferPair {
    pub source_steam_id_64: String,
    pub target_steam_id_64: String,
    pub source_steam_id_32: u32,
    pub target_steam_id_32: u32,
    pub source_persona: String,
    pub target_persona: String,
    pub app_id: u32,
    pub game_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransferOutcome {
    pub pair: TransferPair,
    pub success: bool,
    pub error: Option<String>,
    pub backup_path: Option<PathBuf>,
}

pub struct TransferOptions<'a> {
    pub backup_root: &'a Path,
    pub retention_per_pair: u32,
}

pub fn run_transfer(
    install: &SteamInstall,
    pairs: &[TransferPair],
    opts: TransferOptions,
) -> AppResult<Vec<TransferOutcome>> {
    ensure_steam_not_running()?;
    let mut results = Vec::with_capacity(pairs.len());
    for pair in pairs {
        results.push(run_single(install, pair, &opts));
    }
    Ok(results)
}

fn run_single(install: &SteamInstall, pair: &TransferPair, opts: &TransferOptions) -> TransferOutcome {
    let source_dir = install.userdata_dir()
        .join(pair.source_steam_id_32.to_string())
        .join(pair.app_id.to_string());
    let target_dir = install.userdata_dir()
        .join(pair.target_steam_id_32.to_string())
        .join(pair.app_id.to_string());

    let outcome = (|| -> AppResult<Option<PathBuf>> {
        if !source_dir.is_dir() {
            return Err(AppError::PathMissing(source_dir.clone()));
        }
        let target_parent = target_dir.parent()
            .ok_or_else(|| AppError::PathMissing(target_dir.clone()))?;
        std::fs::create_dir_all(target_parent)?;
        ensure_disk_space(target_parent, dir_size(&source_dir))?;

        let backup_path = if target_dir.is_dir() {
            let res = create(CreateRequest {
                source_dir: &target_dir,
                steam_id_64: &pair.target_steam_id_64,
                persona_name: &pair.target_persona,
                app_id: pair.app_id,
                game_name: &pair.game_name,
                reason: BackupReason::PreCopy,
                backup_root: opts.backup_root,
            })?;
            Some(res.archive_path)
        } else { None };

        TwoPhaseCopy { src: &source_dir, target: &target_dir }.execute()?;

        let _ = prune_for_pair(opts.backup_root, &pair.target_steam_id_64, pair.app_id, opts.retention_per_pair);
        Ok(backup_path)
    })();

    match outcome {
        Ok(backup_path) => TransferOutcome {
            pair: pair.clone(), success: true, error: None, backup_path,
        },
        Err(e) => TransferOutcome {
            pair: pair.clone(), success: false, error: Some(e.to_string()), backup_path: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn transfers_a_single_pair_with_pre_copy_backup() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/100/570")).unwrap();
        std::fs::create_dir_all(root.join("userdata/200/570")).unwrap();
        std::fs::write(root.join("userdata/100/570/cfg.txt"), "src").unwrap();
        std::fs::write(root.join("userdata/200/570/cfg.txt"), "dst").unwrap();

        let install = validate_steam_root(root).unwrap();
        let backup_root = dir.path().join("backups");
        let pair = TransferPair {
            source_steam_id_64: "76561198000000001".into(),
            target_steam_id_64: "76561198000000002".into(),
            source_steam_id_32: 100, target_steam_id_32: 200,
            source_persona: "Alice".into(), target_persona: "Bob".into(),
            app_id: 570, game_name: "Dota 2".into(),
        };
        let outs = run_transfer(&install, &[pair], TransferOptions {
            backup_root: &backup_root, retention_per_pair: 20,
        }).unwrap();
        assert_eq!(outs.len(), 1);
        assert!(outs[0].success, "transfer should succeed: {:?}", outs[0].error);
        assert!(outs[0].backup_path.is_some());
        let copied = std::fs::read_to_string(root.join("userdata/200/570/cfg.txt")).unwrap();
        assert_eq!(copied, "src");
    }
}
```

This test will fail in CI if Steam happens to be running on the test host; gate it behind `#[cfg(not(steam_running))]` if that becomes an issue. On the dev box, ensure Steam is closed before running.

- [ ] **Step 2: Wire + run tests**

Add `pub mod transfer;` to `core/src/sync/mod.rs`. Then:

```bash
cd core && cargo test sync::transfer:: && cd ..
```

Expected: 1 test passes (Steam must not be running on the host).

- [ ] **Step 3: Commit**

```bash
git add core/src/sync
git commit -m "feat: per-pair transfer with auto pre-copy backup"
```

---

## Phase 5 — Restore

### Task 5.1: Restore zip extraction

**Files:**
- Create: `core/src/archive/restore.rs`
- Modify: `core/src/archive/mod.rs`

- [ ] **Step 1: Restore implementation**

Create `core/src/archive/restore.rs`:

```rust
use crate::archive::create::{create, CreateRequest};
use crate::archive::list::{read_manifest, BackupRecord};
use crate::archive::manifest::{BackupReason, MANIFEST_FILENAME};
use crate::error::{AppError, AppResult};
use crate::steam::install::SteamInstall;
use crate::sync::preflight::ensure_steam_not_running;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

pub fn restore(
    install: &SteamInstall,
    record: &BackupRecord,
    target_steam_id_32: u32,
    backup_root: &Path,
) -> AppResult<PathBuf> {
    ensure_steam_not_running()?;
    let manifest = read_manifest(&record.archive_path)?;
    let target_dir = install.userdata_dir()
        .join(target_steam_id_32.to_string())
        .join(manifest.app_id.to_string());

    let safety_backup = if target_dir.is_dir() {
        Some(create(CreateRequest {
            source_dir: &target_dir,
            steam_id_64: &manifest.steam_id_64,
            persona_name: &manifest.persona_name_at_backup,
            app_id: manifest.app_id,
            game_name: &manifest.game_name_at_backup,
            reason: BackupReason::PreRestore,
            backup_root,
        })?.archive_path)
    } else { None };

    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir)
            .map_err(|e| AppError::RestoreFailed(format!("clear target: {e}")))?;
    }
    if let Some(parent) = target_dir.parent() { std::fs::create_dir_all(parent)?; }
    std::fs::create_dir_all(&target_dir)?;

    let extract_result = extract_into(&record.archive_path, &target_dir, manifest.app_id);
    if extract_result.is_err() {
        if let Some(safety) = &safety_backup {
            // rollback: clear target and re-extract safety
            let _ = std::fs::remove_dir_all(&target_dir);
            let _ = std::fs::create_dir_all(&target_dir);
            let _ = extract_into(safety, &target_dir, manifest.app_id);
        }
        return Err(AppError::RestoreFailed(extract_result.err().unwrap().to_string()));
    }

    Ok(target_dir)
}

fn extract_into(archive: &Path, target_dir: &Path, app_id: u32) -> AppResult<()> {
    let f = File::open(archive)?;
    let mut zip = zip::ZipArchive::new(f)?;
    let app_prefix = format!("{app_id}/");
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if name == MANIFEST_FILENAME { continue; }
        let rel = match name.strip_prefix(&app_prefix) {
            Some(r) => r.to_string(),
            None => continue,
        };
        if rel.is_empty() { continue; }
        let dest = target_dir.join(&rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent)?; }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            std::fs::write(&dest, &buf)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive::create::{create, CreateRequest};
    use crate::steam::install::validate_steam_root;
    use tempfile::tempdir;

    #[test]
    fn restores_into_target_account() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("config")).unwrap();
        std::fs::create_dir_all(root.join("userdata/100/570/local")).unwrap();
        std::fs::write(root.join("userdata/100/570/local/cfg.txt"), "saved").unwrap();
        let backup_root = root.join("backups");

        let res = create(CreateRequest {
            source_dir: &root.join("userdata/100/570"),
            steam_id_64: "76561198000000001",
            persona_name: "Alice",
            app_id: 570,
            game_name: "Dota 2",
            reason: BackupReason::Manual,
            backup_root: &backup_root,
        }).unwrap();

        // wipe & restore back into a different target dir
        let install = validate_steam_root(root).unwrap();
        let manifest = read_manifest(&res.archive_path).unwrap();
        let record = BackupRecord {
            archive_path: res.archive_path,
            size_bytes: res.size_bytes,
            manifest,
        };
        std::fs::create_dir_all(root.join("userdata/200")).unwrap();
        let restored = restore(&install, &record, 200, &backup_root).unwrap();
        assert!(restored.join("local/cfg.txt").exists());
        assert_eq!(std::fs::read_to_string(restored.join("local/cfg.txt")).unwrap(), "saved");
    }
}
```

- [ ] **Step 2: Wire + run tests**

Add `pub mod restore;` to `core/src/archive/mod.rs`. Then:

```bash
cd core && cargo test archive::restore:: && cd ..
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add core/src/archive
git commit -m "feat: backup restore with PreRestore safety backup"
```

---

## Phase 6 — Bridge (Tauri Commands)

### Task 6.1: AppState + bridge module

**Files:**
- Create: `core/src/bridge/mod.rs`, `core/src/bridge/state.rs`
- Modify: `core/src/lib.rs`, `core/src/main.rs`

- [ ] **Step 1: AppState wrapper**

Create `core/src/bridge/state.rs`:

```rust
use crate::error::AppResult;
use crate::settings::Settings;
use crate::steam::install::{detect, SteamInstall};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub steam: Mutex<Option<SteamInstall>>,
    pub settings: Mutex<Settings>,
    pub data_dir: PathBuf,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> AppResult<Self> {
        std::fs::create_dir_all(&data_dir)?;
        let settings_path = data_dir.join("settings.json");
        let settings = crate::settings::load(&settings_path)?;
        let steam = match settings.steam_path_override.as_ref() {
            Some(p) => crate::steam::install::validate_steam_root(p).ok(),
            None => detect().ok(),
        };
        let http = reqwest::Client::builder()
            .user_agent("steam-config-transfer/0.1")
            .build()?;
        Ok(Self {
            steam: Mutex::new(steam),
            settings: Mutex::new(settings),
            data_dir,
            http,
        })
    }

    pub fn settings_path(&self) -> PathBuf { self.data_dir.join("settings.json") }
    pub fn games_cache_path(&self) -> PathBuf { self.data_dir.join("games.json") }
    pub fn avatars_dir(&self) -> PathBuf { self.data_dir.join("avatars") }
    pub fn backups_root(&self) -> PathBuf { self.data_dir.join("backups") }
}
```

- [ ] **Step 2: Bridge mod stub**

Create `core/src/bridge/mod.rs`:

```rust
pub mod state;
pub mod commands;
```

Create `core/src/bridge/commands.rs`:

```rust
use crate::bridge::state::AppState;
use crate::error::{AppError, AppResult};
use crate::steam::accounts::Account;
use tauri::State;

#[tauri::command]
pub async fn list_accounts(state: State<'_, AppState>) -> AppResult<Vec<Account>> {
    let install = state.steam.lock().unwrap().clone()
        .ok_or(AppError::SteamNotFound)?;
    let accounts = crate::steam::accounts::discover(&install)?;
    Ok(accounts)
}
```

- [ ] **Step 3: Wire bridge in lib.rs**

In `core/src/lib.rs`:

```rust
pub mod archive;
pub mod bridge;
pub mod error;
pub mod settings;
pub mod steam;
pub mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = app.path()
                .app_data_dir()
                .expect("app_data_dir");
            let state = bridge::state::AppState::new(data_dir)
                .expect("initialize state");
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge::commands::list_accounts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Modify `core/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { steam_config_transfer_lib::run() }
```

(The crate name should match `core/Cargo.toml` `[lib].name`. Default scaffold uses `<package_name>_lib`. Verify with `grep '\[lib\]' core/Cargo.toml` and adjust the function call as needed.)

- [ ] **Step 4: Add `tauri::AppHandle` import requirements**

Make sure `tauri::Manager` is in scope in `lib.rs` (`use tauri::Manager;`).

- [ ] **Step 5: Build**

```bash
cd core && cargo check && cd ..
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add core
git commit -m "feat: bridge module with AppState and list_accounts command"
```

---

### Task 6.2: Bridge — list_games + cache_avatar + open_path commands

**Files:**
- Modify: `core/src/bridge/commands.rs`, `core/src/lib.rs`

- [ ] **Step 1: Add commands**

Append to `core/src/bridge/commands.rs`:

```rust
use crate::steam::games::GameRef;
use crate::steam::metadata::GameMetadata;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct GameView {
    #[serde(flatten)] pub game: GameRef,
    pub name: String,
    pub header_image_url: String,
}

#[tauri::command]
pub async fn list_games(state: State<'_, AppState>, steam_id_32: u32) -> AppResult<Vec<GameView>> {
    let install = state.steam.lock().unwrap().clone()
        .ok_or(AppError::SteamNotFound)?;
    let games = crate::steam::games::list_for_account(&install, steam_id_32)?;
    let cache_path = state.games_cache_path();
    let mut cache = crate::steam::metadata::load_cache(&cache_path)?;
    let ids: Vec<u32> = games.iter().map(|g| g.app_id).collect();
    crate::steam::metadata::ensure_cached(&state.http, &cache_path, &mut cache, &ids).await?;
    Ok(games.into_iter().map(|g| {
        let meta = cache.get(&g.app_id).cloned().unwrap_or_else(|| GameMetadata {
            app_id: g.app_id,
            name: format!("App {}", g.app_id),
            header_image_url: crate::steam::metadata::header_image_url(g.app_id),
        });
        GameView { game: g, name: meta.name, header_image_url: meta.header_image_url }
    }).collect())
}

#[tauri::command]
pub async fn ensure_avatar(state: State<'_, AppState>, steam_id_64: String) -> AppResult<PathBuf> {
    let install = state.steam.lock().unwrap().clone()
        .ok_or(AppError::SteamNotFound)?;
    if let Some(p) = crate::steam::avatars::local_avatar(&install, &steam_id_64) { return Ok(p); }
    let avatars_dir = state.avatars_dir();
    crate::steam::avatars::fetch_remote_avatar(&state.http, &steam_id_64, &avatars_dir).await
}

#[tauri::command]
pub async fn open_path_in_explorer(path: PathBuf) -> AppResult<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(path).spawn()?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = path; Ok(()) }
}
```

- [ ] **Step 2: Register commands in lib.rs**

Update the `invoke_handler` list:

```rust
.invoke_handler(tauri::generate_handler![
    bridge::commands::list_accounts,
    bridge::commands::list_games,
    bridge::commands::ensure_avatar,
    bridge::commands::open_path_in_explorer,
])
```

- [ ] **Step 3: Build**

```bash
cd core && cargo check && cd ..
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add core
git commit -m "feat: bridge commands for games, avatars, explorer reveal"
```

---

### Task 6.3: Bridge — backups + transfer + restore + settings commands

**Files:**
- Modify: `core/src/bridge/commands.rs`, `core/src/lib.rs`

- [ ] **Step 1: Add remaining commands**

Append to `core/src/bridge/commands.rs`:

```rust
use crate::archive::list::BackupRecord;
use crate::archive::manifest::BackupReason;
use crate::settings::Settings;
use crate::sync::transfer::{run_transfer, TransferOptions, TransferOutcome, TransferPair};

#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> AppResult<Vec<BackupRecord>> {
    let backups_root = state.backups_root();
    crate::archive::list::list_all(&backups_root)
}

#[tauri::command]
pub async fn create_manual_backup(
    state: State<'_, AppState>,
    steam_id_64: String,
    steam_id_32: u32,
    persona_name: String,
    app_id: u32,
    game_name: String,
) -> AppResult<PathBuf> {
    let install = state.steam.lock().unwrap().clone().ok_or(AppError::SteamNotFound)?;
    let source = install.userdata_dir().join(steam_id_32.to_string()).join(app_id.to_string());
    let backups_root = state.backups_root();
    let res = crate::archive::create::create(crate::archive::create::CreateRequest {
        source_dir: &source,
        steam_id_64: &steam_id_64,
        persona_name: &persona_name,
        app_id, game_name: &game_name,
        reason: BackupReason::Manual,
        backup_root: &backups_root,
    })?;
    Ok(res.archive_path)
}

#[tauri::command]
pub async fn delete_backup(archive_path: PathBuf) -> AppResult<()> {
    std::fs::remove_file(archive_path)?;
    Ok(())
}

#[tauri::command]
pub async fn run_transfer_cmd(
    state: State<'_, AppState>,
    pairs: Vec<TransferPair>,
) -> AppResult<Vec<TransferOutcome>> {
    let install = state.steam.lock().unwrap().clone().ok_or(AppError::SteamNotFound)?;
    let backups_root = state.backups_root();
    let retention = state.settings.lock().unwrap().backup_retention_per_pair;
    run_transfer(&install, &pairs, TransferOptions {
        backup_root: &backups_root, retention_per_pair: retention,
    })
}

#[tauri::command]
pub async fn restore_backup(
    state: State<'_, AppState>,
    archive_path: PathBuf,
    target_steam_id_32: u32,
) -> AppResult<PathBuf> {
    let install = state.steam.lock().unwrap().clone().ok_or(AppError::SteamNotFound)?;
    let manifest = crate::archive::list::read_manifest(&archive_path)?;
    let size = std::fs::metadata(&archive_path).map(|m| m.len()).unwrap_or(0);
    let record = BackupRecord { archive_path, size_bytes: size, manifest };
    let backup_root = state.backups_root();
    crate::archive::restore::restore(&install, &record, target_steam_id_32, &backup_root)
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
pub async fn update_settings(state: State<'_, AppState>, settings: Settings) -> AppResult<()> {
    let path = state.settings_path();
    crate::settings::save(&path, &settings)?;
    *state.settings.lock().unwrap() = settings.clone();
    if let Some(p) = settings.steam_path_override.as_ref() {
        if let Ok(install) = crate::steam::install::validate_steam_root(p) {
            *state.steam.lock().unwrap() = Some(install);
        }
    } else if let Ok(install) = crate::steam::install::detect() {
        *state.steam.lock().unwrap() = Some(install);
    }
    Ok(())
}

#[tauri::command]
pub async fn pick_steam_path(handle: tauri::AppHandle) -> AppResult<Option<PathBuf>> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    handle.dialog().file().pick_folder(move |p| { let _ = tx.send(p); });
    let chosen = rx.recv().ok().flatten();
    Ok(chosen.and_then(|p| p.into_path().ok()))
}
```

- [ ] **Step 2: Register all commands**

Update `invoke_handler` in `core/src/lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    bridge::commands::list_accounts,
    bridge::commands::list_games,
    bridge::commands::ensure_avatar,
    bridge::commands::open_path_in_explorer,
    bridge::commands::list_backups,
    bridge::commands::create_manual_backup,
    bridge::commands::delete_backup,
    bridge::commands::run_transfer_cmd,
    bridge::commands::restore_backup,
    bridge::commands::get_settings,
    bridge::commands::update_settings,
    bridge::commands::pick_steam_path,
])
```

- [ ] **Step 3: Build**

```bash
cd core && cargo check && cd ..
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add core
git commit -m "feat: bridge commands for backups, transfer, restore, settings"
```

---

## Phase 7 — Frontend Tauri Client + Account/Library/Backup Features

### Task 7.1: Typed tauri-client wrapper

**Files:**
- Create: `ui/lib/tauri-client.ts`, `ui/types/domain.ts`

- [ ] **Step 1: Domain types**

Create `ui/types/domain.ts`:

```ts
export type Account = {
  steam_id_64: string;
  steam_id_32: number;
  account_name: string;
  persona_name: string;
  avatar_path: string | null;
  last_login: string | null;
  has_userdata: boolean;
};

export type GameView = {
  app_id: number;
  config_path: string;
  config_size_bytes: number;
  last_modified: string | null;
  name: string;
  header_image_url: string;
};

export type BackupReason = "Manual" | "PreCopy" | "PreRestore";

export type Manifest = {
  schema_version: number;
  created_at: string;
  steam_id_64: string;
  persona_name_at_backup: string;
  app_id: number;
  game_name_at_backup: string;
  reason: BackupReason;
  source_path: string;
  byte_size: number;
};

export type BackupRecord = {
  archive_path: string;
  size_bytes: number;
  manifest: Manifest;
};

export type TransferPair = {
  source_steam_id_64: string;
  target_steam_id_64: string;
  source_steam_id_32: number;
  target_steam_id_32: number;
  source_persona: string;
  target_persona: string;
  app_id: number;
  game_name: string;
};

export type TransferOutcome = {
  pair: TransferPair;
  success: boolean;
  error: string | null;
  backup_path: string | null;
};

export type Settings = {
  steam_path_override: string | null;
  backup_retention_per_pair: number;
  last_update_check: string | null;
};

export type AppError = { code: string; message: string };
```

- [ ] **Step 2: Tauri client**

Create `ui/lib/tauri-client.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type {
  Account, GameView, BackupRecord, TransferPair, TransferOutcome,
  Settings, AppError,
} from "@/types/domain";

function unwrap<T>(p: Promise<T>): Promise<T> {
  return p.catch((raw) => {
    const err: AppError = typeof raw === "object" && raw && "code" in raw
      ? raw as AppError
      : { code: "Unknown", message: String(raw) };
    throw err;
  });
}

export const api = {
  listAccounts: () => unwrap(invoke<Account[]>("list_accounts")),
  listGames: (steam_id_32: number) =>
    unwrap(invoke<GameView[]>("list_games", { steamId32: steam_id_32 })),
  ensureAvatar: (steam_id_64: string) =>
    unwrap(invoke<string>("ensure_avatar", { steamId64: steam_id_64 })),
  openPathInExplorer: (path: string) =>
    unwrap(invoke<void>("open_path_in_explorer", { path })),
  listBackups: () => unwrap(invoke<BackupRecord[]>("list_backups")),
  createManualBackup: (args: {
    steam_id_64: string; steam_id_32: number; persona_name: string;
    app_id: number; game_name: string;
  }) => unwrap(invoke<string>("create_manual_backup", {
    steamId64: args.steam_id_64, steamId32: args.steam_id_32,
    personaName: args.persona_name, appId: args.app_id, gameName: args.game_name,
  })),
  deleteBackup: (archive_path: string) =>
    unwrap(invoke<void>("delete_backup", { archivePath: archive_path })),
  runTransfer: (pairs: TransferPair[]) =>
    unwrap(invoke<TransferOutcome[]>("run_transfer_cmd", { pairs })),
  restoreBackup: (archive_path: string, target_steam_id_32: number) =>
    unwrap(invoke<string>("restore_backup", {
      archivePath: archive_path, targetSteamId32: target_steam_id_32,
    })),
  getSettings: () => unwrap(invoke<Settings>("get_settings")),
  updateSettings: (settings: Settings) =>
    unwrap(invoke<void>("update_settings", { settings })),
  pickSteamPath: () => unwrap(invoke<string | null>("pick_steam_path")),
};
```

- [ ] **Step 3: Install @tauri-apps/api**

Already installed by the scaffold. Verify with:

```bash
grep '"@tauri-apps/api"' package.json
```

Expected: present. If not, `pnpm add @tauri-apps/api`.

- [ ] **Step 4: Build typecheck**

```bash
pnpm tsc -b
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add ui/lib/tauri-client.ts ui/types/domain.ts
git commit -m "feat: typed tauri-client wrapper + domain types"
```

---

### Task 7.2: Accounts feature (queries + components)

**Files:**
- Create: `ui/features/accounts/api/list-accounts.ts`, `ui/features/accounts/components/avatar-image.tsx`, `ui/features/accounts/components/account-chip.tsx`, `ui/features/accounts/components/account-selector.tsx`, `ui/features/accounts/components/target-list.tsx`, `ui/features/accounts/index.ts`
- Modify: `ui/main.tsx`, `package.json`

- [ ] **Step 1: Install @tanstack/react-query**

```bash
pnpm add @tanstack/react-query
```

- [ ] **Step 2: Wire QueryClientProvider**

Edit `ui/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./app/App";
import { ThemeProvider } from "./app/providers/theme-provider";
import "./app/globals.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider><App /></ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: List accounts query**

Create `ui/features/accounts/api/list-accounts.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const accountsQueryKey = ["accounts"] as const;

export function useAccounts() {
  return useQuery({ queryKey: accountsQueryKey, queryFn: api.listAccounts });
}
```

- [ ] **Step 4: Avatar component (uses convertFileSrc to render local files)**

Create `ui/features/accounts/components/avatar-image.tsx`:

```tsx
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { api } from "@/lib/tauri-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AvatarImageBlock({
  steamId64,
  initialPath,
  fallback,
  className,
}: {
  steamId64: string;
  initialPath?: string | null;
  fallback: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(
    initialPath ? convertFileSrc(initialPath) : null
  );
  useEffect(() => {
    if (src) return;
    let alive = true;
    api.ensureAvatar(steamId64)
      .then((path) => alive && setSrc(convertFileSrc(path)))
      .catch(() => {});
    return () => { alive = false; };
  }, [steamId64, src]);
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={fallback} />}
      <AvatarFallback>{fallback.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
```

- [ ] **Step 5: AccountChip + AccountSelector + TargetList**

Create `ui/features/accounts/components/account-chip.tsx`:

```tsx
import type { Account } from "@/types/domain";
import { AvatarImageBlock } from "./avatar-image";

export function AccountChip({ account }: { account: Account }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <AvatarImageBlock
        steamId64={account.steam_id_64}
        initialPath={account.avatar_path}
        fallback={account.persona_name}
        className="size-7"
      />
      <span className="text-sm font-medium">{account.persona_name}</span>
    </div>
  );
}
```

Create `ui/features/accounts/components/account-selector.tsx`:

```tsx
import type { Account } from "@/types/domain";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AvatarImageBlock } from "./avatar-image";

export function AccountSelector({
  accounts, value, onChange,
}: {
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Choose source account..." />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.steam_id_64} value={a.steam_id_64}>
            <div className="flex items-center gap-2">
              <AvatarImageBlock
                steamId64={a.steam_id_64}
                initialPath={a.avatar_path}
                fallback={a.persona_name}
                className="size-5"
              />
              <span>{a.persona_name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

Create `ui/features/accounts/components/target-list.tsx`:

```tsx
import type { Account } from "@/types/domain";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarImageBlock } from "./avatar-image";

export function TargetList({
  accounts, sourceId, selected, onToggle,
}: {
  accounts: Account[];
  sourceId: string | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const targets = accounts.filter((a) => a.steam_id_64 !== sourceId);
  return (
    <div className="space-y-2">
      {targets.map((a) => {
        const id = `target-${a.steam_id_64}`;
        return (
          <label
            key={a.steam_id_64}
            htmlFor={id}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
          >
            <Checkbox
              id={id}
              checked={selected.has(a.steam_id_64)}
              onCheckedChange={() => onToggle(a.steam_id_64)}
            />
            <AvatarImageBlock
              steamId64={a.steam_id_64}
              initialPath={a.avatar_path}
              fallback={a.persona_name}
              className="size-7"
            />
            <span className="text-sm font-medium">{a.persona_name}</span>
          </label>
        );
      })}
      {targets.length === 0 && (
        <p className="text-sm text-muted-foreground">No other accounts available.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Feature barrel**

Create `ui/features/accounts/index.ts`:

```ts
export { useAccounts } from "./api/list-accounts";
export { AccountChip } from "./components/account-chip";
export { AccountSelector } from "./components/account-selector";
export { TargetList } from "./components/target-list";
export { AvatarImageBlock } from "./components/avatar-image";
```

- [ ] **Step 7: Typecheck**

```bash
pnpm tsc -b
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add ui package.json
git commit -m "feat: accounts feature with selector, target list, avatars"
```

---

### Task 7.3: Library feature (game grid)

**Files:**
- Create: `ui/features/library/api/list-games.ts`, `ui/features/library/components/game-card.tsx`, `ui/features/library/components/game-grid.tsx`, `ui/features/library/index.ts`

- [ ] **Step 1: Query**

Create `ui/features/library/api/list-games.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const gamesKey = (id32: number) => ["games", id32] as const;

export function useGames(steam_id_32: number | null) {
  return useQuery({
    queryKey: gamesKey(steam_id_32 ?? -1),
    queryFn: () => api.listGames(steam_id_32!),
    enabled: steam_id_32 != null,
  });
}
```

- [ ] **Step 2: GameCard**

Create `ui/features/library/components/game-card.tsx`:

```tsx
import type { GameView } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export function GameCard({
  game, selected, onToggle,
}: { game: GameView; selected: boolean; onToggle: () => void }) {
  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-primary"
      )}
      onClick={onToggle}
    >
      <div className="relative aspect-[460/215] bg-muted">
        <img
          src={game.header_image_url}
          alt={game.name}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute top-2 left-2">
          <Checkbox checked={selected} onCheckedChange={onToggle} />
        </div>
      </div>
      <div className="p-3 space-y-1">
        <div className="font-medium text-sm leading-tight truncate" title={game.name}>{game.name}</div>
        <div className="text-xs text-muted-foreground">
          {fmtSize(game.config_size_bytes)} · ID {game.app_id}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: GameGrid**

Create `ui/features/library/components/game-grid.tsx`:

```tsx
import type { GameView } from "@/types/domain";
import { GameCard } from "./game-card";

export function GameGrid({
  games, selected, onToggle,
}: { games: GameView[]; selected: Set<number>; onToggle: (id: number) => void }) {
  if (games.length === 0) {
    return <div className="text-sm text-muted-foreground p-6">No game configs found for this account.</div>;
  }
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {games.map((g) => (
        <GameCard
          key={g.app_id}
          game={g}
          selected={selected.has(g.app_id)}
          onToggle={() => onToggle(g.app_id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Barrel**

Create `ui/features/library/index.ts`:

```ts
export { useGames } from "./api/list-games";
export { GameCard } from "./components/game-card";
export { GameGrid } from "./components/game-grid";
```

- [ ] **Step 5: Commit**

```bash
git add ui/features/library
git commit -m "feat: library feature with multi-select game grid"
```

---

### Task 7.4: Transfer feature wiring

**Files:**
- Create: `ui/features/transfer/stores/transfer-store.ts`, `ui/features/transfer/components/action-bar.tsx`, `ui/features/transfer/components/transfer-results-dialog.tsx`, `ui/features/transfer/components/transfer-confirm-dialog.tsx`
- Modify: `ui/features/transfer/components/transfer-page.tsx`
- Install: `zustand`

- [ ] **Step 1: Install zustand**

```bash
pnpm add zustand
```

- [ ] **Step 2: Store**

Create `ui/features/transfer/stores/transfer-store.ts`:

```ts
import { create } from "zustand";

type S = {
  sourceId: string | null;
  targetIds: Set<string>;
  selectedAppIds: Set<number>;
  setSource: (id: string | null) => void;
  toggleTarget: (id: string) => void;
  toggleApp: (id: number) => void;
  reset: () => void;
};

export const useTransferStore = create<S>((set) => ({
  sourceId: null,
  targetIds: new Set(),
  selectedAppIds: new Set(),
  setSource: (id) => set(() => ({ sourceId: id, selectedAppIds: new Set() })),
  toggleTarget: (id) => set((s) => {
    const next = new Set(s.targetIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { targetIds: next };
  }),
  toggleApp: (id) => set((s) => {
    const next = new Set(s.selectedAppIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedAppIds: next };
  }),
  reset: () => set({ sourceId: null, targetIds: new Set(), selectedAppIds: new Set() }),
}));
```

- [ ] **Step 3: ActionBar**

Create `ui/features/transfer/components/action-bar.tsx`:

```tsx
import { Button } from "@/components/ui/button";

export function ActionBar({
  gamesCount, targetsCount, onCancel, onTransfer, busy,
}: {
  gamesCount: number;
  targetsCount: number;
  onCancel: () => void;
  onTransfer: () => void;
  busy: boolean;
}) {
  const pairs = gamesCount * targetsCount;
  const ready = pairs > 0;
  return (
    <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-4">
      <p className="text-sm text-muted-foreground flex-1">
        {ready
          ? `Transfer ${gamesCount} game${gamesCount === 1 ? "" : "s"} to ${targetsCount} account${targetsCount === 1 ? "" : "s"}. Up to ${pairs} configs will be auto-backed-up.`
          : "Pick a source, target accounts, and games to transfer."}
      </p>
      <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button onClick={onTransfer} disabled={!ready || busy}>
        {busy ? "Transferring..." : `Transfer →`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: ConfirmDialog**

Create `ui/features/transfer/components/transfer-confirm-dialog.tsx`:

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TransferConfirmDialog({
  open, onOpenChange, onConfirm, gamesCount, targetsCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  gamesCount: number;
  targetsCount: number;
}) {
  const pairs = gamesCount * targetsCount;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer {gamesCount} games to {targetsCount} accounts?</AlertDialogTitle>
          <AlertDialogDescription>
            Each target's existing config for these games will be backed up automatically before being overwritten.
            Steam must not be running during the transfer. {pairs} configs will be processed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Transfer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 5: ResultsDialog**

Create `ui/features/transfer/components/transfer-results-dialog.tsx`:

```tsx
import type { TransferOutcome } from "@/types/domain";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TransferResultsDialog({
  open, onOpenChange, results,
}: { open: boolean; onOpenChange: (o: boolean) => void; results: TransferOutcome[] }) {
  const ok = results.filter((r) => r.success).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer complete</DialogTitle>
          <DialogDescription>
            {ok} of {results.length} succeeded.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[40vh] pr-4">
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.success
                  ? <Check className="size-4 text-green-600 mt-0.5" />
                  : <X className="size-4 text-destructive mt-0.5" />}
                <div>
                  <div>
                    <span className="font-medium">{r.pair.game_name}</span>
                    {" "}→ {r.pair.target_persona}
                  </div>
                  {!r.success && <div className="text-destructive text-xs">{r.error}</div>}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: TransferPage**

Replace `ui/features/transfer/components/transfer-page.tsx`:

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";
import type { TransferPair, TransferOutcome } from "@/types/domain";
import { useAccounts, AccountSelector, TargetList } from "@/features/accounts";
import { useGames, GameGrid } from "@/features/library";
import { useTransferStore } from "../stores/transfer-store";
import { ActionBar } from "./action-bar";
import { TransferConfirmDialog } from "./transfer-confirm-dialog";
import { TransferResultsDialog } from "./transfer-results-dialog";

export function TransferPage() {
  const { data: accounts = [] } = useAccounts();
  const { sourceId, targetIds, selectedAppIds, setSource, toggleTarget, toggleApp, reset }
    = useTransferStore();
  const source = accounts.find((a) => a.steam_id_64 === sourceId);
  const { data: games = [] } = useGames(source?.steam_id_32 ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<TransferOutcome[] | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (pairs: TransferPair[]) => api.runTransfer(pairs),
    onSuccess: (out) => {
      setResults(out);
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const buildPairs = (): TransferPair[] => {
    if (!source) return [];
    const targets = accounts.filter((a) => targetIds.has(a.steam_id_64));
    const selectedGames = games.filter((g) => selectedAppIds.has(g.app_id));
    const pairs: TransferPair[] = [];
    for (const t of targets) {
      for (const g of selectedGames) {
        pairs.push({
          source_steam_id_64: source.steam_id_64,
          target_steam_id_64: t.steam_id_64,
          source_steam_id_32: source.steam_id_32,
          target_steam_id_32: t.steam_id_32,
          source_persona: source.persona_name,
          target_persona: t.persona_name,
          app_id: g.app_id,
          game_name: g.name,
        });
      }
    }
    return pairs;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="grid grid-cols-[1fr_320px] flex-1 overflow-hidden">
        <div className="overflow-y-auto p-6 space-y-6">
          <section>
            <h2 className="text-sm font-semibold mb-2">Source account</h2>
            <AccountSelector accounts={accounts} value={sourceId} onChange={setSource} />
          </section>
          <section>
            <h2 className="text-sm font-semibold mb-3">Games</h2>
            {source
              ? <GameGrid games={games} selected={selectedAppIds} onToggle={toggleApp} />
              : <p className="text-sm text-muted-foreground">Pick a source account first.</p>}
          </section>
        </div>
        <aside className="border-l p-6 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-3">Targets</h2>
          <TargetList
            accounts={accounts}
            sourceId={sourceId}
            selected={targetIds}
            onToggle={toggleTarget}
          />
        </aside>
      </div>
      <ActionBar
        gamesCount={selectedAppIds.size}
        targetsCount={targetIds.size}
        onCancel={reset}
        onTransfer={() => setConfirmOpen(true)}
        busy={mutation.isPending}
      />
      <TransferConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        gamesCount={selectedAppIds.size}
        targetsCount={targetIds.size}
        onConfirm={() => { setConfirmOpen(false); mutation.mutate(buildPairs()); }}
      />
      <TransferResultsDialog
        open={results !== null}
        onOpenChange={(o) => !o && setResults(null)}
        results={results ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 7: Smoke test**

```bash
pnpm tauri:dev
```

Expected: app launches, account dropdown lists local accounts, picking one shows games. Don't trigger an actual transfer yet unless you have a test Steam install.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: transfer page wiring source, targets, games, action bar"
```

---

### Task 7.5: Backups feature

**Files:**
- Create: `ui/features/backups/api/queries.ts`, `ui/features/backups/components/backup-row-actions.tsx`, `ui/features/backups/components/backups-table.tsx`
- Modify: `ui/features/backups/components/backups-page.tsx`

- [ ] **Step 1: Queries**

Create `ui/features/backups/api/queries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const backupsKey = ["backups"] as const;

export function useBackups() {
  return useQuery({ queryKey: backupsKey, queryFn: api.listBackups });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archive_path: string) => api.deleteBackup(archive_path),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupsKey }),
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { archive_path: string; target_steam_id_32: number }) =>
      api.restoreBackup(args.archive_path, args.target_steam_id_32),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupsKey }),
  });
}
```

- [ ] **Step 2: Row actions component**

Create `ui/features/backups/components/backup-row-actions.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, RotateCcw, FolderOpen, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/tauri-client";
import type { BackupRecord } from "@/types/domain";
import { useDeleteBackup, useRestoreBackup } from "../api/queries";
import { useAccounts } from "@/features/accounts";

export function BackupRowActions({ record }: { record: BackupRecord }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const del = useDeleteBackup();
  const restore = useRestoreBackup();
  const { data: accounts = [] } = useAccounts();
  const owner = accounts.find((a) => a.steam_id_64 === record.manifest.steam_id_64);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!owner}
            onClick={() => setConfirmRestore(true)}
          >
            <RotateCcw className="size-4 mr-2" /> Restore
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => api.openPathInExplorer(record.archive_path).catch((e) => toast.error(e.message))}
          >
            <FolderOpen className="size-4 mr-2" /> Reveal in Explorer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive">
            <Trash2 className="size-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the backup file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate(record.archive_path, {
                onSuccess: () => toast.success("Backup deleted"),
                onError: (e) => toast.error(e.message),
              })}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {record.manifest.game_name_at_backup}?</AlertDialogTitle>
            <AlertDialogDescription>
              The current config for this game on {owner?.persona_name} will be backed up first
              (PreRestore). Steam must not be running.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => owner && restore.mutate(
                { archive_path: record.archive_path, target_steam_id_32: owner.steam_id_32 },
                {
                  onSuccess: () => toast.success("Backup restored"),
                  onError: (e) => toast.error(e.message),
                },
              )}
            >Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 3: Table component**

Create `ui/features/backups/components/backups-table.tsx`:

```tsx
import type { BackupRecord } from "@/types/domain";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BackupRowActions } from "./backup-row-actions";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"]; let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export function BackupsTable({ records }: { records: BackupRecord[] }) {
  if (records.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">No backups yet.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Game</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => (
          <TableRow key={r.archive_path}>
            <TableCell className="font-mono text-xs">
              {new Date(r.manifest.created_at).toLocaleString()}
            </TableCell>
            <TableCell>{r.manifest.persona_name_at_backup}</TableCell>
            <TableCell>{r.manifest.game_name_at_backup}</TableCell>
            <TableCell>
              <Badge variant={r.manifest.reason === "Manual" ? "default" : "secondary"}>
                {r.manifest.reason}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">{fmtBytes(r.size_bytes)}</TableCell>
            <TableCell className="w-12"><BackupRowActions record={r} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: BackupsPage**

Replace `ui/features/backups/components/backups-page.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useBackups } from "../api/queries";
import { BackupsTable } from "./backups-table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { BackupReason } from "@/types/domain";

const ALL = "__all__";

export function BackupsPage() {
  const { data: records = [] } = useBackups();
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<BackupReason | typeof ALL>(ALL);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (reason !== ALL && r.manifest.reason !== reason) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.manifest.game_name_at_backup.toLowerCase().includes(q)
          || r.manifest.persona_name_at_backup.toLowerCase().includes(q);
      }
      return true;
    });
  }, [records, reason, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search games or accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={reason} onValueChange={(v) => setReason(v as BackupReason | typeof ALL)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All reasons</SelectItem>
            <SelectItem value="Manual">Manual</SelectItem>
            <SelectItem value="PreCopy">Pre-Copy</SelectItem>
            <SelectItem value="PreRestore">Pre-Restore</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg">
        <BackupsTable records={filtered} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add ui/features/backups
git commit -m "feat: backups feature with table, filters, and row actions"
```

---

### Task 7.6: Settings feature

**Files:**
- Create: `ui/features/settings/api/queries.ts`
- Modify: `ui/features/settings/components/settings-page.tsx`

- [ ] **Step 1: Queries**

Create `ui/features/settings/api/queries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";
import type { Settings } from "@/types/domain";

export const settingsKey = ["settings"] as const;

export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: api.getSettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api.updateSettings(s),
    onSuccess: () => qc.invalidateQueries(),
  });
}
```

- [ ] **Step 2: Settings page**

Replace `ui/features/settings/components/settings-page.tsx`:

```tsx
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "../api/queries";
import { api } from "@/lib/tauri-client";
import { useTheme } from "@/app/providers/theme-provider";

export function SettingsPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const [steamPath, setSteamPath] = useState("");
  const [retention, setRetention] = useState(20);

  useEffect(() => {
    if (settings) {
      setSteamPath(settings.steam_path_override ?? "");
      setRetention(settings.backup_retention_per_pair);
    }
  }, [settings]);

  const save = () => {
    if (!settings) return;
    update.mutate({
      ...settings,
      steam_path_override: steamPath ? steamPath : null,
      backup_retention_per_pair: retention,
    }, {
      onSuccess: () => toast.success("Settings saved"),
      onError: (e: { message: string }) => toast.error(e.message),
    });
  };

  const pickPath = async () => {
    try {
      const picked = await api.pickSteamPath();
      if (picked) setSteamPath(picked);
    } catch (e: unknown) {
      toast.error((e as { message: string }).message);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Steam install path</h2>
          <p className="text-sm text-muted-foreground">
            Override the auto-detected Steam folder.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={steamPath}
            placeholder="(auto-detect)"
            onChange={(e) => setSteamPath(e.target.value)}
          />
          <Button variant="outline" onClick={pickPath}>Browse...</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Backup retention</h2>
          <p className="text-sm text-muted-foreground">
            Auto-delete old backups when more than this number exist per (account, game).
            Manual backups are never auto-deleted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="retention" className="w-24">Keep last</Label>
          <Input
            id="retention"
            type="number"
            min={1}
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value) || 1)}
            className="w-24"
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Appearance</h2>
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-24">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={update.isPending}>Save</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

```bash
pnpm tauri:dev
```

Expected: settings page renders, theme selector works, retention input updates.

- [ ] **Step 4: Commit**

```bash
git add ui/features/settings
git commit -m "feat: settings page with steam path, retention, theme"
```

---

## Phase 8 — Auto-Updates

### Task 8.1: Configure tauri-plugin-updater

**Files:**
- Modify: `core/tauri.conf.json`, `core/Cargo.toml` (already added), `core/src/lib.rs`

- [ ] **Step 1: Generate signing keypair (engineer-only, one-time)**

```bash
pnpm tauri signer generate -w ~/.tauri/steam-config-transfer.key
```

Save the printed public key (we paste into tauri.conf.json) and store the private key path + password as GitHub Actions secrets later.

- [ ] **Step 2: Add updater plugin config to `core/tauri.conf.json`**

Add a `plugins.updater` section:

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/<owner>/steam-config-transfer/releases/latest/download/latest.json"
    ],
    "pubkey": "<PASTE_PUBLIC_KEY_HERE>"
  }
}
```

Replace `<owner>` with the GitHub user/org and `<PASTE_PUBLIC_KEY_HERE>` with the public key from Step 1.

- [ ] **Step 3: Update check command**

Append to `core/src/bridge/commands.rs`:

```rust
use tauri_plugin_updater::UpdaterExt;

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(handle: tauri::AppHandle) -> AppResult<UpdateInfo> {
    let current_version = handle.package_info().version.to_string();
    let updater = handle.updater()
        .map_err(|e| AppError::BackupFailed(e.to_string()))?;
    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            current_version,
            notes: update.body.clone(),
        }),
        Ok(None) => Ok(UpdateInfo { available: false, version: None, current_version, notes: None }),
        Err(e) => Err(AppError::Network(reqwest::Error::from(
            // wrap as a generic error; we don't have a Network variant for non-reqwest
            // so fall back to BackupFailed which surfaces the message cleanly
            std::convert::identity(e)
        ).into())).or_else(|_| Err(AppError::BackupFailed(format!("update check: {e}")))),
    }
}

#[tauri::command]
pub async fn install_update(handle: tauri::AppHandle) -> AppResult<()> {
    let updater = handle.updater()
        .map_err(|e| AppError::BackupFailed(e.to_string()))?;
    if let Some(update) = updater.check().await
        .map_err(|e| AppError::BackupFailed(e.to_string()))? {
        update.download_and_install(|_, _| {}, || {}).await
            .map_err(|e| AppError::BackupFailed(e.to_string()))?;
        handle.restart();
    }
    Ok(())
}
```

- [ ] **Step 4: Register the commands**

Add `bridge::commands::check_for_update` and `bridge::commands::install_update` to `tauri::generate_handler![...]` in `lib.rs`.

- [ ] **Step 5: Frontend wrapper**

Append to `ui/lib/tauri-client.ts`:

```ts
export type UpdateInfo = {
  available: boolean;
  version: string | null;
  current_version: string;
  notes: string | null;
};

api.checkForUpdate = () => unwrap(invoke<UpdateInfo>("check_for_update"));
api.installUpdate = () => unwrap(invoke<void>("install_update"));
```

(Adjust `api` to be a `let` or extend its type — easier to just add the methods to the object literal earlier and update the import accordingly.)

- [ ] **Step 6: On-launch silent check**

Create `ui/features/settings/api/update-check.ts`:

```ts
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";

let checked = false;
export function useUpdateCheckOnLaunch() {
  useEffect(() => {
    if (checked) return;
    checked = true;
    api.checkForUpdate?.().then((info) => {
      if (info?.available) {
        toast(`Update v${info.version} available`, {
          action: { label: "Install", onClick: () => api.installUpdate?.() },
          duration: 10_000,
        });
      }
    }).catch(() => { /* silent */ });
  }, []);
}
```

Call `useUpdateCheckOnLaunch()` from `AppShell`.

- [ ] **Step 7: Verify build**

```bash
pnpm tauri:build
```

Expected: build succeeds (skip if no Windows toolchain at hand; just `cargo check` instead).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tauri-plugin-updater config + on-launch update toast"
```

---

### Task 8.2: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`, `README.md`

- [ ] **Step 1: Workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - name: Install pnpm
        uses: pnpm/action-setup@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install deps
        run: pnpm install --frozen-lockfile
      - name: Build & release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Steam Config Transfer ${{ github.ref_name }}"
          releaseBody: "See the assets to download and install this version."
          releaseDraft: true
          prerelease: false
          projectPath: .
          args: --config core/tauri.conf.json
```

Add a small README explaining release flow. `README.md`:

```markdown
# Steam Config Transfer

Windows desktop utility for copying Steam game configs between accounts on the same machine, with automatic + manual backups.

## Releasing

1. Bump version in `package.json` and `core/tauri.conf.json`.
2. `git tag v0.1.0 && git push --tags`
3. GitHub Actions builds, signs, and uploads a draft release. Edit and publish.

## Required secrets

- `TAURI_SIGNING_PRIVATE_KEY` — output of `tauri signer generate`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password used for the keypair
```

- [ ] **Step 2: Commit**

```bash
git add .github README.md
git commit -m "ci: GitHub Actions release workflow with signed Tauri builds"
```

---

## Phase 9 — Polish & Hand-Off

### Task 9.1: Manual smoke checklist

**Files:**
- Create: `docs/manual-test.md`

- [ ] **Step 1: Document checklist**

Create `docs/manual-test.md`:

```markdown
# Manual Smoke Checklist

Run before each release. Quit Steam first.

## Discovery
- [ ] Launch app. Header shows three nav links.
- [ ] Transfer page lists at least one Steam account from this machine.
- [ ] Each account shows an avatar (local cache or fetched).
- [ ] Picking a source account loads its game library with header art.

## Transfer
- [ ] Select two games and one target. Action bar updates totals.
- [ ] Confirm. Transfer completes. Results dialog shows success per pair.
- [ ] Backups page now shows two PreCopy entries.
- [ ] Open Steam, log in to the target account, verify the configs took effect.

## Backups
- [ ] Filter by reason; manual filter only shows Manual rows.
- [ ] Restore a Manual backup (with Steam closed). Verify the target's config matches the backup.
- [ ] After restore, a PreRestore entry exists.

## Settings
- [ ] Override Steam path to an invalid folder; expect a friendly error toast.
- [ ] Reset to auto-detect; account list reloads.
- [ ] Toggle theme between Light/Dark/System.

## Updater
- [ ] On launch with a newer release published, toast appears with Install button.
- [ ] Clicking Install downloads, swaps the binary, restarts.
```

- [ ] **Step 2: Commit**

```bash
git add docs/manual-test.md
git commit -m "docs: manual smoke checklist for releases"
```

---

### Task 9.2: App icons + final polish

**Files:**
- Replace: `core/icons/*` with project-specific icons (placeholder Tauri icons OK for v1)
- Modify: `core/tauri.conf.json` (`productName`, `version`, window size)

- [ ] **Step 1: Update productName + window**

In `core/tauri.conf.json`, set:
- `productName: "Steam Config Transfer"`
- `app.windows[0].title: "Steam Config Transfer"`
- `app.windows[0].width: 1100`, `height: 750`
- `app.windows[0].minWidth: 900`, `minHeight: 600`
- `app.windows[0].theme: null` (lets the OS chrome follow system)

- [ ] **Step 2: Final smoke run**

```bash
pnpm tauri:dev
```

Expected: app boots cleanly with the new title and size. Cycle through every page, toggle theme, smoke-test transfer (against a test/throwaway Steam account if available).

- [ ] **Step 3: Commit**

```bash
git add core/tauri.conf.json
git commit -m "chore: set product name, window size, polish defaults"
```

---

## Self-Review Notes

- **Spec coverage:** all sections of the design (path detection, account discovery, avatars, games, metadata cache, backup format/retention, transfer safety semantics, restore safety, theming, errors, testing, distribution, auto-update) are covered by the tasks above.
- **Placeholders:** `<owner>` and `<PASTE_PUBLIC_KEY_HERE>` in `tauri.conf.json` are intentional and explicitly called out in their step. The release workflow's `--config core/tauri.conf.json` flag depends on the engineer confirming the renamed `core/` directory before tagging.
- **Type consistency:** `Account`, `GameView`, `BackupRecord`, `Manifest`, `TransferPair`, `TransferOutcome`, and `Settings` types match between Rust serializations and TypeScript domain types. `BackupReason` uses `PascalCase` serialization on both sides.
- **Known follow-ups (not blocking v1):** swap the `Network` error variant in `check_for_update` for a dedicated `Updater` variant once we observe the actual error shape from `tauri-plugin-updater`. Add `tauri-specta` later if hand-mirrored types start drifting.
