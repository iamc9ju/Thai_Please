import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import {
  CreateOrderDto,
  PayByQrDto,
  PreviewOrderDto,
} from './dto/order.dto.js';
import { OrderService } from './order.service.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * FR-M02: Merchant สร้าง Order + Generate QR Token
   */
  @Post('merchant/orders')
  @Roles('MERCHANT')
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const merchantId = req.user!.activeMerchantId!;
    return this.orderService.createOrder(merchantId, dto);
  }

  /**
   * FR-M02: Merchant ดูรายการ orders ของร้าน
   */
  @Get('merchant/orders')
  @Roles('MERCHANT')
  async listMerchantOrders(
    @Req() req: Request,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const merchantId = req.user!.activeMerchantId!;
    return this.orderService.listMerchantOrders(merchantId, {
      dateFrom,
      dateTo,
    });
  }

  /**
   * FR-M05: กวาดล้างคำสั่งซื้อที่หมดอายุ (Sweep Expired Orders)
   */
  @Post('merchant/orders/sweep-expired')
  @Roles('MERCHANT', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async sweepExpiredOrders() {
    const swept = await this.orderService.sweepExpiredOrders();
    return { swept };
  }

  /**
   * FR-M08: Merchant ดูใบเสร็จรับเงินฉบับเต็มของ Order
   */
  @Get('merchant/orders/:id/receipt')
  @Roles('MERCHANT')
  async getMerchantReceipt(@Req() req: Request, @Param('id') id: string) {
    const merchantId = req.user!.activeMerchantId!;
    return this.orderService.getMerchantReceipt(merchantId, BigInt(id));
  }

  /**
   * FR-C06: Consumer ดูประวัติคำสั่งซื้อของตนเอง
   */
  @Get('consumer/orders')
  @Roles('CONSUMER')
  async listConsumerOrders(
    @Req() req: Request,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const consumerId = req.user!.userId;
    return this.orderService.listConsumerOrders(consumerId, {
      dateFrom,
      dateTo,
    });
  }

  /**
   * FR-C06: Consumer ดูใบเสร็จรับเงินฉบับเต็มของ Order
   */
  @Get('consumer/orders/:id/receipt')
  @Roles('CONSUMER')
  async getConsumerReceipt(@Req() req: Request, @Param('id') id: string) {
    const consumerId = req.user!.userId;
    return this.orderService.getConsumerReceipt(consumerId, BigInt(id));
  }

  /**
   * FR-C04: Consumer preview รายละเอียดก่อนชำระเงิน
   */
  @Post('consumer/orders/preview')
  @Roles('CONSUMER')
  @HttpCode(HttpStatus.OK)
  async previewOrder(@Req() req: Request, @Body() dto: PreviewOrderDto) {
    const consumerId = req.user!.userId;
    return this.orderService.previewOrder(consumerId, dto);
  }

  /**
   * FR-C05: Consumer ยืนยันชำระเงินผ่าน QR Token
   */
  @Post('consumer/orders/pay')
  @Roles('CONSUMER')
  @HttpCode(HttpStatus.OK)
  async payByQr(@Req() req: Request, @Body() dto: PayByQrDto) {
    const consumerId = req.user!.userId;
    return this.orderService.payByQr(consumerId, dto);
  }
}
