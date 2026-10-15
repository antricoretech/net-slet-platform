import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
const ignored = new Set(['.env.example', 'apps/api/.env.example', 'apps/web/.env.local.example', 'pnpm-lock.yaml']);
const patterns = [
  { name: 'private key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS access key', expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', expression: /\b(?:ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { name: 'Slack token', expression: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
];

for (const file of files) {
  if (ignored.has(file) || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of patterns) if (pattern.expression.test(content)) findings.push(`${file}: ${pattern.name}`);
}

if (findings.length) {
  console.error('Committed-secret scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Committed-secret scan passed for ${files.length} tracked files.`);
