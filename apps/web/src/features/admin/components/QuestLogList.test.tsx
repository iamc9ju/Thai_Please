import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { QuestLogList } from './QuestLogList';
import { questLogCopy as copy } from '../quest-log.copy';
import { adminManagementCopy } from '../admin-management.copy';
import type { QuestGenerationLogItem } from '../admin.types';

afterEach(cleanup);
const logs: QuestGenerationLogItem[] = Array.from(
  { length: 23 },
  (_, index) => ({
    generationId: String(index + 1),
    requestKey: null,
    status: index % 2 ? 'FAILED' : 'ASSIGNED',
    provider: null,
    modelVersion: null,
    promptVersion: null,
    policyVersion: null,
    selectionReason: null,
    reservedPoints: 0,
    generatedAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
    finishedAt: null,
    user: { userId: '1', fullName: 'test', citizenIdMasked: 'xxx' },
    actor: null,
    quest: null,
    assignment: null,
  }),
);

it('sorts by date before ten-row pagination without status controls (FR-A05)', () => {
  render(
    <QuestLogList logs={logs}>
      {(log) => <p key={log.generationId}>log-{log.generationId}</p>}
    </QuestLogList>,
  );
  expect(screen.getByText('log-23')).toBeInTheDocument();
  expect(screen.queryByText('log-13')).toBeNull();
  fireEvent.click(screen.getByText(adminManagementCopy.nextPage));
  expect(screen.getByText('log-13')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(copy.sort), {
    target: { value: 'oldest' },
  });
  expect(screen.getByText('log-1')).toBeInTheDocument();
  expect(screen.queryByText('log-11')).toBeNull();
  expect(
    screen.queryByRole('combobox', { name: 'สถานะ' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'A–Z' })).not.toBeInTheDocument();
});
