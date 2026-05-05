import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";

export const accountsQueryKey = ["accounts"] as const;

export function useAccounts() {
  return useQuery({ queryKey: accountsQueryKey, queryFn: api.listAccounts });
}
