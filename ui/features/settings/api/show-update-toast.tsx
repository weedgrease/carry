import { open } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import type { UpdateInfo } from "@/types/domain";
import { installUpdateWithProgress } from "./install-update";

const NOTES_MAX_CHARS = 240;

function truncateNotes(notes: string): string {
  const trimmed = notes.trim();
  if (trimmed.length <= NOTES_MAX_CHARS) return trimmed;
  return trimmed.slice(0, NOTES_MAX_CHARS).trimEnd() + "…";
}

function releaseUrl(version: string | null): string {
  return version
    ? `https://github.com/weedgrease/carry/releases/tag/v${version}`
    : "https://github.com/weedgrease/carry/releases/latest";
}

/**
 * Render the "update available" toast: persistent (no auto-dismiss), with
 * truncated release notes that open the GitHub release page on click and an
 * Install action that drives the in-app download progress flow.
 */
export function showUpdateAvailableToast(info: UpdateInfo): void {
  const url = releaseUrl(info.version);
  const notes = info.notes?.trim();
  const description = notes ? (
    <button
      type="button"
      onClick={() => { open(url).catch(() => {}); }}
      className="block w-full whitespace-pre-line text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
    >
      {truncateNotes(notes)}
    </button>
  ) : undefined;

  toast(`Update v${info.version} available`, {
    description,
    action: { label: "Install", onClick: () => { installUpdateWithProgress(); } },
    duration: Infinity,
  });
}
