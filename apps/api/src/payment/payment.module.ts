import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';

@Module({
  imports: [RewardsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
