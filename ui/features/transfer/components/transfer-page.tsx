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
type WizardStep = "source" | "games" | "targets";

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
  const [step, setStep] = useState<WizardStep>("source");
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

  // Split into two parts so the footer can either join them with " · " on
  // wider viewports OR put the label on the left and the description on
  // the right with justify-between when narrow.
  const stepNum = step === "source" ? 1 : step === "games" ? 2 : 3;
  const stepLabelText = `Step ${stepNum} of 3`;
  const stepDesc = ((): string => {
    if (step === "source") {
      return source ? `From ${source.display_name}.` : "Pick the account to copy from.";
    }
    if (step === "games") {
      const n = selectedAppIds.size;
      return n === 0 ? "Pick games to copy." : `${n} game${n === 1 ? "" : "s"} selected.`;
    }
    if (targetIds.size === 0) return "Pick destination accounts.";
    const pairs = selectedAppIds.size * targetIds.size;
    return `${selectedAppIds.size}→${targetIds.size}, ${pairs} config${pairs === 1 ? "" : "s"}.`;
  })();

  const canAdvance =
    step === "source" ? !!source :
    step === "games" ? selectedAppIds.size > 0 :
    targetIds.size > 0;
  const ready = !!source && selectedAppIds.size > 0 && targetIds.size > 0;

  // If the user changed Steam path (or any other reason the previously-
  // selected source no longer exists), drop the stale selection AND
  // restart the wizard so the page is consistent again.
  useEffect(() => {
    if (sourceId && accounts.length > 0 && !source) {
      reset();
      setStep("source");
    }
  }, [sourceId, source, accounts.length, reset]);

  // Always scroll the content area to the top when changing wizard step so
  // the new section header is visible.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const goNext = () => {
    if (step === "source") setStep("games");
    else if (step === "games") setStep("targets");
  };
  const goBack = () => {
    if (step === "targets") setStep("games");
    else if (step === "games") setStep("source");
  };
  const handleReset = () => {
    reset();
    setStep("source");
  };

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {step === "source" && (
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
        )}

        {step === "games" && source && (
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
        )}

        {step === "targets" && source && (
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

      <div className="border-t bg-background/95 backdrop-blur px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* Narrow: label and description on opposite sides. */}
        <div className="flex items-center justify-between gap-3 text-sm sm:hidden">
          <span className="font-semibold text-foreground">{stepLabelText}</span>
          <span className="text-muted-foreground text-right truncate">{stepDesc}</span>
        </div>
        {/* Wide: combined sentence. */}
        <p className="hidden sm:block sm:flex-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{stepLabelText}</span> · {stepDesc}
        </p>
        {/* Buttons: Reset on far left at narrow, far right at wide. */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
          <Button variant="ghost" onClick={handleReset} disabled={mutation.isPending}>
            Reset
          </Button>
          <div className="flex items-center gap-2 sm:gap-4">
            {step !== "source" && (
              <Button variant="outline" onClick={goBack} disabled={mutation.isPending}>
                ← Back
              </Button>
            )}
            {step !== "targets" ? (
              <Button onClick={goNext} disabled={!canAdvance || mutation.isPending}>
                Next →
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={!ready || mutation.isPending}>
                {mutation.isPending ? "Transferring..." : "Transfer →"}
              </Button>
            )}
          </div>
        </div>
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
