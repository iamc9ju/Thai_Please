import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { RewardsService } from './rewards.service.js';

const POSITIVE_BIGINT_PATTERN = /^[1-9]\d{0,18}$/;

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  /**
   * FR-C08: Consumer ดูยอดพอยต์และประวัติพอยต์
   */
  @Get(['consumer/points', 'points'])
  @Roles('CONSUMER')
  async getConsumerPoints(@Req() req: Request) {
    return this.rewardsService.getConsumerPoints(req.user!.userId);
  }

  /**
   * FR-C09: Consumer ดูรายการคูปองที่แลกได้ (Catalogue) และคูปองของตนเอง
   */
  @Get(['consumer/coupons', 'coupons'])
  @Roles('CONSUMER')
  async getConsumerCoupons(@Req() req: Request) {
    return this.rewardsService.getConsumerCoupons(req.user!.userId);
  }

  /**
   * FR-C09: Consumer ใช้พอยต์แลกคูปองส่วนลด
   */
  @Post(['consumer/coupons/:id/redeem', 'coupons/:id/redeem'])
  @Roles('CONSUMER')
  @HttpCode(HttpStatus.OK)
  async redeemCoupon(@Req() req: Request, @Param('id') id: string) {
    if (!POSITIVE_BIGINT_PATTERN.test(id)) {
      throw new BadRequestException('รหัสคูปองไม่ถูกต้อง');
    }
    return this.rewardsService.redeemCoupon(req.user!.userId, BigInt(id));
  }
}
