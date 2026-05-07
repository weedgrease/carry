import { NavLink } from "react-router";
import { ThemeToggle } from "./theme-toggle";
import { WindowControls } from "./window-controls";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Transfer", end: true },
  { to: "/backups", label: "Backups" },
  { to: "/settings", label: "Settings" },
  { to: "/about", label: "About" },
];

/** Custom title-bar acting as the Tauri drag region, with nav and window controls. */
export function Header() {
  return (
    <header
      data-tauri-drag-region
      className="h-10 flex items-stretch border-b bg-background select-none"
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-3 sm:gap-4 pl-3 sm:pl-4 pr-2 flex-1 min-w-0"
      >
        <h1 className="font-semibold text-sm tracking-tight whitespace-nowrap hidden sm:block">carry</h1>
        <nav className="flex items-center gap-0.5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto pr-1">
          <ThemeToggle />
        </div>
      </div>
      <WindowControls />
    </header>
  );
}
