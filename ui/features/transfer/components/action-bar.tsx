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
