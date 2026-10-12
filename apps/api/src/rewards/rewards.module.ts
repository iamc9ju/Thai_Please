import { Module } from '@nestjs/common';
import {
  HistoryQuestProposalProvider,
  QuestProposalProvider,
} from './quest-provider.js';
import { RewardsController } from './rewards.controller.js';
import { RewardsService } from './rewards.service.js';

@Module({
  controllers: [RewardsController],
  exports: [RewardsService],
  providers: [
    RewardsService,
    { provide: QuestProposalProvider, useClass: HistoryQuestProposalProvider },
  ],
})
export class RewardsModule {}
