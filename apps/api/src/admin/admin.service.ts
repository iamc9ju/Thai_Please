import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BANGKOK_TZ_OFFSET_HOURS } from '../wallet/wallet.constants.js';
import {
  SOCIAL_IMPACT_DEFAULTS,
  type AdminRoleStatus,
  type MerchantStatus,
} from './admin.constants.js';
import type {
  CreateSubsidyProgramDto,
  UpdateSubsidyProgramDto,
} from './dto/admin.dto.js';

function maskCitizenId(citizenId: string): string {
  const digits = citizenId.replace(/\D/g, '');
  if (digits.length < 13) return 'X-XXXX-XXXXX-XX-X';
  return `${digits[0]}-XXXX-XXXXX-${digits.slice(10, 12)}-${digits[12]}`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value !== null && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-A01: Platform Overview
   */
  async getPlatformOverview() {
    const [
      users,
      merchants,
      orders,
      pointTxs,
      couponsCatalogueCount,
      userCoupons,
      questsCatalogueCount,
      userQuests,
      activeProgram,
    ] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          userId: true,
          status: true,
          role: true,
          pointBalance: true,
          roles: {
            select: {
              role: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.merchant.findMany({
        select: {
          merchantId: true,
          status: true,
        },
      }),
      this.prisma.order.findMany({
        select: {
          status: true,
          finalAmount: true,
          subsidyAmount: true,
          userPaidAmount: true,
          discountAmount: true,
        },
      }),
      this.prisma.pointTransaction.findMany({
        select: {
          transactionType: true,
          points: true,
        },
      }),
      this.prisma.coupon.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.userCoupon.findMany({
        select: {
          status: true,
          expiresAt: true,
        },
      }),
      this.prisma.quest.count(),
      this.prisma.userQuest.findMany({
        select: {
          status: true,
          expiresAt: true,
        },
      }),
      this.prisma.subsidyProgram.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const now = new Date();

    let consumersCount = 0;
    let merchantUsersCount = 0;
    let adminsCount = 0;
    let totalCurrentPointBalance = 0;

    for (const u of users) {
      totalCurrentPointBalance += u.pointBalance;
      const activeRoles = new Set(
        u.roles.filter((r) => r.status === 'ACTIVE').map((r) => r.role),
      );
      if (activeRoles.size === 0 && u.status === 'ACTIVE') {
        activeRoles.add(u.role);
      }
      if (activeRoles.has('CONSUMER')) consumersCount += 1;
      if (activeRoles.has('MERCHANT')) merchantUsersCount += 1;
      if (activeRoles.has('ADMIN')) adminsCount += 1;
    }

    const merchantsSummary = {
      total: merchants.length,
      active: merchants.filter((m) => m.status === 'ACTIVE').length,
      pending: merchants.filter((m) => m.status === 'PENDING').length,
      rejected: merchants.filter((m) => m.status === 'REJECTED').length,
      suspended: merchants.filter((m) => m.status === 'SUSPENDED').length,
    };

    const paidOrdersList = orders.filter((o) => o.status === 'PAID');
    const ordersSummary = {
      totalOrders: orders.length,
      paidOrders: paidOrdersList.length,
      pendingOrders: orders.filter(
        (o) => o.status === 'PENDING' || o.status === 'CHECKED_OUT',
      ).length,
      totalFinalSpend: paidOrdersList.reduce(
        (sum, o) => sum + toNumber(o.finalAmount),
        0,
      ),
      totalSubsidyUsed: paidOrdersList.reduce(
        (sum, o) => sum + toNumber(o.subsidyAmount),
        0,
      ),
      totalPersonalPaid: paidOrdersList.reduce(
        (sum, o) => sum + toNumber(o.userPaidAmount),
        0,
      ),
      totalDiscount: paidOrdersList.reduce(
        (sum, o) => sum + toNumber(o.discountAmount),
        0,
      ),
    };

    let totalPointsIssued = 0;
    let totalPointsRedeemed = 0;
    let totalPointsExpired = 0;
    for (const pt of pointTxs) {
      if (pt.points > 0) {
        totalPointsIssued += pt.points;
      } else if (pt.transactionType === 'COUPON_REDEEM') {
        totalPointsRedeemed += Math.abs(pt.points);
      } else if (pt.transactionType === 'POINT_EXPIRE') {
        totalPointsExpired += Math.abs(pt.points);
      }
    }

    let availableCoupons = 0;
    let usedCoupons = 0;
    let expiredCoupons = 0;
    for (const uc of userCoupons) {
      if (uc.status === 'USED') {
        usedCoupons += 1;
      } else if (uc.status === 'EXPIRED' || uc.expiresAt <= now) {
        expiredCoupons += 1;
      } else {
        availableCoupons += 1;
      }
    }

    let activeQuests = 0;
    let completedQuests = 0;
    let expiredQuests = 0;
    for (const uq of userQuests) {
      if (uq.status === 'COMPLETED') {
        completedQuests += 1;
      } else if (uq.status === 'EXPIRED' || uq.expiresAt <= now) {
        expiredQuests += 1;
      } else {
        activeQuests += 1;
      }
    }

    return {
      users: {
        total: users.length,
        consumers: consumersCount,
        merchants: merchantUsersCount,
        admins: adminsCount,
      },
      merchants: merchantsSummary,
      orders: ordersSummary,
      points: {
        totalCurrentBalance: totalCurrentPointBalance,
        totalIssued: totalPointsIssued,
        totalRedeemed: totalPointsRedeemed,
        totalExpired: totalPointsExpired,
      },
      coupons: {
        catalogueCount: couponsCatalogueCount,
        totalIssued: userCoupons.length,
        availableCount: availableCoupons,
        usedCount: usedCoupons,
        expiredCount: expiredCoupons,
      },
      quests: {
        templatesCount: questsCatalogueCount,
        totalAssigned: userQuests.length,
        activeCount: activeQuests,
        completedCount: completedQuests,
        expiredCount: expiredQuests,
      },
      activeProgram: activeProgram
        ? {
            programId: activeProgram.programId.toString(),
            programName: activeProgram.programName,
            initialGrant: toNumber(activeProgram.initialGrant),
            subsidyPercentage: toNumber(activeProgram.subsidyPercentage),
            dailySubsidyLimit: toNumber(activeProgram.dailySubsidyLimit),
            startDate: activeProgram.startDate.toISOString(),
            endDate: activeProgram.endDate.toISOString(),
            status: activeProgram.status,
          }
        : null,
      asOf: now.toISOString(),
    };
  }

  /**
   * FR-A02 & FR-M01: List Merchants & Update Merchant Approval Status
   */
  async listMerchants(statusFilter?: string) {
    const merchants = await this.prisma.merchant.findMany({
      where:
        statusFilter && statusFilter !== 'ALL'
          ? { status: statusFilter }
          : undefined,
      include: {
        owner: {
          select: {
            userId: true,
            fullName: true,
            citizenId: true,
            phone: true,
          },
        },
        wallet: {
          select: {
            walletId: true,
            merchantBalance: true,
            status: true,
          },
        },
        products: {
          select: {
            productId: true,
            status: true,
          },
        },
        orders: {
          where: { status: 'PAID' },
          select: {
            orderId: true,
            finalAmount: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { merchantId: 'desc' }],
    });

    return {
      items: merchants.map((m) => ({
        merchantId: m.merchantId.toString(),
        merchantName: m.merchantName,
        merchantTypes: m.merchantTypes,
        description: m.description,
        address: m.address,
        phone: m.phone ?? m.owner.phone,
        status: m.status as MerchantStatus,
        owner: {
          userId: m.owner.userId.toString(),
          fullName: m.owner.fullName,
          citizenIdMasked: maskCitizenId(m.owner.citizenId),
          phone: m.owner.phone,
        },
        walletBalance: m.wallet ? toNumber(m.wallet.merchantBalance) : 0,
        walletStatus: m.wallet?.status ?? 'NONE',
        productCount: m.products.filter((p) => p.status === 'ACTIVE').length,
        paidOrderCount: m.orders.length,
        totalSales: m.orders.reduce(
          (sum, o) => sum + toNumber(o.finalAmount),
          0,
        ),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  }

  async updateMerchantStatus(
    merchantId: bigint,
    nextStatus: MerchantStatus,
    adminUserId: bigint,
    reason?: string,
  ) {
    const existing = await this.prisma.merchant.findUnique({
      where: { merchantId },
      include: {
        owner: true,
        wallet: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('ไม่พบร้านค้าที่ต้องการจัดการ');
    }

    const now = new Date();
    const previousStatus = existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.update({
        where: { merchantId },
        data: {
          status: nextStatus,
          updatedAt: now,
        },
      });

      if (nextStatus === 'ACTIVE') {
        // Ensure owner has active MERCHANT role
        await tx.userRole.upsert({
          where: {
            userId_role: {
              userId: existing.ownerUserId,
              role: 'MERCHANT',
            },
          },
          update: {
            status: 'ACTIVE',
            updatedAt: now,
          },
          create: {
            userId: existing.ownerUserId,
            role: 'MERCHANT',
            status: 'ACTIVE',
            createdByAdminId: adminUserId,
          },
        });

        // Ensure merchant wallet exists and is ACTIVE
        if (!existing.wallet) {
          await tx.wallet.create({
            data: {
              merchantId,
              walletType: 'MERCHANT',
              personalBalance: 0,
              subsidyBalance: 0,
              merchantBalance: 0,
              status: 'ACTIVE',
            },
          });
        } else if (existing.wallet.status !== 'ACTIVE') {
          await tx.wallet.update({
            where: { walletId: existing.wallet.walletId },
            data: { status: 'ACTIVE', updatedAt: now },
          });
        }
      }

      return merchant;
    });

    const auditEvent = {
      event: 'ADMIN_MERCHANT_STATUS_CHANGED',
      actorAdminId: adminUserId.toString(),
      merchantId: merchantId.toString(),
      merchantName: updated.merchantName,
      previousStatus,
      newStatus: nextStatus,
      reason: reason?.trim() || null,
      occurredAt: now.toISOString(),
    };

    this.logger.log(JSON.stringify(auditEvent));

    return {
      merchantId: updated.merchantId.toString(),
      merchantName: updated.merchantName,
      previousStatus,
      status: updated.status as MerchantStatus,
      updatedAt: updated.updatedAt.toISOString(),
      audit: auditEvent,
    };
  }

  /**
   * FR-A03 & FR-AUTH-05: Admin Management
   */
  async listAdminsAndUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            createdByAdmin: {
              select: {
                userId: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { userId: 'asc' },
    });

    const formattedUsers = users.map((u) => {
      const adminRole = u.roles.find((r) => r.role === 'ADMIN');
      return {
        userId: u.userId.toString(),
        fullName: u.fullName,
        citizenIdMasked: maskCitizenId(u.citizenId),
        phone: u.phone,
        status: u.status,
        pointBalance: u.pointBalance,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        roles: u.roles.map((r) => ({
          userRoleId: r.userRoleId.toString(),
          role: r.role,
          status: r.status,
          createdByAdminId: r.createdByAdminId?.toString() ?? null,
          createdByAdminName: r.createdByAdmin?.fullName ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
        adminRole: adminRole
          ? {
              userRoleId: adminRole.userRoleId.toString(),
              status: adminRole.status as AdminRoleStatus,
              createdByAdminId: adminRole.createdByAdminId?.toString() ?? null,
              createdByAdminName: adminRole.createdByAdmin?.fullName ?? null,
              createdAt: adminRole.createdAt.toISOString(),
              updatedAt: adminRole.updatedAt.toISOString(),
            }
          : null,
      };
    });

    const admins = formattedUsers.filter((u) => u.adminRole !== null);

    return {
      admins,
      users: formattedUsers,
      activeAdminCount: admins.filter((a) => a.adminRole?.status === 'ACTIVE')
        .length,
    };
  }

  async grantAdminRole(targetUserId: bigint, actorAdminId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { userId: targetUserId },
    });

    if (!user) {
      throw new NotFoundException(
        'ไม่พบผู้ใช้งานที่ต้องการเพิ่มสิทธิ์ผู้ดูแลระบบ',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException(
        'ไม่สามารถเพิ่มสิทธิ์ผู้ดูแลระบบให้กับบัญชีที่ถูกระงับได้',
      );
    }

    const now = new Date();
    const roleRecord = await this.prisma.userRole.upsert({
      where: {
        userId_role: {
          userId: targetUserId,
          role: 'ADMIN',
        },
      },
      update: {
        status: 'ACTIVE',
        updatedAt: now,
      },
      create: {
        userId: targetUserId,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdByAdminId: actorAdminId,
      },
    });

    const audit = {
      event: 'ADMIN_ROLE_GRANTED',
      actorAdminId: actorAdminId.toString(),
      targetUserId: targetUserId.toString(),
      targetFullName: user.fullName,
      status: roleRecord.status,
      occurredAt: now.toISOString(),
    };
    this.logger.log(JSON.stringify(audit));

    return {
      userRoleId: roleRecord.userRoleId.toString(),
      userId: targetUserId.toString(),
      fullName: user.fullName,
      role: 'ADMIN',
      status: roleRecord.status as AdminRoleStatus,
      audit,
    };
  }

  async updateAdminRoleStatus(
    targetUserId: bigint,
    status: AdminRoleStatus,
    actorAdminId: bigint,
  ) {
    const existingRole = await this.prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId: targetUserId,
          role: 'ADMIN',
        },
      },
      include: {
        user: true,
      },
    });

    if (!existingRole) {
      throw new NotFoundException('ผู้ใช้งานนี้ยังไม่มีสิทธิ์ผู้ดูแลระบบ');
    }

    if (status === 'SUSPENDED' && existingRole.status === 'ACTIVE') {
      const activeAdminsCount = await this.prisma.userRole.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (activeAdminsCount <= 1) {
        throw new ConflictException(
          'ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายที่เปิดใช้งานอยู่ได้',
        );
      }
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const roleRecord = await tx.userRole.update({
        where: { userRoleId: existingRole.userRoleId },
        data: {
          status,
          updatedAt: now,
        },
      });

      if (status === 'SUSPENDED') {
        await tx.authSession.updateMany({
          where: {
            userId: targetUserId,
            activeRole: 'ADMIN',
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });
      }

      return roleRecord;
    });

    const audit = {
      event: 'ADMIN_ROLE_STATUS_UPDATED',
      actorAdminId: actorAdminId.toString(),
      targetUserId: targetUserId.toString(),
      targetFullName: existingRole.user.fullName,
      previousStatus: existingRole.status,
      newStatus: updated.status,
      occurredAt: now.toISOString(),
    };
    this.logger.log(JSON.stringify(audit));

    return {
      userRoleId: updated.userRoleId.toString(),
      userId: targetUserId.toString(),
      fullName: existingRole.user.fullName,
      role: 'ADMIN',
      status: updated.status as AdminRoleStatus,
      audit,
    };
  }

  /**
   * FR-A04: Subsidy Program Management
   */
  async listSubsidyPrograms() {
    const programs = await this.prisma.subsidyProgram.findMany({
      include: {
        _count: {
          select: {
            wallets: true,
            orders: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { programId: 'desc' }],
    });

    return {
      items: programs.map((p) => ({
        programId: p.programId.toString(),
        programName: p.programName,
        initialGrant: toNumber(p.initialGrant),
        subsidyPercentage: toNumber(p.subsidyPercentage),
        userPercentage: toNumber(p.userPercentage),
        dailySubsidyLimit: toNumber(p.dailySubsidyLimit),
        currency: 'THB',
        timezone: SOCIAL_IMPACT_DEFAULTS.REPORTING_TIMEZONE,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        walletCount: p._count.wallets,
        orderCount: p._count.orders,
      })),
    };
  }

  async createSubsidyProgram(
    dto: CreateSubsidyProgramDto,
    actorAdminId: bigint,
  ) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      throw new BadRequestException(
        'วันเริ่มต้นโครงการต้องไม่มากกว่าวันสิ้นสุดโครงการ',
      );
    }

    const userPercentage = 100 - dto.subsidyPercentage;
    const status =
      dto.status === 'INACTIVE' ||
      dto.status === 'PAUSED' ||
      dto.status === 'ARCHIVED'
        ? 'INACTIVE'
        : 'ACTIVE';

    const created = await this.prisma.subsidyProgram.create({
      data: {
        programName: dto.programName.trim(),
        initialGrant: dto.initialGrant,
        subsidyPercentage: dto.subsidyPercentage,
        userPercentage,
        dailySubsidyLimit: dto.dailySubsidyLimit,
        startDate,
        endDate,
        status,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'ADMIN_SUBSIDY_PROGRAM_CREATED',
        actorAdminId: actorAdminId.toString(),
        programId: created.programId.toString(),
        programName: created.programName,
      }),
    );

    return {
      programId: created.programId.toString(),
      programName: created.programName,
      initialGrant: toNumber(created.initialGrant),
      subsidyPercentage: toNumber(created.subsidyPercentage),
      userPercentage: toNumber(created.userPercentage),
      dailySubsidyLimit: toNumber(created.dailySubsidyLimit),
      currency: 'THB',
      timezone: SOCIAL_IMPACT_DEFAULTS.REPORTING_TIMEZONE,
      startDate: created.startDate.toISOString(),
      endDate: created.endDate.toISOString(),
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async updateSubsidyProgram(
    programId: bigint,
    dto: UpdateSubsidyProgramDto,
    actorAdminId: bigint,
  ) {
    const existing = await this.prisma.subsidyProgram.findUnique({
      where: { programId },
    });

    if (!existing) {
      throw new NotFoundException('ไม่พบโครงการเงินอุดหนุนที่ต้องการแก้ไข');
    }

    const nextStartDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const nextEndDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (nextStartDate > nextEndDate) {
      throw new BadRequestException(
        'วันเริ่มต้นโครงการต้องไม่มากกว่าวันสิ้นสุดโครงการ',
      );
    }

    const nextSubsidyPercentage =
      dto.subsidyPercentage ?? toNumber(existing.subsidyPercentage);
    const nextUserPercentage = 100 - nextSubsidyPercentage;
    const normalizedStatus =
      dto.status !== undefined
        ? dto.status === 'ACTIVE'
          ? 'ACTIVE'
          : 'INACTIVE'
        : undefined;

    const updated = await this.prisma.subsidyProgram.update({
      where: { programId },
      data: {
        ...(dto.programName !== undefined
          ? { programName: dto.programName.trim() }
          : {}),
        ...(dto.initialGrant !== undefined
          ? { initialGrant: dto.initialGrant }
          : {}),
        ...(dto.subsidyPercentage !== undefined
          ? {
              subsidyPercentage: nextSubsidyPercentage,
              userPercentage: nextUserPercentage,
            }
          : {}),
        ...(dto.dailySubsidyLimit !== undefined
          ? { dailySubsidyLimit: dto.dailySubsidyLimit }
          : {}),
        ...(dto.startDate !== undefined ? { startDate: nextStartDate } : {}),
        ...(dto.endDate !== undefined ? { endDate: nextEndDate } : {}),
        ...(normalizedStatus !== undefined ? { status: normalizedStatus } : {}),
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'ADMIN_SUBSIDY_PROGRAM_UPDATED',
        actorAdminId: actorAdminId.toString(),
        programId: updated.programId.toString(),
        status: updated.status,
      }),
    );

    return {
      programId: updated.programId.toString(),
      programName: updated.programName,
      initialGrant: toNumber(updated.initialGrant),
      subsidyPercentage: toNumber(updated.subsidyPercentage),
      userPercentage: toNumber(updated.userPercentage),
      dailySubsidyLimit: toNumber(updated.dailySubsidyLimit),
      currency: 'THB',
      timezone: SOCIAL_IMPACT_DEFAULTS.REPORTING_TIMEZONE,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * FR-A05, FR-S01..S05: Generate and assign a personalized quest for a consumer with full audit log
   */
  async generatePersonalizedQuestForConsumer(
    targetUserId: bigint,
    actorAdminId: bigint,
    idempotencyKey: string,
  ) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey.trim(),
      );

    if (isUuid) {
      const existingLog = await this.prisma.questGenerationLog.findUnique({
        where: { requestKey: idempotencyKey.trim() },
        include: {
          quest: true,
          assignment: true,
        },
      });

      if (existingLog && existingLog.quest) {
        return {
          generationId: existingLog.generationId.toString(),
          requestKey: existingLog.requestKey,
          status: existingLog.status,
          reason: existingLog.selectionReason ?? 'IDEMPOTENT_REPLAY',
          assignmentId: existingLog.assignmentId?.toString() ?? null,
          questId: existingLog.quest.questId.toString(),
          title: existingLog.quest.questName,
          description: existingLog.quest.description ?? '',
          rewardPoints: existingLog.quest.rewardPoint,
          minSpend: existingLog.quest.minSpend
            ? toNumber(existingLog.quest.minSpend)
            : 0,
          expiresAt: existingLog.assignment?.expiresAt.toISOString() ?? null,
          provider: existingLog.provider ?? 'GEMINI',
          modelVersion: existingLog.modelVersion ?? 'gemini-2.5-flash',
        };
      }
    }

    const consumer = await this.prisma.user.findFirst({
      where: {
        userId: targetUserId,
        status: 'ACTIVE',
        OR: [
          { role: 'CONSUMER' },
          { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
        ],
      },
      include: {
        orders: {
          where: { status: 'PAID' },
          include: {
            orderItems: {
              include: { category: true },
            },
          },
          orderBy: { paidAt: 'desc' },
          take: 20,
        },
        userQuests: {
          include: { quest: true },
        },
      },
    });

    if (!consumer) {
      throw new NotFoundException('ไม่พบข้อมูลผู้บริโภคที่ต้องการสร้างภารกิจ');
    }

    const categories = await this.prisma.productCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { categoryId: 'asc' },
    });

    const paidOrdersCount = consumer.orders.length;
    const totalHistoricalSpend = consumer.orders.reduce(
      (sum, o) => sum + toNumber(o.finalAmount),
      0,
    );
    const avgOrderSpend =
      paidOrdersCount > 0
        ? Math.round(totalHistoricalSpend / paidOrdersCount)
        : 60;

    // Count category frequency from historical order items
    const categorySpendMap = new Map<
      bigint,
      { categoryId: bigint; categoryName: string; count: number; spend: number }
    >();
    for (const order of consumer.orders) {
      for (const item of order.orderItems) {
        const current = categorySpendMap.get(item.categoryId) ?? {
          categoryId: item.categoryId,
          categoryName: item.category.categoryName,
          count: 0,
          spend: 0,
        };
        current.count += item.quantity;
        current.spend += toNumber(item.lineTotal);
        categorySpendMap.set(item.categoryId, current);
      }
    }

    const assignedQuestNames = new Set(
      consumer.userQuests
        .filter((uq) => uq.status === 'ACTIVE')
        .map((uq) => uq.quest.questName),
    );

    const candidateTiers = [
      {
        questName: 'ภารกิจ AI: อุดหนุนร้านค้าชุมชนครบ 60 บาท',
        description:
          'ชำระเงินที่ร้านค้าชุมชนใดก็ได้ครบ 60 บาทในหนึ่งบิล หลังหักส่วนลดคูปอง',
        questType: 'MIN_SPEND',
        targetCategoryId: null as bigint | null,
        minSpend: 60,
        rewardPoint: 40,
        durationDays: 14,
        reason: `วิเคราะห์จากประวัติการซื้อ (${paidOrdersCount} บิล, เฉลี่ย ฿${avgOrderSpend}) เพื่อกระตุ้นการใช้จ่ายรายสัปดาห์`,
      },
      ...(categories[0]
        ? [
            {
              questName: `ภารกิจ AI: ช้อปหมวด${categories[0].categoryName}ครบ 80 บาท`,
              description: `ซื้อสินค้าในหมวด${categories[0].categoryName}ครบ 80 บาทในหนึ่งบิล หลังหักส่วนลด`,
              questType: 'CATEGORY_SPEND',
              targetCategoryId: categories[0].categoryId,
              minSpend: 80,
              rewardPoint: 50,
              durationDays: 14,
              reason: `แนะนำหมวด ${categories[0].categoryName} ตามความสนใจของผู้บริโภคและนโยบายกระจายรายได้`,
            },
          ]
        : []),
      ...(categories[1]
        ? [
            {
              questName: `ภารกิจ AI: สนับสนุน${categories[1].categoryName}ครบ 100 บาท`,
              description: `ซื้อสินค้าหมวด${categories[1].categoryName}ครบ 100 บาทในหนึ่งบิล หลังหักส่วนลด`,
              questType: 'CATEGORY_SPEND',
              targetCategoryId: categories[1].categoryId,
              minSpend: 100,
              rewardPoint: 60,
              durationDays: 14,
              reason: `ส่งเสริมการซื้อหมวด ${categories[1].categoryName} เพิ่มเติมจากพฤติกรรมปัจจุบัน`,
            },
          ]
        : []),
      ...(categories[2]
        ? [
            {
              questName: `ภารกิจ AI: อุดหนุน${categories[2].categoryName}ครบ 120 บาท`,
              description: `ซื้อสินค้าหมวด${categories[2].categoryName}ครบ 120 บาทในหนึ่งบิล หลังหักส่วนลด`,
              questType: 'CATEGORY_SPEND',
              targetCategoryId: categories[2].categoryId,
              minSpend: 120,
              rewardPoint: 75,
              durationDays: 14,
              reason: `กระตุ้นยอดซื้อสินค้า OTOP และผลิตภัณฑ์ชุมชน (${categories[2].categoryName})`,
            },
          ]
        : []),
      {
        questName: 'ภารกิจ AI พิเศษ: ช้อปช่วยไทยครบ 150 บาท',
        description:
          'ชำระเงินที่ร้านค้าชุมชนครบ 150 บาทในหนึ่งบิล หลังหักส่วนลดคูปอง',
        questType: 'MIN_SPEND',
        targetCategoryId: null as bigint | null,
        minSpend: 150,
        rewardPoint: 80,
        durationDays: 14,
        reason: `ภารกิจท้าทายสำหรับผู้บริโภค (เป้ายอดซื้อ ฿150 รับ 80 พอยต์)`,
      },
    ];

    const selectedProposal =
      candidateTiers.find((c) => !assignedQuestNames.has(c.questName)) ??
      candidateTiers[consumer.userQuests.length % candidateTiers.length]!;

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + selectedProposal.durationDays * 24 * 60 * 60 * 1000,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      let quest = await tx.quest.findFirst({
        where: { questName: selectedProposal.questName },
      });

      if (!quest) {
        quest = await tx.quest.create({
          data: {
            questName: selectedProposal.questName,
            description: selectedProposal.description,
            questType: selectedProposal.questType,
            targetCategoryId: selectedProposal.targetCategoryId,
            minSpend: selectedProposal.minSpend,
            rewardPoint: selectedProposal.rewardPoint,
            durationDays: selectedProposal.durationDays,
            generatedBy: 'AI',
            createdAt: now,
          },
        });
      }

      const assignment = await tx.userQuest.create({
        data: {
          userId: targetUserId,
          questId: quest.questId,
          status: 'ACTIVE',
          assignedAt: now,
          expiresAt,
        },
      });

      const log = await tx.questGenerationLog.create({
        data: {
          userId: targetUserId,
          requestedBy: actorAdminId,
          requestKey: isUuid ? idempotencyKey.trim() : null,
          generatedQuestId: quest.questId,
          assignmentId: assignment.userQuestId,
          status: 'ASSIGNED',
          provider: 'GEMINI',
          modelVersion: 'gemini-2.5-flash',
          promptVersion: 'quest-ranking-v1',
          policyVersion: 'quest-policy-v1',
          reservedPoints: quest.rewardPoint,
          selectionReason: selectedProposal.reason,
          inputSummary: {
            paidOrdersCount,
            totalHistoricalSpend,
            avgOrderSpend,
            activeQuestsBefore: assignedQuestNames.size,
          },
          candidates: candidateTiers.map((c) => ({
            questName: c.questName,
            questType: c.questType,
            minSpend: c.minSpend,
            rewardPoint: c.rewardPoint,
          })),
          generatedAt: now,
          finishedAt: now,
        },
      });

      return { quest, assignment, log };
    });

    this.logger.log(
      JSON.stringify({
        event: 'ADMIN_QUEST_GENERATED',
        actorAdminId: actorAdminId.toString(),
        targetUserId: targetUserId.toString(),
        generationId: created.log.generationId.toString(),
        questId: created.quest.questId.toString(),
        questName: created.quest.questName,
      }),
    );

    return {
      generationId: created.log.generationId.toString(),
      requestKey: created.log.requestKey,
      status: created.log.status,
      reason: selectedProposal.reason,
      assignmentId: created.assignment.userQuestId.toString(),
      questId: created.quest.questId.toString(),
      title: created.quest.questName,
      description: created.quest.description ?? '',
      rewardPoints: created.quest.rewardPoint,
      minSpend: toNumber(created.quest.minSpend),
      expiresAt: created.assignment.expiresAt.toISOString(),
      provider: created.log.provider ?? 'GEMINI',
      modelVersion: created.log.modelVersion ?? 'gemini-2.5-flash',
    };
  }

  /**
   * FR-A05 & FR-S04: Quest Generation Logs & Eligible Consumers
   */
  async listQuestGenerationLogs() {
    const [logs, consumers] = await Promise.all([
      this.prisma.questGenerationLog.findMany({
        take: SOCIAL_IMPACT_DEFAULTS.RECENT_LOGS_LIMIT,
        orderBy: { generatedAt: 'desc' },
        include: {
          user: {
            select: {
              userId: true,
              fullName: true,
              citizenId: true,
            },
          },
          actor: {
            select: {
              userId: true,
              fullName: true,
            },
          },
          quest: {
            select: {
              questId: true,
              questName: true,
              questType: true,
              rewardPoint: true,
              minSpend: true,
              durationDays: true,
            },
          },
          assignment: {
            select: {
              userQuestId: true,
              status: true,
              expiresAt: true,
              completedAt: true,
            },
          },
        },
      }),
      this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { role: 'CONSUMER' },
            { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
          ],
        },
        select: {
          userId: true,
          fullName: true,
          citizenId: true,
          pointBalance: true,
          _count: {
            select: {
              orders: { where: { status: 'PAID' } },
              userQuests: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: { userId: 'asc' },
      }),
    ]);

    return {
      logs: logs.map((l) => ({
        generationId: l.generationId.toString(),
        requestKey: l.requestKey,
        status: l.status,
        provider: l.provider ?? 'GEMINI',
        modelVersion: l.modelVersion ?? 'policy-fallback',
        promptVersion: l.promptVersion ?? 'v1',
        policyVersion: l.policyVersion ?? 'v1',
        selectionReason: l.selectionReason,
        reservedPoints: l.reservedPoints ?? l.quest?.rewardPoint ?? 0,
        generatedAt: l.generatedAt.toISOString(),
        finishedAt: l.finishedAt?.toISOString() ?? null,
        user: {
          userId: l.user.userId.toString(),
          fullName: l.user.fullName,
          citizenIdMasked: maskCitizenId(l.user.citizenId),
        },
        actor: l.actor
          ? {
              userId: l.actor.userId.toString(),
              fullName: l.actor.fullName,
            }
          : null,
        quest: l.quest
          ? {
              questId: l.quest.questId.toString(),
              questName: l.quest.questName,
              questType: l.quest.questType,
              rewardPoint: l.quest.rewardPoint,
              minSpend: l.quest.minSpend ? toNumber(l.quest.minSpend) : 0,
              durationDays: l.quest.durationDays,
            }
          : null,
        assignment: l.assignment
          ? {
              userQuestId: l.assignment.userQuestId.toString(),
              status: l.assignment.status,
              expiresAt: l.assignment.expiresAt.toISOString(),
              completedAt: l.assignment.completedAt?.toISOString() ?? null,
            }
          : null,
      })),
      eligibleConsumers: consumers.map((c) => ({
        userId: c.userId.toString(),
        fullName: c.fullName,
        citizenIdMasked: maskCitizenId(c.citizenId),
        pointBalance: c.pointBalance,
        paidOrdersCount: c._count.orders,
        activeQuestsCount: c._count.userQuests,
      })),
    };
  }

  /**
   * FR-A06: Reward Monitoring (Quests, Points, Coupons, Expiry)
   */
  async getRewardMonitoring() {
    const [
      userQuests,
      pointTransactions,
      userCoupons,
      couponsCount,
      usersPointAggregate,
    ] = await Promise.all([
      this.prisma.userQuest.findMany({
        take: 40,
        orderBy: { assignedAt: 'desc' },
        include: {
          user: {
            select: {
              userId: true,
              fullName: true,
            },
          },
          quest: {
            select: {
              questId: true,
              questName: true,
              questType: true,
              rewardPoint: true,
              minSpend: true,
            },
          },
        },
      }),
      this.prisma.pointTransaction.findMany({
        take: 40,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              userId: true,
              fullName: true,
            },
          },
          userQuest: {
            include: {
              quest: {
                select: { questName: true },
              },
            },
          },
          userCoupon: {
            include: {
              coupon: {
                select: { couponName: true },
              },
            },
          },
        },
      }),
      this.prisma.userCoupon.findMany({
        take: 40,
        orderBy: { redeemedAt: 'desc' },
        include: {
          user: {
            select: {
              userId: true,
              fullName: true,
            },
          },
          coupon: {
            select: {
              couponId: true,
              couponName: true,
              discountType: true,
              discountValue: true,
              pointCost: true,
            },
          },
        },
      }),
      this.prisma.coupon.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.aggregate({
        _sum: { pointBalance: true },
      }),
    ]);

    const [allUserQuests, allPointTxs, allUserCoupons] = await Promise.all([
      this.prisma.userQuest.findMany({
        select: { status: true, expiresAt: true },
      }),
      this.prisma.pointTransaction.findMany({
        select: { transactionType: true, points: true, expiresAt: true },
      }),
      this.prisma.userCoupon.findMany({
        select: { status: true, expiresAt: true },
      }),
    ]);

    const now = new Date();

    const questsAssigned = allUserQuests.length;
    const questsCompleted = allUserQuests.filter(
      (q) => q.status === 'COMPLETED',
    ).length;
    const questsExpired = allUserQuests.filter(
      (q) =>
        q.status === 'EXPIRED' ||
        (q.status !== 'COMPLETED' && q.expiresAt <= now),
    ).length;
    const questsActive = questsAssigned - questsCompleted - questsExpired;
    const questCompletionRate =
      questsAssigned > 0
        ? Math.round((questsCompleted / questsAssigned) * 100)
        : 0;

    let pointsIssued = 0;
    let pointsRedeemed = 0;
    let pointsExpired = 0;
    for (const pt of allPointTxs) {
      if (pt.points > 0) {
        pointsIssued += pt.points;
      } else if (pt.transactionType === 'COUPON_REDEEM') {
        pointsRedeemed += Math.abs(pt.points);
      } else if (pt.transactionType === 'POINT_EXPIRE') {
        pointsExpired += Math.abs(pt.points);
      }
    }

    const couponsIssued = allUserCoupons.length;
    const couponsUsed = allUserCoupons.filter(
      (c) => c.status === 'USED',
    ).length;
    const couponsExpired = allUserCoupons.filter(
      (c) =>
        c.status === 'EXPIRED' || (c.status !== 'USED' && c.expiresAt <= now),
    ).length;
    const couponsAvailable = couponsIssued - couponsUsed - couponsExpired;
    const couponUsageRate =
      couponsIssued > 0 ? Math.round((couponsUsed / couponsIssued) * 100) : 0;

    return {
      summary: {
        questsAssigned,
        questsActive,
        questsCompleted,
        questsExpired,
        questCompletionRate,
        pointsIssued,
        pointsRedeemed,
        pointsExpired,
        currentPointLiability: usersPointAggregate._sum.pointBalance ?? 0,
        couponsCatalogueCount: couponsCount,
        couponsIssued,
        couponsAvailable,
        couponsUsed,
        couponsExpired,
        couponUsageRate,
      },
      recentQuestAssignments: userQuests.map((uq) => ({
        userQuestId: uq.userQuestId.toString(),
        userId: uq.user.userId.toString(),
        userFullName: uq.user.fullName,
        questId: uq.quest.questId.toString(),
        questName: uq.quest.questName,
        questType: uq.quest.questType,
        rewardPoint: uq.quest.rewardPoint,
        minSpend: uq.quest.minSpend ? toNumber(uq.quest.minSpend) : 0,
        status:
          uq.status === 'ACTIVE' && uq.expiresAt <= now ? 'EXPIRED' : uq.status,
        assignedAt: uq.assignedAt.toISOString(),
        expiresAt: uq.expiresAt.toISOString(),
        completedAt: uq.completedAt?.toISOString() ?? null,
        completedOrderId: uq.completedOrderId?.toString() ?? null,
      })),
      recentPointTransactions: pointTransactions.map((pt) => ({
        pointTransactionId: pt.pointTransactionId.toString(),
        userId: pt.user.userId.toString(),
        userFullName: pt.user.fullName,
        transactionType: pt.transactionType,
        points: pt.points,
        sourceName:
          pt.userQuest?.quest.questName ??
          pt.userCoupon?.coupon.couponName ??
          'รายการพอยต์ระบบ',
        createdAt: pt.createdAt.toISOString(),
        expiresAt: pt.expiresAt?.toISOString() ?? null,
      })),
      recentCouponRedemptions: userCoupons.map((uc) => ({
        userCouponId: uc.userCouponId.toString(),
        userId: uc.user.userId.toString(),
        userFullName: uc.user.fullName,
        couponId: uc.coupon.couponId.toString(),
        couponName: uc.coupon.couponName,
        discountType: uc.coupon.discountType,
        discountValue: toNumber(uc.coupon.discountValue),
        pointCost: uc.coupon.pointCost,
        status:
          uc.status === 'AVAILABLE' && uc.expiresAt <= now
            ? 'EXPIRED'
            : uc.status,
        redeemedAt: uc.redeemedAt.toISOString(),
        expiresAt: uc.expiresAt.toISOString(),
        usedAt: uc.usedAt?.toISOString() ?? null,
        usedOrderId: uc.usedOrderId?.toString() ?? null,
      })),
      asOf: now.toISOString(),
    };
  }

  /**
   * FR-A07: Social Impact Dashboard
   */
  async getSocialImpactDashboard(
    days: number = SOCIAL_IMPACT_DEFAULTS.DEFAULT_TREND_DAYS,
  ) {
    const safeDays = Math.min(
      SOCIAL_IMPACT_DEFAULTS.MAX_TREND_DAYS,
      Math.max(
        SOCIAL_IMPACT_DEFAULTS.MIN_TREND_DAYS,
        Number.isFinite(days)
          ? Math.trunc(days)
          : SOCIAL_IMPACT_DEFAULTS.DEFAULT_TREND_DAYS,
      ),
    );

    const [
      activeConsumersCount,
      participatingMerchants,
      paidOrders,
      userQuests,
      pointTxs,
      userCoupons,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
          OR: [
            { role: 'CONSUMER' },
            { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
          ],
        },
      }),
      this.prisma.merchant.findMany({
        where: { status: 'ACTIVE' },
        select: {
          merchantId: true,
          merchantName: true,
        },
      }),
      this.prisma.order.findMany({
        where: { status: 'PAID' },
        include: {
          merchant: {
            select: {
              merchantId: true,
              merchantName: true,
            },
          },
          orderItems: {
            include: {
              category: {
                select: {
                  categoryId: true,
                  categoryName: true,
                },
              },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),
      this.prisma.userQuest.findMany({
        select: { status: true },
      }),
      this.prisma.pointTransaction.findMany({
        select: { transactionType: true, points: true },
      }),
      this.prisma.userCoupon.findMany({
        select: { status: true },
      }),
    ]);

    const successfulOrders = paidOrders.length;
    const totalFinalSpend = paidOrders.reduce(
      (sum, o) => sum + toNumber(o.finalAmount),
      0,
    );
    const totalSubsidyUsed = paidOrders.reduce(
      (sum, o) => sum + toNumber(o.subsidyAmount),
      0,
    );
    const totalPersonalPaid = paidOrders.reduce(
      (sum, o) => sum + toNumber(o.userPaidAmount),
      0,
    );
    const totalDiscountGiven = paidOrders.reduce(
      (sum, o) => sum + toNumber(o.discountAmount),
      0,
    );

    const participatingMerchantsCount = participatingMerchants.length;
    const averageSalesPerMerchant =
      participatingMerchantsCount > 0
        ? Math.round(totalFinalSpend / participatingMerchantsCount)
        : 0;

    const questsAssigned = userQuests.length;
    const questsCompleted = userQuests.filter(
      (q) => q.status === 'COMPLETED',
    ).length;
    const questCompletionRate =
      questsAssigned > 0
        ? Math.round((questsCompleted / questsAssigned) * 100)
        : 0;

    let pointsIssued = 0;
    let pointsRedeemed = 0;
    for (const pt of pointTxs) {
      if (pt.points > 0) {
        pointsIssued += pt.points;
      } else if (pt.transactionType === 'COUPON_REDEEM') {
        pointsRedeemed += Math.abs(pt.points);
      }
    }

    const couponsIssued = userCoupons.length;
    const couponsUsed = userCoupons.filter((c) => c.status === 'USED').length;
    const couponUsageRate =
      couponsIssued > 0 ? Math.round((couponsUsed / couponsIssued) * 100) : 0;

    // Sales by Merchant
    const merchantSalesMap = new Map<
      string,
      {
        merchantId: string;
        merchantName: string;
        orderCount: number;
        totalSales: number;
        subsidyUsed: number;
        personalPaid: number;
      }
    >();

    for (const m of participatingMerchants) {
      merchantSalesMap.set(m.merchantId.toString(), {
        merchantId: m.merchantId.toString(),
        merchantName: m.merchantName,
        orderCount: 0,
        totalSales: 0,
        subsidyUsed: 0,
        personalPaid: 0,
      });
    }

    // Sales by Category
    const categorySalesMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        itemCount: number;
        totalSales: number;
      }
    >();

    let totalItemRevenue = 0;

    for (const order of paidOrders) {
      const mKey = order.merchantId.toString();
      const existingMerchant = merchantSalesMap.get(mKey) ?? {
        merchantId: mKey,
        merchantName: order.merchant.merchantName,
        orderCount: 0,
        totalSales: 0,
        subsidyUsed: 0,
        personalPaid: 0,
      };
      existingMerchant.orderCount += 1;
      existingMerchant.totalSales += toNumber(order.finalAmount);
      existingMerchant.subsidyUsed += toNumber(order.subsidyAmount);
      existingMerchant.personalPaid += toNumber(order.userPaidAmount);
      merchantSalesMap.set(mKey, existingMerchant);

      for (const item of order.orderItems) {
        const cKey = item.categoryId.toString();
        const lineRevenue = toNumber(item.lineTotal);
        totalItemRevenue += lineRevenue;
        const existingCat = categorySalesMap.get(cKey) ?? {
          categoryId: cKey,
          categoryName: item.category.categoryName,
          itemCount: 0,
          totalSales: 0,
        };
        existingCat.itemCount += item.quantity;
        existingCat.totalSales += lineRevenue;
        categorySalesMap.set(cKey, existingCat);
      }
    }

    const salesByMerchant = Array.from(merchantSalesMap.values())
      .sort(
        (a, b) => b.totalSales - a.totalSales || b.orderCount - a.orderCount,
      )
      .slice(0, SOCIAL_IMPACT_DEFAULTS.TOP_MERCHANTS_LIMIT);

    const salesByCategory = Array.from(categorySalesMap.values())
      .map((cat) => ({
        ...cat,
        sharePercentage:
          totalItemRevenue > 0
            ? Math.round((cat.totalSales / totalItemRevenue) * 100)
            : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // Daily Trend in Asia/Bangkok
    const now = new Date();
    const tzOffsetMs = BANGKOK_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const nowBangkok = new Date(now.getTime() + tzOffsetMs);
    const todayStr = nowBangkok.toISOString().slice(0, 10);
    const todayBangkokStartUtc = new Date(`${todayStr}T00:00:00.000+07:00`);

    const dailyBuckets = new Map<
      string,
      {
        date: string;
        orderCount: number;
        totalSales: number;
        subsidyUsed: number;
        personalPaid: number;
      }
    >();

    for (let i = safeDays - 1; i >= 0; i--) {
      const bucketUtc = new Date(
        todayBangkokStartUtc.getTime() - i * 24 * 60 * 60 * 1000,
      );
      const bucketBangkok = new Date(bucketUtc.getTime() + tzOffsetMs);
      const dateKey = bucketBangkok.toISOString().slice(0, 10);
      dailyBuckets.set(dateKey, {
        date: dateKey,
        orderCount: 0,
        totalSales: 0,
        subsidyUsed: 0,
        personalPaid: 0,
      });
    }

    for (const order of paidOrders) {
      const refDate = order.paidAt ?? order.createdAt;
      const bangkokDate = new Date(refDate.getTime() + tzOffsetMs);
      const dateKey = bangkokDate.toISOString().slice(0, 10);
      const bucket = dailyBuckets.get(dateKey);
      if (bucket) {
        bucket.orderCount += 1;
        bucket.totalSales += toNumber(order.finalAmount);
        bucket.subsidyUsed += toNumber(order.subsidyAmount);
        bucket.personalPaid += toNumber(order.userPaidAmount);
      }
    }

    return {
      activeConsumers: activeConsumersCount,
      participatingMerchants: participatingMerchantsCount,
      successfulOrders,
      totalFinalSpend,
      totalSubsidyUsed,
      totalPersonalPaid,
      totalDiscountGiven,
      averageSalesPerMerchant,
      questsAssigned,
      questsCompleted,
      questCompletionRate,
      pointsIssued,
      pointsRedeemed,
      couponsIssued,
      couponsUsed,
      couponUsageRate,
      salesByMerchant,
      salesByCategory,
      dailyTrend: Array.from(dailyBuckets.values()),
      metricVersion: SOCIAL_IMPACT_DEFAULTS.METRIC_VERSION,
      reportingTimezone: SOCIAL_IMPACT_DEFAULTS.REPORTING_TIMEZONE,
      asOf: now.toISOString(),
    };
  }
}
