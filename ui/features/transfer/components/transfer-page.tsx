import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";
import type { GameView, TransferPair, TransferOutcome } from "@/types/domain";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts, AccountGrid } from "@/features/accounts";
import { useGames, GameGrid } from "@/features/library";
import { useTransferStore } from "../stores/transfer-store";
import { TransferConfirmDialog } from "./transfer-confirm-dialog";
import { TransferResultsDialog } from "./transfer-results-dialog";

type SortKey = "recent" | "name";

function sortGames(games: GameView[], key: SortKey): GameView[] {
  if (key === "name") {
    // Pending entries (empty name) sort to the end so the user sees real
    // names alphabetised and skeletons at the tail.
    return [...games].sort((a, b) => {
      if (!a.name && b.name) return 1;
      if (a.name && !b.name) return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }
  // "recent" — backend already returns games sorted by last_modified DESC.
  return games;
}

export function TransferPage() {
  const { data: accounts = [] } = useAccounts();
  const {
    sourceId, targetIds, selectedAppIds,
    setSource, toggleTarget, toggleApp, reset,
  } = useTransferStore();
  const source = accounts.find((a) => a.steam_id_64 === sourceId);
  const { data: games = [], isLoading: gamesLoading } = useGames(source?.steam_id_32 ?? null);
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const sortedGames = useMemo(() => sortGames(games, sortBy), [games, sortBy]);
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

  // If the user changed Steam path (or any other reason the previously-
  // selected source no longer exists), drop the stale selection so the
  // page returns to its empty Source-only state.
  useEffect(() => {
    if (sourceId && accounts.length > 0 && !source) {
      reset();
    }
  }, [sourceId, source, accounts.length, reset]);

  // Auto-scroll between sections so users on smaller windows don't have
  // to manually scroll after each decision.
  const scrollRef = useRef<HTMLDivElement>(null);
  const gamesRef = useRef<HTMLDivElement>(null);
  const targetsRef = useRef<HTMLDivElement>(null);
  const prevHasGames = useRef(false);

  useEffect(() => {
    if (sourceId) {
      requestAnimationFrame(() => {
        gamesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      // Reset → scroll back to top so SOURCE is visible again.
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [sourceId]);

  useEffect(() => {
    const hasGames = selectedAppIds.size > 0;
    if (hasGames && !prevHasGames.current) {
      requestAnimationFrame(() => {
        targetsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    prevHasGames.current = hasGames;
  }, [selectedAppIds.size]);

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
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
          <div ref={gamesRef} className="scroll-mt-3">
            <Section
              title="Games"
              description="Click cards to select. Multi-select."
              action={games.length > 0 ? (
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recently played</SelectItem>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                  </SelectContent>
                </Select>
              ) : undefined}
            >
              {gamesLoading ? (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Scanning {source.display_name}'s game configs…
                </p>
              ) : games.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {source.display_name} has no game configs on disk.
                </p>
              ) : (
                <GameGrid games={sortedGames} selected={selectedAppIds} onToggle={toggleApp} />
              )}
            </Section>
          </div>
        )}

        {source && selectedAppIds.size > 0 && (
          <div ref={targetsRef} className="scroll-mt-3">
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
          </div>
        )}
      </div>

      <div className="border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-4">
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
