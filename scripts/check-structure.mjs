import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const required = [
  'AGENTS.md', 'compose.yaml', 'apps/web/src/app/page.tsx',
  'apps/api/src/health/health.controller.ts', 'apps/api/prisma/schema.prisma',
  'packages/exam-rules/src/index.test.ts',
  'docs/requirements/Project_NET_SLET_Master_Knowledge_Base_v2_2.md',
  'docs/implementation/SPRINT_0_CHECKLIST.md',
];
let failures = 0;
for (const file of required) {
  if (!existsSync(resolve(root, file))) { console.error(`MISSING: ${file}`); failures++; }
}
const content = readFileSync(resolve(root, 'AGENTS.md'),'utf8');
for (const guardrail of ['PostgreSQL', 'RESEARCH_ONLY', 'acknowledged', 'approved']) {
  if (!content.toLowerCase().includes(guardrail.toLowerCase())) { console.error(`MISSING GUARDRAIL: ${guardrail}`); failures++; }
}
if (failures) process.exit(1);
console.log(`Structure OK: ${required.length} files and agent guardrail markers verified.`);
