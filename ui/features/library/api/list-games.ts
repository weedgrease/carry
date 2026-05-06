import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const gamesKey = (id32: number) => ["games", id32] as const;

// The `game-metadata-updated` event listener is registered once at app
// startup in main.tsx (module load) so it can't race the backend's bg
// fetcher. The listener writes payloads straight into the React Query
// cache via setQueriesData — no extra IPC roundtrip — which is why names
// pop in the moment Steam responds, well before the cover-art image
// finishes downloading.
export function useGames(steam_id_32: number | null) {
  return useQuery({
    queryKey: gamesKey(steam_id_32 ?? -1),
    queryFn: () => api.listGames(steam_id_32!),
    enabled: steam_id_32 != null,
  });
}
