import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/authorization/roles.decorator.js';
import { RolesGuard } from '../auth/authorization/roles.guard.js';
import { CatalogService } from './catalog.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
  UploadProductImageDto,
} from './dto/product.dto.js';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  // ─── Products (FR-M02) ────────────────────────────────────────────────────

  @Get('merchant/products')
  @Roles('MERCHANT')
  async listMyProducts(
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const merchantId = req.user!.activeMerchantId!;
    return this.catalogService.listProducts(
      merchantId,
      includeInactive === 'true',
    );
  }

  @Post('merchant/products/upload-image')
  @Roles('MERCHANT')
  async uploadProductImage(
    @Req() req: Request,
    @Body() dto: UploadProductImageDto,
  ) {
    const merchantId = req.user!.activeMerchantId!;
    return this.cloudinaryService.uploadProductImage(dto.dataUrl, merchantId);
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

  @Patch('merchant/products/:productId/status')
  @Roles('MERCHANT')
  async updateProductStatus(
    @Req() req: Request,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const merchantId = req.user!.activeMerchantId!;
    return this.catalogService.updateProductStatus(
      merchantId,
      BigInt(productId),
      dto.status,
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
