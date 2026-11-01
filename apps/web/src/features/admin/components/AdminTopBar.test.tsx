import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { AdminTopBar } from './AdminTopBar';

describe('AdminTopBar', () => {
  afterEach(cleanup);

  it('renders breadcrumb, refresh CTA, and triggers actions', () => {
    const onRefresh = vi.fn();
    const onLogout = vi.fn();
    const onOpenMobile = vi.fn();
    const copy = th.adminPortal;

    render(
      <AdminTopBar
        activeTab="merchants"
        adminName="แอดมินทดสอบ"
        isLoading={false}
        onOpenMobile={onOpenMobile}
        onRefresh={onRefresh}
        onLogout={onLogout}
      />,
    );

    // Breadcrumb displays active tab title
    expect(
      screen.getByRole('heading', { level: 1, name: copy.nav.merchants }),
    ).toBeInTheDocument();

    // Refresh CTA button
    const refreshBtn = screen.getByRole('button', {
      name: copy.refresh,
    });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();

    expect(
      screen.queryByRole('button', { name: 'การแจ้งเตือนระบบ' }),
    ).not.toBeInTheDocument();

    // Logout button
    const logoutBtn = screen.getByRole('button', {
      name: 'ออกจากระบบแถบบน',
    });
    fireEvent.click(logoutBtn);
    expect(onLogout).toHaveBeenCalled();
  });
});
