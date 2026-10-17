import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RewardsController } from './rewards.controller.js';
import { RewardsService } from './rewards.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
