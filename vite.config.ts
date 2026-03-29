import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("elkjs")) {
            return "elk-vendor";
          }

          if (id.includes("@xyflow/react")) {
            return "xyflow-vendor";
          }

          if (id.includes("@tiptap")) {
            return "editor-vendor";
          }

          if (id.includes("@tauri-apps")) {
            return "tauri-vendor";
          }

          if (
            id.includes("react-dom") ||
            id.includes("react-router-dom") ||
            id.includes("@remix-run/router") ||
            id.includes("scheduler") ||
            id.includes("react")
          ) {
            return "react-vendor";
          }

          if (id.includes("lucide-react") || id.includes("clsx")) {
            return "ui-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
