import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';

describe('CatalogService (FR-M02)', () => {
  const mockPrisma = {
    merchant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    productCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };

  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    service = new CatalogService(mockPrisma as never);
  });

  it('returns ten random ACTIVE merchants for public recommendations', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        merchant_id: 9n,
        merchant_name: 'ร้านชุมชนสุขใจ',
        merchant_types: ['อาหารและเครื่องดื่ม'],
        description: 'ร้านอาหารชุมชน',
        address: 'กรุงเทพมหานคร',
      },
    ]);

    const merchants = await service.listPublicMerchants(undefined, 10);

    expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    expect(merchants).toEqual([
      {
        merchantId: '9',
        merchantName: 'ร้านชุมชนสุขใจ',
        merchantTypes: ['อาหารและเครื่องดื่ม'],
        description: 'ร้านอาหารชุมชน',
        address: 'กรุงเทพมหานคร',
      },
    ]);
  });

  it('searches only ACTIVE merchants by public fields', async () => {
    mockPrisma.merchant.findMany.mockResolvedValueOnce([
      {
        merchantId: 10n,
        merchantName: 'ร้านน้ำสมุนไพรไทย',
        merchantTypes: ['เครื่องดื่ม'],
        description: null,
        address: 'เชียงใหม่',
      },
    ]);

    const merchants = await service.listPublicMerchants('สมุนไพร', 10);

    expect(mockPrisma.merchant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
        take: 10,
      }),
    );
    expect(merchants[0]?.merchantName).toBe('ร้านน้ำสมุนไพรไทย');
  });

  it('lists only ACTIVE products by default and all products when includeInactive=true', async () => {
    mockPrisma.product.findMany.mockResolvedValueOnce([
      {
        productId: 1n,
        productName: 'ข้าวกะเพราไก่',
        description: 'สูตรดั้งเดิม',
        price: 55,
        status: 'ACTIVE',
        isRecommended: true,
        categoryId: 10n,
        category: { categoryName: 'อาหารตามสั่ง' },
      },
    ]);

    const activeOnly = await service.listProducts(100n, false);
    expect(mockPrisma.merchant.findUnique).toHaveBeenCalledWith({
      where: { merchantId: 100n },
      select: { status: true },
    });
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 100n, status: 'ACTIVE' },
        orderBy: [
          { status: 'asc' },
          { isRecommended: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    );
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0]?.isRecommended).toBe(true);

    mockPrisma.product.findMany.mockResolvedValueOnce([
      {
        productId: 1n,
        productName: 'ข้าวกะเพราไก่',
        description: 'สูตรดั้งเดิม',
        price: 55,
        status: 'ACTIVE',
        isRecommended: true,
        categoryId: 10n,
        category: { categoryName: 'อาหารตามสั่ง' },
      },
      {
        productId: 2n,
        productName: 'เมนูตามฤดูกาล',
        description: null,
        price: 75,
        status: 'INACTIVE',
        isRecommended: false,
        categoryId: 10n,
        category: { categoryName: 'อาหารตามสั่ง' },
      },
    ]);

    const withInactive = await service.listProducts(100n, true);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 100n },
      }),
    );
    expect(withInactive).toHaveLength(2);
    expect(withInactive[1]?.status).toBe('INACTIVE');
  });

  it('creates a recommended product when requested', async () => {
    mockPrisma.productCategory.findUnique.mockResolvedValueOnce({
      categoryId: 10n,
      categoryName: 'อาหารตามสั่ง',
      status: 'ACTIVE',
    });
    mockPrisma.product.create.mockResolvedValueOnce({
      productId: 3n,
      productName: 'เมนูแนะนำ',
      description: null,
      price: 80,
      status: 'ACTIVE',
      isRecommended: true,
      categoryId: 10n,
      category: { categoryName: 'อาหารตามสั่ง' },
    });

    const created = await service.createProduct(100n, {
      productName: 'เมนูแนะนำ',
      price: 80,
      categoryId: 10,
      isRecommended: true,
    });

    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isRecommended: true }),
      }),
    );
    expect(created.isRecommended).toBe(true);
  });

  it('blocks catalog reads and writes when the merchant is not ACTIVE', async () => {
    const inactiveOperations = [
      {
        status: 'PENDING',
        execute: () => service.listProducts(100n),
      },
      {
        status: 'REJECTED',
        execute: () =>
          service.createProduct(100n, {
            productName: 'สินค้าใหม่',
            price: 50,
            categoryId: 10,
          }),
      },
      {
        status: 'SUSPENDED',
        execute: () => service.updateProduct(100n, 5n, { price: 60 }),
      },
      {
        status: 'SUSPENDED',
        execute: () => service.updateProductStatus(100n, 5n, 'INACTIVE'),
      },
      {
        status: 'SUSPENDED',
        execute: () => service.deleteProduct(100n, 5n),
      },
    ] as const;

    for (const operation of inactiveOperations) {
      mockPrisma.merchant.findUnique.mockResolvedValueOnce({
        status: operation.status,
      });
      await expect(operation.execute()).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MERCHANT_NOT_ACTIVE' }),
      });
    }

    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.product.create).not.toHaveBeenCalled();
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.productCategory.findUnique).not.toHaveBeenCalled();
  });

  it('updates product details and status for the owning merchant without mutating order snapshots', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({
      productId: 5n,
      merchantId: 100n,
      categoryId: 10n,
      productName: 'ชาไทยโบราณ',
      description: 'หวานปกติ',
      price: 35,
      status: 'INACTIVE',
      isRecommended: false,
    });
    mockPrisma.productCategory.findUnique.mockResolvedValueOnce({
      categoryId: 11n,
      categoryName: 'เครื่องดื่มสมุนไพร',
      status: 'ACTIVE',
    });
    mockPrisma.product.update.mockResolvedValueOnce({
      productId: 5n,
      merchantId: 100n,
      categoryId: 11n,
      productName: 'ชาไทยสูตรเข้มข้น',
      description: 'หวานน้อย หอมใบชา',
      price: 40,
      status: 'ACTIVE',
      isRecommended: true,
      category: { categoryName: 'เครื่องดื่มสมุนไพร' },
    });

    const updated = await service.updateProduct(100n, 5n, {
      productName: 'ชาไทยสูตรเข้มข้น',
      description: 'หวานน้อย หอมใบชา',
      price: 40,
      categoryId: 11,
      status: 'ACTIVE',
      isRecommended: true,
    });

    expect(updated).toEqual({
      productId: '5',
      productName: 'ชาไทยสูตรเข้มข้น',
      description: 'หวานน้อย หอมใบชา',
      price: 40,
      status: 'ACTIVE',
      isRecommended: true,
      categoryId: '11',
      categoryName: 'เครื่องดื่มสมุนไพร',
    });
  });

  it('rejects updating or toggling status of a product owned by another merchant', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      productId: 5n,
      merchantId: 999n,
      categoryId: 10n,
      productName: 'สินค้าของร้านอื่น',
      description: null,
      price: 50,
      status: 'ACTIVE',
      isRecommended: false,
    });

    await expect(
      service.updateProduct(100n, 5n, { price: 60 }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.updateProductStatus(100n, 5n, 'INACTIVE'),
    ).rejects.toThrow(ForbiddenException);

    await expect(service.deleteProduct(100n, 5n)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('toggles product status between ACTIVE and INACTIVE', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({
      productId: 8n,
      merchantId: 100n,
      categoryId: 10n,
      productName: 'ขนมครกโบราณ',
      description: 'ชุด 6 คู่',
      price: 30,
      status: 'ACTIVE',
      isRecommended: false,
    });
    mockPrisma.product.update.mockResolvedValueOnce({
      productId: 8n,
      merchantId: 100n,
      categoryId: 10n,
      productName: 'ขนมครกโบราณ',
      description: 'ชุด 6 คู่',
      price: 30,
      status: 'INACTIVE',
      isRecommended: false,
      category: { categoryName: 'ของหวาน' },
    });

    const deactivated = await service.updateProductStatus(100n, 8n, 'INACTIVE');
    expect(deactivated.status).toBe('INACTIVE');
  });

  it('throws NotFoundException or BadRequestException on missing product or invalid category', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateProduct(100n, 404n, { productName: 'ไม่พบ' }),
    ).rejects.toThrow(NotFoundException);

    mockPrisma.productCategory.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createProduct(100n, {
        productName: 'สินค้าใหม่',
        price: 50,
        categoryId: 999,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
