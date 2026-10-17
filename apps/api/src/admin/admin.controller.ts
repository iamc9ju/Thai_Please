import {
  BadRequestException,
  Body,
  Controller,
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
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { ADMIN_ROUTES, SOCIAL_IMPACT_DEFAULTS } from './admin.constants.js';
import { AdminService } from './admin.service.js';
import {
  CreateSubsidyProgramDto,
  MerchantStatusActionDto,
  UpdateAdminRoleStatusDto,
  UpdateSubsidyProgramDto,
} from './dto/admin.dto.js';

function parseBigIntId(rawId: string, label: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(rawId)) {
    throw new BadRequestException(`รหัส${label}ไม่ถูกต้อง`);
  }
  return BigInt(rawId);
}

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  /** FR-A05 & FR-S04: Quest Generation Logs */
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
}
