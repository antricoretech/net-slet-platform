import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    { command: process.env.COLD_START_QA === '1' ? 'corepack pnpm --filter @net-slet/api start' : 'corepack pnpm --filter @net-slet/api dev', url: 'http://localhost:4000/api/v1/health/ready', reuseExistingServer: process.env.COLD_START_QA !== '1', timeout: 120_000 },
    { command: 'corepack pnpm --filter @net-slet/web dev', url: 'http://localhost:3000', reuseExistingServer: process.env.COLD_START_QA !== '1', timeout: 120_000 },
  ],
});
