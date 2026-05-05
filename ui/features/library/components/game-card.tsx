import type { GameView } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export function GameCard({
  game, selected, onToggle,
}: { game: GameView; selected: boolean; onToggle: () => void }) {
  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-primary",
        !game.is_known && "opacity-70"
      )}
      onClick={onToggle}
    >
      <div className="relative aspect-[460/215] bg-muted flex items-center justify-center">
        {game.is_known ? (
          <img
            src={game.header_image_url}
            alt={game.name}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <HelpCircle className="size-10 text-muted-foreground" />
        )}
        <div className="absolute top-2 left-2">
          <Checkbox checked={selected} onCheckedChange={onToggle} />
        </div>
      </div>
      <div className="p-3 space-y-1">
        <div className="font-medium text-sm leading-tight truncate" title={game.name}>{game.name}</div>
        <div className="text-xs text-muted-foreground">
          {fmtSize(game.config_size_bytes)} · ID {game.app_id}
        </div>
      </div>
    </Card>
  );
}
