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
    // Settings changes (especially Steam path) can change which accounts and
    // games exist. Drop ALL cached query data instead of just invalidating it
    // so stale entries can't be surfaced before the refetch lands.
    onSuccess: () => qc.removeQueries(),
  });
}
