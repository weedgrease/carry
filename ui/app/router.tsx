import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { TransferPage } from "@/features/transfer/components/transfer-page";

const BackupsPage = lazy(() =>
  import("@/features/backups/components/backups-page").then((m) => ({ default: m.BackupsPage }))
);
const SettingsPage = lazy(() =>
  import("@/features/settings/components/settings-page").then((m) => ({ default: m.SettingsPage }))
);
const AboutPage = lazy(() =>
  import("@/features/about/components/about-page").then((m) => ({ default: m.AboutPage }))
);

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<div className="px-6 py-6 text-sm text-muted-foreground">Loading…</div>}>
      <Component />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: TransferPage },
      { path: "backups", element: withSuspense(BackupsPage) },
      { path: "settings", element: withSuspense(SettingsPage) },
      { path: "about", element: withSuspense(AboutPage) },
    ],
  },
]);

/** Top-level router: lazy-loads non-default routes behind a Suspense fallback. */
export function Router() {
  return <RouterProvider router={router} />;
}
