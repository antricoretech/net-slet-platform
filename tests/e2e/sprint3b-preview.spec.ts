import { expect, test } from '@playwright/test';

test('preview route is unavailable unless explicitly enabled', async ({ page }) => {
  await page.goto('/practice/preview');
  await expect(page.getByRole('heading', { name: 'CBT preview unavailable' })).toBeVisible();
  await expect(page.getByText('development-only preview is disabled')).toBeVisible();
});

test('results preview is unavailable unless explicitly enabled', async ({ page }) => {
  await page.goto('/results/preview');
  await expect(page.getByRole('heading', { name: 'Results preview unavailable' })).toBeVisible();
  await expect(page.getByText('illustrative results preview is disabled')).toBeVisible();
});

test('learning practice preview is unavailable unless explicitly enabled', async ({ page }) => {
  await page.goto('/practice/learning');
  await expect(page.getByRole('heading', { name: 'Practice preview unavailable' })).toBeVisible();
  await expect(page.getByText('development-only practice preview is disabled')).toBeVisible();
});

test('mistake mine preview is unavailable unless explicitly enabled', async ({ page }) => {
  await page.goto('/revision/mistakes/preview');
  await expect(page.getByRole('heading', { name: 'Mistake Mine preview unavailable' })).toBeVisible();
  await expect(page.getByText('development-only revision preview is disabled')).toBeVisible();
});

test('PrepPilot dashboard preview is unavailable unless explicitly enabled', async ({ page }) => {
  await page.goto('/dashboard/preview');
  await expect(page.getByRole('heading', { name: 'PrepPilot preview unavailable' })).toBeVisible();
  await expect(page.getByText('development-only dashboard preview is disabled')).toBeVisible();
});

test('ExamDNA readiness preview is unavailable unless explicitly enabled', async ({ page }) => {
  await page.goto('/workspace/examination-readiness/preview');
  await expect(page.getByRole('heading', { name: 'Examination readiness preview unavailable' })).toBeVisible();
  await expect(page.getByText('development-only administrative preview is disabled')).toBeVisible();
});
