import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri-client";
import { settingsKey } from "./queries";
import { showUpdateAvailableToast } from "./show-update-toast";

// Module-scoped flags so StrictMode double-invokes and AppShell remounts
// don't fire duplicate checks. `inflight` blocks while a request is open;
// `succeeded` blocks for the rest of the session once a check returns.
// A failed first check resets `inflight` so a later mount can retry.
let inflight = false;
let succeeded = false;

/** Fire one update check on first mount; toast with an Install action if available. */
export function useUpdateCheckOnLaunch() {
  const qc = useQueryClient();
  useEffect(() => {
    if (succeeded || inflight) return;
    inflight = true;
    api.checkForUpdate()
      .then((info) => {
        succeeded = true;
        qc.invalidateQueries({ queryKey: settingsKey });
        if (info.available) {
          showUpdateAvailableToast(info);
        }
      })
      .catch(() => {})
      .finally(() => { inflight = false; });
  }, [qc]);
}
