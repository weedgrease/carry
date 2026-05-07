import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";
import type { Settings } from "@/types/domain";

export const settingsKey = ["settings"] as const;

/** React Query subscription for the persisted user settings. */
export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: api.getSettings });
}

/**
 * Mutation that persists settings. Selectively invalidates the query slices
 * a Steam-path / hide-untitled change can affect — accounts, games, settings —
 * rather than nuking every cached query.
 */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api.updateSettings(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["games"] });
      qc.invalidateQueries({ queryKey: settingsKey });
    },
  });
}
