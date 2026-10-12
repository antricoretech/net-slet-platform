import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: '../../apps/api/prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('STAGE_A_DATABASE_URL') },
});
