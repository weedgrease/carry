import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { api } from "@/lib/tauri-client";

export const gamesKey = (id32: number) => ["games", id32] as const;

export function useGames(steam_id_32: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: gamesKey(steam_id_32 ?? -1),
    queryFn: () => api.listGames(steam_id_32!),
    enabled: steam_id_32 != null,
  });

  // The Rust side emits a `game-metadata-updated` event the instant each
  // appdetails fetch lands in the cache file. We invalidate the query on
  // each event so the UI reflects the new data within milliseconds rather
  // than waiting for a polling tick. Each invalidate triggers a single
  // (fast) IPC call to list_games, which just re-reads the cache.
  useEffect(() => {
    if (steam_id_32 == null) return;
    const unlisten = listen("game-metadata-updated", () => {
      queryClient.invalidateQueries({ queryKey: gamesKey(steam_id_32) });
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [steam_id_32, queryClient]);

  return query;
}
