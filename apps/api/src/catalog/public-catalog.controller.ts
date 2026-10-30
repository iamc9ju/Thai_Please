import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { PublicMerchantsQueryDto } from './dto/public-merchants-query.dto.js';

@Controller('public')
export class PublicCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('merchants')
  listMerchants(@Query() query: PublicMerchantsQueryDto) {
    return this.catalogService.listPublicMerchants(query.search, query.limit);
  }
}
