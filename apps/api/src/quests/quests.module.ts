import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { GeminiQuestProvider } from './gemini.provider.js';
import { QuestsController } from './quests.controller.js';
import { QuestsRepository } from './quests.repository.js';
import { QuestsService } from './quests.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [QuestsController],
  providers: [QuestsRepository, GeminiQuestProvider, QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}
