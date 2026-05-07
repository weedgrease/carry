import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";

// Module-scoped flags so StrictMode double-invokes and AppShell remounts
// don't fire duplicate checks. `inflight` blocks while a request is open;
// `succeeded` blocks for the rest of the session once a check returns.
// A failed first check resets `inflight` so a later mount can retry.
let inflight = false;
let succeeded = false;

/** Fire one update check on first mount; toast with an Install action if available. */
export function useUpdateCheckOnLaunch() {
  useEffect(() => {
    if (succeeded || inflight) return;
    inflight = true;
    api.checkForUpdate()
      .then((info) => {
        succeeded = true;
        if (info.available) {
          toast(`Update v${info.version} available`, {
            action: { label: "Install", onClick: () => api.installUpdate() },
            duration: 10_000,
          });
        }
      })
      .catch(() => {})
      .finally(() => { inflight = false; });
  }, []);
}
