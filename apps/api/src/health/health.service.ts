import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private redis: Redis | undefined;
  constructor(private readonly database: PrismaService) {}

  liveness() { return { status: 'ok', service: 'net-slet-api', environment: process.env.NODE_ENV ?? 'development' }; }

  async readiness() {
    const dependencies = { postgres: 'down', redis: 'down' };
    try {
      await this.database.$queryRaw`SELECT 1`;
      dependencies.postgres = 'up';
    } catch { /* Do not leak connection strings or internal error details. */ }
    try {
      if (!this.redis) {
        this.redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          connectTimeout: 1500,
        });
        this.redis.on('error', () => { /* failure is reflected in readiness */ });
      }
      if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
      await this.redis.ping();
      dependencies.redis = 'up';
    } catch { /* Readiness stays false if Redis cannot be reached. */ }
    return { status: dependencies.postgres === 'up' && dependencies.redis === 'up' ? 'ready' : 'not_ready', dependencies };
  }

  async onModuleDestroy() { this.redis?.disconnect(); }
}
