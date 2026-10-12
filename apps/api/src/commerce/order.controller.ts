import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthActor } from '../auth/auth.types.js';
import { requireConsumer } from '../auth/authorization.js';
import {
  ApplyCouponDto,
  AddOrderItemDto,
  CreateOrderDto,
} from './dto/order.dto.js';
import { OrderService } from './order.service.js';

@ApiTags('Orders and QR')
@ApiBearerAuth()
@Controller({ version: '1' })
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post('orders') create(
    @CurrentActor() actor: AuthActor,
    @Body() body: CreateOrderDto,
  ): Promise<unknown> {
    return this.orders.create(actor, body.merchant_id);
  }
  @Get('orders') list(@CurrentActor() actor: AuthActor): Promise<unknown> {
    requireConsumer(actor);
    return this.orders.listForUser(actor.userId);
  }
  @Get('orders/:id') get(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    return this.orders.getOrder(actor, id);
  }

  @Post('orders/:id/items')
  addItem(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddOrderItemDto,
  ): Promise<unknown> {
    return this.orders.addItem(actor, id, body.product_id, body.quantity);
  }

  @Delete('orders/:id/items/:itemId')
  removeItem(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ): Promise<unknown> {
    return this.orders.removeItem(actor, id, itemId);
  }

  @Post('orders/:id/coupon')
  applyCoupon(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApplyCouponDto,
  ): Promise<unknown> {
    return this.orders.applyCoupon(
      actor,
      id,
      body.user_coupon_id,
      body.qr_token,
    );
  }

  @Post('orders/:id/checkout')
  @ApiOperation({
    summary:
      'Freeze server-calculated pricing and issue an expiring opaque QR token',
  })
  checkout(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    return this.orders.checkout(actor, id);
  }

  @Get('payments/qr/:token')
  scan(
    @CurrentActor() actor: AuthActor,
    @Param('token') token: string,
  ): Promise<unknown> {
    return this.orders.scan(actor, token);
  }

  @Get('orders/:id/receipt')
  receipt(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    requireConsumer(actor);
    return this.orders.receipt(actor.userId, id);
  }

  @Post('orders/:id/cancel')
  cancel(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<never> {
    return this.orders.rejectPaidMutation(actor, id);
  }
}
