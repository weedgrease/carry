import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/tauri-client";

async function runWindowAction(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    toast.error(`${label} failed: ${toErrorMessage(e)}`);
  }
}

const minimize = () => runWindowAction("Minimize", () => getCurrentWindow().minimize());
const toggleMaximize = () => runWindowAction("Maximize toggle", () => getCurrentWindow().toggleMaximize());
const close = () => runWindowAction("Close", () => getCurrentWindow().close());

/** Custom minimize / maximize / close buttons replacing the OS title bar. */
export function WindowControls() {
  return (
    <div
      className="flex items-stretch h-full"
      data-tauri-drag-region="false"
    >
      <button
        type="button"
        onClick={minimize}
        aria-label="Minimize"
        data-tauri-drag-region="false"
        className="w-10 inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={toggleMaximize}
        aria-label="Maximize"
        data-tauri-drag-region="false"
        className="w-10 inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Square className="size-3" />
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        data-tauri-drag-region="false"
        className="w-10 inline-flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
