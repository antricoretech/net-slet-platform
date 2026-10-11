import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: { command: 'corepack pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
});
