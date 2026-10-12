import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthActor } from '../auth/auth.types.js';
import { requireConsumer } from '../auth/authorization.js';
import { HTTP_HEADERS } from '../common/http/http.constants.js';
import { TopupDto } from './dto/topup.dto.js';
import { WalletService } from './wallet.service.js';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller({ version: '1' })
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('users/me')
  @ApiOperation({ summary: 'Get the authenticated consumer overview' })
  me(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.wallet.getOverview(actor.userId);
  }

  @Get('users/me/transactions')
  transactions(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.wallet.history(actor.userId);
  }

  @Get('wallet')
  getWallet(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.wallet.getWallet(actor.userId);
  }

  @Get('wallet/transactions')
  walletTransactions(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.wallet.history(actor.userId);
  }

  @Get('wallet/subsidy')
  subsidy(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.wallet.subsidy(actor.userId);
  }

  @Post('wallet/topup')
  topup(
    @CurrentActor() actor: AuthActor,
    @Body() body: TopupDto,
    @Headers(HTTP_HEADERS.idempotencyKey) idempotencyKey: string | undefined,
    @Req() request: Request,
  ): Promise<unknown> {
    requireConsumer(actor);
    return this.wallet.topup(
      actor.userId,
      body.amount,
      idempotencyKey,
      request.header(HTTP_HEADERS.requestId) ?? 'missing-request-id',
    );
  }
}
