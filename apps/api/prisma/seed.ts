import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined)
  throw new Error('DATABASE_URL is required for seeding.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function ensureWallet(userId: number, subsidy: number): Promise<void> {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing !== null) return;
  await prisma.$transaction(async (transaction) => {
    const wallet = await transaction.wallet.create({
      data: { userId, subsidyBalance: subsidy, currency: 'THB' },
    });
    await transaction.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        userId,
        bucket: 'SUBSIDY',
        type: 'SUBSIDY_GRANT',
        amount: subsidy,
        currency: 'THB',
        businessRef: `subsidy-grant:user:${userId}`,
        correlationId: 'demo-seed',
      },
    });
  });
}

async function main(): Promise<void> {
  const merchantCategory = await prisma.merchantCategory.upsert({
    where: { name: 'อาหารและเครื่องดื่ม' },
    update: {},
    create: { name: 'อาหารและเครื่องดื่ม' },
  });
  const productCategory = await prisma.productCategory.upsert({
    where: { name: 'อาหารหลัก' },
    update: {},
    create: { name: 'อาหารหลัก' },
  });
  const consumer = await prisma.user.upsert({
    where: { citizenId: '1101700203451' },
    update: {},
    create: {
      citizenId: '1101700203451',
      displayName: 'ผู้ใช้ตัวอย่าง',
      role: 'CONSUMER',
    },
  });
  const secondConsumer = await prisma.user.upsert({
    where: { citizenId: '1101700203452' },
    update: {},
    create: {
      citizenId: '1101700203452',
      displayName: 'ผู้ใช้ตัวอย่างสอง',
      role: 'CONSUMER',
    },
  });
  const merchantUser = await prisma.user.upsert({
    where: { citizenId: '1101700203453' },
    update: {},
    create: {
      citizenId: '1101700203453',
      displayName: 'ผู้ดูแลร้านตัวอย่าง',
      role: 'MERCHANT',
    },
  });
  await prisma.user.upsert({
    where: { citizenId: '1101700203454' },
    update: {},
    create: {
      citizenId: '1101700203454',
      displayName: 'ผู้ดูแลระบบตัวอย่าง',
      role: 'ADMIN',
    },
  });
  await ensureWallet(consumer.id, 1_000);
  await ensureWallet(secondConsumer.id, 1_000);
  await ensureWallet(merchantUser.id, 1_000);

  let merchant = await prisma.merchant.findFirst({
    where: { name: 'ร้านไทยอิ่มใจ' },
  });
  merchant ??= await prisma.merchant.create({
    data: { name: 'ร้านไทยอิ่มใจ', categoryId: merchantCategory.id },
  });
  await prisma.merchantMember.upsert({
    where: {
      merchantId_userId: { merchantId: merchant.id, userId: merchantUser.id },
    },
    update: {},
    create: { merchantId: merchant.id, userId: merchantUser.id },
  });
  const product = await prisma.product.findFirst({
    where: { merchantId: merchant.id, name: 'ข้าวกะเพรา' },
  });
  if (product === null)
    await prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: productCategory.id,
        name: 'ข้าวกะเพรา',
        price: 100,
        currency: 'THB',
      },
    });
  await prisma.couponDefinition.upsert({
    where: { code: 'SAVE10' },
    update: {},
    create: {
      code: 'SAVE10',
      name: 'ลด 10 บาท',
      discountAmount: 10,
      pointsCost: 100,
    },
  });

  let quest = await prisma.quest.findFirst({
    where: { title: 'ซื้อครบ 100 บาทในออเดอร์เดียว', minimumAmount: 100 },
  });
  quest ??= await prisma.quest.create({
    data: {
      title: 'ซื้อครบ 100 บาทในออเดอร์เดียว',
      description: 'ยอดสุทธิหลังส่วนลดต้องถึง 100 บาทในใบเสร็จเดียว',
      minimumAmount: 100,
      rewardPoints: 20,
      provider: 'demo-seed',
      modelVersion: 'deterministic-v1',
      policyVersion: 'prototype-v1',
    },
  });
  await prisma.userQuest.upsert({
    where: { userId_questId: { userId: consumer.id, questId: quest.id } },
    update: {},
    create: {
      userId: consumer.id,
      questId: quest.id,
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
}

await main();
await prisma.$disconnect();
