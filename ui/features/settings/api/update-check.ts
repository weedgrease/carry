import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";

let checked = false;
/**
 * Fire one update check on first mount and toast with an Install action if a
 * newer version is available. Module-level guard prevents duplicate checks
 * across StrictMode double-invokes or AppShell remounts.
 */
export function useUpdateCheckOnLaunch() {
  useEffect(() => {
    if (checked) return;
    checked = true;
    api.checkForUpdate().then((info) => {
      if (info.available) {
        toast(`Update v${info.version} available`, {
          action: { label: "Install", onClick: () => api.installUpdate() },
          duration: 10_000,
        });
      }
    }).catch(() => {});
  }, []);
}
