import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const { Client } = requireFromApi('pg') as { Client: new (options: { connectionString: string }) => DbClient };
interface DbClient { connect(): Promise<void>; end(): Promise<void>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }

function isolatedDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('Sprint 2 E2E requires an explicit isolated DATABASE_URL');
  const url = new URL(value);
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/stage_a_acceptance') throw new Error('Sprint 2 E2E refuses a non-isolated database');
  return value;
}

async function api(page: Page, pathName: string, method = 'GET', body?: unknown): Promise<{ status: number; body: any }> {
  return page.evaluate(async ({ pathName, method, body }) => {
    const response = await fetch(`http://localhost:4000/api/v1${pathName}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { pathName, method, body });
}

async function signIn(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
  return page;
}

test('isolated authenticated author-review-publish-challenge journey enforces separation and privacy', async ({ browser, request }) => {
  test.setTimeout(300_000);
  const dbUrl = isolatedDatabaseUrl();
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  const identity = await db.query('SELECT current_database() AS name, inet_server_port() AS port');
  expect(identity.rows[0]).toMatchObject({ name: 'stage_a_acceptance', port: 5432 });

  const suffix = Date.now().toString(36).toUpperCase();
  const password = 'CorrectHorseBattery1';
  const examCode = `ACCEPT_${suffix}`;
  const cycleCode = `RESEARCH_${suffix}`;
  const subjectCode = `SUB_${suffix}`;
  const users = {
    admin: `accept-admin-${suffix}@example.test`, author: `accept-author-${suffix}@example.test`,
    reviewer: `accept-reviewer-${suffix}@example.test`, student: `accept-student-${suffix}@example.test`,
    other: `accept-other-${suffix}@example.test`,
  };
  const ids: Record<keyof typeof users, string> = {} as Record<keyof typeof users, string>;
  const pages: Page[] = [];
  try {
    await expect.poll(async () => {
      try { return (await request.get('http://127.0.0.1:4000/api/v1/health/ready')).status(); }
      catch { return 0; }
    }, { timeout: 60_000 }).toBe(200);
    for (const role of Object.keys(users) as Array<keyof typeof users>) {
      const response = await request.post('http://localhost:4000/api/v1/auth/register', { data: { email: users[role], password } });
      expect(response.status()).toBe(201);
      ids[role] = (await response.json()).account.id;
      if (role === 'admin' || role === 'author' || role === 'reviewer') await db.query('UPDATE "Account" SET role=$1 WHERE id=$2', [role === 'admin' ? 'ADMIN' : 'SME', ids[role]]);
    }
    const admin = await signIn(browser, users.admin, password); pages.push(admin);
    const author = await signIn(browser, users.author, password); pages.push(author);
    const reviewer = await signIn(browser, users.reviewer, password); pages.push(reviewer);
    const student = await signIn(browser, users.student, password); pages.push(student);
    const other = await signIn(browser, users.other, password); pages.push(other);

    const cookie = (await student.context().cookies()).find((item) => item.name === 'netslet_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
    expect((await api(student, '/auth/me')).body.account.id).toBe(ids.student);
    expect((await api(student, '/qbms/questions')).status).toBe(403);
    await student.goto('/workspace');
    await expect(student.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
    const crossOrigin = await request.post('http://localhost:4000/api/v1/qbms/questions', { headers: { Origin: 'https://attacker.example.test' }, data: {} });
    expect(crossOrigin.status()).toBe(403);

    const exam = await api(admin, '/catalogue/examinations', 'POST', { code: examCode, name: `Synthetic research fixture ${suffix}`, family: 'STATE_SET_SLET', organizer: { code: `ORG_${suffix}`, name: 'Synthetic fixture organizer' }, jurisdictions: [{ code: `REGION_${suffix}`, name: 'Synthetic region', type: 'REGIONAL' }] });
    expect(exam.status).toBe(201);
    expect((await api(admin, `/catalogue/examinations/${examCode}/cycles/${cycleCode}/subjects`, 'POST', { code: subjectCode, name: 'Synthetic subject' })).status).toBe(201);
    const base = `/catalogue/examinations/${examCode}/cycles/${cycleCode}/subjects/${subjectCode}/syllabi`;
    const syllabus = await api(admin, base, 'POST', { title: 'Research-only synthetic syllabus', version: 1 });
    expect(syllabus.status).toBe(201);
    const unit = await api(admin, `${base}/${syllabus.body.id}/units`, 'POST', { code: 'UNIT1', title: 'Synthetic unit', sequence: 0 });
    expect(unit.status).toBe(201);
    const topic = await api(admin, `${base}/${syllabus.body.id}/units/UNIT1/topics`, 'POST', { code: 'TOPIC1', title: 'Synthetic topic', sequence: 0 });
    expect(topic.status).toBe(201);

    const otherExamCode = `OTHER_${suffix}`;
    expect((await api(admin, '/catalogue/examinations', 'POST', { code: otherExamCode, name: 'Separate synthetic examination', family: 'STATE_SET_SLET', organizer: { code: `OTHERORG_${suffix}`, name: 'Other fixture organizer' }, jurisdictions: [{ code: `OTHERREG_${suffix}`, name: 'Other synthetic region', type: 'REGIONAL' }] })).status).toBe(201);
    expect((await api(admin, `/catalogue/examinations/${otherExamCode}/cycles/${cycleCode}/subjects`, 'POST', { code: subjectCode, name: 'Synthetic subject in separate exam' })).status).toBe(201);
    const draftInput = { examinationCode: examCode, cycleCode, subjectCode, syllabusVersionId: syllabus.body.id, topicIds: [topic.body.id], type: 'SINGLE_CHOICE', prompt: { text: `Original synthetic question ${suffix}` }, options: [{ optionKey: 'A', optionText: { text: 'Synthetic A' }, sequence: 0 }, { optionKey: 'B', optionText: { text: 'Synthetic B' }, sequence: 1 }] };
    expect((await api(author, '/qbms/questions', 'POST', { ...draftInput, examinationCode: otherExamCode })).status).toBe(400);
    expect((await api(author, '/qbms/questions', 'POST', { ...draftInput, topicIds: [randomUUID()] })).status).toBe(400);
    const incomplete = await api(author, '/qbms/questions', 'POST', draftInput);
    expect(incomplete.status).toBe(201);
    const incompletePath = `/qbms/questions/${incomplete.body.id}/revisions/${incomplete.body.revisionId}`;
    expect((await api(author, `${incompletePath}/submit-review`, 'POST')).status).toBe(400);
    expect((await api(author, `${incompletePath}/answer-keys`, 'POST', { correctAnswers: ['A'] })).status).toBe(201);
    expect((await api(author, `${incompletePath}/explanations`, 'POST', { explanation: { text: 'Synthetic explanation' } })).status).toBe(201);
    expect((await api(author, `${incompletePath}/provenance`, 'POST', { sourceTitle: 'Synthetic licensed fixture', sourceType: 'ORIGINAL', rightsStatus: 'LICENSED' })).status).toBe(201);
    expect((await api(author, `${incompletePath}/submit-review`, 'POST')).status).toBe(400);
    expect((await api(author, `${incompletePath}/licences`, 'POST', { licenceName: 'Synthetic rights fixture' })).status).toBe(201);
    expect((await api(author, `${incompletePath}/submit-review`, 'POST')).status).toBe(201);
    expect((await api(admin, `${incompletePath}/assign-reviewer`, 'POST', { reviewerId: ids.reviewer })).status).toBe(201);
    await reviewer.goto('/workspace/review');
    const rejectCard = reviewer.locator('article.review-card').filter({ has: reviewer.locator(`a[href="/workspace/questions?selected=${incomplete.body.id}"]`) });
    await expect(rejectCard).toBeVisible();
    await rejectCard.getByRole('button', { name: 'Reject' }).click();
    await expect.poll(async () => (await api(author, `/qbms/questions/${incomplete.body.id}`)).body.versions[0].status).toBe('REJECTED');
    const rejection = await db.query('SELECT notes FROM "QuestionReview" WHERE "questionVersionId"=$1 AND decision=$2', [incomplete.body.revisionId, 'REJECTED']);
    expect(rejection.rows[0].notes).toContain('requires correction');

    await author.goto('/workspace/questions/new');
    await author.getByLabel('Examination code').fill(examCode);
    await author.getByLabel('Cycle code').fill(cycleCode);
    await author.getByLabel('Subject code').fill(subjectCode);
    await author.getByLabel('Syllabus version ID').fill(syllabus.body.id);
    await author.getByLabel('Topic IDs (comma separated)').fill(topic.body.id);
    await author.getByLabel('Question stem').fill(`Which synthetic option is correct ${suffix}?`);
    await author.getByLabel('Option A text').fill('Synthetic correct choice');
    await author.getByLabel('Option B text').fill('Synthetic incorrect choice');
    await author.getByRole('checkbox', { name: 'Correct' }).first().check();
    await author.getByLabel('Explanation').fill('Synthetic explanation for test-only content.');
    await author.getByLabel('Source title').fill('Original synthetic fixture');
    await author.getByLabel('Rights status').selectOption('OWNED');
    await expect(author.getByRole('region', { name: 'Question preview' })).toContainText(`Which synthetic option is correct ${suffix}?`);
    await author.getByRole('button', { name: 'Save single choice draft' }).click();
    await expect(author).toHaveURL(/\/workspace\/questions\?selected=/, { timeout: 20_000 });
    const questionId = new URL(author.url()).searchParams.get('selected')!;
    const detail = await api(author, `/qbms/questions/${questionId}`);
    expect(detail.status).toBe(200);
    const versionId = detail.body.versions[0].id as string;
    expect(detail.body.versions[0].answerKeys[0].correctAnswers).toEqual(['A']);
    expect(detail.body.versions[0].mappings[0].syllabusTopicId).toBe(topic.body.id);
    expect(detail.body.versions[0].provenance[0].rightsStatus).toBe('OWNED');
    expect((await api(reviewer, `/qbms/questions/${questionId}`)).status).toBe(403);
    await reviewer.goto(`/workspace/questions?selected=${questionId}`);
    await expect(reviewer.getByRole('status').filter({ hasText: 'Question review access denied' })).toBeVisible();
    expect((await api(reviewer, `/qbms/questions/${questionId}/revisions/${versionId}`, 'PATCH', { prompt: { text: 'Unauthorized' } })).status).toBe(403);
    expect((await api(author, `/qbms/public/questions/${questionId}`)).status).toBe(404);

    const revision = await api(author, `/qbms/questions/${questionId}/revisions`, 'POST', {});
    expect(revision.status).toBe(201);
    expect((await api(author, `/qbms/questions/${questionId}/revisions/${revision.body.id}`, 'PATCH', { prompt: { text: `Revised synthetic draft ${suffix}` } })).status).toBe(200);
    expect((await api(author, `/qbms/questions/${questionId}/revisions/${versionId}/submit-review`, 'POST')).status).toBe(201);
    expect((await api(reviewer, '/qbms/questions/review/queue')).body.map((item: { id: string }) => item.id)).not.toContain(versionId);
    expect((await api(admin, `/qbms/questions/${questionId}/revisions/${versionId}/assign-reviewer`, 'POST', { reviewerId: ids.author })).status).toBe(403);
    expect((await api(admin, `/qbms/questions/${questionId}/revisions/${versionId}/assign-reviewer`, 'POST', { reviewerId: ids.reviewer })).status).toBe(201);
    expect((await api(reviewer, '/qbms/questions/review/queue')).body.map((item: { id: string }) => item.id)).toContain(versionId);
    expect((await api(author, `/qbms/questions/${questionId}/revisions/${versionId}/review`, 'POST', { notes: 'Self review attempt' })).status).toBe(403);
    await reviewer.goto('/workspace/review');
    const reviewCard = reviewer.locator('article.review-card').filter({ has: reviewer.locator(`a[href="/workspace/questions?selected=${questionId}"]`) });
    await expect(reviewCard).toContainText(`${examCode} · ${subjectCode}`);
    await reviewCard.getByRole('link', { name: 'Inspect question' }).click();
    const assignedDetail = await api(reviewer, `/qbms/questions/${questionId}`);
    expect(assignedDetail.status).toBe(200);
    expect(assignedDetail.body.versions).toHaveLength(1);
    expect(assignedDetail.body.versions[0].id).toBe(versionId);
    await expect(reviewer.getByText(`Which synthetic option is correct ${suffix}?`)).toBeVisible();
    expect((await api(reviewer, `/qbms/questions/${questionId}/revisions/${versionId}/review`, 'POST', { notes: 'Independent synthetic review approved.' })).status).toBe(201);
    expect((await api(author, `/qbms/questions/${questionId}/revisions/${versionId}/approve`, 'POST', { notes: 'Denied' })).status).toBe(403);
    expect((await api(admin, `/qbms/questions/${questionId}/revisions/${versionId}/publish`, 'POST')).status).toBe(400);
    expect((await api(admin, `/qbms/questions/${questionId}/revisions/${versionId}/approve`, 'POST', { notes: 'Independent admin approval.' })).status).toBe(201);
    expect((await api(admin, `/qbms/questions/${questionId}/revisions/${versionId}/publish`, 'POST')).status).toBe(201);
    const history = await api(admin, `/qbms/questions/${questionId}/publication-history`);
    expect(history.status).toBe(200);
    expect(history.body[0].publication.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect((await api(author, `/qbms/questions/${questionId}/revisions/${versionId}`, 'PATCH', { prompt: { text: 'Tampered' } })).status).toBe(409);
    const publicQuestion = await api(student, `/qbms/public/questions/${questionId}`);
    expect(publicQuestion.status).toBe(200);
    expect(publicQuestion.body.prompt.text).toContain('Which synthetic option');
    expect(JSON.stringify(publicQuestion.body)).not.toContain('correctAnswers');
    expect(JSON.stringify(publicQuestion.body)).not.toContain('Synthetic explanation');
    expect(JSON.stringify(publicQuestion.body)).not.toContain('reporterId');

    const challenge = await api(student, `/qbms/questions/${questionId}/revisions/${versionId}/challenges`, 'POST', { category: 'AMBIGUOUS_QUESTION', description: `Synthetic ambiguity challenge ${suffix}` });
    expect(challenge.status).toBe(201);
    const challengeId = challenge.body.id as string;
    expect((await api(other, `/qbms/questions/challenges/${challengeId}`)).status).toBe(403);
    const otherList = await api(other, '/qbms/questions/challenges?page=1&pageSize=1');
    expect(otherList.status).toBe(200);
    expect(otherList.body.pagination.total).toBe(0);
    const studentList = await api(student, `/qbms/questions/challenges?status=OPEN&questionId=${questionId}&page=1&pageSize=1`);
    expect(studentList.body.pagination.total).toBe(1);
    expect(studentList.body.data[0].id).toBe(challengeId);
    expect(JSON.stringify(studentList.body)).not.toContain('reporterId');
    const staffList = await api(admin, `/qbms/questions/challenges?search=${suffix}&page=1&pageSize=1`);
    expect(staffList.body.pagination.total).toBe(1);
    expect(JSON.stringify(staffList.body)).not.toContain('reporterId');
    await admin.goto('/workspace/challenges');
    let challengeCard = admin.locator('article.review-card').filter({ hasText: `Synthetic ambiguity challenge ${suffix}` });
    await expect(challengeCard).toBeVisible();
    await challengeCard.getByRole('button', { name: 'Triage' }).click();
    await admin.reload();
    challengeCard = admin.locator('article.review-card').filter({ hasText: `Synthetic ambiguity challenge ${suffix}` });
    await expect(challengeCard).toBeVisible();
    await challengeCard.getByRole('button', { name: 'Resolve' }).click();
    await expect.poll(async () => (await api(student, `/qbms/questions/challenges/${challengeId}`)).body.status).toBe('RESOLVED');
    const safeResolution = await api(student, `/qbms/questions/challenges/${challengeId}`);
    expect(JSON.stringify(safeResolution.body)).not.toContain('reporterId');
    expect((await api(admin, `/qbms/public/questions/${questionId}`)).body).toEqual(publicQuestion.body);
    const audit = await db.query('SELECT type FROM "AuditEvent" WHERE "questionVersionId"=$1', [versionId]);
    expect(audit.rows.map((row) => row.type)).toEqual(expect.arrayContaining(['QUESTION_PUBLISHED', 'QUESTION_CHALLENGED', 'QUESTION_CHALLENGE_RESOLVED']));
    const key = await db.query('SELECT "correctAnswers" FROM "QuestionAnswerKeyVersion" WHERE "questionVersionId"=$1', [versionId]);
    expect(key.rows[0].correctAnswers).toEqual(['A']);

    await db.query('UPDATE "Session" SET "expiresAt"=now()-interval \'1 second\' WHERE "accountId"=$1', [ids.other]);
    expect((await api(other, '/auth/me')).status).toBe(401);
  } finally {
    await Promise.all(pages.map((page) => page.close().catch(() => undefined)));
    await db.end();
  }
});
