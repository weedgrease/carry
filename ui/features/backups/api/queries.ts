import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const backupsKey = ["backups"] as const;

/** React Query subscription for every backup record on disk. */
export function useBackups() {
  return useQuery({ queryKey: backupsKey, queryFn: api.listBackups });
}

/** Mutation that deletes a backup zip and refreshes the cache. */
export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archive_path: string) => api.deleteBackup(archive_path),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupsKey }),
  });
}

/** Mutation that restores a backup into a target account. */
export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { archive_path: string; target_steam_id_32: number }) =>
      api.restoreBackup(args.archive_path, args.target_steam_id_32),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupsKey }),
  });
}
