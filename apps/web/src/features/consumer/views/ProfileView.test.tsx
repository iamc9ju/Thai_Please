import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { getConsumerProfile } from '../api/profile.api';
import { ProfileView } from './ProfileView';
vi.mock('../api/profile.api', () => ({ getConsumerProfile: vi.fn() }));
afterEach(cleanup);
const read = vi.mocked(getConsumerProfile);
const profile = {
  fullName: 'ผู้ใช้จากฐานข้อมูล',
  maskedCitizenId: 'X-XXXX-1234',
  role: 'CONSUMER',
  phone: '0812345678',
  address: '99 แขวงทดสอบ เขตทดสอบ กรุงเทพ 10200',
} as const;
const copy = th.consumerPortal.profile;
beforeEach(() => {
  read.mockReset();
  read.mockResolvedValue(profile);
});
describe('FR-C01 persisted profile', () => {
  it('loads actual account data without mock content', async () => {
    render(<ProfileView />);
    expect(screen.getByText(copy.loading)).toBeInTheDocument();
    expect(await screen.findByText(profile.phone)).toBeInTheDocument();
    expect(screen.getByText(profile.address)).toBeInTheDocument();
    expect(screen.getByText(profile.maskedCitizenId)).toBeInTheDocument();
    expect(screen.queryByText('08X-XXX-4567')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: copy.changePassword }),
    ).toBeDisabled();
  });
  it('shows missing fields honestly', async () => {
    read.mockResolvedValue({ ...profile, phone: null, address: null });
    render(<ProfileView />);
    expect(await screen.findAllByText(copy.notProvided)).toHaveLength(2);
  });
  it('retries a failed read without showing stale personal data', async () => {
    read.mockRejectedValueOnce(new Error('offline'));
    render(<ProfileView />);
    fireEvent.click(await screen.findByRole('button', { name: copy.retry }));
    expect(await screen.findByText(profile.phone)).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403])('handles permission status %s', async (status) => {
    read.mockRejectedValue(new ApiError(status, 'denied'));
    render(<ProfileView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      copy.permissionDenied,
    );
    expect(screen.queryByText(profile.phone)).not.toBeInTheDocument();
  });
});
