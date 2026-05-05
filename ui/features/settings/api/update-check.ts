import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri-client";

let checked = false;
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
    }).catch(() => { /* silent */ });
  }, []);
}
