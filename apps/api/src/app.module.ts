import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { OrderModule } from './order/order.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { validateEnvironment } from './config/environment.js';
import { QuestsModule } from './quests/quests.module.js';
import { RewardsModule } from './rewards/rewards.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletModule,
    CatalogModule,
    OrderModule,
    QuestsModule,
    RewardsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
