import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { TransferPage } from "@/features/transfer/components/transfer-page";
import { BackupsPage } from "@/features/backups/components/backups-page";
import { SettingsPage } from "@/features/settings/components/settings-page";

const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: TransferPage },
      { path: "backups", Component: BackupsPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
