import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const gamesKey = (id32: number) => ["games", id32] as const;

/**
 * React Query subscription for the games list of a Steam account.
 *
 * Background metadata updates arrive via the `game-metadata-updated` listener
 * registered in `main.tsx`, which writes directly into this cache through
 * `setQueriesData` so names appear without an IPC refetch.
 */
export function useGames(steam_id_32: number | null) {
  return useQuery({
    queryKey: gamesKey(steam_id_32 ?? -1),
    queryFn: () => api.listGames(steam_id_32!),
    enabled: steam_id_32 != null,
  });
}
