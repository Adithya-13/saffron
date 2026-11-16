import { defineConfig } from '@playwright/test';

const remoteUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  use: {
    baseURL: remoteUrl ?? 'http://localhost:8787',
    viewport: { width: 1440, height: 900 },
  },
  ...(remoteUrl
    ? {}
    : {
        webServer: {
          command: 'pnpm --filter @saffron/web build && pnpm --filter @saffron/server dev',
          url: 'http://localhost:8787',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
