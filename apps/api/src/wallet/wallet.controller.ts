import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { TopUpDto } from './dto/top-up.dto.js';
import { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto.js';
import { WalletService } from './wallet.service.js';

@Controller('wallet')
@UseGuards(AuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * FR-C01 & FR-C03: ดึงข้อมูลภาพรวมกระเป๋าเงินและสิทธิประโยชน์
   */
  @Get('overview')
  @Roles('CONSUMER')
  async getOverview(@Req() req: Request) {
    const userId = req.user!.userId;
    return this.walletService.getConsumerOverview(userId);
  }

  /**
   * FR-C02: เติมเงินจำลองเข้ากระเป๋าส่วนตัว (Virtual Top-up)
   */
  @Post('topup')
  @Roles('CONSUMER')
  @HttpCode(HttpStatus.OK)
  async topUp(@Req() req: Request, @Body() dto: TopUpDto) {
    const userId = req.user!.userId;
    return this.walletService.topUpPersonal(userId, dto);
  }

  /**
   * FR-C02: ประวัติธุรกรรมกระเป๋าเงินของ Consumer แบบ cursor pagination
   */
  @Get('transactions')
  @Roles('CONSUMER')
  async getTransactions(
    @Req() req: Request,
    @Query() query: WalletTransactionsQueryDto,
  ) {
    return this.walletService.getConsumerTransactions(req.user!.userId, query);
  }
}
