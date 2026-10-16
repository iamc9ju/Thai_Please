import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('Seeding initial data...');

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

  // 3. Seed Sample Quests
  const foodCategory = await prisma.productCategory.findUnique({
    where: { categoryName: 'อาหารและเครื่องดื่ม' },
  });

  const existingQuest = await prisma.quest.findFirst({
    where: { questName: 'อุดหนุนร้านอาหารชุมชน' },
  });

  if (!existingQuest && foodCategory) {
    await prisma.quest.create({
      data: {
        questName: 'อุดหนุนร้านอาหารชุมชน',
        description: 'ใช้จ่ายกับร้านอาหารชุมชนสะสมครบ 100 บาท',
        questType: 'CATEGORY_SPEND',
        targetCategoryId: foodCategory.categoryId,
        minSpend: 100.0,
        rewardPoint: 50,
        durationDays: 7,
        generatedBy: 'AI',
      },
    });
    console.log('Created sample quest: อุดหนุนร้านอาหารชุมชน');
  }

  // 4. Seed Sample Coupons
  const existingCoupon = await prisma.coupon.findFirst({
    where: { couponName: 'คูปองส่วนลด 20 บาท ร้านค้าชุมชน' },
  });

  if (!existingCoupon) {
    await prisma.coupon.create({
      data: {
        couponName: 'คูปองส่วนลด 20 บาท ร้านค้าชุมชน',
        description: 'ใช้เป็นส่วนลดสำหรับร้านค้าชุมชนที่ร่วมรายการ',
        discountType: 'FIXED',
        discountValue: 20.0,
        pointCost: 100,
        minPurchase: 50.0,
        validityDays: 30,
        status: 'ACTIVE',
      },
    });
    console.log('Created sample coupon');
  }

  // 5. If any existing consumers have 0 subsidy balance and no subsidy program, grant them initial subsidy
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

  // 6. Ensure all merchants have a merchant wallet
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
  }

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
