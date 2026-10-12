import path from 'node:path';
import { createRequire } from 'node:module';
const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const pg = requireFromApi('pg');
const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: url });
await client.connect();
try {
  const counts = {
    tables: 'SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = \'BASE TABLE\'',
    indexes: 'SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname = current_schema()',
    constraints: 'SELECT count(*)::int AS count FROM information_schema.table_constraints WHERE constraint_schema = current_schema()',
    functions: 'SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = current_schema()',
    triggers: 'SELECT count(*)::int AS count FROM information_schema.triggers WHERE trigger_schema = current_schema()',
  };
  const result = {};
  for (const [name, query] of Object.entries(counts)) result[name] = (await client.query(query)).rows[0].count;
  if (Number(result.tables) < 38 || Number(result.indexes) < 99 || Number(result.constraints) < 96 || Number(result.functions) < 6 || Number(result.triggers) < 18) throw new Error(`Recovery object counts below reviewed minimums: ${JSON.stringify(result)}`);
  console.log(JSON.stringify({ status: 'pass', counts: result }));
} finally { await client.end(); }
