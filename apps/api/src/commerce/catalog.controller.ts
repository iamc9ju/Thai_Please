import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthActor } from '../auth/auth.types.js';
import { HTTP_HEADERS } from '../common/http/http.constants.js';
import { CatalogService } from './catalog.service.js';
import { CreateProductDto, UpdateProductDto } from './dto/catalog.dto.js';

@ApiTags('Merchant catalog')
@ApiBearerAuth()
@Controller({ version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('merchant-categories') merchantCategories(): Promise<unknown> {
    return this.catalog.merchantCategories();
  }
  @Get('product-categories') productCategories(): Promise<unknown> {
    return this.catalog.categories();
  }
  @Get('merchants') merchants(): Promise<unknown> {
    return this.catalog.merchants();
  }
  @Get('merchants/:id') merchant(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    return this.catalog.merchant(id);
  }

  @Get('products')
  @ApiQuery({ name: 'merchant_id', required: false, type: Number })
  products(@Query('merchant_id') merchantId?: string): Promise<unknown> {
    return this.catalog.products(
      merchantId === undefined ? undefined : Number(merchantId),
    );
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product for an authorized merchant' })
  create(
    @CurrentActor() actor: AuthActor,
    @Body() body: CreateProductDto,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.catalog.create(
      actor,
      body,
      request.header(HTTP_HEADERS.requestId) ?? 'missing-request-id',
    );
  }

  @Patch('products/:id')
  update(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductDto,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.catalog.update(
      actor,
      id,
      body,
      request.header(HTTP_HEADERS.requestId) ?? 'missing-request-id',
    );
  }

  @Delete('products/:id')
  deactivate(
    @CurrentActor() actor: AuthActor,
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ): Promise<unknown> {
    const body = new UpdateProductDto();
    body.active = false;
    return this.catalog.update(
      actor,
      id,
      body,
      request.header(HTTP_HEADERS.requestId) ?? 'missing-request-id',
    );
  }
}
