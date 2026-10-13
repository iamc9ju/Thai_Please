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
  UpdateProductDto,
} from './dto/product.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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

  // ─── Products ─────────────────────────────────────────────────────────────────

  /**
   * FR-M01: ดึงรายการสินค้าของร้านค้า
   */
  async listProducts(merchantId: bigint) {
    const products = await this.prisma.product.findMany({
      where: { merchantId, status: 'ACTIVE' },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
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
   * FR-M01: Merchant สร้างสินค้าใหม่
   */
  async createProduct(merchantId: bigint, dto: CreateProductDto) {
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
        productName: dto.productName,
        description: dto.description,
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
   * FR-M01: Merchant อัปเดตสินค้า
   */
  async updateProduct(
    merchantId: bigint,
    productId: bigint,
    dto: UpdateProductDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { productId },
    });
    if (!product || product.status !== 'ACTIVE') {
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
        productName: dto.productName ?? product.productName,
        description:
          dto.description !== undefined ? dto.description : product.description,
        price: dto.price !== undefined ? dto.price : product.price,
        categoryId,
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
   * FR-M01: Merchant ลบสินค้า (soft delete)
   */
  async deleteProduct(merchantId: bigint, productId: bigint) {
    const product = await this.prisma.product.findUnique({
      where: { productId },
    });
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException('ไม่พบสินค้า');
    }
    if (product.merchantId !== merchantId) {
      throw new ForbiddenException('ไม่มีสิทธิ์ลบสินค้าของร้านอื่น');
    }

    await this.prisma.product.update({
      where: { productId },
      data: { status: 'INACTIVE', updatedAt: new Date() },
    });

    return { success: true };
  }
}
