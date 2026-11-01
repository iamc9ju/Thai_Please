import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ConsumerMobileNav } from './ConsumerMobileNav';

afterEach(cleanup);

describe('ConsumerMobileNav', () => {
  it('renders all 5 mobile navigation items with correct labels', () => {
    const onNavigate = vi.fn();
    render(<ConsumerMobileNav activeView="overview" onNavigate={onNavigate} />);

    expect(
      screen.getByRole('button', { name: th.consumerDashboard.mobileNav.home }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.consumerDashboard.mobileNav.wallet,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.consumerDashboard.mobileNav.scan }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.consumerDashboard.mobileNav.quests,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.consumerDashboard.mobileNav.coupons,
      }),
    ).toBeInTheDocument();
  });

  it('marks the active view with aria-current="page"', () => {
    const onNavigate = vi.fn();
    render(<ConsumerMobileNav activeView="wallet" onNavigate={onNavigate} />);

    const walletBtn = screen.getByRole('button', {
      name: th.consumerDashboard.mobileNav.wallet,
    });
    expect(walletBtn).toHaveAttribute('aria-current', 'page');

    const homeBtn = screen.getByRole('button', {
      name: th.consumerDashboard.mobileNav.home,
    });
    expect(homeBtn).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate with appropriate views when items are clicked', () => {
    const onNavigate = vi.fn();
    render(<ConsumerMobileNav activeView="overview" onNavigate={onNavigate} />);

    fireEvent.click(
      screen.getByRole('button', { name: th.consumerDashboard.mobileNav.scan }),
    );
    expect(onNavigate).toHaveBeenCalledWith('payment');

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerDashboard.mobileNav.quests,
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith('quests');

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerDashboard.mobileNav.coupons,
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith('rewards');
  });
});
