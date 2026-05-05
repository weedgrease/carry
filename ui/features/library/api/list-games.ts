import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const gamesKey = (id32: number) => ["games", id32] as const;

export function useGames(steam_id_32: number | null) {
  return useQuery({
    queryKey: gamesKey(steam_id_32 ?? -1),
    queryFn: () => api.listGames(steam_id_32!),
    enabled: steam_id_32 != null,
  });
}
