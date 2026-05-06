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

// Register at module load — before React even renders — so the listener is
// always in place by the time list_games kicks off the backend's metadata
// fetcher. listen() is async (it round-trips to register the IPC handler),
// and with 4-way parallel fetches the first events can fire in tens of ms.
// Setting up inside a hook on hook-first-call would race those events.
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
  // Untitled entries may need to vanish when the user has hide_untitled_apps
  // on. That filter lives server-side in list_games, so trigger a refetch
  // for the uncommon untitled case. Known games stay on the fast no-IPC path.
  if (!is_known) {
    queryClient.invalidateQueries({ queryKey: ["games"] });
  }
}).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider><App /></ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
