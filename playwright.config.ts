import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env['CI']),
  // Explicit cap rather than the core-count default, per the memory rules in CLAUDE.md.
  workers: 2,
  reporter: process.env['CI'] ? 'line' : 'list',

  // No webServer on purpose. The artifact is a single file opened over file://,
  // which is exactly how a user runs it; `pnpm test:e2e` rebuilds dist first.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
