import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";
import type { TransferPair, TransferOutcome } from "@/types/domain";
import { useAccounts, AccountSelector, TargetList } from "@/features/accounts";
import { useGames, GameGrid } from "@/features/library";
import { useTransferStore } from "../stores/transfer-store";
import { ActionBar } from "./action-bar";
import { TransferConfirmDialog } from "./transfer-confirm-dialog";
import { TransferResultsDialog } from "./transfer-results-dialog";

export function TransferPage() {
  const { data: accounts = [] } = useAccounts();
  const { sourceId, targetIds, selectedAppIds, setSource, toggleTarget, toggleApp, reset }
    = useTransferStore();
  const source = accounts.find((a) => a.steam_id_64 === sourceId);
  const { data: games = [] } = useGames(source?.steam_id_32 ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<TransferOutcome[] | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (pairs: TransferPair[]) => api.runTransfer(pairs),
    onSuccess: (out) => {
      setResults(out);
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const buildPairs = (): TransferPair[] => {
    if (!source) return [];
    const targets = accounts.filter((a) => targetIds.has(a.steam_id_64));
    const selectedGames = games.filter((g) => selectedAppIds.has(g.app_id));
    const pairs: TransferPair[] = [];
    for (const t of targets) {
      for (const g of selectedGames) {
        pairs.push({
          source_steam_id_64: source.steam_id_64,
          target_steam_id_64: t.steam_id_64,
          source_steam_id_32: source.steam_id_32,
          target_steam_id_32: t.steam_id_32,
          source_persona: source.persona_name,
          target_persona: t.persona_name,
          app_id: g.app_id,
          game_name: g.name,
        });
      }
    }
    return pairs;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="grid grid-cols-[1fr_320px] flex-1 overflow-hidden">
        <div className="overflow-y-auto p-6 space-y-6">
          <section>
            <h2 className="text-sm font-semibold mb-2">Source account</h2>
            <AccountSelector accounts={accounts} value={sourceId} onChange={setSource} />
          </section>
          <section>
            <h2 className="text-sm font-semibold mb-3">Games</h2>
            {source
              ? <GameGrid games={games} selected={selectedAppIds} onToggle={toggleApp} />
              : <p className="text-sm text-muted-foreground">Pick a source account first.</p>}
          </section>
        </div>
        <aside className="border-l p-6 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-3">Targets</h2>
          <TargetList
            accounts={accounts}
            sourceId={sourceId}
            selected={targetIds}
            onToggle={toggleTarget}
          />
        </aside>
      </div>
      <ActionBar
        gamesCount={selectedAppIds.size}
        targetsCount={targetIds.size}
        onCancel={reset}
        onTransfer={() => setConfirmOpen(true)}
        busy={mutation.isPending}
      />
      <TransferConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        gamesCount={selectedAppIds.size}
        targetsCount={targetIds.size}
        onConfirm={() => { setConfirmOpen(false); mutation.mutate(buildPairs()); }}
      />
      <TransferResultsDialog
        open={results !== null}
        onOpenChange={(o) => !o && setResults(null)}
        results={results ?? []}
      />
    </div>
  );
}
