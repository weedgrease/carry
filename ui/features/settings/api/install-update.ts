import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { api, toErrorMessage } from "@/lib/tauri-client";
import type { UpdateProgress } from "@/types/domain";

// Module-scoped guard so a double-clicked toast action can't kick off two
// concurrent installs.
let inFlight = false;

function formatMB(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1);
}

function formatProgress(downloaded: number, total: number | null): string {
  if (total && total > 0) {
    const pct = Math.floor((downloaded / total) * 100);
    return `Downloading ${formatMB(downloaded)} / ${formatMB(total)} MB (${pct}%)`;
  }
  return `Downloading ${formatMB(downloaded)} MB…`;
}

/**
 * Trigger `install_update` and surface byte-level download progress through
 * a single sonner toast that updates in place. The Rust side restarts the
 * process after install, so the toast naturally disappears with the window.
 */
export async function installUpdateWithProgress(): Promise<void> {
  if (inFlight) return;
  inFlight = true;

  const toastId = toast.loading("Preparing update…");

  const unlisten = await listen<UpdateProgress>("update-progress", (e) => {
    const p = e.payload;
    if (p.phase === "progress") {
      toast.loading(formatProgress(p.downloaded, p.total), { id: toastId });
    } else if (p.phase === "finished") {
      toast.loading("Installing… app will restart.", { id: toastId });
    }
  });

  try {
    await api.installUpdate();
  } catch (e) {
    toast.error(toErrorMessage(e, "Update failed"), { id: toastId });
  } finally {
    unlisten();
    inFlight = false;
  }
}
