import {
  BadRequestException,
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
import { MerchantDashboardQueryDto } from './dto/merchant-dashboard-query.dto.js';
import { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto.js';
import { WithdrawMerchantWalletDto } from './dto/withdraw-merchant-wallet.dto.js';
import { WalletService } from './wallet.service.js';

function parseOptionalMerchantId(id?: string): bigint | undefined {
  if (id === undefined) {
    return undefined;
  }
  if (!/^[1-9]\d*$/.test(id)) {
    throw new BadRequestException('MERCHANT_ID_INVALID');
  }
  return BigInt(id);
}

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class MerchantWalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * FR-M06: ดึงข้อมูลกระเป๋าเงินร้านค้า รายรับจากแต่ละ Order และสถานะสิทธิ์ถอนเงินเข้ากระเป๋าประชาชนของเจ้าของร้าน
   */
  @Get(['merchant/wallet', 'merchants/:id/wallet'])
  @Roles('MERCHANT')
  async getMerchantWallet(
    @Req() req: Request,
    @Query() query: WalletTransactionsQueryDto,
    @Param('id') id?: string,
  ) {
    return this.walletService.getMerchantWalletOverview(
      req.user!.userId,
      req.user!.activeMerchantId,
      parseOptionalMerchantId(id),
      query,
    );
  }

  /**
   * FR-M06: ดึงประวัติธุรกรรมกระเป๋าเงินร้านค้า
   */
  @Get(['merchant/wallet/transactions', 'merchants/:id/wallet/transactions'])
  @Roles('MERCHANT')
  async getMerchantTransactions(
    @Req() req: Request,
    @Query() query: WalletTransactionsQueryDto,
    @Param('id') id?: string,
  ) {
    return this.walletService.getMerchantTransactions(
      req.user!.userId,
      req.user!.activeMerchantId,
      query,
      parseOptionalMerchantId(id),
    );
  }

  /**
   * FR-M06 & BR-WALLET-06: ถอนเงินเสมือนจาก Merchant Wallet ไปยัง Consumer Personal Balance ของเจ้าของร้าน
   */
  @Post([
    'merchant/wallet/withdrawals',
    'merchant/wallet/withdraw',
    'merchants/:id/wallet/withdrawals',
  ])
  @Roles('MERCHANT')
  @HttpCode(HttpStatus.OK)
  async withdrawMerchantWallet(
    @Req() req: Request,
    @Body() dto: WithdrawMerchantWalletDto,
    @Param('id') id?: string,
  ) {
    return this.walletService.withdrawFromMerchantWallet(
      req.user!.userId,
      req.user!.activeMerchantId,
      dto,
      parseOptionalMerchantId(id),
    );
  }

  /**
   * FR-M07: ดึงข้อมูล Analytics Dashboard ของร้านค้า
   */
  @Get(['merchant/dashboard', 'merchants/:id/dashboard'])
  @Roles('MERCHANT')
  async getMerchantDashboard(
    @Req() req: Request,
    @Query() query: MerchantDashboardQueryDto,
    @Param('id') id?: string,
  ) {
    return this.walletService.getMerchantDashboard(
      req.user!.userId,
      req.user!.activeMerchantId,
      query.days,
      query.page,
      query.pageSize,
      parseOptionalMerchantId(id),
    );
  }
}
