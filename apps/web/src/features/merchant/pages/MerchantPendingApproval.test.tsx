import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MerchantPendingApproval } from './MerchantPendingApproval';

describe('MerchantPendingApproval (FR-AUTH-04, FR-M01)', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders pending approval message, merchant details, and masked citizen ID', () => {
    const handleLogout = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <MerchantPendingApproval
        merchantName="ร้านส้มตำป้าณี"
        citizenId="1100500123456"
        status="PENDING"
        merchantRole="OWNER"
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />,
    );

    expect(
      screen.getByText('อยู่ระหว่างการรออนุมัติจากผู้ดูแลระบบ'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('ร้านส้มตำป้าณี').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1-1005-xxxxx-45-6')).toBeInTheDocument();
    expect(screen.getAllByText('รออนุมัติ (PENDING)')).toHaveLength(2);
    expect(screen.getAllByText('เจ้าของร้าน (OWNER)')).toHaveLength(2);
    expect(
      screen.getByText('2. ตรวจสอบคุณสมบัติ'),
    ).toBeInTheDocument();
  });

  it('triggers onRefresh when clicking check status button', async () => {
    const handleRefresh = vi.fn().mockResolvedValue(undefined);
    const handleLogout = vi.fn();

    render(
      <MerchantPendingApproval
        merchantName="ร้านส้มตำป้าณี"
        citizenId="1100500123456"
        status="PENDING"
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />,
    );

    const refreshBtn = screen.getByRole('button', {
      name: /ตรวจสอบสถานะอีกครั้ง/i,
    });
    fireEvent.click(refreshBtn);

    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it('triggers onLogout when clicking logout button', () => {
    const handleLogout = vi.fn();

    render(
      <MerchantPendingApproval
        merchantName="ร้านส้มตำป้าณี"
        citizenId="1100500123456"
        status="PENDING"
        onLogout={handleLogout}
      />,
    );

    const logoutButtons = screen.getAllByRole('button', {
      name: /ออกจากระบบ/i,
    });
    fireEvent.click(logoutButtons[0]!);

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('renders suspended alert when status is SUSPENDED', () => {
    render(
      <MerchantPendingApproval
        merchantName="ร้านป้าสมศรี"
        citizenId="1100500123456"
        status="SUSPENDED"
        onLogout={vi.fn()}
      />,
    );

    expect(
      screen.getByText('ร้านค้านี้ถูกระงับการใช้งานชั่วคราว'),
    ).toBeInTheDocument();
  });

  it('renders rejected alert when status is REJECTED', () => {
    render(
      <MerchantPendingApproval
        merchantName="ร้านป้าสมศรี"
        citizenId="1100500123456"
        status="REJECTED"
        onLogout={vi.fn()}
      />,
    );

    expect(
      screen.getByText('ใบสมัครร้านค้าไม่ผ่านการอนุมัติ'),
    ).toBeInTheDocument();
  });
});
