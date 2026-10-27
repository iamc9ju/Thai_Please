import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return products.map((p) => ({
      productId: p.productId.toString(),
      productName: p.productName,
      description: p.description,
      price: Number(p.price),
      status: p.status,
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
        price: dto.price,
        status: 'ACTIVE',
      },
      include: { category: true },
    });

    return {
      productId: product.productId.toString(),
      productName: product.productName,
      description: product.description,
      price: Number(product.price),
      status: product.status,
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
        price: dto.price !== undefined ? dto.price : product.price,
        categoryId,
        status: dto.status ?? product.status,
        updatedAt: new Date(),
      },
      include: { category: true },
    });

    return {
      productId: updated.productId.toString(),
      productName: updated.productName,
      description: updated.description,
      price: Number(updated.price),
      status: updated.status,
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
      price: Number(updated.price),
      status: updated.status,
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
