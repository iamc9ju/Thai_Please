import {
  CONSUMER_QUEST_ASSIGNMENT_PATH,
  QUEST_CANCEL_PATH_SUFFIX,
  QUEST_CANCELLATION_PATH_SUFFIX,
  type ConsumerQuestCancellationPreview,
  type ConsumerQuestCancellationResponse,
} from '@thai-please/contracts';
import { apiClient } from '../../../lib/api-client';

function assignmentPath(id: string) {
  return CONSUMER_QUEST_ASSIGNMENT_PATH.replace(
    ':assignmentId',
    encodeURIComponent(id),
  );
}

function parsePreview(
  value: unknown,
  id: string,
): ConsumerQuestCancellationPreview {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('assignmentId' in value) ||
    value.assignmentId !== id ||
    !('nextEligibleAt' in value) ||
    typeof value.nextEligibleAt !== 'string' ||
    !Number.isFinite(Date.parse(value.nextEligibleAt))
  ) {
    throw new Error('QUEST_CANCELLATION_INVALID_RESPONSE');
  }
  return { assignmentId: id, nextEligibleAt: value.nextEligibleAt };
}

export async function getQuestCancellation(id: string, signal: AbortSignal) {
  return parsePreview(
    await apiClient.get<unknown>(
      `${assignmentPath(id)}/${QUEST_CANCELLATION_PATH_SUFFIX}`,
      { signal },
    ),
    id,
  );
}

export async function cancelQuest(
  id: string,
): Promise<ConsumerQuestCancellationResponse> {
  const value = await apiClient.post<unknown>(
    `${assignmentPath(id)}/${QUEST_CANCEL_PATH_SUFFIX}`,
    {},
  );
  const preview = parsePreview(value, id);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('status' in value) ||
    value.status !== 'CANCELLED'
  ) {
    throw new Error('QUEST_CANCELLATION_INVALID_RESPONSE');
  }
  return { ...preview, status: 'CANCELLED' };
}
