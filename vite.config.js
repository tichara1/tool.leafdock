import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  server: {
    proxy: { "/api": "http://127.0.0.1:3000", "/mcp": "http://127.0.0.1:3000" },
  },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: { input: { main: "index.html", demo: "demo.html" } },
  },
});
