import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { PublicCatalogController } from './public-catalog.controller.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CatalogController, PublicCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
