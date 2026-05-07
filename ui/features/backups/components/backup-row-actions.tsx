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

/** Per-row dropdown with Restore, Reveal in Explorer, and Delete confirmations. */
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
              The current config for this game on {owner?.display_name ?? owner?.persona_name} will
              be backed up first (PreRestore) so you can roll back if needed.
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
