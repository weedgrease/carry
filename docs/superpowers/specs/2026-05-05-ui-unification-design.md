# UI Unification — Design

**Date:** 2026-05-05
**Status:** Approved (pre-implementation)
**Owner:** kevin.murphy@proof.com
**Supersedes:** Transfer-page section of `2026-05-05-steam-config-transfer-design.md`

## Overview

The existing Carry UI mixes three different layout patterns (Transfer = two-pane with sidebar; Backups = flat table; Settings = stacked Cards), which makes the app feel inconsistent. This redesign establishes a single layout pattern — **a vertical canvas of named sections** — that applies to all three pages, plus a small library of shared visual primitives. It also folds in two data-quality fixes surfaced during testing (empty account names; unknown apps with no metadata).

## Goals

- One shared layout pattern across every page in the app.
- Small, reusable visual primitives (`Section`, `AccountGrid`, `GameCard`) used in multiple places.
- Real Steam profile pictures for accounts and real Steam header art for games — no broken-image fallbacks, no gradient placeholders in the live UI.
- Eliminate the original "empty target list before any source is picked" problem via progressive disclosure.
- Eliminate the double-scrollbar artifact (single scrollable canvas per page).

## Non-goals (this iteration)

- Animated section reveal transitions (instant render is fine).
- Saving / resuming a transfer in progress.
- A separate review step on Transfer (the action bar's status text is the summary).
- Drag-and-drop multi-select.
- A wizard / step indicator (explicitly removed; progressive disclosure replaces it).
- A "Hide untitled apps" toggle in Settings (can come in a follow-up if desired).

## Layout Pattern

**Every page** renders inside `AppShell` (header + theme toggle, unchanged) and consists of a vertical scrollable canvas containing one or more `Section` blocks. Sections are rendered in source order. Pages may have a sticky footer (only Transfer does).

A `Section` is:

```
LABEL  · helper text                            [optional action]
─────────────────────────────────────────────
<content>
```

- LABEL: uppercase, ~13px, semibold
- helper text: 11px, muted, inline next to label, separated by ` · `
- optional action slot: right-aligned (used by Backups for the reason filter)
- content: anything (grid, list, form, etc.)

Sections have a small bottom margin between them. There's no card wrapper — the section header itself is the visual delimiter.

## Pages

### Transfer (`/transfer`)

Three sections + a sticky action bar at the bottom. Sections appear progressively:

| # | Section | Content | Visible when |
|---|---|---|---|
| 1 | SOURCE — *"Pick the account you want to copy from"* | `AccountGrid` in `single` mode | always |
| 2 | GAMES — *"Click cards to select"* | `GameGrid` in `multi` mode, scoped to source's library | `sourceId !== null` |
| 3 | COPY TO — *"One or more targets. Source is hidden."* | `AccountGrid` in `multi` mode, source excluded | `selectedAppIds.size >= 1` |

The sticky action bar at the bottom is always visible:

- Status line on the left: dynamic — "Pick a source...", "Pick games...", "Pick at least one target...", or "N games → M accounts · K configs will be backed up"
- Reset button (clears all selections)
- Transfer button (disabled until ready)

Pre-transfer confirmation: clicking Transfer opens `TransferConfirmDialog` (existing `AlertDialog`) which lists impact and the "Steam must not be running" guard. After confirm, the existing transfer mutation runs; results render in `TransferResultsDialog`. After dismissing the results dialog, the Transfer page resets to "Source-only visible" state.

### Backups (`/backups`)

Two sections:

| # | Section | Content | Visible when |
|---|---|---|---|
| 1 | ACCOUNT — *"Pick an account to view its backups"* | `AccountGrid` in `single` mode, with backup-count badges per account | always |
| 2 | BACKUPS FOR `<persona>` — *"N backups across M games"* | Game-grouped list (each game group = small Steam header art thumbnail + game name + count + a list of backup rows) | `selectedAccountId !== null` |

The reason filter (`Manual` / `PreCopy` / `PreRestore` / All) lives in the section 2 header's action slot, applying to the listed backups only.

Per-row actions (Restore / Reveal / Delete) are unchanged from the existing implementation, just rendered inline at the right side of each backup row.

### Settings (`/settings`)

Three sections with the same header treatment as Transfer + Backups (no `Card` wrapper):

| # | Section | Content |
|---|---|---|
| 1 | STEAM INSTALL PATH — *"Override the auto-detected folder"* | text input + Browse button |
| 2 | BACKUP RETENTION — *"Keep last N auto-backups per (account, game)"* | number input |
| 3 | APPEARANCE — *"Theme"* | Select (System / Light / Dark) |

Save button at the bottom (right-aligned). Version footer ("Carry vX.Y.Z") below.

## Shared Components

### New

| File | Responsibility |
|---|---|
| `ui/components/layout/section.tsx` | `<Section title="LABEL" description="..." action={<filter>}>{children}</Section>`. Pure presentation. |
| `ui/features/accounts/components/account-grid.tsx` | Single component handling all "pick an account" interactions. Props: `accounts`, `selected: string \| Set<string>`, `onSelect`, `mode: "single" \| "multi"`, `excludeIds?`, `badges?: Map<string, number>`. Renders `AccountCard`s in a responsive grid. Single-mode is selection only — no auto-advance. |
| `ui/features/accounts/components/account-card.tsx` | Single avatar + persona name (uses `display_name`). Visual states: default, selected, disabled. Respects badge prop. |

### Modified

| File | Change |
|---|---|
| `ui/features/transfer/components/transfer-page.tsx` | Rewritten as the vertical-sections + sticky-action-bar layout described above. |
| `ui/features/transfer/stores/transfer-store.ts` | Adds nothing new — the existing `sourceId`, `selectedAppIds`, `targetIds` are sufficient with progressive disclosure driven by their values. |
| `ui/features/backups/components/backups-page.tsx` | Rewritten as the two-section layout above. New supporting components for the game-grouped list (see below). |
| `ui/features/settings/components/settings-page.tsx` | Replace `Card` wrappers with `Section` blocks. No functional change. |
| `ui/features/library/components/game-card.tsx` | Handles `is_known === false`: replaces the broken-image fallback with a centered placeholder (`?` icon + "Untitled" label) and dims the card subtly. |
| `core/src/steam/accounts.rs` | Adds derived `display_name` field to `Account`: `persona_name` if non-empty, else `account_name` if non-empty, else `format!("Steam ID {steam_id_64}")`. |
| `core/src/steam/metadata.rs` | Adds `is_known: bool` to `GameMetadata` (defaults to `true`; set to `false` only when `appdetails` returned `success: false`). |
| `core/src/bridge/commands.rs` | `list_games` returns `GameView` with `is_known` propagated and `name` falling back to `"Untitled · ID {appid}"` when unknown. |
| `ui/types/domain.ts` | Adds `display_name: string` to `Account` and `is_known: boolean` to `GameView`. |

### Removed

| File | Reason |
|---|---|
| `ui/features/transfer/components/action-bar.tsx` | Folded into TransferPage as a sticky footer (the new behavior is too entangled with page-level state to justify a separate file). |
| `ui/features/accounts/components/account-selector.tsx` | The dropdown becomes an `AccountGrid` in single mode. shadcn `Select` stays installed (still used in Settings). |
| `ui/features/accounts/components/target-list.tsx` | The sidebar list becomes an `AccountGrid` in multi mode. |

The barrel export `ui/features/accounts/index.ts` updates to expose `AccountGrid` instead of the removed components.

`TransferConfirmDialog` and `TransferResultsDialog` are unchanged.

## State

### Transfer store (`transfer-store.ts`)

Unchanged shape vs. the current code: `sourceId`, `targetIds`, `selectedAppIds`, plus actions. **No `step` field** — progressive disclosure is derived from existing values:

- Section 2 (GAMES) renders iff `sourceId !== null`
- Section 3 (COPY TO) renders iff `selectedAppIds.size >= 1`
- Sticky action bar's Transfer button is enabled iff `targetIds.size >= 1` (and the other two preconditions hold transitively)

Setting a new source (`setSource`) clears `selectedAppIds` and `targetIds` only when `id !== sourceId`. Reset behavior unchanged: full clear, returns to source-only state. Successful transfer triggers `reset()` after the user dismisses the results dialog.

### Backups page state

Local `useState<string | null>` for the selected account. No global store needed; the URL doesn't reflect selection. Default selection on mount: most-recent-login account that has at least one backup; if none of the accounts have backups, falls back to the most-recent-login account (so the user lands on a real account, not on null).

### Settings store

Unchanged.

## Data Quality

### `Account.display_name`

Computed in `discover()`. Frontend uses `display_name` for **all user-visible labels**. The original `persona_name` and `account_name` stay on the struct (used by backup manifests, debug views, future filtering features).

```rust
let display_name = if !persona_name.is_empty() {
    persona_name.clone()
} else if !account_name.is_empty() {
    account_name.clone()
} else {
    format!("Steam ID {steam_id_64}")
};
```

### `GameMetadata.is_known`

`is_known` is `true` when `appdetails` returned `success: true` with `data.name`. It's `false` when the API explicitly returned `success: false` (the public Steam store has no entry — typical for internal Steam apps like ID 7).

When the network fails entirely (transient), we currently `continue` without inserting a cache entry. That behavior is unchanged — we just don't mark anything `is_known: false` for transient failures. A retry on the next launch can succeed.

`list_games` (bridge) computes the displayed name:

```rust
let name = if meta.is_known { meta.name.clone() } else { format!("Untitled · ID {}", meta.app_id) };
```

The frontend uses `is_known` to:

- Render a placeholder image (centered `?` glyph) instead of trying to load `header.jpg` (which doesn't exist for unknown apps).
- Apply a subtle `opacity-70` to the card (de-emphasized, but still selectable — the user might genuinely want to copy that userdata).

## Visual Conventions

- **AccountCard**: ~120-150px wide, vertical layout. 56px circular avatar (real Steam profile picture via existing `AvatarImageBlock` → `convertFileSrc` → local cache or remote XML fetch). Persona name (`display_name`) below in 13px semibold. Optional badge (top-right, small filled chip with count) when `badges` prop is provided. Selected = `ring-2 ring-primary` + subtle `bg-primary/10` tint. Disabled = `opacity-55 pointer-events-none`. Hover (when not disabled) = `border-foreground/40`.
- **GameCard**: unchanged dimensions (Steam header aspect ratio 460:215). When `is_known === false`: replace `<img>` with a centered `?` glyph in a muted color, and apply `opacity-70` to the whole card.
- **Section header**: uppercase 13px semibold label + 11px muted helper text on same line, separated by `·`. Optional right-aligned action slot.
- **Sticky action bar (Transfer)**: full-width, `border-t`, `bg-background/95 backdrop-blur`, 12px vertical padding. Status text on left (muted, 12px), buttons on right.

All colors come from existing CSS tokens — no new variables.

## Edge Cases

- **No accounts on machine:** Transfer's SOURCE section renders an empty state ("No Steam accounts detected. Check Settings → Steam install path."). Backups' ACCOUNT section renders the same. Settings unaffected.
- **One account on machine:** Transfer can pick it as source; section 3 renders an empty state ("No other accounts available to copy to."); action bar Transfer button is disabled.
- **Selected source has no game configs:** GAMES section renders an empty state ("This account has no game configs on disk.").
- **Selected account has no backups:** Backups section 2 renders an empty state ("No backups for `<persona>` yet. Auto-backups are created when you copy configs to this account.").
- **All games unknown:** still selectable. Each card shows the placeholder treatment but the flow works normally.
- **Avatar fetch fails:** `AvatarImageBlock` falls back to the persona's first two letters (existing behavior) — no change.
- **Network down / `appdetails` fails:** the cache miss is retried on next launch. UI shows `Untitled · ID <id>` for the affected appIds in the meantime.

## Out of Scope

A "Hide untitled apps" toggle in Settings: rejected for this iteration. If users find untitled apps too noisy, we add a Settings boolean later. For now they're visible because at least some untitled-but-on-disk apps may genuinely have userdata the user wants to copy.

## Spec Linkage

This document supersedes the prior `2026-05-05-transfer-page-redesign-design.md` (renamed to this filename via `git mv`; the wizard pattern proposed there was rejected during the visual-companion iteration in favor of this unified layout). Backend types (`Account`, `GameMetadata`) gain new fields but no breaking changes; existing tests continue to pass. Tauri commands' return shapes are additive only.
