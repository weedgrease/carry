import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import App from "./app/App";
import { ThemeProvider } from "./app/providers/theme-provider";
import type { GameView } from "./types/domain";
import "./app/globals.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

type MetadataUpdate = {
  app_id: number;
  name: string;
  header_image_url: string;
  is_known: boolean;
};

// Registered at module load (pre-render) because listen() is async and the
// backend can emit the first event within tens of ms of list_games starting
// — a hook-first-call registration would race those.
listen<MetadataUpdate>("game-metadata-updated", (event) => {
  const { app_id, name, header_image_url, is_known } = event.payload;
  queryClient.setQueriesData<GameView[]>({ queryKey: ["games"] }, (old) => {
    if (!old) return old;
    return old.map((g) =>
      g.app_id === app_id
        ? { ...g, name, header_image_url, is_known, is_pending_fetch: false }
        : g,
    );
  });
  // hide_untitled_apps is enforced server-side, so untitled resolutions need
  // a refetch to reflect the filter. Known games stay on the no-IPC fast path.
  if (!is_known) {
    queryClient.invalidateQueries({ queryKey: ["games"] });
  }
}).catch((err) => {
  // Listener failure means metadata events won't reach the cache; surface
  // it so debugging "names never update" reports doesn't start blind.
  console.warn("game-metadata-updated listener failed to register:", err);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider><App /></ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
