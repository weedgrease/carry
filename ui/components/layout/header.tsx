import { NavLink } from "react-router";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Transfer", end: true },
  { to: "/backups", label: "Backups" },
  { to: "/settings", label: "Settings" },
];

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center px-6 gap-6">
        <h1 className="font-semibold tracking-tight">Carry</h1>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
    </header>
  );
}
