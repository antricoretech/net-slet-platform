import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
const fixture = JSON.parse(fs.readFileSync(path.resolve('test-results/stage-b-e2e/fixture.json'), 'utf8')) as { api: string; password: string; studentA: { email: string; id: string }; studentB: { email: string; id: string }; forms: Array<{ formId: string; subjectCode: string; durationSeconds: number }> };
const api = fixture.api;
let attemptId = '';

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
  await expect(page.getByRole('heading', { name: 'Performance summary' })).toBeVisible();
  await expect(page.getByText('Explanations are withheld until the configured release state.')).toBeVisible();
  const firstResult = await page.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/attempts/${id}/submit`, { method: 'POST', credentials: 'include' }); return response.json(); }, { base: api, id: attemptId }) as { scoreRunReference: string };
  const secondResult = await page.evaluate(async ({ base, id }) => { const response = await fetch(`${base}/attempts/${id}/result`, { credentials: 'include' }); return response.json(); }, { base: api, id: attemptId }) as { scoreRunReference: string };
  expect(secondResult.scoreRunReference).toBe(firstResult.scoreRunReference);
  const history = await page.evaluate(async (base) => { const response = await fetch(`${base}/attempts/learning-history`, { credentials: 'include' }); return { status: response.status, body: await response.json() }; }, api) as { status: number; body: { source: string } };
  expect(history.status).toBe(200);
  expect(history.body.source).toBe('DURABLE_LEARNING_HISTORY');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Performance summary' })).toBeVisible();
});

test('student ownership prevents cross-account attempt access', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, fixture.studentB.email);
  const response = await page.evaluate(async ({ base, id }) => { const result = await fetch(`${base}/attempts/${id}/state`, { credentials: 'include' }); return result.status; }, { base: api, id: attemptId });
  expect(response).toBe(404);
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
  await page.waitForTimeout(1_500);
  await page.locator('input[type="radio"]').nth(0).check();
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await expect(page.getByText('Attempt session has expired')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Performance summary' })).toBeVisible();
});
