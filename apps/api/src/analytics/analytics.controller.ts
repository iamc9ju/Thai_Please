import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthActor } from '../auth/auth.types.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller({ version: '1' })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('merchant/dashboard')
  @ApiQuery({ name: 'merchant_id', type: Number })
  merchant(
    @CurrentActor() actor: AuthActor,
    @Query('merchant_id', ParseIntPipe) merchantId: number,
  ): Promise<unknown> {
    return this.analytics.merchant(actor, merchantId);
  }

  @Get('dashboard/social-impact')
  socialImpact(@CurrentActor() actor: AuthActor): Promise<unknown> {
    return this.analytics.socialImpact(actor);
  }
}
