import type { BackupRecord } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format";
import { BackupRowActions } from "./backup-row-actions";

/** Header image, name, and table of backup rows for one game. */
export function BackupGameGroup({
  appId,
  gameName,
  headerUrl,
  records,
}: {
  appId: number;
  gameName: string;
  headerUrl: string | null;
  records: BackupRecord[];
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center gap-3 mb-2">
        {headerUrl ? (
          <img
            src={headerUrl}
            alt={gameName}
            className="w-20 h-9 rounded object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-20 h-9 rounded bg-muted" />
        )}
        <div className="font-medium text-sm">{gameName}</div>
        <div className="text-xs text-muted-foreground">· {records.length} backup{records.length === 1 ? "" : "s"}</div>
        <div className="text-[10px] text-muted-foreground/70 ml-auto">ID {appId}</div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        {records.map((r, i) => (
          <div
            key={r.archive_path}
            className={`grid grid-cols-[1fr_110px_90px_44px] items-center px-4 py-2 text-xs ${i < records.length - 1 ? "border-b" : ""}`}
          >
            <div className="font-mono text-muted-foreground">
              {new Date(r.manifest.created_at).toLocaleString()}
            </div>
            <div>
              <Badge variant={r.manifest.reason === "Manual" ? "default" : "secondary"}>
                {r.manifest.reason}
              </Badge>
            </div>
            <div className="text-right font-mono text-muted-foreground">
              {formatBytes(r.size_bytes)}
            </div>
            <div className="flex justify-end">
              <BackupRowActions record={r} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
