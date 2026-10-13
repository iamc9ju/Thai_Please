import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { CatalogService } from './catalog.service.js';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
} from './dto/product.dto.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ─── Categories (any authenticated role can read) ─────────────────────────

  @Get('catalog/categories')
  @Roles('MERCHANT', 'CONSUMER', 'ADMIN')
  async listCategories() {
    return this.catalogService.listCategories();
  }

  @Post('catalog/categories')
  @Roles('ADMIN')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  @Get('merchant/products')
  @Roles('MERCHANT')
  async listMyProducts(@Req() req: Request) {
    const merchantId = req.user!.activeMerchantId!;
    return this.catalogService.listProducts(merchantId);
  }

  @Post('merchant/products')
  @Roles('MERCHANT')
  async createProduct(@Req() req: Request, @Body() dto: CreateProductDto) {
    const merchantId = req.user!.activeMerchantId!;
    return this.catalogService.createProduct(merchantId, dto);
  }

  @Put('merchant/products/:productId')
  @Roles('MERCHANT')
  async updateProduct(
    @Req() req: Request,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
  ) {
    const merchantId = req.user!.activeMerchantId!;
    return this.catalogService.updateProduct(
      merchantId,
      BigInt(productId),
      dto,
    );
  }

  @Delete('merchant/products/:productId')
  @Roles('MERCHANT')
  @HttpCode(HttpStatus.OK)
  async deleteProduct(
    @Req() req: Request,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const merchantId = req.user!.activeMerchantId!;
    return this.catalogService.deleteProduct(merchantId, BigInt(productId));
  }
}
