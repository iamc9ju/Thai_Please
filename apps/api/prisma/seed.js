import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DAY_MS = 24 * 60 * 60 * 1000;

async function seed() {
  console.log('Seeding initial data...');
  const now = new Date();

  // 1. Seed Subsidy Program
  const existingProgram = await prisma.subsidyProgram.findFirst({
    where: { status: 'ACTIVE' },
  });

  let activeProgram = existingProgram;
  if (!activeProgram) {
    activeProgram = await prisma.subsidyProgram.create({
      data: {
        programName: 'โครงการไทยช่วยไทยพลีส (ระยะที่ 1)',
        initialGrant: 1000.0,
        subsidyPercentage: 50.0,
        userPercentage: 50.0,
        dailySubsidyLimit: 200.0,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59Z'),
        status: 'ACTIVE',
      },
    });
    console.log('Created active subsidy program:', activeProgram.programName);
  } else {
    console.log('Found existing subsidy program:', activeProgram.programName);
  }

  // 2. Seed Product Categories
  const categories = [
    {
      categoryName: 'อาหารและเครื่องดื่ม',
      description: 'อาหารปรุงสุก ข้าวแกง และเครื่องดื่ม',
    },
    {
      categoryName: 'สินค้าอุปโภคบริโภค',
      description: 'ของใช้ในครัวเรือน สินค้าจำเป็นในชีวิตประจำวัน',
    },
    {
      categoryName: 'สินค้า OTOP และชุมชน',
      description: 'ผลิตภัณฑ์ท้องถิ่น สินค้าหัตถกรรมชุมชน',
    },
  ];

  for (const cat of categories) {
    const found = await prisma.productCategory.findUnique({
      where: { categoryName: cat.categoryName },
    });
    if (!found) {
      await prisma.productCategory.create({ data: cat });
      console.log('Created category:', cat.categoryName);
    }
  }

  // FR-C07 v3: quests are proposed and assigned only through consumer selection.

  // 4. Seed Multi-Tier Coupons (20, 50, 100, 180, 250 points)
  const sampleCoupons = [
    {
      couponName: 'คูปองส่วนลด 10 บาท (เริ่มต้น)',
      description:
        'ส่วนลดทันที 10 บาท เมื่อซื้อขั้นต่ำ 30 บาท ใช้ได้ทุกร้านที่ร่วมรายการ',
      discountType: 'FIXED',
      discountValue: 10.0,
      pointCost: 20,
      minPurchase: 30.0,
      validityDays: 30,
      status: 'ACTIVE',
    },
    {
      couponName: 'คูปองส่วนลด 15 บาท ร้านค้าชุมชน',
      description:
        'ส่วนลด 15 บาท เมื่อซื้อขั้นต่ำ 50 บาท ใช้ได้ทุกร้านที่ร่วมรายการ',
      discountType: 'FIXED',
      discountValue: 15.0,
      pointCost: 50,
      minPurchase: 50.0,
      validityDays: 30,
      status: 'ACTIVE',
    },
    {
      couponName: 'คูปองส่วนลด 20 บาท ร้านค้าชุมชน',
      description:
        'ใช้เป็นส่วนลดสำหรับร้านค้าชุมชนที่ร่วมรายการ เมื่อซื้อครบ 50 บาท',
      discountType: 'FIXED',
      discountValue: 20.0,
      pointCost: 100,
      minPurchase: 50.0,
      validityDays: 30,
      status: 'ACTIVE',
    },
    {
      couponName: 'คูปองส่วนลด 10% ช้อปช่วยชุมชน',
      description:
        'ลด 10% เมื่อมียอดซื้อขั้นต่ำ 100 บาท ใช้ได้ทุกร้านที่ร่วมรายการ',
      discountType: 'PERCENT',
      discountValue: 10.0,
      pointCost: 120,
      minPurchase: 100.0,
      validityDays: 30,
      status: 'ACTIVE',
    },
    {
      couponName: 'คูปองส่วนลด 50 บาท ขาช้อปชุมชน',
      description: 'ส่วนลดพิเศษ 50 บาท เมื่อซื้อครบ 200 บาทขึ้นไป',
      discountType: 'FIXED',
      discountValue: 50.0,
      pointCost: 200,
      minPurchase: 200.0,
      validityDays: 30,
      status: 'ACTIVE',
    },
  ];

  for (const c of sampleCoupons) {
    const existingCoupon = await prisma.coupon.findFirst({
      where: { couponName: c.couponName },
    });
    if (!existingCoupon) {
      await prisma.coupon.create({ data: c });
      console.log(
        `Created sample coupon: ${c.couponName} (${c.pointCost} pts)`,
      );
    }
  }

  // 5. Existing development welcome-point fixture for CONSUMER users
  const consumers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { role: 'CONSUMER' },
        { roles: { some: { role: 'CONSUMER', status: 'ACTIVE' } } },
      ],
    },
  });

  for (const consumer of consumers) {
    // No starter assignments: selection owns the entitlement cycle.

    // 5b. If consumer has 0 pointTransactions, grant a starter 100-point welcome reward so they can test coupon redemption immediately
    const txCount = await prisma.pointTransaction.count({
      where: { userId: consumer.userId },
    });

    if (txCount === 0) {
      const starterPoints = 100;
      const pointExpiresAt = new Date(now.getTime() + 30 * DAY_MS);
      await prisma.$transaction([
        prisma.pointTransaction.create({
          data: {
            userId: consumer.userId,
            transactionType: 'QUEST_REWARD',
            points: starterPoints,
            expiresAt: pointExpiresAt,
            createdAt: now,
          },
        }),
        prisma.user.update({
          where: { userId: consumer.userId },
          data: {
            pointBalance: { increment: starterPoints },
            updatedAt: now,
          },
        }),
      ]);
      console.log(
        `Granted starter ${starterPoints} points to consumer userId=${consumer.userId}`,
      );
    }
  }

  // 6. If any existing consumers have 0 subsidy balance and no subsidy program, grant them initial subsidy
  const walletsWithoutSubsidy = await prisma.wallet.findMany({
    where: {
      walletType: 'CONSUMER',
      subsidyProgramId: null,
    },
  });

  for (const w of walletsWithoutSubsidy) {
    await prisma.wallet.update({
      where: { walletId: w.walletId },
      data: {
        subsidyBalance: activeProgram.initialGrant,
        subsidyProgramId: activeProgram.programId,
      },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: w.walletId,
        programId: activeProgram.programId,
        fundType: 'SUBSIDY',
        transactionType: 'SUBSIDY_GRANT',
        amount: activeProgram.initialGrant,
        balanceBefore: 0,
        balanceAfter: activeProgram.initialGrant,
        businessRef: `grant_${w.walletId}_seed_${Date.now()}`,
        correlationId: 'seed-grant',
        userId: w.userId,
        walletTypeSnapshot: 'CONSUMER',
      },
    });
    console.log(
      'Updated existing wallet with initial subsidy grant:',
      w.walletId.toString(),
    );
  }

  // 7. Ensure all merchants have a merchant wallet, and merchant owners have CONSUMER role + CONSUMER wallet for FR-M06 withdrawal testing
  const merchants = await prisma.merchant.findMany();
  for (const m of merchants) {
    const existing = await prisma.wallet.findFirst({
      where: { merchantId: m.merchantId },
    });
    if (!existing) {
      await prisma.wallet.create({
        data: {
          merchantId: m.merchantId,
          walletType: 'MERCHANT',
          personalBalance: 0,
          subsidyBalance: 0,
          merchantBalance: 0,
          status: 'ACTIVE',
        },
      });
      console.log('Created wallet for merchant:', m.merchantName);
    }

    // Ensure merchant owner has active CONSUMER role so they can withdraw from Merchant Wallet to Consumer Personal Balance (FR-M06)
    const ownerConsumerRole = await prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId: m.ownerUserId,
          role: 'CONSUMER',
        },
      },
    });
    if (!ownerConsumerRole) {
      await prisma.userRole.create({
        data: {
          userId: m.ownerUserId,
          role: 'CONSUMER',
          status: 'ACTIVE',
        },
      });
      console.log(
        `Granted CONSUMER role to merchant owner userId=${m.ownerUserId}`,
      );
    }

    const ownerConsumerWallet = await prisma.wallet.findUnique({
      where: { userId: m.ownerUserId },
    });
    if (!ownerConsumerWallet) {
      await prisma.wallet.create({
        data: {
          userId: m.ownerUserId,
          walletType: 'CONSUMER',
          personalBalance: 0,
          subsidyBalance: activeProgram.initialGrant,
          subsidyProgramId: activeProgram.programId,
          status: 'ACTIVE',
        },
      });
      console.log(
        `Created CONSUMER wallet for merchant owner userId=${m.ownerUserId}`,
      );
    }
  }

  // 8. FR-AUTH-06: Ensure Initial Admin Role exists on primary users so Admin Portal can be tested immediately
  const activeAdminRole = await prisma.userRole.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    include: { user: true },
    orderBy: { userRoleId: 'asc' },
  });

  if (activeAdminRole) {
    console.log(
      `Found active ADMIN userId=${activeAdminRole.userId} (${activeAdminRole.user.fullName}, citizenId=${activeAdminRole.user.citizenId})`,
    );
  }

  const firstUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { userId: 'asc' },
    take: 2,
  });

  for (const adminCandidate of firstUsers) {
    const existingAdminRole = await prisma.userRole.findUnique({
      where: {
        userId_role: {
          userId: adminCandidate.userId,
          role: 'ADMIN',
        },
      },
    });
    if (!existingAdminRole && activeAdminRole) {
      await prisma.userRole.create({
        data: {
          userId: adminCandidate.userId,
          role: 'ADMIN',
          status: 'ACTIVE',
          createdByAdminId: activeAdminRole.userId,
        },
      });
      console.log(
        `Granted ADMIN role to userId=${adminCandidate.userId} (${adminCandidate.fullName}, citizenId=${adminCandidate.citizenId})`,
      );
    }
  }

  // Generation audit logs are produced by the real proposal workflow only.

  console.log('Seeding completed successfully!');
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
