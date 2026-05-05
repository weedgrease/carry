import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";
import type { TransferPair, TransferOutcome } from "@/types/domain";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { useAccounts, AccountGrid } from "@/features/accounts";
import { useGames, GameGrid } from "@/features/library";
import { useTransferStore } from "../stores/transfer-store";
import { TransferConfirmDialog } from "./transfer-confirm-dialog";
import { TransferResultsDialog } from "./transfer-results-dialog";

export function TransferPage() {
  const { data: accounts = [] } = useAccounts();
  const {
    sourceId, targetIds, selectedAppIds,
    setSource, toggleTarget, toggleApp, reset,
  } = useTransferStore();
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
          source_persona: source.display_name,
          target_persona: t.display_name,
          app_id: g.app_id,
          game_name: g.name,
        });
      }
    }
    return pairs;
  };

  const status = (() => {
    if (!source) return "Pick a source account.";
    if (selectedAppIds.size === 0) return "Pick at least one game.";
    if (targetIds.size === 0) return "Pick at least one target account.";
    const pairs = selectedAppIds.size * targetIds.size;
    return `${selectedAppIds.size} game${selectedAppIds.size === 1 ? "" : "s"} → ${targetIds.size} account${targetIds.size === 1 ? "" : "s"} · up to ${pairs} configs will be auto-backed-up.`;
  })();

  const ready = !!source && selectedAppIds.size > 0 && targetIds.size > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <Section title="Source" description="Pick the account you want to copy from">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Steam accounts detected. Check Settings → Steam install path.
            </p>
          ) : (
            <AccountGrid
              mode="single"
              accounts={accounts}
              value={sourceId}
              onSelect={setSource}
            />
          )}
        </Section>

        {source && (
          <Section title="Games" description="Click cards to select. Multi-select.">
            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {source.display_name} has no game configs on disk.
              </p>
            ) : (
              <GameGrid games={games} selected={selectedAppIds} onToggle={toggleApp} />
            )}
          </Section>
        )}

        {source && selectedAppIds.size > 0 && (
          <Section title="Copy to" description="One or more targets. Source is hidden.">
            <AccountGrid
              mode="multi"
              accounts={accounts}
              value={targetIds}
              onSelect={toggleTarget}
              excludeIds={new Set([source.steam_id_64])}
              emptyMessage="No other accounts available to copy to."
            />
          </Section>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">{status}</p>
        <Button variant="ghost" onClick={reset} disabled={mutation.isPending}>
          Reset
        </Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={!ready || mutation.isPending}>
          {mutation.isPending ? "Transferring..." : "Transfer →"}
        </Button>
      </div>

      <TransferConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        gamesCount={selectedAppIds.size}
        targetsCount={targetIds.size}
        onConfirm={() => { setConfirmOpen(false); mutation.mutate(buildPairs()); }}
      />
      <TransferResultsDialog
        open={results !== null}
        onOpenChange={(o) => {
          if (!o) {
            setResults(null);
            reset();
          }
        }}
        results={results ?? []}
      />
    </div>
  );
}
