import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health-indicator.js';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  @Get('live')
  @ApiOkResponse({ description: 'The API process is alive.' })
  liveness() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOkResponse({
    description: 'The API and required dependencies are ready.',
  })
  @ApiServiceUnavailableResponse({
    description: 'A required dependency is unavailable.',
  })
  readiness() {
    return this.health.check([() => this.database.check()]);
  }
}
