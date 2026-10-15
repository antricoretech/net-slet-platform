import { performance } from 'node:perf_hooks';

const baseUrl = process.env.PERF_BASE_URL?.replace(/\/$/, '');
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 4);
const iterations = Number(process.env.PERF_ITERATIONS ?? 10);
const isolated = process.env.PERF_ISOLATED === '1';
let cookie = process.env.PERF_SESSION_COOKIE;

if (!baseUrl) throw new Error('PERF_BASE_URL is required');
if (!isolated) throw new Error('Performance tests require PERF_ISOLATED=1 and synthetic data');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error('PERF_CONCURRENCY must be between 1 and 100');
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000) throw new Error('PERF_ITERATIONS must be between 1 and 10000');

const defaultTargets = [
  ['health-live', '/api/v1/health/live'],
  ['form-catalogue', '/api/v1/attempts/forms'],
  ['learning-history', '/api/v1/attempts/learning-history'],
];
const targets = process.env.PERF_ENDPOINTS
  ? process.env.PERF_ENDPOINTS.split(',').map((entry) => {
    const [name, path] = entry.split(':', 2);
    if (!name || !path?.startsWith('/')) throw new Error('PERF_ENDPOINTS entries must be name:/path');
    return [name, path];
  })
  : defaultTargets;
if (!cookie && process.env.PERF_LOGIN_EMAIL && process.env.PERF_LOGIN_PASSWORD) {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.PERF_LOGIN_EMAIL, password: process.env.PERF_LOGIN_PASSWORD }),
  });
  if (!login.ok) throw new Error(`Synthetic performance login failed with status ${login.status}`);
  cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Synthetic performance login did not return a session cookie');
}
const headers = cookie ? { cookie } : {};

async function measure(name, path) {
  const durations = [];
  let errors = 0;
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= iterations) return;
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`, { headers });
        if (!response.ok) errors += 1;
      } catch {
        errors += 1;
      } finally {
        durations.push(performance.now() - started);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, iterations) }, () => worker()));
  durations.sort((left, right) => left - right);
  const percentile = (ratio) => durations[Math.min(durations.length - 1, Math.floor(durations.length * ratio))] ?? 0;
  return { name, path, requests: iterations, concurrency, errors, p50Ms: Number(percentile(0.5).toFixed(2)), p95Ms: Number(percentile(0.95).toFixed(2)), p99Ms: Number(percentile(0.99).toFixed(2)) };
}

const results = [];
for (const [name, path] of targets) results.push(await measure(name, path));
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), baseUrl: new URL(baseUrl).origin, syntheticDataOnly: true, results }, null, 2));
if (results.some((result) => result.errors > 0)) process.exitCode = 1;
