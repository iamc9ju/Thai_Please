import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { MerchantTopBar } from './MerchantTopBar';

describe('MerchantTopBar', () => {
  afterEach(cleanup);

  it('renders breadcrumb, merchant name, and triggers actions', () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();
    const onOpenMobile = vi.fn();

    render(
      <MerchantTopBar
        activeView="orders"
        merchantName="ร้านทดสอบใจดี"
        merchantRole="OWNER"
        hasActiveQr={true}
        onOpenMobile={onOpenMobile}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />,
    );

    // Breadcrumb displays active view
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: th.merchantPortal.nav.orders,
      }),
    ).toBeInTheDocument();

    // Fast action to POS (since activeView is orders)
    const posAction = screen.getByRole('button', {
      name: th.merchantPortal.nav.pos,
    });
    fireEvent.click(posAction);
    expect(onNavigate).toHaveBeenCalledWith('pos');

    // Fast action to QR (since hasActiveQr is true)
    const qrAction = screen.getByRole('button', {
      name: th.merchantPortal.nav.qr,
    });
    fireEvent.click(qrAction);
    expect(onNavigate).toHaveBeenCalledWith('qr');

    expect(
      screen.queryByRole('button', { name: 'การแจ้งเตือนร้านค้า' }),
    ).not.toBeInTheDocument();

    // Logout button
    const logoutBtn = screen.getByRole('button', {
      name: th.merchantPortal.logout,
    });
    fireEvent.click(logoutBtn);
    expect(onLogout).toHaveBeenCalled();
  });
});
