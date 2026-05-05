# UI Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three different layout patterns (Transfer = two-pane sidebar, Backups = flat table, Settings = stacked Cards) with one shared "vertical canvas of named sections" pattern, plus shared primitives (`Section`, `AccountGrid`, `AccountCard`) and two data-quality fixes (`Account.display_name`, `GameMetadata.is_known`).

**Architecture:** Phase 1 adds backend fields (`display_name` on `Account`, `is_known` on `GameMetadata`) so the frontend has accurate data. Phase 2 builds the new shared frontend primitives. Phase 3 rewrites the three pages to use them. Phase 4 deletes the now-unused legacy components. The Zustand transfer store keeps its existing shape — progressive disclosure is derived from values, not a `step` field.

**Tech Stack:** Tauri 2, React 19, TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Zustand, Rust 2021.

**Reference spec:** `docs/superpowers/specs/2026-05-05-ui-unification-design.md`

---

## Phase 1 — Backend Data Quality

### Task 1.1: Add `display_name` to `Account`

**Files:**
- Modify: `core/src/steam/accounts.rs`

- [ ] **Step 1: Update the `Account` struct + `discover()` + add a test**

Open `core/src/steam/accounts.rs`. Add `pub display_name: String` to the `Account` struct (after `persona_name`, before `avatar_path`). In `discover()`, compute `display_name` after parsing each entry:

```rust
let display_name = if !e.persona_name.is_empty() {
    e.persona_name.clone()
} else if !e.account_name.is_empty() {
    e.account_name.clone()
} else {
    format!("Steam ID {}", e.steam_id_64)
};
```

Pass it into the `Account { ... }` literal.

Add a test inside the existing `mod tests {}` block:

```rust
#[test]
fn display_name_falls_back_through_persona_account_steam_id() {
    let dir = tempdir().unwrap();
    let root = dir.path();
    std::fs::create_dir_all(root.join("config")).unwrap();
    std::fs::create_dir_all(root.join("userdata/100")).unwrap();
    std::fs::create_dir_all(root.join("userdata/200")).unwrap();
    std::fs::create_dir_all(root.join("userdata/300")).unwrap();
    let vdf = r#"
"users"
{
	"76561197960265828"
	{
		"AccountName" "alice"
		"PersonaName" "Alice"
	}
	"76561197960265928"
	{
		"AccountName" "bob_login"
		"PersonaName" ""
	}
	"76561197960266028"
	{
		"AccountName" ""
		"PersonaName" ""
	}
}
"#;
    write(&root.join("config/loginusers.vdf"), vdf);
    let install = validate_steam_root(root).unwrap();
    let accounts = discover(&install).unwrap();
    let by_id: std::collections::HashMap<_, _> = accounts.iter()
        .map(|a| (a.steam_id_64.as_str(), a)).collect();
    assert_eq!(by_id["76561197960265828"].display_name, "Alice");
    assert_eq!(by_id["76561197960265928"].display_name, "bob_login");
    assert_eq!(by_id["76561197960266028"].display_name, "Steam ID 76561197960266028");
}
```

- [ ] **Step 2: Run the new test**

```bash
cd /home/kevin/repositories/steam-config-transfer/core && cargo test steam::accounts::tests::display_name_falls_back_through_persona_account_steam_id -- --nocapture
```

Expected: 1 passed.

- [ ] **Step 3: Run all existing tests to confirm nothing else broke**

```bash
cd /home/kevin/repositories/steam-config-transfer/core && cargo test
```

Expected: previous passing count + 1 (the new one).

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/repositories/steam-config-transfer
git add core/src/steam/accounts.rs
git commit -m "feat: derive Account.display_name with persona/account_name/steam_id fallback"
```

---

### Task 1.2: Add `is_known` to `GameMetadata`

**Files:**
- Modify: `core/src/steam/metadata.rs`

- [ ] **Step 1: Update the `GameMetadata` struct with `is_known`**

In `core/src/steam/metadata.rs`, add `is_known: bool` to `GameMetadata`. Use a serde default so older cache files (which lack this field) still deserialize cleanly:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMetadata {
    pub app_id: u32,
    pub name: String,
    pub header_image_url: String,
    #[serde(default = "default_true")]
    pub is_known: bool,
}

fn default_true() -> bool { true }
```

- [ ] **Step 2: Update `fetch_one()` and `ensure_cached()` to set the field**

Replace the body of `fetch_one()`'s `Ok(...)` arm and `ensure_cached()`'s match arms. Find the existing `fetch_one` and rewrite as:

```rust
pub async fn fetch_one(client: &reqwest::Client, app_id: u32) -> AppResult<Option<GameMetadata>> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={app_id}&filters=basic"
    );
    let env: AppDetailsEnvelope = client.get(url).send().await?.error_for_status()?.json().await?;
    let resp = env.inner.get(&app_id.to_string());
    Ok(resp.and_then(|r| {
        if r.success {
            r.data.as_ref().map(|d| GameMetadata {
                app_id, name: d.name.clone(), header_image_url: header_image_url(app_id),
                is_known: true,
            })
        } else {
            None
        }
    }))
}
```

In `ensure_cached`, the `Ok(None)` arm currently inserts a fallback entry — update it to mark `is_known: false`:

```rust
        match fetch_one(client, id).await {
            Ok(Some(meta)) => { cache.insert(id, meta); }
            Ok(None) => {
                cache.insert(id, GameMetadata {
                    app_id: id, name: format!("App {id}"),
                    header_image_url: header_image_url(id),
                    is_known: false,
                });
            }
            Err(_) => continue,
        }
```

(Leave the `name: format!("App {id}")` for now — bridge will compute the user-facing name in Task 1.3.)

- [ ] **Step 3: Update existing test to construct with the new field**

The existing `cache_round_trip` test constructs a `GameMetadata` literal. Update it:

```rust
        cache.insert(570, GameMetadata {
            app_id: 570, name: "Dota 2".into(), header_image_url: header_image_url(570),
            is_known: true,
        });
```

- [ ] **Step 4: Add a new test verifying `is_known` round-trips**

Append to the same `mod tests` block:

```rust
    #[test]
    fn is_known_false_round_trips() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        let mut cache = HashMap::new();
        cache.insert(7, GameMetadata {
            app_id: 7, name: "App 7".into(), header_image_url: header_image_url(7),
            is_known: false,
        });
        save_cache(&path, &cache).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert!(!loaded.get(&7).unwrap().is_known);
    }

    #[test]
    fn legacy_cache_without_is_known_defaults_to_true() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("games.json");
        // Write a legacy entry that doesn't include is_known.
        std::fs::write(&path, r#"{"570":{"app_id":570,"name":"Dota 2","header_image_url":"https://example/570.jpg"}}"#).unwrap();
        let loaded = load_cache(&path).unwrap();
        assert!(loaded.get(&570).unwrap().is_known);
    }
```

- [ ] **Step 5: Run tests**

```bash
cd /home/kevin/repositories/steam-config-transfer/core && cargo test steam::metadata::
```

Expected: 4 passing (2 pre-existing + 2 new).

- [ ] **Step 6: Run full suite**

```bash
cd /home/kevin/repositories/steam-config-transfer/core && cargo test
```

Expected: full suite passes.

- [ ] **Step 7: Commit**

```bash
cd /home/kevin/repositories/steam-config-transfer
git add core/src/steam/metadata.rs
git commit -m "feat: add GameMetadata.is_known with backwards-compatible serde default"
```

---

### Task 1.3: Update `bridge::list_games` to use `is_known`

**Files:**
- Modify: `core/src/bridge/commands.rs`

- [ ] **Step 1: Update `GameView` and `list_games`**

Open `core/src/bridge/commands.rs`. Find the `GameView` struct and the `list_games` command. Update `GameView` to expose `is_known`:

```rust
#[derive(Serialize)]
pub struct GameView {
    #[serde(flatten)] pub game: GameRef,
    pub name: String,
    pub header_image_url: String,
    pub is_known: bool,
}
```

In `list_games`, update the construction loop:

```rust
    Ok(games.into_iter().map(|g| {
        let meta = cache.get(&g.app_id).cloned().unwrap_or_else(|| GameMetadata {
            app_id: g.app_id,
            name: format!("App {}", g.app_id),
            header_image_url: crate::steam::metadata::header_image_url(g.app_id),
            is_known: false,
        });
        let display_name = if meta.is_known {
            meta.name.clone()
        } else {
            format!("Untitled · ID {}", meta.app_id)
        };
        GameView {
            game: g,
            name: display_name,
            header_image_url: meta.header_image_url,
            is_known: meta.is_known,
        }
    }).collect())
```

- [ ] **Step 2: Run cargo check**

```bash
cd /home/kevin/repositories/steam-config-transfer/core && cargo check
```

Expected: clean.

- [ ] **Step 3: Run cargo test**

```bash
cd /home/kevin/repositories/steam-config-transfer/core && cargo test
```

Expected: full suite passes (no new tests, but nothing should regress).

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/repositories/steam-config-transfer
git add core/src/bridge/commands.rs
git commit -m "feat: bridge::list_games uses is_known for 'Untitled' fallback"
```

---

## Phase 2 — Frontend Types & Shared Primitives

### Task 2.1: Update domain types

**Files:**
- Modify: `ui/types/domain.ts`

- [ ] **Step 1: Add the new fields**

Open `ui/types/domain.ts`. Add `display_name` to `Account` (immediately after `persona_name`):

```ts
export type Account = {
  steam_id_64: string;
  steam_id_32: number;
  account_name: string;
  persona_name: string;
  display_name: string;
  avatar_path: string | null;
  last_login: string | null;
  has_userdata: boolean;
};
```

Add `is_known` to `GameView`:

```ts
export type GameView = {
  app_id: number;
  config_path: string;
  config_size_bytes: number;
  last_modified: string | null;
  name: string;
  header_image_url: string;
  is_known: boolean;
};
```

- [ ] **Step 2: Verify the typecheck**

```bash
cd /home/kevin/repositories/steam-config-transfer && pnpm build
```

Expected: build succeeds (TypeScript will not yet complain because none of the consumers of these types use the new fields strictly).

- [ ] **Step 3: Commit**

```bash
git add ui/types/domain.ts
git commit -m "types: add Account.display_name and GameView.is_known"
```

---

### Task 2.2: Create `Section` component

**Files:**
- Create: `ui/components/layout/section.tsx`

- [ ] **Step 1: Write the component**

Create `ui/components/layout/section.tsx` with:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <header className="flex items-baseline gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground flex-1">· {description}</p>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/kevin/repositories/steam-config-transfer && pnpm build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add ui/components/layout/section.tsx
git commit -m "feat: Section layout primitive"
```

---

### Task 2.3: Create `AccountCard` component

**Files:**
- Create: `ui/features/accounts/components/account-card.tsx`

- [ ] **Step 1: Write the component**

Create `ui/features/accounts/components/account-card.tsx`:

```tsx
import type { Account } from "@/types/domain";
import { cn } from "@/lib/utils";
import { AvatarImageBlock } from "./avatar-image";

export function AccountCard({
  account,
  selected,
  disabled,
  badge,
  onClick,
}: {
  account: Account;
  selected: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border text-center transition-all",
        "bg-card text-card-foreground",
        selected
          ? "border-primary ring-2 ring-primary bg-primary/10"
          : "border-border hover:border-foreground/40",
        disabled && "opacity-55 pointer-events-none"
      )}
    >
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
          {badge}
        </span>
      )}
      <AvatarImageBlock
        steamId64={account.steam_id_64}
        initialPath={account.avatar_path}
        fallback={account.display_name}
        className="size-14"
      />
      <span className="text-sm font-medium leading-tight truncate max-w-full" title={account.display_name}>
        {account.display_name}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add ui/features/accounts/components/account-card.tsx
git commit -m "feat: AccountCard primitive (avatar + display_name + selected state + badge)"
```

---

### Task 2.4: Create `AccountGrid` component

**Files:**
- Create: `ui/features/accounts/components/account-grid.tsx`

- [ ] **Step 1: Write the component**

Create `ui/features/accounts/components/account-grid.tsx`:

```tsx
import type { Account } from "@/types/domain";
import { AccountCard } from "./account-card";

type CommonProps = {
  accounts: Account[];
  excludeIds?: Set<string>;
  badges?: Map<string, number>;
  emptyMessage?: string;
};

type SingleProps = CommonProps & {
  mode: "single";
  value: string | null;
  onSelect: (steamId64: string) => void;
};

type MultiProps = CommonProps & {
  mode: "multi";
  value: Set<string>;
  onSelect: (steamId64: string) => void;
};

export function AccountGrid(props: SingleProps | MultiProps) {
  const { accounts, excludeIds, badges, emptyMessage, mode, onSelect } = props;
  const filtered = accounts.filter((a) => !excludeIds?.has(a.steam_id_64));

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {emptyMessage ?? "No accounts available."}
      </p>
    );
  }

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
    >
      {filtered.map((a) => {
        const isSelected =
          mode === "single"
            ? props.value === a.steam_id_64
            : props.value.has(a.steam_id_64);
        const badge = badges?.get(a.steam_id_64);
        const disabled = badge === 0;
        return (
          <AccountCard
            key={a.steam_id_64}
            account={a}
            selected={isSelected}
            disabled={disabled}
            badge={badge}
            onClick={() => onSelect(a.steam_id_64)}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add ui/features/accounts/components/account-grid.tsx
git commit -m "feat: AccountGrid (single/multi mode, optional badges + excludes)"
```

---

## Phase 3 — Page Rewrites

### Task 3.1: Update `GameCard` for unknown apps

**Files:**
- Modify: `ui/features/library/components/game-card.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `ui/features/library/components/game-card.tsx`:

```tsx
import type { GameView } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle } from "lucide-react";
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
        selected && "ring-2 ring-primary",
        !game.is_known && "opacity-70"
      )}
      onClick={onToggle}
    >
      <div className="relative aspect-[460/215] bg-muted flex items-center justify-center">
        {game.is_known ? (
          <img
            src={game.header_image_url}
            alt={game.name}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <HelpCircle className="size-10 text-muted-foreground" />
        )}
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

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add ui/features/library/components/game-card.tsx
git commit -m "feat: GameCard renders placeholder + dim for unknown apps"
```

---

### Task 3.2: Rewrite `TransferPage` (vertical sections + sticky action bar)

**Files:**
- Modify: `ui/features/transfer/components/transfer-page.tsx`
- Modify: `ui/features/accounts/index.ts`

- [ ] **Step 1: Update accounts barrel to expose new components**

Replace `ui/features/accounts/index.ts` with:

```ts
export { useAccounts } from "./api/list-accounts";
export { AvatarImageBlock } from "./components/avatar-image";
export { AccountCard } from "./components/account-card";
export { AccountGrid } from "./components/account-grid";
```

(Old exports — `AccountChip`, `AccountSelector`, `TargetList` — are deliberately dropped. Their files will be deleted in Task 4.1; for now they remain on disk but unimported.)

- [ ] **Step 2: Rewrite `transfer-page.tsx`**

Replace the entire contents of `ui/features/transfer/components/transfer-page.tsx`:

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";
import type { TransferPair, TransferOutcome } from "@/types/domain";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { useAccounts, AccountGrid } from "@/features/accounts";
import { useGames, GameGrid } from "@/features/library";
import { useTransferStore } from "../stores/transfer-store";
import { TransferConfirmDialog } from "./transfer-confirm-dialog";
import { TransferResultsDialog } from "./transfer-results-dialog";

export function TransferPage() {
  const { data: accounts = [] } = useAccounts();
  const {
    sourceId, targetIds, selectedAppIds,
    setSource, toggleTarget, toggleApp, reset,
  } = useTransferStore();
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
          source_persona: source.display_name,
          target_persona: t.display_name,
          app_id: g.app_id,
          game_name: g.name,
        });
      }
    }
    return pairs;
  };

  const status = (() => {
    if (!source) return "Pick a source account.";
    if (selectedAppIds.size === 0) return "Pick at least one game.";
    if (targetIds.size === 0) return "Pick at least one target account.";
    const pairs = selectedAppIds.size * targetIds.size;
    return `${selectedAppIds.size} game${selectedAppIds.size === 1 ? "" : "s"} → ${targetIds.size} account${targetIds.size === 1 ? "" : "s"} · up to ${pairs} configs will be auto-backed-up.`;
  })();

  const ready = !!source && selectedAppIds.size > 0 && targetIds.size > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <Section title="Source" description="Pick the account you want to copy from">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Steam accounts detected. Check Settings → Steam install path.
            </p>
          ) : (
            <AccountGrid
              mode="single"
              accounts={accounts}
              value={sourceId}
              onSelect={setSource}
            />
          )}
        </Section>

        {source && (
          <Section title="Games" description="Click cards to select. Multi-select.">
            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {source.display_name} has no game configs on disk.
              </p>
            ) : (
              <GameGrid games={games} selected={selectedAppIds} onToggle={toggleApp} />
            )}
          </Section>
        )}

        {source && selectedAppIds.size > 0 && (
          <Section title="Copy to" description="One or more targets. Source is hidden.">
            <AccountGrid
              mode="multi"
              accounts={accounts}
              value={targetIds}
              onSelect={toggleTarget}
              excludeIds={new Set([source.steam_id_64])}
              emptyMessage="No other accounts available to copy to."
            />
          </Section>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">{status}</p>
        <Button variant="ghost" onClick={reset} disabled={mutation.isPending}>
          Reset
        </Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={!ready || mutation.isPending}>
          {mutation.isPending ? "Transferring..." : "Transfer →"}
        </Button>
      </div>

      <TransferConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        gamesCount={selectedAppIds.size}
        targetsCount={targetIds.size}
        onConfirm={() => { setConfirmOpen(false); mutation.mutate(buildPairs()); }}
      />
      <TransferResultsDialog
        open={results !== null}
        onOpenChange={(o) => {
          if (!o) {
            setResults(null);
            reset();
          }
        }}
        results={results ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 4: Smoke test (manual)**

```bash
pnpm tauri:dev
```

Click around: Transfer page should show only the SOURCE section initially. Picking a source reveals GAMES. Picking a game reveals COPY TO. Action bar status updates as selections change. Transfer button is disabled until ready. Reset clears everything. Quit the dev window.

- [ ] **Step 5: Commit**

```bash
git add ui/features/transfer/components/transfer-page.tsx ui/features/accounts/index.ts
git commit -m "feat: rewrite TransferPage as vertical sections with progressive disclosure"
```

---

### Task 3.3: Rewrite `BackupsPage` (vertical sections, account picker + game-grouped list)

**Files:**
- Modify: `ui/features/backups/components/backups-page.tsx`
- Create: `ui/features/backups/components/backup-game-group.tsx`

- [ ] **Step 1: Create the per-game backup group component**

Create `ui/features/backups/components/backup-game-group.tsx`:

```tsx
import type { BackupRecord } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { BackupRowActions } from "./backup-row-actions";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"]; let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export function BackupGameGroup({
  appId,
  gameName,
  headerUrl,
  records,
}: {
  appId: number;
  gameName: string;
  headerUrl: string | null;
  records: BackupRecord[];
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-2">
        {headerUrl ? (
          <img
            src={headerUrl}
            alt={gameName}
            className="w-20 h-9 rounded object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-20 h-9 rounded bg-muted" />
        )}
        <div className="font-medium text-sm">{gameName}</div>
        <div className="text-xs text-muted-foreground">· {records.length} backup{records.length === 1 ? "" : "s"}</div>
        <div className="text-[10px] text-muted-foreground/70 ml-auto">ID {appId}</div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        {records.map((r, i) => (
          <div
            key={r.archive_path}
            className={`grid grid-cols-[1fr_110px_90px_44px] items-center px-4 py-2 text-xs ${i < records.length - 1 ? "border-b" : ""}`}
          >
            <div className="font-mono text-muted-foreground">
              {new Date(r.manifest.created_at).toLocaleString()}
            </div>
            <div>
              <Badge variant={r.manifest.reason === "Manual" ? "default" : "secondary"}>
                {r.manifest.reason}
              </Badge>
            </div>
            <div className="text-right font-mono text-muted-foreground">
              {fmtBytes(r.size_bytes)}
            </div>
            <div className="flex justify-end">
              <BackupRowActions record={r} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `backups-page.tsx`**

Replace the entire contents of `ui/features/backups/components/backups-page.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { BackupReason } from "@/types/domain";
import { Section } from "@/components/layout/section";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts, AccountGrid } from "@/features/accounts";
import { useBackups } from "../api/queries";
import { BackupGameGroup } from "./backup-game-group";

const ALL = "__all__";

export function BackupsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: records = [] } = useBackups();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState<BackupReason | typeof ALL>(ALL);

  // Backup-count per account.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records) {
      m.set(r.manifest.steam_id_64, (m.get(r.manifest.steam_id_64) ?? 0) + 1);
    }
    return m;
  }, [records]);

  // Default selection: most-recent-login account that has backups, else most-recent-login account.
  useEffect(() => {
    if (selectedId !== null) return;
    if (accounts.length === 0) return;
    const withBackups = accounts.find((a) => (counts.get(a.steam_id_64) ?? 0) > 0);
    setSelectedId((withBackups ?? accounts[0]).steam_id_64);
  }, [accounts, counts, selectedId]);

  const selectedAccount = accounts.find((a) => a.steam_id_64 === selectedId) ?? null;

  const filteredForSelected = useMemo(() => {
    if (!selectedId) return [];
    return records
      .filter((r) => r.manifest.steam_id_64 === selectedId)
      .filter((r) => reason === ALL || r.manifest.reason === reason);
  }, [records, selectedId, reason]);

  // Group filtered backups by app_id.
  const groups = useMemo(() => {
    const byApp = new Map<number, typeof filteredForSelected>();
    for (const r of filteredForSelected) {
      const arr = byApp.get(r.manifest.app_id) ?? [];
      arr.push(r);
      byApp.set(r.manifest.app_id, arr);
    }
    return Array.from(byApp.entries())
      .map(([appId, recs]) => ({
        appId,
        gameName: recs[0].manifest.game_name_at_backup || `App ${appId}`,
        headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
        records: recs,
      }))
      .sort((a, b) => a.gameName.localeCompare(b.gameName));
  }, [filteredForSelected]);

  const totalForSelected = selectedId ? (counts.get(selectedId) ?? 0) : 0;
  const description = selectedAccount
    ? `${totalForSelected} backup${totalForSelected === 1 ? "" : "s"} across ${groups.length} game${groups.length === 1 ? "" : "s"}`
    : "";

  return (
    <div className="px-6 py-6">
      <Section title="Account" description="Pick an account to view its backups">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Steam accounts detected. Check Settings → Steam install path.
          </p>
        ) : (
          <AccountGrid
            mode="single"
            accounts={accounts}
            value={selectedId}
            onSelect={setSelectedId}
            badges={counts}
          />
        )}
      </Section>

      {selectedAccount && (
        <Section
          title={`Backups for ${selectedAccount.display_name}`}
          description={description}
          action={
            <Select value={reason} onValueChange={(v) => setReason(v as BackupReason | typeof ALL)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All reasons</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="PreCopy">Pre-Copy</SelectItem>
                <SelectItem value="PreRestore">Pre-Restore</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {totalForSelected === 0
                ? `No backups for ${selectedAccount.display_name} yet. Auto-backups are created when you copy configs to this account.`
                : `No backups match the current filter.`}
            </p>
          ) : (
            <div>
              {groups.map((g) => (
                <BackupGameGroup
                  key={g.appId}
                  appId={g.appId}
                  gameName={g.gameName}
                  headerUrl={g.headerUrl}
                  records={g.records}
                />
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 4: Smoke test (manual)**

```bash
pnpm tauri:dev
```

Navigate to Backups. The account grid should appear with backup-count badges; selecting an account shows the game-grouped backup list. Filter dropdown should narrow. Quit.

- [ ] **Step 5: Commit**

```bash
git add ui/features/backups/components/backups-page.tsx ui/features/backups/components/backup-game-group.tsx
git commit -m "feat: rewrite BackupsPage as vertical sections + game-grouped list"
```

---

### Task 3.4: Update `SettingsPage` to use `Section`

**Files:**
- Modify: `ui/features/settings/components/settings-page.tsx`

- [ ] **Step 1: Rewrite to use Section**

Replace the entire contents of `ui/features/settings/components/settings-page.tsx`:

```tsx
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getVersion } from "@tauri-apps/api/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Section } from "@/components/layout/section";
import { useSettings, useUpdateSettings } from "../api/queries";
import { api } from "@/lib/tauri-client";
import { useTheme } from "@/app/providers/theme-provider";

export function SettingsPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const [steamPath, setSteamPath] = useState("");
  const [retention, setRetention] = useState(20);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setSteamPath(settings.steam_path_override ?? "");
      setRetention(settings.backup_retention_per_pair);
    }
  }, [settings]);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

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
    <div className="px-6 py-6 max-w-2xl">
      <Section title="Steam install path" description="Override the auto-detected folder">
        <div className="flex gap-2">
          <Input
            value={steamPath}
            placeholder="(auto-detect)"
            onChange={(e) => setSteamPath(e.target.value)}
          />
          <Button variant="outline" onClick={pickPath}>Browse...</Button>
        </div>
      </Section>

      <Section
        title="Backup retention"
        description="Auto-delete old backups when more than this number exist per (account, game). Manual backups are never auto-deleted."
      >
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
      </Section>

      <Section title="Appearance" description="Theme">
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
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={update.isPending}>Save</Button>
      </div>

      {version && (
        <p className="text-xs text-muted-foreground text-center pt-6">
          Carry v{version}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add ui/features/settings/components/settings-page.tsx
git commit -m "feat: SettingsPage uses Section primitive"
```

---

## Phase 4 — Cleanup

### Task 4.1: Remove unused legacy components

**Files:**
- Delete: `ui/features/accounts/components/account-chip.tsx`
- Delete: `ui/features/accounts/components/account-selector.tsx`
- Delete: `ui/features/accounts/components/target-list.tsx`
- Delete: `ui/features/transfer/components/action-bar.tsx`

- [ ] **Step 1: Verify nothing imports these any more**

Run from project root:

```bash
cd /home/kevin/repositories/steam-config-transfer
grep -rE "account-chip|account-selector|target-list|action-bar" ui/ 2>&1 | grep -v Binary
```

Expected: only matches inside the files about to be deleted (no other references). If any other file still imports them, fix that file first.

- [ ] **Step 2: Delete the files**

```bash
git rm ui/features/accounts/components/account-chip.tsx \
       ui/features/accounts/components/account-selector.tsx \
       ui/features/accounts/components/target-list.tsx \
       ui/features/transfer/components/action-bar.tsx
```

- [ ] **Step 3: Verify build still succeeds**

```bash
pnpm build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove legacy AccountChip / AccountSelector / TargetList / ActionBar

Replaced by AccountGrid + AccountCard + the Section-based TransferPage
sticky footer. Nothing imports these any more."
```

---

## Self-Review

Re-read against the spec:

- ✅ **Layout pattern (Section)** — Task 2.2 creates `Section`, Tasks 3.2/3.3/3.4 use it across all three pages.
- ✅ **AccountGrid + AccountCard** — Tasks 2.3 + 2.4. Used in TransferPage (3.2) for source and target grids and BackupsPage (3.3) for the account picker.
- ✅ **Real Steam profile pictures** — `AccountCard` uses the existing `AvatarImageBlock` (no change needed; already wired).
- ✅ **Real Steam header art** — `GameCard` (3.1) and `BackupGameGroup` (3.3) both use the Steam CDN URL.
- ✅ **Progressive disclosure on Transfer** — driven by `sourceId` and `selectedAppIds.size` in 3.2; no `step` field added.
- ✅ **Sticky action bar** — inline in `transfer-page.tsx` (3.2); the old `action-bar.tsx` is removed in 4.1.
- ✅ **Backups page redesign** — Task 3.3 with `BackupGameGroup` for game grouping.
- ✅ **Settings normalization** — Task 3.4 swaps `Card` for `Section`.
- ✅ **`Account.display_name`** — Task 1.1, plus Task 2.1 exposes it in TS, plus all consumer sites use it (3.2, 3.3 use `display_name`; AccountCard fallback uses it).
- ✅ **`GameMetadata.is_known`** — Task 1.2 backend, 1.3 bridge, 2.1 frontend type, 3.1 GameCard handles the visual.
- ✅ **Removed components** — Task 4.1 deletes the four legacy files.

No placeholder phrases used. Type names match across tasks (`AccountCard`, `AccountGrid`, `Section`, `is_known`, `display_name`). The Backups page introduces a slight gap: `BackupGameGroup` uses `r[0].manifest.game_name_at_backup || \`App {appId}\`` for the game name. This name was captured at backup time and may not match the current `GameMetadata.is_known` state — that's fine because the backup manifest preserves the name in effect when the backup was made.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-ui-unification.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
