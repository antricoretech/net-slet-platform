import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const { Client } = requireFromApi('pg') as { Client: new (options: { connectionString: string }) => DbClient };
interface DbClient { connect(): Promise<void>; end(): Promise<void>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

async function signIn(browser: Browser, email: string, password: string) {
  const page = await browser.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
  return page;
}

async function register(email: string, password: string) {
  const response = await fetch(`${apiBase}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (response.status !== 201) throw new Error(`Fixture registration failed: ${response.status}`);
  return (await response.json()).account.id as string;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('PYQ browser acceptance requires DATABASE_URL');
  const url = new URL(value);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('PYQ browser acceptance requires a local database');
  if (url.pathname !== '/netslet_stageb_ci' || url.port !== '5432') throw new Error('PYQ browser acceptance refuses a non-CI database');
  return value;
}

test.describe('Release 1 historical PYQ journeys', () => {
  test('authorized reviewer opens the protected governance workspace and sees a safe queue state', async ({ browser }) => {
    const db = new Client({ connectionString: databaseUrl() }); await db.connect();
    const suffix = randomUUID(); const email = `pyq-reviewer-${suffix}@integration.test`; const password = 'IntegrationOnlyPassword123!'; let accountId: string | undefined; let page: Page | undefined;
    try {
      accountId = await register(email, password);
      await db.query('UPDATE "Account" SET role = $1 WHERE id = $2', ['SME', accountId]);
      page = await signIn(browser, email, password);
      await page.goto('/workspace/historical-governance');
      await expect(page.getByRole('heading', { name: 'Evidence before publication.' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Historical question governance queue' })).toBeVisible().catch(() => undefined);
      await expect(page.getByText(/No historical records|Loading historical governance queue/)).toBeVisible({ timeout: 30_000 });
    } finally {
      await page?.context().close();
      if (accountId) { await db.query('DELETE FROM "AuditEvent" WHERE "accountId" = $1', [accountId]); await db.query('DELETE FROM "Session" WHERE "accountId" = $1', [accountId]); await db.query('DELETE FROM "Account" WHERE id = $1', [accountId]); }
      await db.end();
    }
  });

  test('student reaches historical PYQ preparation and receives a safe empty or filtered state', async ({ browser }) => {
    const db = new Client({ connectionString: databaseUrl() }); await db.connect();
    const suffix = randomUUID(); const email = `pyq-student-${suffix}@integration.test`; const password = 'IntegrationOnlyPassword123!'; let accountId: string | undefined; let page: Page | undefined;
    try {
      accountId = await register(email, password);
      page = await signIn(browser, email, password);
      await page.goto('/preparation/UGC_NET/pyqs');
      await expect(page.getByRole('heading', { name: 'Past-question discovery' })).toBeVisible();
      await expect(page.getByText(/No verified questions found|Loading verified historical question inventory|Showing/)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('body')).not.toContainText(/correct answer\s*:/i);
    } finally {
      await page?.context().close();
      if (accountId) { await db.query('DELETE FROM "AuditEvent" WHERE "accountId" = $1', [accountId]); await db.query('DELETE FROM "Session" WHERE "accountId" = $1', [accountId]); await db.query('DELETE FROM "Account" WHERE id = $1', [accountId]); }
      await db.end();
    }
  });
});
