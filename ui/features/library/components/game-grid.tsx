import type { GameView } from "@/types/domain";
import { GameCard } from "./game-card";

export function GameGrid({
  games, selected, onToggle,
}: { games: GameView[]; selected: Set<number>; onToggle: (id: number) => void }) {
  if (games.length === 0) {
    return <div className="text-sm text-muted-foreground p-6">No game configs found for this account.</div>;
  }
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {games.map((g) => (
        <GameCard
          key={g.app_id}
          game={g}
          selected={selected.has(g.app_id)}
          onToggle={() => onToggle(g.app_id)}
        />
      ))}
    </div>
  );
}
