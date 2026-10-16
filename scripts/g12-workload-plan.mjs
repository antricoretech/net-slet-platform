#!/usr/bin/env node

// Plan-only by default. This creates no requests, containers, database
// connections or test users. Execution requires a separately approved runner.
const plan = {
  schemaVersion: 'g12-workload-plan-1',
  mode: 'PLAN_ONLY',
  safety: {
    activeDatabaseForbidden: true,
    port5432Forbidden: true,
    requiredIsolation: 'disposable services and non-production credentials',
    maxVirtualUsers: 25,
    maxDurationSeconds: 300,
  },
  scenarios: [
    { id: 'login', method: 'POST', route: '/auth/login', virtualUsers: 5, durationSeconds: 60 },
    { id: 'catalogue', method: 'GET', route: '/examinations', virtualUsers: 10, durationSeconds: 60 },
    { id: 'attempt-start', method: 'POST', route: '/attempts', virtualUsers: 10, durationSeconds: 60 },
    { id: 'question-delivery', method: 'GET', route: '/attempts/:id/questions', virtualUsers: 10, durationSeconds: 60 },
    { id: 'answer-save', method: 'PUT', route: '/attempts/:id/answers/:questionId', virtualUsers: 10, durationSeconds: 60 },
    { id: 'review-markers', method: 'PUT', route: '/attempts/:id/review-markers', virtualUsers: 10, durationSeconds: 60 },
    { id: 'reconnect', method: 'GET', route: '/attempts/:id', virtualUsers: 5, durationSeconds: 60 },
    { id: 'concurrent-finalization', method: 'POST', route: '/attempts/:id/finalize', virtualUsers: 5, durationSeconds: 60, concurrency: 2 },
    { id: 'results', method: 'GET', route: '/attempts/:id/results', virtualUsers: 5, durationSeconds: 60 },
  ],
};

const output = process.env.G12_OUTPUT;
if (output) {
  const fs = await import('node:fs/promises');
  await fs.writeFile(output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(`Wrote plan-only workload manifest to ${output}`);
} else {
  console.log(JSON.stringify(plan, null, 2));
}
