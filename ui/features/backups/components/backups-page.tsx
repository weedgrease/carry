import { useMemo, useState } from "react";
import { useBackups } from "../api/queries";
import { BackupsTable } from "./backups-table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { BackupReason } from "@/types/domain";

const ALL = "__all__";

export function BackupsPage() {
  const { data: records = [] } = useBackups();
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<BackupReason | typeof ALL>(ALL);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (reason !== ALL && r.manifest.reason !== reason) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.manifest.game_name_at_backup.toLowerCase().includes(q)
          || r.manifest.persona_name_at_backup.toLowerCase().includes(q);
      }
      return true;
    });
  }, [records, reason, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search games or accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={reason} onValueChange={(v) => setReason(v as BackupReason | typeof ALL)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All reasons</SelectItem>
            <SelectItem value="Manual">Manual</SelectItem>
            <SelectItem value="PreCopy">Pre-Copy</SelectItem>
            <SelectItem value="PreRestore">Pre-Restore</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg">
        <BackupsTable records={filtered} />
      </div>
    </div>
  );
}
