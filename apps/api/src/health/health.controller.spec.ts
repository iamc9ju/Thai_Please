import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseHealthIndicator } from './database.health-indicator.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  const healthCheckService = {
    check: vi.fn().mockResolvedValue({ status: 'ok' }),
  };
  const databaseHealthIndicator = {
    check: vi.fn().mockResolvedValue({ database: { status: 'up' } }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        {
          provide: DatabaseHealthIndicator,
          useValue: databaseHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
    vi.clearAllMocks();
  });

  it('reports process liveness without checking the database', async () => {
    await expect(controller.liveness()).resolves.toEqual({ status: 'ok' });
    expect(databaseHealthIndicator.check).not.toHaveBeenCalled();
  });

  it('includes the database in readiness checks', async () => {
    await expect(controller.readiness()).resolves.toEqual({ status: 'ok' });
    expect(healthCheckService.check).toHaveBeenCalledOnce();
  });
});
