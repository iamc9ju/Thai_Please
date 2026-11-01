import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { MerchantSidebar } from './MerchantSidebar';

describe('MerchantSidebar (Role-based Navigation & Layout)', () => {
  afterEach(cleanup);

  it('renders all navigation items for OWNER role', () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();
    const onCloseMobile = vi.fn();

    render(
      <MerchantSidebar
        activeView="pos"
        merchantName="ร้านทดสอบใจดี"
        merchantRole="OWNER"
        citizenId="1100000000001"
        hasActiveQr={false}
        isMobileOpen={false}
        onCloseMobile={onCloseMobile}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />,
    );

    // Active POS button
    const posBtn = screen.getByRole('button', {
      name: th.merchantPortal.nav.pos,
    });
    expect(posBtn).toBeInTheDocument();
    expect(posBtn).toHaveAttribute('aria-current', 'page');

    // Orders button
    expect(
      screen.getByRole('button', { name: th.merchantPortal.nav.orders }),
    ).toBeInTheDocument();

    // Owner specific buttons (Wallet & Dashboard)
    expect(
      screen.getByRole('button', { name: th.merchantPortal.nav.wallet }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.merchantPortal.nav.dashboard }),
    ).toBeInTheDocument();

    // QR should not be rendered if hasActiveQr is false
    expect(
      screen.queryByRole('button', { name: th.merchantPortal.nav.qr }),
    ).not.toBeInTheDocument();

    // Profile card displays Owner info
    expect(screen.getByText('ร้านทดสอบใจดี')).toBeInTheDocument();
    expect(screen.getAllByText(/เจ้าของร้าน/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/X-XXXX-0001/)).toBeInTheDocument();

    // Clicking navigation calls onNavigate
    fireEvent.click(
      screen.getByRole('button', { name: th.merchantPortal.nav.wallet }),
    );
    expect(onNavigate).toHaveBeenCalledWith('wallet');
    expect(onCloseMobile).toHaveBeenCalled();

    // Clicking logout calls onLogout
    fireEvent.click(
      screen.getByRole('button', { name: th.merchantPortal.logout }),
    );
    expect(onLogout).toHaveBeenCalled();
  });

  it('filters out wallet and dashboard for STAFF role', () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();

    render(
      <MerchantSidebar
        activeView="pos"
        merchantName="ร้านทดสอบใจดี"
        merchantRole="STAFF"
        citizenId="1100000000002"
        hasActiveQr={false}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />,
    );

    // Operational items allowed
    expect(
      screen.getByRole('button', { name: th.merchantPortal.nav.pos }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.merchantPortal.nav.orders }),
    ).toBeInTheDocument();

    // Restricted items hidden from staff
    expect(
      screen.queryByRole('button', { name: th.merchantPortal.nav.wallet }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: th.merchantPortal.nav.dashboard }),
    ).not.toBeInTheDocument();

    // Displays staff role
    expect(screen.getByText(/พนักงานร้าน/)).toBeInTheDocument();
  });

  it('renders QR navigation item when hasActiveQr is true', () => {
    render(
      <MerchantSidebar
        activeView="qr"
        merchantName="ร้านทดสอบใจดี"
        merchantRole="OWNER"
        hasActiveQr={true}
        isMobileOpen={false}
        onCloseMobile={vi.fn()}
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    const qrBtn = screen.getByRole('button', {
      name: th.merchantPortal.nav.qr,
    });
    expect(qrBtn).toBeInTheDocument();
    expect(qrBtn).toHaveAttribute('aria-current', 'page');
  });
});
