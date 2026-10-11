import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get('live') live() { return this.health.liveness(); }
  @Get('ready') async ready() {
    const result = await this.health.readiness();
    if (result.status !== 'ready') throw new ServiceUnavailableException(result);
    return result;
  }
}
