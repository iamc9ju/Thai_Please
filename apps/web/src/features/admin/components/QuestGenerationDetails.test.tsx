import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuestGenerationDetails } from './QuestGenerationDetails';
import type { QuestGenerationLogItem } from '../admin.types';
import { adminManagementCopy as copy } from '../admin-management.copy';
const log: QuestGenerationLogItem = {
  generationId: '1',
  requestKey: null,
  status: 'LEGACY',
  provider: null,
  modelVersion: null,
  promptVersion: null,
  policyVersion: null,
  selectionReason: null,
  reservedPoints: 0,
  generatedAt: '2026-10-01T00:00:00.000Z',
  finishedAt: null,
  user: { userId: '1', fullName: 'ผู้ใช้ทดสอบ', citizenIdMasked: 'X-XXXX' },
  actor: null,
  quest: null,
  assignment: null,
};
afterEach(cleanup);
describe('FR-A05 stored quest evidence', () => {
  it('does not invent proposal or successful validation for legacy logs', () => {
    render(<QuestGenerationDetails log={log} />);
    expect(screen.getByText(copy.noProposal)).toBeInTheDocument();
    expect(screen.getByText(copy.noValidation)).toBeInTheDocument();
    expect(screen.queryByText(copy.assignmentEvidence)).not.toBeInTheDocument();
  });
  it('shows stored assignment rules and escapes untrusted proposal text', () => {
    const maliciousTitle = '<script>window.attack=true</script>';
    const { container } = render(
      <QuestGenerationDetails
        log={{
          ...log,
          proposal: {
            questId: '31',
            questName: maliciousTitle,
            questType: 'SPEND',
            minSpend: 100,
            rewardPoint: 10,
            durationDays: 7,
          },
          candidates: [
            {
              questName: 'ซื้อสินค้าชุมชน',
              questType: 'SPEND',
              minSpend: 100,
              rewardPoint: 10,
            },
          ],
          validationResult: {
            status: 'ACCEPTED',
            evidence: 'ASSIGNED_QUEST_RULE',
          },
        }}
      />,
    );
    expect(screen.getByText(maliciousTitle)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(copy.assignmentEvidence)).toBeInTheDocument();
    expect(screen.getByText('ซื้อสินค้าชุมชน')).toBeInTheDocument();
  });
});
