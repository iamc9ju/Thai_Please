import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';

@Module({
  controllers: [CatalogController, OrderController],
  exports: [CatalogService, OrderService],
  providers: [CatalogService, OrderService],
})
export class CommerceModule {}
