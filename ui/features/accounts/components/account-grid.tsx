import type { Account } from "@/types/domain";
import { AccountCard } from "./account-card";

type CommonProps = {
  accounts: Account[];
  excludeIds?: Set<string>;
  badges?: Map<string, number>;
  emptyMessage?: string;
};

type SingleProps = CommonProps & {
  mode: "single";
  value: string | null;
  onSelect: (steamId64: string) => void;
};

type MultiProps = CommonProps & {
  mode: "multi";
  value: Set<string>;
  onSelect: (steamId64: string) => void;
};

/**
 * Grid of {@link AccountCard}s in either single- or multi-select mode. Used
 * by Transfer (source + targets) and Backups (account picker).
 */
export function AccountGrid(props: SingleProps | MultiProps) {
  const { accounts, excludeIds, badges, emptyMessage, mode, onSelect } = props;
  const filtered = accounts.filter((a) => !excludeIds?.has(a.steam_id_64));

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {emptyMessage ?? "No accounts available."}
      </p>
    );
  }

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
    >
      {filtered.map((a) => {
        const isSelected =
          mode === "single"
            ? props.value === a.steam_id_64
            : props.value.has(a.steam_id_64);
        const badge = badges?.get(a.steam_id_64);
        const disabled = badge === 0;
        return (
          <AccountCard
            key={a.steam_id_64}
            account={a}
            selected={isSelected}
            disabled={disabled}
            badge={badge}
            onClick={() => onSelect(a.steam_id_64)}
          />
        );
      })}
    </div>
  );
}
