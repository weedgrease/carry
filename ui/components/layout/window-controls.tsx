import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();

export function WindowControls() {
  return (
    <div className="flex items-stretch h-full">
      <button
        type="button"
        onClick={() => win.minimize()}
        aria-label="Minimize"
        className="w-10 inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => win.toggleMaximize()}
        aria-label="Maximize"
        className="w-10 inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Square className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => win.close()}
        aria-label="Close"
        className="w-10 inline-flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
