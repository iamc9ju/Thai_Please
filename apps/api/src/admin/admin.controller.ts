import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseCorsOrigins } from '../config/environment.js';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { ADMIN_ROUTES, SOCIAL_IMPACT_DEFAULTS } from './admin.constants.js';
import { AdminService } from './admin.service.js';
import {
  AdminGenerateQuestDto,
  CreateSubsidyProgramDto,
  MerchantStatusActionDto,
  UpdateAdminRoleStatusDto,
  UpdateSubsidyProgramDto,
} from './dto/admin.dto.js';

function parseBigIntId(rawId: string, label: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(rawId)) {
    throw new BadRequestException(`รหัส${label}ไม่ถูกต้อง`);
  }
  if (BigInt(rawId) > 9223372036854775807n) {
    throw new BadRequestException(`รหัส${label}ไม่ถูกต้อง`);
  }
  return BigInt(rawId);
}

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
  ) {}

  private requireAdminId(req: Request): bigint {
    if (!req.user?.userId || req.user.role !== 'ADMIN') {
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบในฐานะผู้ดูแลระบบ');
    }
    return req.user.userId;
  }

  /** FR-A01: Platform Overview */
  @Get(ADMIN_ROUTES.overview)
  async getPlatformOverview(@Req() req: Request) {
    this.requireAdminId(req);
    return this.adminService.getPlatformOverview();
  }

  /** FR-A02 & FR-M01: Merchant Approval & Management */
  @Get(ADMIN_ROUTES.merchants)
  async listMerchants(@Req() req: Request, @Query('status') status?: string) {
    this.requireAdminId(req);
    return this.adminService.listMerchants(status);
  }

  @Post(ADMIN_ROUTES.approveMerchant)
  @HttpCode(HttpStatus.OK)
  async approveMerchant(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto?: MerchantStatusActionDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.updateMerchantStatus(
      parseBigIntId(id, 'ร้านค้า'),
      'ACTIVE',
      adminId,
      dto?.reason,
      dto?.expectedStatus,
    );
  }

  @Post(ADMIN_ROUTES.rejectMerchant)
  @HttpCode(HttpStatus.OK)
  async rejectMerchant(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto?: MerchantStatusActionDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.updateMerchantStatus(
      parseBigIntId(id, 'ร้านค้า'),
      'REJECTED',
      adminId,
      dto?.reason,
      dto?.expectedStatus,
    );
  }

  @Post(ADMIN_ROUTES.suspendMerchant)
  @HttpCode(HttpStatus.OK)
  async suspendMerchant(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto?: MerchantStatusActionDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.updateMerchantStatus(
      parseBigIntId(id, 'ร้านค้า'),
      'SUSPENDED',
      adminId,
      dto?.reason,
      dto?.expectedStatus,
    );
  }

  @Post(ADMIN_ROUTES.activateMerchant)
  @HttpCode(HttpStatus.OK)
  async activateMerchant(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto?: MerchantStatusActionDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.updateMerchantStatus(
      parseBigIntId(id, 'ร้านค้า'),
      'ACTIVE',
      adminId,
      dto?.reason,
      dto?.expectedStatus,
    );
  }

  /** FR-A03 & FR-AUTH-05: Admin Role Management */
  @Get(ADMIN_ROUTES.admins)
  async listAdmins(@Req() req: Request) {
    this.requireAdminId(req);
    return this.adminService.listAdminsAndUsers();
  }

  @Post(ADMIN_ROUTES.grantAdminRole)
  @HttpCode(HttpStatus.OK)
  async grantAdminRole(@Req() req: Request, @Param('userId') userId: string) {
    const adminId = this.requireAdminId(req);
    return this.adminService.grantAdminRole(
      parseBigIntId(userId, 'ผู้ใช้งาน'),
      adminId,
    );
  }

  @Patch(ADMIN_ROUTES.grantAdminRole)
  async updateAdminRoleStatus(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminRoleStatusDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.updateAdminRoleStatus(
      parseBigIntId(userId, 'ผู้ใช้งาน'),
      dto.status,
      adminId,
    );
  }

  /** FR-A04: Subsidy Program Management */
  @Get(ADMIN_ROUTES.subsidyPrograms)
  async listSubsidyPrograms(@Req() req: Request) {
    this.requireAdminId(req);
    return this.adminService.listSubsidyPrograms();
  }

  @Post(ADMIN_ROUTES.subsidyPrograms)
  async createSubsidyProgram(
    @Req() req: Request,
    @Body() dto: CreateSubsidyProgramDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.createSubsidyProgram(dto, adminId);
  }

  @Patch(ADMIN_ROUTES.updateSubsidyProgram)
  async updateSubsidyProgram(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSubsidyProgramDto,
  ) {
    const adminId = this.requireAdminId(req);
    return this.adminService.updateSubsidyProgram(
      parseBigIntId(id, 'โครงการ'),
      dto,
      adminId,
    );
  }

  /** FR-A05 & FR-S04: Quest Generation & Logs */
  @Post(ADMIN_ROUTES.generatePersonalizedQuest)
  @HttpCode(HttpStatus.ACCEPTED)
  async generatePersonalizedQuest(
    @Req() req: Request,
    @Body() dto: AdminGenerateQuestDto,
  ) {
    const adminId = this.requireAdminId(req);
    const origin = req.get('origin');
    if (
      !origin ||
      !parseCorsOrigins(
        this.config.getOrThrow<string>('CORS_ORIGINS'),
      ).includes(origin) ||
      !req.is('application/json')
    ) {
      throw new ForbiddenException('QUEST_ORIGIN_REJECTED');
    }
    return this.adminService.generatePersonalizedQuestForConsumer(
      parseBigIntId(dto.userId, 'ผู้บริโภค'),
      adminId,
      dto.idempotencyKey,
    );
  }

  @Get(ADMIN_ROUTES.questGenerationLogs)
  async listQuestGenerationLogs(@Req() req: Request) {
    this.requireAdminId(req);
    return this.adminService.listQuestGenerationLogs();
  }

  /** FR-A06: Reward Monitoring */
  @Get(ADMIN_ROUTES.rewardMonitoring)
  async getRewardMonitoring(@Req() req: Request) {
    this.requireAdminId(req);
    return this.adminService.getRewardMonitoring();
  }

  /** FR-A07: Social Impact Dashboard */
  @Get(ADMIN_ROUTES.socialImpact)
  async getSocialImpactDashboard(
    @Req() req: Request,
    @Query('days') days?: string,
  ) {
    this.requireAdminId(req);
    const parsedDays = days
      ? Number(days)
      : SOCIAL_IMPACT_DEFAULTS.DEFAULT_TREND_DAYS;
    return this.adminService.getSocialImpactDashboard(parsedDays);
  }

  /** NFR-OBS-01 & BR-POLICY-01: Persistent Security Audit Events */
  @Get('admin/audit-events')
  async listAuditEvents(
    @Req() req: Request,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.requireAdminId(req);
    return this.adminService.listAuditEvents({
      action,
      targetType,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
