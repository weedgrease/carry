# Transfer Page Redesign — Design

**Date:** 2026-05-05
**Status:** Approved (pre-implementation)
**Owner:** kevin.murphy@proof.com
**Supersedes:** Transfer-page section of `2026-05-05-steam-config-transfer-design.md`

## Overview

The current Transfer page is a two-pane layout (source dropdown + game grid on the left, persistent target list on the right) plus a sticky action bar. It surfaces an empty target list before the user has picked a source and produces a double-scrollbar effect. This redesign replaces that layout with a four-step guided flow — **Source → Games → Targets → Review** — where each step gets the full canvas, navigated with a step indicator at the top and Back / Continue at the bottom.

## Goals

- Match the natural mental order of "FROM → WHAT → TO → CONFIRM" without dead empty-state areas.
- Give the game grid full-width canvas treatment so cover art reads well.
- Remove the persistent target sidebar and the secondary scrollbar it produced.
- Keep the existing safety semantics (auto-backup before overwrite, Steam-running guard, etc.) untouched — only the UI changes.

## Non-goals (v1 of this redesign)

- Keyboard shortcut navigation between steps.
- Drag-and-drop selection.
- Animated step transitions (a simple swap is fine; polish later if needed).
- Saving/resuming a transfer in progress.
- Editing pairs in the Review step (back button already lets the user edit).

## UX Flow

Top app shell stays unchanged: header with three nav links (Transfer / Backups / Settings) and the theme toggle. Inside the Transfer route, the page is one of four step views.

### Top-of-page step indicator

Always visible inside the Transfer route, just below the app header. Pattern:

```
[✓ Source]  ———  [● Games]  ———  [○ Targets]  ———  [○ Review]
```

- Completed steps show a check; current step is highlighted; future steps are dimmed.
- Clicking a *completed* step jumps back to it (without losing the selections from later steps — see "State preservation" below).
- Future steps are not clickable.

### Step 1 · Source

Centered grid of all known accounts as avatar cards (avatar + persona name). Single-select.

- Empty state (no accounts found): "No Steam accounts detected on this machine. Check Settings → Steam install path."
- **Auto-advances** to Step 2 the moment a card is clicked. The indicator shows a check on Source and flips highlight to Games.

### Step 2 · Games

Full-width grid of games for the selected source account, using the existing `GameCard` (Steam header art + name + size). Multi-select via card click.

Above the grid: a compact context line — "Copying from `<persona>`" with a small avatar — so the user always sees who they picked.

- Empty state (this source has no game configs): "This account has no game configs on disk." Continue is disabled.
- Continue button at the bottom is enabled when `selectedAppIds.size >= 1`.

### Step 3 · Targets

Same visual treatment as Step 1 (avatar card grid), but **multi-select** and the source account is hidden from the list.

- Empty state (only one account on machine, so no targets available): "No other accounts available to copy to."
- Continue enabled when `targetIds.size >= 1`.

### Step 4 · Review

Single card summarizing the transfer:

- "From `<source>` → N games → M accounts (`<targetA>`, `<targetB>`, ...)"
- A bullet list of every `(game, target)` pair with a per-pair note: "existing config will be backed up" or "no existing config (skipping backup)".
- Back / Transfer buttons.

The big "Transfer" button is the commit action. It runs the existing `runTransfer` mutation. The current `TransferConfirmDialog` is removed because Step 4 is the confirmation.

After the transfer mutation resolves, show the existing `TransferResultsDialog` with per-pair outcomes. Closing the dialog returns to Step 1 (full reset).

## Components

### New

| File | Responsibility |
|---|---|
| `ui/features/transfer/components/step-indicator.tsx` | Visual progress bar + clickable completed-step navigation |
| `ui/features/transfer/components/source-step.tsx` | Step 1 view: avatar grid, single-select, auto-advance |
| `ui/features/transfer/components/games-step.tsx` | Step 2 view: context line + GameGrid + nav |
| `ui/features/transfer/components/targets-step.tsx` | Step 3 view: avatar grid, multi-select, nav |
| `ui/features/transfer/components/review-step.tsx` | Step 4 view: summary card with per-pair backup notes + Transfer button |
| `ui/features/transfer/components/wizard-nav.tsx` | Reusable Back / Continue button row |
| `ui/features/accounts/components/account-card.tsx` | Single avatar+name card. Used by both Source and Target steps. Variants: `selected` and `disabled`. |

### Modified

| File | Change |
|---|---|
| `ui/features/transfer/components/transfer-page.tsx` | Becomes the wizard shell — owns step indicator + the current step view. The bulk of the existing logic moves into the per-step components and the store. |
| `ui/features/transfer/stores/transfer-store.ts` | Adds `step: 1\|2\|3\|4`, `next()`, `back()`, `goToStep(s)`, plus existing source/target/game state. |

### Removed

| File | Reason |
|---|---|
| `ui/features/transfer/components/action-bar.tsx` | Replaced by per-step `wizard-nav.tsx`. |
| `ui/features/transfer/components/transfer-confirm-dialog.tsx` | Step 4 IS the confirmation — modal is redundant. |
| `ui/features/accounts/components/account-selector.tsx` | The dropdown was a single-select that's now an avatar grid. |
| `ui/features/accounts/components/target-list.tsx` | The sidebar multi-select is gone; targets-step uses the same `account-card.tsx` as source-step. |

The shadcn `Select` primitive stays installed; it's still used in the Settings page.

## State and Validation

`transfer-store.ts` extends to:

```ts
type S = {
  step: 1 | 2 | 3 | 4;
  sourceId: string | null;
  selectedAppIds: Set<number>;
  targetIds: Set<string>;
  next: () => void;
  back: () => void;
  goToStep: (s: 1 | 2 | 3 | 4) => void;
  setSource: (id: string) => void;
  toggleApp: (id: number) => void;
  toggleTarget: (id: string) => void;
  reset: () => void;
};
```

**Validation rules**, enforced by `next()`:

- `1 → 2`: requires `sourceId !== null`. (Auto-advance handles this; setSource calls next.)
- `2 → 3`: requires `selectedAppIds.size >= 1`.
- `3 → 4`: requires `targetIds.size >= 1`.
- Step 4 has no "next" — the Transfer button calls the mutation directly.

**State preservation across back navigation:**

- Going back from any step does **not** clear later steps' selections. Example: user picks 2 games, picks 2 targets, goes back to Step 2 to add a third game, returns to Step 3 — the original 2 targets are still selected.
- Clicking a previous step in the indicator is the same as repeatedly calling `back()`.

**Reset rules:**

- `setSource(id)` clears `selectedAppIds` and `targetIds` only when `id !== sourceId` (picking the same source again preserves later selections). Either way, `setSource` triggers the auto-advance to Step 2.
- `goToStep(s)` only honors `s <= the highest step ever reached`. Forward jumps via `goToStep` are ignored — the only way to advance is `next()` with its validation.
- `reset()` clears everything and returns to Step 1.
- Successful transfer → close ResultsDialog → `reset()`.

## Visual Conventions

Re-uses existing tokens; nothing new in `globals.css`.

- **Avatar card** (used by Source + Targets): rounded `border` container, ~120-150px wide, `aspect-square` avatar with persona name underneath. Default = neutral border, no tint. Selected = `ring-2 ring-primary` plus a subtle `bg-primary/10` tint. Disabled = `opacity-50` and `pointer-events-none`. Hover (when not disabled) = subtle `border-foreground/40`.
- **Step indicator**: chip-style numbered circles connected by horizontal lines. Active = filled (`bg-foreground text-background`). Completed = filled with a check. Future = outline (`border bg-secondary text-muted-foreground`).
- **Wizard nav**: right-aligned button row, `[Back]` (`variant="ghost"` or `variant="outline"`) + `[Continue →]` (`variant="default"`).
- **Context line** above Step 2's grid: small avatar (24px) + persona name in muted text — "Copying from <persona>".

## Error / Edge Cases

- No accounts: Step 1 empty state.
- Single account: Step 1 lets you pick it; Step 3 shows "No other accounts available to copy to" with disabled Continue.
- No games: Step 2 empty state with disabled Continue.
- Existing transfer/backup mutation errors continue to surface via the `sonner` toast (no change).
- Backups query is invalidated on successful transfer — same as today.

## Out of Scope / Open Questions

None at design freeze. One thing flagged for *future* iteration: if the per-pair list in Step 4 grows long (say more than 10 pairs), collapse to "first N + ... and X more". Not blocking v1.

## Spec linkage

This document is a UX-only delta on top of `2026-05-05-steam-config-transfer-design.md`. The Rust core, bridge commands, transfer/backup semantics, and theming are unchanged.
