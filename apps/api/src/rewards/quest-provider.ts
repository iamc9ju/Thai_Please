export type QuestFeatures = {
  averageFinalAmount: number;
  preferredCategoryId?: number;
};

export type QuestProposal = {
  title: string;
  description: string;
  minimumAmount: number;
  categoryId?: number;
  rewardPoints: number;
  provider: string;
  modelVersion: string;
  policyVersion: string;
};

export abstract class QuestProposalProvider {
  abstract propose(features: QuestFeatures): Promise<QuestProposal>;
}

export class HistoryQuestProposalProvider extends QuestProposalProvider {
  async propose(features: QuestFeatures): Promise<QuestProposal> {
    const minimumAmount = Math.max(1, features.averageFinalAmount);
    return {
      title: `Spend ${minimumAmount} baht in one order`,
      description: `Complete one successful post-discount purchase of at least ${minimumAmount} baht.`,
      minimumAmount,
      ...(features.preferredCategoryId === undefined
        ? {}
        : { categoryId: features.preferredCategoryId }),
      rewardPoints: 20,
      provider: 'mock-history-provider',
      modelVersion: 'deterministic-v1',
      policyVersion: 'prototype-v1',
    };
  }
}
