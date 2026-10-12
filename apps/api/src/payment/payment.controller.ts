import {
  Body,
  Controller,
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
import { PayOrderDto } from '../commerce/dto/order.dto.js';
import { PaymentService } from './payment.service.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller({ version: '1' })
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post('orders/:id/pay')
  @ApiOperation({
    summary:
      'Atomically complete a virtual-wallet payment; retries require the same Idempotency-Key',
  })
  pay(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) orderId: number,
    @Body() body: PayOrderDto,
    @Headers(HTTP_HEADERS.idempotencyKey) key: string | undefined,
    @Req() request: Request,
  ): Promise<unknown> {
    requireConsumer(actor);
    return this.payments.pay(
      actor.userId,
      orderId,
      body.qr_token,
      key,
      request.header(HTTP_HEADERS.requestId) ?? 'missing-request-id',
    );
  }
}
