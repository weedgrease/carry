import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";
import type { GameView } from "@/types/domain";

export const gamesKey = (id32: number) => ["games", id32] as const;

const POLL_INTERVAL_MS = 2500;

export function useGames(steam_id_32: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: gamesKey(steam_id_32 ?? -1),
    queryFn: () => api.listGames(steam_id_32!),
    enabled: steam_id_32 != null,
  });

  // While any tile is still pending its metadata fetch, poll the backend
  // every few seconds. Each poll is fast (just reads the cache file) and
  // returns the updated set; React Query swaps in the new array and the
  // tiles re-render with real names + header art. Polling stops the moment
  // every tile is resolved (either known with metadata or confirmed
  // untitled).
  const data: GameView[] | undefined = query.data;
  const hasPending = data?.some((g) => g.is_pending_fetch) ?? false;

  useEffect(() => {
    if (steam_id_32 == null || !hasPending) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: gamesKey(steam_id_32) });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [steam_id_32, hasPending, queryClient]);

  return query;
}
