import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestOriginGuard } from './auth/request-origin.guard';
import { randomUUID } from 'node:crypto';
import { loadRuntimeConfig } from './config/runtime-config';

async function bootstrap() {
  const config = loadRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  app.use((request: { header(name: string): string | undefined }, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    const suppliedRequestId = request.header('x-request-id');
    const requestId = suppliedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.applicationEnvironment === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
  const express = app.getHttpAdapter().getInstance() as { set?: (name: string, value: boolean | number) => void };
  express.set?.('trust proxy', config.trustedProxy);
  app.useGlobalGuards(new RequestOriginGuard());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
  console.log(`NET/SLET API listening on port ${process.env.PORT ?? 4000}`);
}
bootstrap().catch((error) => { console.error(error); process.exitCode = 1; });
