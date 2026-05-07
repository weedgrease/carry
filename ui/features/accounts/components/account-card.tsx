import type { Account } from "@/types/domain";
import { cn } from "@/lib/utils";
import { AvatarImageBlock } from "./avatar-image";

/** Selectable tile rendering an account avatar, display name, and optional badge. */
export function AccountCard({
  account,
  selected,
  disabled,
  badge,
  onClick,
}: {
  account: Account;
  selected: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border text-center transition-all",
        "bg-card text-card-foreground",
        selected
          ? "border-primary ring-2 ring-primary bg-primary/10"
          : "border-border hover:border-foreground/40",
        disabled && "opacity-55 pointer-events-none"
      )}
    >
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
          {badge}
        </span>
      )}
      <AvatarImageBlock
        steamId64={account.steam_id_64}
        initialPath={account.avatar_path}
        fallback={account.display_name}
        className="size-14"
      />
      <span className="text-sm font-medium leading-tight truncate max-w-full" title={account.display_name}>
        {account.display_name}
      </span>
    </button>
  );
}
