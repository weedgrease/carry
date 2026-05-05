import { Outlet } from "react-router";
import { Header } from "./header";
import { useUpdateCheckOnLaunch } from "@/features/settings/api/update-check";

export function AppShell() {
  useUpdateCheckOnLaunch();
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
