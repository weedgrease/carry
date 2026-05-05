import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "ui") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/core/**"] },
  },
  build: {
    outDir: "dist",
    // Carry is a desktop app loaded from disk, not over the network. The 500 kB
    // default is tuned for web bundles; raise it so normal-sized desktop chunks
    // don't trigger noise but a true regression (e.g. a 1.5 MB blob from
    // accidentally bundling something heavy) still gets flagged.
    chunkSizeWarningLimit: 700,
  },
}));
