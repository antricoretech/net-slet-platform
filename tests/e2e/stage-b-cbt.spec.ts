import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
const fixture = JSON.parse(fs.readFileSync(path.resolve('test-results/stage-b-e2e/fixture.json'), 'utf8')) as { api: string; password: string; studentA: { email: string; id: string }; studentB: { email: string; id: string }; admin: { email: string; id: string }; forms: Array<{ formId: string; subjectCode: string; durationSeconds: number; versionId: string }> };
const api = fixture.api;
let attemptId = '';
const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const { Client } = requireFromApi('pg') as { Client: new (options: { connectionString: string }) => { connect(): Promise<void>; end(): Promise<void>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> } };

async function isolatedQuery(text: string, values: unknown[] = []) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Stage B E2E database URL is required');
  const parsed = new URL(connectionString);
  const local = parsed.port === '55434' && parsed.pathname.startsWith('/netslet_stageb_');
  const ci = process.env.STAGE_B_CI === '1' && parsed.port === '5432' && parsed.pathname === '/netslet_stageb_ci';
  if (!local && !ci) throw new Error('E2E database assertion refuses a non-disposable target');
  const client = new Client({ connectionString });
  await client.connect();
  try { return await client.query(text, values); } finally { await client.end(); }
}

async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test('authenticated student completes persistent CBT lifecycle and safely resumes it', async ({ page }) => {
  await signIn(page, fixture.studentA.email);
  await page.goto('/attempts');
  const card = page.getByRole('article').filter({ hasText: 'PERSISTENT' }).first();
  await expect(card).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: 'Read instructions & start' }).click();
  await expect(page).toHaveURL(/\/attempts\/[^/]+$/);
  attemptId = page.url().split('/').pop()!;
  await expect(page.getByRole('timer')).toContainText('Server deadline');
  await expect(page.getByText('Question 1 of 2')).toBeVisible();

  await page.locator('input[type="radio"]').nth(0).check();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await expect(page.getByText('Question 2 of 2')).toBeVisible();
  await expect(page.getByRole('button', { name: /Question 1, answered/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await expect(page.locator('input[type="radio"]').nth(0)).toBeChecked();
  await page.getByRole('button', { name: 'Clear Response' }).click();
  await page.locator('input[type="radio"]').nth(1).check();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await page.locator('input[type="radio"]').nth(0).check();
  await page.getByRole('button', { name: 'Save & Next' }).click();

  await page.route('**/api/v1/attempts/*/form', (route) => void route.abort());
  await page.reload();
  await expect(page.getByText('Failed to fetch')).toBeVisible();
  await page.unroute('**/api/v1/attempts/*/form');
  await page.reload();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();

  await page.getByRole('button', { name: 'Submit Attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Your result is ready' })).toBeVisible();
  await expect(page.getByText('Explanations are withheld until the configured release state.')).toBeVisible();
  await expect(page.getByText('Question-level learning feedback is withheld until this result is published.')).toBeVisible();
  const firstResult = await page.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/attempts/${id}/submit`, { method: 'POST', credentials: 'include' }); return response.json(); }, { base: api, id: attemptId }) as { scoreRunReference: string };
  const secondResult = await page.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/attempts/${id}/result`, { credentials: 'include' }); return response.json(); }, { base: api, id: attemptId }) as { scoreRunReference: string };
  expect(secondResult.scoreRunReference).toBe(firstResult.scoreRunReference);
  const pending = await page.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/attempts/${id}/learning-summary`, { credentials: 'include' }); return { status: response.status, body: await response.json() }; }, { base: api, id: attemptId }) as { status: number; body: Record<string, unknown> };
  expect(pending.status).toBe(200);
  expect(pending.body).toEqual({ attemptId, releaseStatus: 'PENDING', available: false, reason: 'LEARNING_FEEDBACK_WITHHELD_UNTIL_RESULT_PUBLICATION' });
  expect(JSON.stringify(pending.body)).not.toMatch(/question|outcome|topic|mistake|recommendation|evidence/i);
  const history = await page.evaluate(async (base) => { const response = await fetch(`${base}/attempts/learning-history`, { credentials: 'include' }); return { status: response.status, body: await response.json() }; }, api) as { status: number; body: { source: string; topics: unknown[]; mistakes: unknown[]; recommendations: unknown[] } };
  expect(history.status).toBe(200);
  expect(history.body.source).toBe('RELEASED_LEARNING_HISTORY');
  expect(history.body).toMatchObject({ topics: [], mistakes: [], recommendations: [] });

  const adminContext = await page.context().browser()!.newContext();
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, fixture.admin.email);
  const publication = await adminPage.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/admin/results/${id}/publish`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approvalReference: 'REL-G13-E2E-001', reason: 'E2E owner-approved publication' }) }); return { status: response.status, body: await response.json() }; }, { base: api, id: attemptId }) as { status: number; body: { status: string } };
  expect(publication).toMatchObject({ status: 201, body: { status: 'PUBLISHED' } });
  const correction = await adminPage.evaluate(async ({ base, questionVersionId }) => { const response = await fetch(`${base}/admin/results/answer-key-corrections/${questionVersionId}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approvalReference: 'KEY-G13-E2E-001', reason: 'E2E verified key correction', correctAnswers: ['B'], evidence: { reviewerId: 'external-reviewer-g13', decision: 'APPROVED', reviewedAt: new Date().toISOString(), source: 'E2E review record' } }) }); return { status: response.status, body: await response.json() }; }, { base: api, questionVersionId: fixture.forms.find((form) => form.subjectCode === 'PERSISTENT')!.versionId }) as { status: number; body: { correctionId: string } };
  expect(correction.status).toBe(201);
  const rescore = await adminPage.evaluate(async ({ base, id, correctionId }) => { const response = await fetch(`${base}/admin/results/${id}/rescore`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correctionId, approvalReference: 'RESCORE-G13-E2E-001', reason: 'E2E authorized rescore', idempotencyKey: 'RESCORE-G13-E2E-001' }) }); return { status: response.status, body: await response.json() }; }, { base: api, id: attemptId, correctionId: correction.body.correctionId }) as { status: number; body: { status: string; scoreRunReference: string } };
  expect(rescore.status).toBe(201);
  const rescoreRetry = await adminPage.evaluate(async ({ base, id, correctionId }) => { const response = await fetch(`${base}/admin/results/${id}/rescore`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correctionId, approvalReference: 'RESCORE-G13-E2E-001', reason: 'E2E authorized rescore', idempotencyKey: 'RESCORE-G13-E2E-001' }) }); return { status: response.status, body: await response.json() }; }, { base: api, id: attemptId, correctionId: correction.body.correctionId }) as { status: number; body: { status: string; scoreRunReference: string } };
  expect(rescoreRetry).toMatchObject({ status: 201, body: { status: 'IDEMPOTENT', scoreRunReference: rescore.body.scoreRunReference } });
  await adminContext.close();
  const released = await page.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/attempts/${id}/learning-summary`, { credentials: 'include' }); return { status: response.status, body: await response.json() }; }, { base: api, id: attemptId }) as { status: number; body: { available: boolean; releaseStatus: string; durableEvidence: unknown[] } };
  expect(released.status).toBe(200);
  expect(released.body).toMatchObject({ available: true, releaseStatus: 'PUBLISHED' });
  expect(released.body.durableEvidence).toHaveLength(2);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Performance summary' })).toBeVisible();
});

test('student ownership prevents cross-account attempt access', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, fixture.studentB.email);
  const responses = await page.evaluate(async ({ base, id }) => Promise.all([
    fetch(`${base}/attempts/${id}/state`, { credentials: 'include' }).then((response) => response.status),
    fetch(`${base}/attempts/${id}/learning-summary`, { credentials: 'include' }).then((response) => response.status),
  ]), { base: api, id: attemptId });
  expect(responses).toEqual([404, 404]);
  await context.close();
});

test('expired attempt rejects answer acknowledgement after the server deadline', async ({ page }) => {
  await signIn(page, fixture.studentA.email);
  await page.goto('/attempts');
  const card = page.getByRole('article').filter({ hasText: 'EXPIRED' }).first();
  await expect(card).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: 'Read instructions & start' }).click();
  await expect(page.getByText('Question 1 of 1')).toBeVisible();
  const expiredAttemptId = page.url().split('/').pop()!;
  const expiredQuestionId = fixture.forms.find((form) => form.subjectCode === 'EXPIRED')!.versionId;
  const state = await page.evaluate(async ({ base, id }) => fetch(`${base}/attempts/${id}/state`, { credentials: 'include' }).then((response) => response.json()), { base: api, id: expiredAttemptId }) as { revision: number };
  await page.waitForTimeout(1_500);
  const lateWrites = await page.evaluate(async ({ base, attempt, question, revision }) => Promise.all([1, 2].map(async (number) => {
    const response = await fetch(`${base}/attempts/${attempt}/answers/${question}`, { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ selectedOptionIds: [], expectedRevision: revision, idempotencyKey: `late-${number}` }) });
    return response.status;
  })), { base: api, attempt: expiredAttemptId, question: expiredQuestionId, revision: state.revision });
  expect(lateWrites).toEqual([409, 409]);
  const durable = await isolatedQuery('SELECT a.status AS attempt_status, s.status AS session_status, (SELECT COUNT(*)::int FROM "AttemptAnswerEvent" e WHERE e."attemptId" = a.id) AS answer_events, (SELECT COUNT(*)::int FROM "AuditEvent" u WHERE u."attemptId" = a.id AND u.type = \'ATTEMPT_EXPIRED\') AS expiry_events FROM "Attempt" a JOIN "AttemptSession" s ON s."attemptId" = a.id WHERE a.id = $1', [expiredAttemptId]);
  expect(durable.rows[0]).toMatchObject({ attempt_status: 'EXPIRED', session_status: 'EXPIRED', answer_events: 0, expiry_events: 1 });
  const finalized = await page.evaluate(async ({ base, id }) => Promise.all([1, 2].map(async () => { const response = await fetch(`${base}/attempts/${id}/submit`, { method: 'POST', credentials: 'include' }); return { status: response.status, body: await response.json() }; })), { base: api, id: expiredAttemptId });
  expect(finalized.every((item) => item.status === 201 && item.body.scoreRunReference === finalized[0].body.scoreRunReference)).toBe(true);
  const scoreCounts = await isolatedQuery('SELECT (SELECT COUNT(*)::int FROM "ScoreRun" WHERE "attemptId" = $1) AS score_runs, (SELECT COUNT(*)::int FROM "AttemptResult" WHERE "attemptId" = $1) AS results', [expiredAttemptId]);
  expect(scoreCounts.rows[0]).toMatchObject({ score_runs: 1, results: 1 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your result is ready' })).toBeVisible();
});
