import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthActor } from '../auth/auth.types.js';
import { requireConsumer } from '../auth/authorization.js';
import { HTTP_HEADERS } from '../common/http/http.constants.js';
import { RewardsService } from './rewards.service.js';

@ApiTags('Quests, points and coupons')
@ApiBearerAuth()
@Controller({ version: '1' })
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('quests') quests(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.listQuests(actor.userId);
  }
  @Get('quests/:id') quest(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.quest(actor.userId, id);
  }
  @Post('quests/generate')
  @ApiOperation({
    summary:
      'Generate a constrained quest proposal with the prototype history-based provider and auto-assign it',
  })
  generate(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.generate(actor.userId);
  }
  @Post('quests/evaluate/:receiptId')
  evaluate(
    @CurrentActor() actor: AuthActor,
    @Param('receiptId', ParseIntPipe) receiptId: number,
    @Req() request: Request,
  ): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.evaluateReceipt(
      receiptId,
      request.header(HTTP_HEADERS.requestId) ?? `user-${actor.userId}`,
      actor.userId,
    );
  }
  @Get('points') points(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.points(actor.userId);
  }
  @Get('coupons') coupons(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.coupons(actor.userId);
  }
  @Post('coupons/:id/redeem')
  redeem(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
    @Headers(HTTP_HEADERS.idempotencyKey) key: string | undefined,
    @Req() request: Request,
  ): Promise<unknown> {
    requireConsumer(actor);
    return this.rewards.redeemCoupon(
      actor.userId,
      id,
      key,
      request.header(HTTP_HEADERS.requestId) ?? 'missing-request-id',
    );
  }
}
