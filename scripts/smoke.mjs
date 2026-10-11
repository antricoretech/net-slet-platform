const endpoints = [
  ['web', 'http://localhost:3000', 200],
  ['api liveness', 'http://localhost:4000/api/v1/health/live', 200],
  ['api readiness', 'http://localhost:4000/api/v1/health/ready', 200],
];
let failures = 0;
for (const [label, url, wanted] of endpoints) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (response.status !== wanted) { console.error(`${label}: expected HTTP ${wanted}, received ${response.status}`); failures++; }
    else console.log(`${label}: HTTP ${response.status} OK`);
  } catch (error) { console.error(`${label}: ${error.message}`); failures++; }
}
if (failures) process.exit(1);
