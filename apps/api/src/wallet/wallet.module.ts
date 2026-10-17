import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MerchantWalletController } from './merchant-wallet.controller.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WalletController, MerchantWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
