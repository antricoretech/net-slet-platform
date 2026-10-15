import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const { Client } = requireFromApi('pg') as { Client: new (options: { connectionString: string }) => DbClient };
interface DbClient { connect(): Promise<void>; end(): Promise<void>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; }
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve('apps/api/.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^DATABASE_URL=(.*)$/);
      if (match) return match[1];
    }
  }
  throw new Error('DATABASE_URL is required for the administrator E2E fixture');
}

async function api(page: import('@playwright/test').Page, pathName: string, method: string, body?: unknown) {
  return page.evaluate(async ({ base, pathName: requestPath, method: requestMethod, body: requestBody }) => {
    const response = await fetch(`${base}${requestPath}`, { method: requestMethod, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: requestBody === undefined ? undefined : JSON.stringify(requestBody) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { base: apiBase, pathName, method, body });
}

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.beforeEach(async ({ request }) => {
  await expect.poll(async () => {
    try { return (await request.get('http://127.0.0.1:4000/api/v1/health/ready')).status(); }
    catch { return 0; }
  }, { timeout: 60_000 }).toBe(200);
});

test('student can register, view account, log out and log back in', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = 'CorrectHorseBattery1';
  await page.goto('/register');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test('student-facing catalogue and protected pattern writes are reachable safely', async ({ page }) => {
  await page.goto('/examinations');
  await expect(page.getByRole('heading', { name: 'Distinct exams. Distinct rules.' })).toBeVisible();
  const result = await page.evaluate(async (base) => {
    const response = await fetch(`${base}/catalogue/examinations/UGC_NET/patterns`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycleCode: 'TEST', subjectCode: 'CS', version: 1, rules: { sections: [] } }) });
    return response.status;
  }, apiBase);
  expect(result).toBe(401);
});

test('faculty workspace requires an authorized session', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
});

test('administrator can manage a research-only catalogue and pattern lifecycle', async ({ browser }) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const password = 'CorrectHorseBattery1';
  const adminEmail = `admin-${suffix}@example.test`;
  const smeEmail = `sme-${suffix}@example.test`;
  const studentEmail = `student-${suffix}@example.test`;
  const examCode = `E2E_${suffix}`;
  const organizerCode = `ORG_${suffix}`;
  const cycleCode = `RESEARCH_${suffix}`;
  const subjectCode = `SUBJECT_${suffix}`;
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();
  const accountIds: string[] = [];
  let examId: string | undefined;
  let patternId: string | undefined;
  try {
    for (const [email, role] of [[adminEmail, 'ADMIN'], [smeEmail, 'SME'], [studentEmail, 'STUDENT']] as const) {
      const registration = await fetch('http://localhost:4000/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!registration.ok) throw new Error(`Fixture registration failed: ${registration.status}`);
      const registrationBody = await registration.json() as { account: { id: string } };
      accountIds.push(registrationBody.account.id);
      await client.query('UPDATE "Account" SET role = $1 WHERE id = $2', [role, registrationBody.account.id]);
      const roleCheck = await client.query('SELECT role FROM "Account" WHERE id = $1', [registrationBody.account.id]);
      if (String(roleCheck.rows[0]?.role) !== role) throw new Error(`Fixture role update failed for ${email}`);
    }

    const page = await browser.newPage();
    await signIn(page, adminEmail, password);
    const createdExam = await api(page, '/catalogue/examinations', 'POST', { code: examCode, name: `E2E research fixture ${suffix}`, family: 'STATE_SET_SLET', organizer: { code: organizerCode, name: 'E2E Research Fixture Organizer' }, jurisdictions: [{ code: `REGION_${suffix}`, name: 'Research fixture region', type: 'REGIONAL' }] });
    expect(createdExam.status).toBe(201);
    examId = String(createdExam.body.id);

    const subject = await api(page, `/catalogue/examinations/${examCode}/cycles/${cycleCode}/subjects`, 'POST', { code: subjectCode, name: 'Research-only fixture subject' });
    expect(subject.status).toBe(201);

    const rules = { sessions: [{ key: 'MAIN', durationSeconds: 600, sequence: 0, deliveryMode: 'CBT', timingPolicy: 'CONTINUOUS', sections: [{ key: 'A', durationSeconds: 600, offeredQuestions: 10, maximumAttempts: 10, answerPolicy: 'SINGLE_SELECT', marksCorrect: '2', marksWrong: '0' }] }], languages: ['en'] };
    const incomplete = await api(page, `/catalogue/examinations/${examCode}/patterns`, 'POST', { cycleCode, subjectCode, version: 1, rules });
    expect(incomplete.status).toBe(201);
    const incompleteReview = await api(page, `/catalogue/examinations/${examCode}/patterns/${incomplete.body.id}/submit-review`, 'POST');
    expect(incompleteReview.status).toBe(400);

    const evidence = { officialSourceUrl: 'https://example.test/research-fixture.pdf', sourceDocumentHash: '0'.repeat(64), officialDocumentTitle: 'Research-only fixture evidence', issuingAuthority: 'Internal test fixture', evidenceExcerpt: 'Artificial evidence used only to exercise workflow controls.', artifactReference: 'fixture://research-only', questionBankCoverage: { covered: 0, total: 0 }, regressionReportId: `e2e-${suffix}` };
    const draft = await api(page, `/catalogue/examinations/${examCode}/patterns`, 'POST', { cycleCode, subjectCode, version: 2, rules, evidence });
    expect(draft.status).toBe(201);
    patternId = String(draft.body.id);
    expect((await api(page, `/catalogue/examinations/${examCode}/patterns/${patternId}/submit-review`, 'POST')).status).toBe(201);
    expect((await api(page, `/catalogue/examinations/${examCode}/patterns/${patternId}/approve`, 'POST', {})).status).toBe(403);

    const smePage = await browser.newPage();
    await signIn(smePage, smeEmail, password);
    const approval = await api(smePage, `/catalogue/examinations/${examCode}/patterns/${patternId}/approve`, 'POST', { notes: 'Research-only workflow fixture approval.' });
    expect(approval.status).toBe(201);
    await smePage.close();

    await signIn(page, adminEmail, password);
    const publication = await api(page, `/catalogue/examinations/${examCode}/patterns/${patternId}/publish`, 'POST');
    expect(publication.status).toBe(201);
    expect((await api(page, `/catalogue/examinations/WRONG_${suffix}/patterns/${patternId}`, 'GET')).status).toBe(404);
    await client.query('BEGIN');
    await client.query('SAVEPOINT e2e_immutability');
    let blocked = false;
    try { await client.query('UPDATE "ExamPatternVersion" SET rules = \'{"tampered":true}\'::jsonb WHERE id = $1', [patternId]); } catch { blocked = true; await client.query('ROLLBACK TO SAVEPOINT e2e_immutability'); }
    await client.query('COMMIT');
    expect(blocked).toBe(true);

    const studentPage = await browser.newPage();
    await signIn(studentPage, studentEmail, password);
    expect((await api(studentPage, '/catalogue/examinations', 'POST', { code: `DENIED_${suffix}`, name: 'Denied', family: 'STATE_SET_SLET', organizer: { code: `DENIED_ORG_${suffix}`, name: 'Denied' }, jurisdictions: [{ code: `DENIED_REGION_${suffix}`, name: 'Denied', type: 'REGIONAL' }] })).status).toBe(403);
    await studentPage.close();
    await page.close();
  } finally {
    if (examId) await client.query('DELETE FROM "ExamPatternVersion" WHERE "examCycleId" IN (SELECT id FROM "ExamCycle" WHERE "examinationId" = $1)', [examId]);
    if (patternId) await client.query('DELETE FROM "ExamPatternVersion" WHERE id = $1', [patternId]);
    await client.query('DELETE FROM "AuditEvent" WHERE "accountId" = ANY($1::uuid[])', [accountIds]);
    await client.query('DELETE FROM "Account" WHERE id = ANY($1::uuid[])', [accountIds]);
    if (examId) {
      await client.query('DELETE FROM "ExaminationJurisdiction" WHERE "examinationId" = $1', [examId]);
      await client.query('DELETE FROM "ExamCycle" WHERE "examinationId" = $1', [examId]);
      await client.query('DELETE FROM "Examination" WHERE id = $1', [examId]);
      await client.query('DELETE FROM "ExamOrganizer" WHERE code = $1', [organizerCode]);
    }
    await client.end();
  }
});
