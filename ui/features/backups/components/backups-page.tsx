import { useEffect, useMemo, useRef, useState } from "react";
import type { BackupReason } from "@/types/domain";
import { Section } from "@/components/layout/section";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts, AccountGrid } from "@/features/accounts";
import { useBackups } from "../api/queries";
import { BackupGameGroup } from "./backup-game-group";

const ALL = "__all__";

export function BackupsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: records = [] } = useBackups();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState<BackupReason | typeof ALL>(ALL);

  // Backup-count per account.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records) {
      m.set(r.manifest.steam_id_64, (m.get(r.manifest.steam_id_64) ?? 0) + 1);
    }
    return m;
  }, [records]);

  const selectedAccount = accounts.find((a) => a.steam_id_64 === selectedId) ?? null;

  const filteredForSelected = useMemo(() => {
    if (!selectedId) return [];
    return records
      .filter((r) => r.manifest.steam_id_64 === selectedId)
      .filter((r) => reason === ALL || r.manifest.reason === reason);
  }, [records, selectedId, reason]);

  // Group filtered backups by app_id.
  const groups = useMemo(() => {
    const byApp = new Map<number, typeof filteredForSelected>();
    for (const r of filteredForSelected) {
      const arr = byApp.get(r.manifest.app_id) ?? [];
      arr.push(r);
      byApp.set(r.manifest.app_id, arr);
    }
    return Array.from(byApp.entries())
      .map(([appId, recs]) => ({
        appId,
        gameName: recs[0].manifest.game_name_at_backup || `App ${appId}`,
        headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
        records: recs,
      }))
      .sort((a, b) => a.gameName.localeCompare(b.gameName));
  }, [filteredForSelected]);

  const totalForSelected = selectedId ? (counts.get(selectedId) ?? 0) : 0;
  const description = selectedAccount
    ? `${totalForSelected} backup${totalForSelected === 1 ? "" : "s"} across ${groups.length} game${groups.length === 1 ? "" : "s"}`
    : "";

  // Scroll to the backups section when an account is picked so the user
  // doesn't have to manually scroll past the account grid.
  const scrollRef = useRef<HTMLDivElement>(null);
  const backupsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId && backupsRef.current) {
      requestAnimationFrame(() => {
        backupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [selectedId]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-5 py-5">
      <Section title="Account" description="Pick an account to view its backups">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Steam accounts detected. Check Settings → Steam install path.
          </p>
        ) : (
          <AccountGrid
            mode="single"
            accounts={accounts}
            value={selectedId}
            onSelect={setSelectedId}
            badges={counts}
          />
        )}
      </Section>

      {selectedAccount && (
        <div ref={backupsRef} className="scroll-mt-3">
        <Section
          title={`Backups for ${selectedAccount.display_name}`}
          description={description}
          action={
            <Select value={reason} onValueChange={(v) => setReason(v as BackupReason | typeof ALL)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="PreCopy">Pre-Copy</SelectItem>
                <SelectItem value="PreRestore">Pre-Restore</SelectItem>
                <SelectItem value="Source">Source</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {totalForSelected === 0
                ? `No backups for ${selectedAccount.display_name} yet. Auto-backups are created when you copy configs to this account.`
                : `No backups match the current filter.`}
            </p>
          ) : (
            <div>
              {groups.map((g) => (
                <BackupGameGroup
                  key={g.appId}
                  appId={g.appId}
                  gameName={g.gameName}
                  headerUrl={g.headerUrl}
                  records={g.records}
                />
              ))}
            </div>
          )}
        </Section>
        </div>
      )}
    </div>
  );
}
