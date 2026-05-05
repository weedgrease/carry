import type { Account } from "@/types/domain";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarImageBlock } from "./avatar-image";

export function TargetList({
  accounts, sourceId, selected, onToggle,
}: {
  accounts: Account[];
  sourceId: string | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const targets = accounts.filter((a) => a.steam_id_64 !== sourceId);
  return (
    <div className="space-y-2">
      {targets.map((a) => {
        const id = `target-${a.steam_id_64}`;
        return (
          <label
            key={a.steam_id_64}
            htmlFor={id}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
          >
            <Checkbox
              id={id}
              checked={selected.has(a.steam_id_64)}
              onCheckedChange={() => onToggle(a.steam_id_64)}
            />
            <AvatarImageBlock
              steamId64={a.steam_id_64}
              initialPath={a.avatar_path}
              fallback={a.persona_name}
              className="size-7"
            />
            <span className="text-sm font-medium">{a.persona_name}</span>
          </label>
        );
      })}
      {targets.length === 0 && (
        <p className="text-sm text-muted-foreground">No other accounts available.</p>
      )}
    </div>
  );
}
