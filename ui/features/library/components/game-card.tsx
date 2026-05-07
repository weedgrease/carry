import { useEffect, useState } from "react";
import type { GameView } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

/** Selectable cover-art tile for one game with size, app id, and pending state. */
export function GameCard({
  game, selected, onToggle,
}: { game: GameView; selected: boolean; onToggle: () => void }) {
  // Pre-release / unannounced titles have a name but no public header.jpg.
  // Falling back per-card matches the untitled placeholder treatment.
  const [imageFailed, setImageFailed] = useState(false);
  // Mount the <img> at opacity 0 and fade in on `load` so cached bytes don't
  // reveal name + image in the same React commit — the name visibly lands first.
  const [imageReady, setImageReady] = useState(false);
  useEffect(() => { setImageReady(false); }, [game.header_image_url]);
  const showImage = game.is_known && !imageFailed;

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-primary",
        !showImage && "opacity-70"
      )}
      onClick={onToggle}
    >
      <div className="relative aspect-[460/215] bg-muted flex items-center justify-center">
        {showImage ? (
          <img
            src={game.header_image_url}
            alt={game.name}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-200",
              imageReady ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
          />
        ) : game.is_pending_fetch ? (
          <Loader2 className="size-8 text-muted-foreground animate-spin" />
        ) : (
          <HelpCircle className="size-10 text-muted-foreground" />
        )}
        <div className="absolute top-2 left-2">
          <Checkbox checked={selected} onCheckedChange={onToggle} />
        </div>
      </div>
      <div className="p-3 space-y-1">
        {game.is_pending_fetch ? (
          <>
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted/60 animate-pulse" />
          </>
        ) : (
          <>
            <div className="font-medium text-sm leading-tight truncate" title={game.name}>{game.name}</div>
            <div className="text-xs text-muted-foreground">
              {fmtSize(game.config_size_bytes)} · ID {game.app_id}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
