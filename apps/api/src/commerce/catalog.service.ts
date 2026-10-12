import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthActor } from '../auth/auth.types.js';
import {
  DomainException,
  DOMAIN_ERRORS,
} from '../common/domain/domain-errors.js';
import { PROTOTYPE_MONEY } from '../common/policy/prototype-policy.service.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import type { CreateProductDto, UpdateProductDto } from './dto/catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  categories(): Promise<unknown> {
    return this.prisma.productCategory.findMany({
      where: { active: true },
      orderBy: { id: 'asc' },
    });
  }

  merchantCategories(): Promise<unknown> {
    return this.prisma.merchantCategory.findMany({
      where: { active: true },
      orderBy: { id: 'asc' },
    });
  }

  merchants(): Promise<unknown> {
    return this.prisma.merchant.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { id: 'asc' },
    });
  }

  async merchant(id: number): Promise<unknown> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id },
      include: { category: true },
    });
    if (merchant === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    return merchant;
  }

  products(merchantId?: number): Promise<unknown> {
    return this.prisma.product.findMany({
      where: {
        active: true,
        ...(merchantId === undefined ? {} : { merchantId }),
      },
      include: { category: true },
      orderBy: { id: 'asc' },
    });
  }

  async create(
    actor: AuthActor,
    input: CreateProductDto,
    correlationId: string,
  ): Promise<unknown> {
    await this.requireMerchant(actor, input.merchant_id);
    const category = await this.prisma.productCategory.findFirst({
      where: { id: input.category_id, active: true },
    });
    if (category === null)
      throw new DomainException(
        DOMAIN_ERRORS.invalidProduct,
        HttpStatus.BAD_REQUEST,
      );
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({
        data: {
          merchantId: input.merchant_id,
          categoryId: input.category_id,
          name: input.name.trim(),
          price: input.price,
          currency: PROTOTYPE_MONEY.currency,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'product.created',
          targetType: 'product',
          targetId: String(product.id),
          result: 'success',
          correlationId,
        },
      });
      return product;
    });
  }

  async update(
    actor: AuthActor,
    id: number,
    input: UpdateProductDto,
    correlationId: string,
  ): Promise<unknown> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (product === null)
      throw new DomainException(DOMAIN_ERRORS.notFound, HttpStatus.NOT_FOUND);
    await this.requireMerchant(actor, product.merchantId);
    if (input.category_id !== undefined) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: input.category_id, active: true },
      });
      if (category === null)
        throw new DomainException(
          DOMAIN_ERRORS.invalidProduct,
          HttpStatus.BAD_REQUEST,
        );
    }
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.product.update({
        where: { id },
        data: {
          ...(input.category_id === undefined
            ? {}
            : { categoryId: input.category_id }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.price === undefined ? {} : { price: input.price }),
          ...(input.active === undefined ? {} : { active: input.active }),
          version: { increment: 1 },
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'product.updated',
          targetType: 'product',
          targetId: String(id),
          result: 'success',
          correlationId,
        },
      });
      return updated;
    });
  }

  async requireMerchant(actor: AuthActor, merchantId: number): Promise<void> {
    if (actor.role === 'ADMIN') return;
    if (actor.role !== 'MERCHANT')
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
    const membership = await this.prisma.merchantMember.findUnique({
      where: { merchantId_userId: { merchantId, userId: actor.userId } },
    });
    if (membership === null)
      throw new DomainException(DOMAIN_ERRORS.forbidden, HttpStatus.FORBIDDEN);
  }
}
