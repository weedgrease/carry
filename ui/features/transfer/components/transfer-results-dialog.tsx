import type { TransferOutcome } from "@/types/domain";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Per-pair success/failure summary shown after a transfer completes. */
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
                  : <X className="size-4 text-destructive dark:text-red-400 mt-0.5" />}
                <div>
                  <div>
                    <span className="font-medium">{r.pair.game_name}</span>
                    {" "}→ {r.pair.target_persona}
                  </div>
                  {!r.success && <div className="text-destructive dark:text-red-400 text-xs">{r.error}</div>}
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
