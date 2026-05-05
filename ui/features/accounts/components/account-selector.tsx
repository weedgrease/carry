import type { Account } from "@/types/domain";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AvatarImageBlock } from "./avatar-image";

export function AccountSelector({
  accounts, value, onChange,
}: {
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Choose source account..." />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.steam_id_64} value={a.steam_id_64}>
            <div className="flex items-center gap-2">
              <AvatarImageBlock
                steamId64={a.steam_id_64}
                initialPath={a.avatar_path}
                fallback={a.persona_name}
                className="size-5"
              />
              <span>{a.persona_name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
