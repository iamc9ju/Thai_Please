import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateCategoryDto,
  CreateProductDto,
  ProductStatusValue,
  UpdateProductDto,
} from './dto/product.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicMerchants(search?: string, limit = 10) {
    const normalizedSearch = search?.trim() ?? '';
    const normalizedLimit = Math.min(20, Math.max(1, limit));

    if (normalizedSearch) {
      const merchants = await this.prisma.merchant.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            {
              merchantName: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            {
              address: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            {
              categoryAssignments: {
                some: {
                  category: {
                    status: 'ACTIVE',
                    OR: [
                      {
                        categoryName: {
                          contains: normalizedSearch,
                          mode: 'insensitive',
                        },
                      },
                      {
                        categoryCode: {
                          contains: normalizedSearch,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
        select: {
          merchantId: true,
          merchantName: true,
          description: true,
          address: true,
          categoryAssignments: {
            where: { category: { status: 'ACTIVE' } },
            select: {
              category: {
                select: { categoryCode: true, categoryName: true },
              },
            },
            orderBy: { category: { sortOrder: 'asc' } },
          },
        },
        orderBy: [{ merchantName: 'asc' }, { merchantId: 'asc' }],
        take: normalizedLimit,
      });

      return merchants.map((merchant) => ({
        merchantId: merchant.merchantId.toString(),
        merchantName: merchant.merchantName,
        merchantTypes: merchant.categoryAssignments.map(
          (assignment) => assignment.category.categoryName,
        ),
        description: merchant.description,
        address: merchant.address,
      }));
    }

    const merchants = await this.prisma.$queryRaw<
      Array<{
        merchant_id: bigint;
        merchant_name: string;
        merchant_types: string[];
        description: string | null;
        address: string | null;
      }>
    >(Prisma.sql`
      SELECT
        m.merchant_id,
        m.merchant_name,
        COALESCE(
          array_agg(c.category_name ORDER BY c.sort_order)
            FILTER (WHERE c.merchant_category_id IS NOT NULL AND c.status = 'ACTIVE'),
          ARRAY[]::VARCHAR[]
        ) AS merchant_types,
        m.description,
        m.address
      FROM merchants m
      LEFT JOIN merchant_category_assignments a
        ON a.merchant_id = m.merchant_id
      LEFT JOIN merchant_categories c
        ON c.merchant_category_id = a.merchant_category_id
      WHERE m.status = 'ACTIVE'
      GROUP BY m.merchant_id, m.merchant_name, m.description, m.address
      ORDER BY RANDOM()
      LIMIT ${normalizedLimit}
    `);

    return merchants.map((merchant) => ({
      merchantId: merchant.merchant_id.toString(),
      merchantName: merchant.merchant_name,
      merchantTypes: merchant.merchant_types,
      description: merchant.description,
      address: merchant.address,
    }));
  }

  private async assertActiveMerchant(merchantId: bigint): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
      select: { status: true },
    });

    if (merchant?.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'MERCHANT_NOT_ACTIVE',
        message: 'ร้านค้านี้ยังไม่ได้รับอนุมัติหรือถูกระงับการใช้งาน',
      });
    }
  }

  // ─── Categories ───────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.productCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { categoryName: 'asc' },
      select: {
        categoryId: true,
        categoryName: true,
        description: true,
      },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { categoryName: dto.categoryName },
    });
    if (existing) {
      throw new ConflictException('ชื่อหมวดหมู่นี้มีในระบบแล้ว');
    }
    const category = await this.prisma.productCategory.create({
      data: {
        categoryName: dto.categoryName,
        description: dto.description,
        status: 'ACTIVE',
      },
    });
    return {
      categoryId: category.categoryId.toString(),
      categoryName: category.categoryName,
      description: category.description,
    };
  }

  // ─── Products (FR-M02) ────────────────────────────────────────────────────────

  /**
   * FR-M02: ดึงรายการสินค้าของร้านค้า (รองรับทั้งเฉพาะ ACTIVE หรือรวม INACTIVE สำหรับโหมดจัดการสินค้า)
   */
  async listProducts(merchantId: bigint, includeInactive = false) {
    await this.assertActiveMerchant(merchantId);

    const products = await this.prisma.product.findMany({
      where: includeInactive
        ? { merchantId }
        : { merchantId, status: 'ACTIVE' },
      include: { category: true },
      orderBy: [
        { status: 'asc' },
        { isRecommended: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return products.map((p) => ({
      productId: p.productId.toString(),
      productName: p.productName,
      description: p.description,
      imageUrl: p.imageUrl ?? null,
      price: Number(p.price),
      status: p.status,
      isRecommended: p.isRecommended,
      categoryId: p.categoryId.toString(),
      categoryName: p.category.categoryName,
    }));
  }

  /**
   * FR-M02: Merchant สร้างสินค้าใหม่
   */
  async createProduct(merchantId: bigint, dto: CreateProductDto) {
    await this.assertActiveMerchant(merchantId);

    const category = await this.prisma.productCategory.findUnique({
      where: { categoryId: BigInt(dto.categoryId) },
    });
    if (!category || category.status !== 'ACTIVE') {
      throw new BadRequestException('ไม่พบหมวดหมู่สินค้า');
    }

    const product = await this.prisma.product.create({
      data: {
        merchantId,
        categoryId: BigInt(dto.categoryId),
        productName: dto.productName.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
        price: dto.price,
        status: 'ACTIVE',
        isRecommended: dto.isRecommended ?? false,
      },
      include: { category: true },
    });

    return {
      productId: product.productId.toString(),
      productName: product.productName,
      description: product.description,
      imageUrl: product.imageUrl ?? null,
      price: Number(product.price),
      status: product.status,
      isRecommended: product.isRecommended,
      categoryId: product.categoryId.toString(),
      categoryName: product.category.categoryName,
    };
  }

  /**
   * FR-M02: Merchant อัปเดตสินค้า (ไม่แก้ไข order_items ย้อนหลัง เพื่อรักษา Immutable Snapshot)
   */
  async updateProduct(
    merchantId: bigint,
    productId: bigint,
    dto: UpdateProductDto,
  ) {
    await this.assertActiveMerchant(merchantId);

    const product = await this.prisma.product.findUnique({
      where: { productId },
    });
    if (!product) {
      throw new NotFoundException('ไม่พบสินค้า');
    }
    if (product.merchantId !== merchantId) {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขสินค้าของร้านอื่น');
    }

    let categoryId = product.categoryId;
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.productCategory.findUnique({
        where: { categoryId: BigInt(dto.categoryId) },
      });
      if (!category || category.status !== 'ACTIVE') {
        throw new BadRequestException('ไม่พบหมวดหมู่สินค้า');
      }
      categoryId = BigInt(dto.categoryId);
    }

    const updated = await this.prisma.product.update({
      where: { productId },
      data: {
        productName:
          dto.productName !== undefined
            ? dto.productName.trim()
            : product.productName,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : product.description,
        imageUrl:
          dto.imageUrl !== undefined
            ? dto.imageUrl.trim() || null
            : product.imageUrl,
        price: dto.price !== undefined ? dto.price : product.price,
        categoryId,
        status: dto.status ?? product.status,
        isRecommended: dto.isRecommended ?? product.isRecommended,
        updatedAt: new Date(),
      },
      include: { category: true },
    });

    return {
      productId: updated.productId.toString(),
      productName: updated.productName,
      description: updated.description,
      imageUrl: updated.imageUrl ?? null,
      price: Number(updated.price),
      status: updated.status,
      isRecommended: updated.isRecommended,
      categoryId: updated.categoryId.toString(),
      categoryName: updated.category.categoryName,
    };
  }

  /**
   * FR-M02: Merchant เปิด/ปิดการขายสินค้า (ACTIVE / INACTIVE) โดยไม่ลบประวัติ
   */
  async updateProductStatus(
    merchantId: bigint,
    productId: bigint,
    status: ProductStatusValue,
  ) {
    await this.assertActiveMerchant(merchantId);

    const product = await this.prisma.product.findUnique({
      where: { productId },
    });
    if (!product) {
      throw new NotFoundException('ไม่พบสินค้า');
    }
    if (product.merchantId !== merchantId) {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขสถานะสินค้าของร้านอื่น');
    }

    const updated = await this.prisma.product.update({
      where: { productId },
      data: { status, updatedAt: new Date() },
      include: { category: true },
    });

    return {
      productId: updated.productId.toString(),
      productName: updated.productName,
      description: updated.description,
      imageUrl: updated.imageUrl ?? null,
      price: Number(updated.price),
      status: updated.status,
      isRecommended: updated.isRecommended,
      categoryId: updated.categoryId.toString(),
      categoryName: updated.category.categoryName,
    };
  }

  /**
   * FR-M02: Merchant ปิดการใช้งานสินค้า (soft delete -> INACTIVE)
   */
  async deleteProduct(merchantId: bigint, productId: bigint) {
    await this.assertActiveMerchant(merchantId);

    const product = await this.prisma.product.findUnique({
      where: { productId },
    });
    if (!product) {
      throw new NotFoundException('ไม่พบสินค้า');
    }
    if (product.merchantId !== merchantId) {
      throw new ForbiddenException('ไม่มีสิทธิ์ลบสินค้าของร้านอื่น');
    }

    await this.prisma.product.update({
      where: { productId },
      data: { status: 'INACTIVE', updatedAt: new Date() },
    });

    return {
      success: true,
      productId: productId.toString(),
      status: 'INACTIVE',
    };
  }
}
