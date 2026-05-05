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
