import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
  async listMerchantOrders(@Req() req: Request) {
    const merchantId = req.user!.activeMerchantId!;
    return this.orderService.listMerchantOrders(merchantId);
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
