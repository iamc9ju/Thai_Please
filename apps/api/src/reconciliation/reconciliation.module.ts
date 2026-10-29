import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReconciliationController } from './reconciliation.controller.js';
import { ReconciliationService } from './reconciliation.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
