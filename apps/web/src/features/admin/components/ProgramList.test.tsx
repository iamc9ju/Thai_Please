import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ProgramList } from './ProgramList';
import { adminManagementCopy as copy } from '../admin-management.copy';
import type { SubsidyProgramItem } from '../admin.types';

afterEach(cleanup);
it('searches all projects and resets ten-item pagination on search (FR-A01)', () => {
  const programs: SubsidyProgramItem[] = Array.from(
    { length: 23 },
    (_, index) => ({
      programId: String(index),
      programName: `project-${index}`,
      initialGrant: 100,
      subsidyPercentage: 50,
      userPercentage: 50,
      dailySubsidyLimit: 50,
      currency: 'THB',
      timezone: 'Asia/Bangkok',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      createdAt: '2026-10-01',
      status: 'ACTIVE',
    }),
  );
  render(
    <ProgramList programs={programs}>
      {(program) => <p key={program.programId}>{program.programName}</p>}
    </ProgramList>,
  );
  expect(screen.getByText('project-9')).toBeInTheDocument();
  expect(screen.queryByText('project-10')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.rewardPage(3) }));
  expect(screen.getByText('project-22')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'project-0' },
  });
  expect(screen.getByText('project-0')).toBeInTheDocument();
  expect(screen.getByText(copy.nextPage)).toBeDisabled();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'missing' },
  });
  expect(screen.getByText(copy.programSearchEmpty)).toBeInTheDocument();
});
