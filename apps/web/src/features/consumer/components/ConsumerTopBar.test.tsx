import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ConsumerTopBar } from './ConsumerTopBar';

afterEach(cleanup);

describe('ConsumerTopBar', () => {
  it('keeps logout visible and usable on mobile', () => {
    const onLogout = vi.fn();

    render(
      <ConsumerTopBar
        activeView="overview"
        displayName="สมชาย ใจดี"
        onNavigate={vi.fn()}
        onNotification={vi.fn()}
        onOpenProfile={vi.fn()}
        onLogout={onLogout}
      />,
    );

    const logoutButton = screen.getByRole('button', {
      name: th.consumerDashboard.logout,
    });
    expect(logoutButton).not.toHaveClass('hidden');

    fireEvent.click(logoutButton);
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
