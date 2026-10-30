import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { cancelQuest, getQuestCancellation } from './quest-cancellation.api';
vi.mock('../../../lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
const preview = {
  assignmentId: '41',
  nextEligibleAt: '2026-11-06T07:30:00.000Z',
};
beforeEach(() => vi.resetAllMocks());
describe('FR-C07 cancellation API boundary', () => {
  it('sends an empty mutation body without actor or entitlement overrides', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...preview,
      status: 'CANCELLED',
    });
    expect(await cancelQuest(preview.assignmentId)).toEqual({
      ...preview,
      status: 'CANCELLED',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/consumer/quests/41/cancel',
      {},
    );
  });
  it.each([
    null,
    {},
    { ...preview, assignmentId: '42' },
    { ...preview, nextEligibleAt: 'invalid' },
  ])('rejects malformed or mismatched preview %j', async (payload) => {
    vi.mocked(apiClient.get).mockResolvedValue(payload);
    await expect(
      getQuestCancellation(preview.assignmentId, new AbortController().signal),
    ).rejects.toThrow('QUEST_CANCELLATION_INVALID_RESPONSE');
  });
  it('does not report success for a response with another status', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...preview,
      status: 'ACTIVE',
    });
    await expect(cancelQuest(preview.assignmentId)).rejects.toThrow(
      'QUEST_CANCELLATION_INVALID_RESPONSE',
    );
  });
});
