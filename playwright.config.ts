import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:8787',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'pnpm --filter @saffron/web build && pnpm --filter @saffron/server dev',
    url: 'http://localhost:8787',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
