import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Confirmation dialog shown before kicking off a transfer batch. */
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
            {" "}{pairs} configs will be processed.
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
