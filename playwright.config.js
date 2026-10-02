import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      "PORT=3100 DATA_DIR=/tmp/leafdock-playwright-data node server/index.js",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
