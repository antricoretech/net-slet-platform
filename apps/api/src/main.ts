import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestOriginGuard } from './auth/request-origin.guard';
import { randomUUID } from 'node:crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((request: { header(name: string): string | undefined }, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    const requestId = request.header('x-request-id') ?? randomUUID();
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
  app.useGlobalGuards(new RequestOriginGuard());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
  console.log(`NET/SLET API listening on port ${process.env.PORT ?? 4000}`);
}
bootstrap().catch((error) => { console.error(error); process.exitCode = 1; });
