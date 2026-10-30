import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { AdminSidebar } from './AdminSidebar';

describe('AdminSidebar', () => {
  afterEach(cleanup);

  it('renders all 7 admin navigation tabs and handles navigation and logout', () => {
    const onSelectTab = vi.fn();
    const onLogout = vi.fn();
    const onCloseMobile = vi.fn();
    const copy = th.adminPortal;

    render(
      <AdminSidebar
        activeTab="overview"
        adminName="แอดมินทดสอบ"
        isMobileOpen={false}
        onCloseMobile={onCloseMobile}
        onSelectTab={onSelectTab}
        onLogout={onLogout}
      />,
    );

    // Active tab button
    const overviewBtn = screen.getByRole('button', {
      name: copy.nav.overview,
    });
    expect(overviewBtn).toBeInTheDocument();
    expect(overviewBtn).toHaveAttribute('aria-current', 'page');

    // All tabs exist
    expect(
      screen.getByRole('button', { name: copy.nav.merchants }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: copy.nav.programs }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: copy.nav.quests }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: copy.nav.rewards }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: copy.nav.socialImpact }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: copy.nav.admins }),
    ).toBeInTheDocument();

    // Profile card displays Admin info
    expect(screen.getByText('แอดมินทดสอบ')).toBeInTheDocument();
    expect(screen.getAllByText(copy.roleBadge).length).toBeGreaterThanOrEqual(1);

    // Clicking a tab invokes onSelectTab
    fireEvent.click(screen.getByRole('button', { name: copy.nav.merchants }));
    expect(onSelectTab).toHaveBeenCalledWith('merchants');
    expect(onCloseMobile).toHaveBeenCalled();

    // Clicking logout invokes onLogout
    fireEvent.click(screen.getByRole('button', { name: copy.logout }));
    expect(onLogout).toHaveBeenCalled();
  });
});
