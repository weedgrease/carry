import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";
import type { Settings } from "@/types/domain";

export const settingsKey = ["settings"] as const;

/** React Query subscription for the persisted user settings. */
export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: api.getSettings });
}

/**
 * Mutation that persists settings. Drops every cached query on success because
 * a Steam-path change can shift which accounts and games exist; invalidating
 * alone could briefly surface stale entries before refetches land.
 */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api.updateSettings(s),
    onSuccess: () => qc.removeQueries(),
  });
}
