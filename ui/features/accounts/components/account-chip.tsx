import type { Account } from "@/types/domain";
import { AvatarImageBlock } from "./avatar-image";

export function AccountChip({ account }: { account: Account }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <AvatarImageBlock
        steamId64={account.steam_id_64}
        initialPath={account.avatar_path}
        fallback={account.persona_name}
        className="size-7"
      />
      <span className="text-sm font-medium">{account.persona_name}</span>
    </div>
  );
}
