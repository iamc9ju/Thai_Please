import {
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
import { ReconciliationService } from './reconciliation.service.js';

@Controller('admin/reconciliation')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * INVARIANTS & NFR-OBS-01: ดูรายงานผลการกระทบยอดทางการเงินล่าสุด
   */
  @Get('report')
  async getLatestReport() {
    return this.reconciliationService.getLatestReport();
  }

  /**
   * INVARIANTS & NFR-OBS-01: สั่งรันการตรวจสอบกระทบยอดทางการเงินแบบสด (On-Demand Run)
   */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runReconciliation(@Req() req: Request) {
    const actorUserId = req.user?.userId;
    const correlationId =
      (req.headers['x-correlation-id'] as string) || undefined;
    return this.reconciliationService.runReconciliation(
      actorUserId,
      correlationId,
    );
  }
}
