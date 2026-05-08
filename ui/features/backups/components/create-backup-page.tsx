import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GameView } from "@/types/domain";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts, AccountGrid } from "@/features/accounts";
import { useGames, GameGrid } from "@/features/library";
import { api, toErrorMessage } from "@/lib/tauri-client";

type SortKey = "recent" | "name";
type WizardStep = "account" | "games";

const STEP_NUMBERS = { account: 1, games: 2 } as const satisfies Record<WizardStep, number>;

function sortGames(games: GameView[], key: SortKey): GameView[] {
  if (key === "name") {
    return [...games].sort((a, b) => {
      if (!a.name && b.name) return 1;
      if (a.name && !b.name) return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }
  return games;
}

/** Two-step wizard for creating manual backups: pick an account, pick games. */
export function CreateBackupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const presetAccountId = searchParams.get("account");
  const [accountId, setAccountId] = useState<string | null>(presetAccountId);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<number>>(new Set());
  // Skip the account-picker step if we arrived with a preset account.
  const [step, setStep] = useState<WizardStep>(presetAccountId ? "games" : "account");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [submitting, setSubmitting] = useState(false);

  const account = accounts.find((a) => a.steam_id_64 === accountId);
  const { data: games = [], isLoading: gamesLoading } = useGames(account?.steam_id_32 ?? null);
  const sortedGames = useMemo(() => sortGames(games, sortBy), [games, sortBy]);

  const toggleApp = (id: number) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // If the account disappears (e.g. Steam path change flushed queries),
  // restart the wizard.
  useEffect(() => {
    if (!accountId) {
      setStep("account");
      return;
    }
    if (accounts.length > 0 && !account) {
      setAccountId(null);
      setSelectedAppIds(new Set());
      setStep("account");
    }
  }, [accountId, account, accounts.length]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const stepLabelText = `Step ${STEP_NUMBERS[step]} of 2`;
  const stepDesc = ((): string => {
    if (step === "account") {
      return account ? `Backing up ${account.display_name}.` : "Pick the account to back up.";
    }
    const n = selectedAppIds.size;
    return n === 0 ? "Pick games to back up." : `${n} game${n === 1 ? "" : "s"} selected.`;
  })();

  const canAdvance = step === "account" ? !!account : selectedAppIds.size > 0;
  const ready = !!account && selectedAppIds.size > 0;

  const goNext = () => { if (step === "account") setStep("games"); };
  // Back leaves the wizard entirely from step 1 — gives the user a clear
  // way to return to the Backups list without going through the nav bar.
  const goBack = () => {
    if (step === "games") setStep("account");
    else navigate("/backups");
  };
  const handleReset = () => {
    setAccountId(null);
    setSelectedAppIds(new Set());
    setStep("account");
  };

  const handleBackup = async () => {
    if (!account || !ready) return;
    setSubmitting(true);
    const targets = games.filter((g) => selectedAppIds.has(g.app_id));
    let succeeded = 0;
    let failed = 0;
    for (const g of targets) {
      try {
        await api.createManualBackup({
          steam_id_64: account.steam_id_64,
          steam_id_32: account.steam_id_32,
          persona_name: account.display_name,
          app_id: g.app_id,
          game_name: g.name,
        });
        succeeded++;
      } catch (e) {
        failed++;
        toast.error(`${g.name || `App ${g.app_id}`}: ${toErrorMessage(e)}`);
      }
    }
    setSubmitting(false);
    if (succeeded > 0) {
      toast.success(`Backed up ${succeeded} game${succeeded === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["backups"] });
      navigate("/backups");
    } else if (failed === 0) {
      navigate("/backups");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {step === "account" && (
          <Section title="Account" description="Pick the account to back up">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Steam accounts detected. Check Settings → Steam install path.
              </p>
            ) : (
              <AccountGrid
                mode="single"
                accounts={accounts}
                value={accountId}
                onSelect={setAccountId}
              />
            )}
          </Section>
        )}

        {step === "games" && account && (
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
                Scanning {account.display_name}'s game configs…
              </p>
            ) : games.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {account.display_name} has no game configs on disk.
              </p>
            ) : (
              <GameGrid games={sortedGames} selected={selectedAppIds} onToggle={toggleApp} />
            )}
          </Section>
        )}
      </div>

      <div className="border-t bg-background/95 backdrop-blur px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-muted-foreground sm:flex-1">
          <span className="font-semibold text-foreground">{stepLabelText}</span> · {stepDesc}
        </p>
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
          <Button variant="outline" onClick={handleReset} disabled={submitting}>
            Reset
          </Button>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" onClick={goBack} disabled={submitting}>
              ← Back
            </Button>
            {step !== "games" ? (
              <Button onClick={goNext} disabled={!canAdvance || submitting}>
                Next →
              </Button>
            ) : (
              <Button onClick={handleBackup} disabled={!ready || submitting}>
                {submitting ? "Backing up..." : "Backup →"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
