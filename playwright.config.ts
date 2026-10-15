import { defineConfig, devices } from '@playwright/test';

const apiPort = process.env.STAGE_B_API_PORT ?? '4000';
const webPort = process.env.STAGE_B_WEB_PORT ?? '3000';
const externalServers = process.env.STAGE_B_EXTERNAL_SERVERS === '1';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/stage-b-e2e-runs',
  timeout: 30_000,
  fullyParallel: false,
  workers: process.env.CI === 'true' ? 1 : undefined,
  reporter: [['list']],
  globalSetup: process.env.STAGE_B_CBT_E2E === '1' ? './tests/e2e/stage-b-cbt.global.ts' : undefined,
  globalTeardown: process.env.STAGE_B_CBT_E2E === '1' ? './tests/e2e/stage-b-cbt.teardown.ts' : undefined,
  use: { baseURL: `http://127.0.0.1:${webPort}`, trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: externalServers ? undefined : [
    { command: process.env.COLD_START_QA === '1' ? 'corepack pnpm --filter @net-slet/api start' : 'corepack pnpm --filter @net-slet/api dev', url: `http://127.0.0.1:${apiPort}/api/v1/health/ready`, reuseExistingServer: process.env.COLD_START_QA !== '1', timeout: 120_000 },
    { command: process.env.COLD_START_QA === '1' ? `corepack pnpm --filter @net-slet/web exec next start -p ${webPort}` : `corepack pnpm --filter @net-slet/web exec next dev -p ${webPort}`, url: `http://127.0.0.1:${webPort}`, reuseExistingServer: process.env.COLD_START_QA !== '1', timeout: 120_000 },
  ],
});
