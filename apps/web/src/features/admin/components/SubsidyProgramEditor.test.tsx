import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsidyProgramEditor } from './SubsidyProgramEditor';
import { adminManagementCopy as copy } from '../admin-management.copy';
import { th } from '../../../i18n/th';
import * as api from '../api/admin.api';
import type { SubsidyProgramItem } from '../admin.types';
vi.mock('../api/admin.api', () => ({ updateSubsidyProgram: vi.fn() }));
const fixture: SubsidyProgramItem = {
  programId: '21',
  programName: 'โครงการทดสอบ',
  initialGrant: 1000,
  subsidyPercentage: 60,
  userPercentage: 40,
  dailySubsidyLimit: 200,
  currency: 'THB',
  timezone: 'Asia/Bangkok',
  status: 'ACTIVE',
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
};
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
describe('FR-A04 existing program editor', () => {
  it('sends edited values to the existing program and replaces the displayed record', async () => {
    const updated = { ...fixture, programName: 'โครงการแก้ไข' };
    vi.mocked(api.updateSubsidyProgram).mockResolvedValue(updated);
    const onSaved = vi.fn();
    render(<SubsidyProgramEditor program={fixture} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: copy.programEdit }));
    fireEvent.change(
      screen.getByLabelText(th.adminPortal.programs.programNameLabel),
      { target: { value: updated.programName } },
    );
    fireEvent.click(screen.getByRole('button', { name: copy.programSave }));
    await waitFor(() =>
      expect(api.updateSubsidyProgram).toHaveBeenCalledWith('21', {
        programName: updated.programName,
        initialGrant: 1000,
        subsidyPercentage: 60,
        dailySubsidyLimit: 200,
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(await screen.findByRole('status')).toHaveTextContent(
      copy.programSaved,
    );
  });
  it('rejects reversed dates without a mutation', async () => {
    render(<SubsidyProgramEditor program={fixture} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: copy.programEdit }));
    fireEvent.change(
      screen.getByLabelText(th.adminPortal.programs.endDateLabel),
      { target: { value: '2026-09-30' } },
    );
    fireEvent.click(screen.getByRole('button', { name: copy.programSave }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.dateOrder);
    expect(api.updateSubsidyProgram).not.toHaveBeenCalled();
  });
  it('keeps edits and shows failure when the API refuses a historical policy change', async () => {
    vi.mocked(api.updateSubsidyProgram).mockRejectedValue(
      new Error('internal database detail'),
    );
    render(<SubsidyProgramEditor program={fixture} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: copy.programEdit }));
    fireEvent.click(screen.getByRole('button', { name: copy.programSave }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.failed);
    expect(
      screen.queryByText('internal database detail'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(th.adminPortal.programs.programNameLabel),
    ).toHaveValue(fixture.programName);
  });
  it('explains why economic terms cannot be edited after the policy has references', () => {
    render(<SubsidyProgramEditor program={{ ...fixture, walletTransactionCount: 1 }} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: copy.programEdit })).toBeDisabled();
    expect(screen.getByText(copy.programPolicyNote)).toBeInTheDocument();
    expect(api.updateSubsidyProgram).not.toHaveBeenCalled();
  });

});
