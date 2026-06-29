import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright browser-smoke config — see ../../docs/testing.md (Layer 4).
 *
 * Smoke flows only. Run locally with:
 *   bunx playwright install   # one-time: download browsers
 *   bun run test:browser
 *
 * The web server is started automatically against a production build unless
 * PLAYWRIGHT_BASE_URL points at an already-running instance.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Only manage a server when targeting localhost (skip if pointed elsewhere).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run build && bun run start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
