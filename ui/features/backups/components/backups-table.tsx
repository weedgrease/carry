import type { BackupRecord } from "@/types/domain";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BackupRowActions } from "./backup-row-actions";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"]; let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

/** Flat tabular view of every backup. Used by older flat layouts. */
export function BackupsTable({ records }: { records: BackupRecord[] }) {
  if (records.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">No backups yet.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Game</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => (
          <TableRow key={r.archive_path}>
            <TableCell className="font-mono text-xs">
              {new Date(r.manifest.created_at).toLocaleString()}
            </TableCell>
            <TableCell>{r.manifest.persona_name_at_backup}</TableCell>
            <TableCell>{r.manifest.game_name_at_backup}</TableCell>
            <TableCell>
              <Badge variant={r.manifest.reason === "Manual" ? "default" : "secondary"}>
                {r.manifest.reason}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">{fmtBytes(r.size_bytes)}</TableCell>
            <TableCell className="w-12"><BackupRowActions record={r} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
