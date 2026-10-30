import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastItem } from './ToastItem';
import { ToastProvider, useToast } from './ToastProvider';
import { th } from '../../i18n/th';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastItem (Centered Modal with Thai Please Theme)', () => {
  it('renders login-success centered modal with brand logo and action button, omitting center icon podium and role badge as requested', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-login',
          type: 'login-success',
          title: th.authToast.loginSuccessTitle,
          description: 'ยินดีต้อนรับคุณ สมชาย ใจดี เข้าสู่ระบบเรียบร้อยแล้ว',
          badge: 'ประชาชน',
          duration: 3500,
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: th.brand })).toBeInTheDocument();
    expect(screen.getByText(th.authToast.loginSuccessTitle)).toBeInTheDocument();
    expect(
      screen.getByText('ยินดีต้อนรับคุณ สมชาย ใจดี เข้าสู่ระบบเรียบร้อยแล้ว'),
    ).toBeInTheDocument();
    // Center icon podium and role badge removed for auth modals
    expect(screen.queryByText('ประชาชน')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.authToast.goToDashboard }),
    ).toBeInTheDocument();
  });

  it('renders logout-success modal with confirm button', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-logout',
          type: 'logout-success',
          title: th.authToast.logoutSuccessTitle,
          description: th.authToast.logoutSuccessDesc,
          duration: 3500,
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(th.authToast.logoutSuccessTitle)).toBeInTheDocument();
    expect(screen.getByText(th.authToast.logoutSuccessDesc)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.authToast.confirm }),
    ).toBeInTheDocument();
  });

  it('dismisses modal when clicking the primary action button', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-action-dismiss',
          type: 'login-success',
          title: 'เข้าสู่ระบบสำเร็จ',
          duration: 3500,
        }}
        onDismiss={onDismiss}
      />,
    );

    const actionBtn = screen.getByRole('button', {
      name: th.authToast.goToDashboard,
    });
    fireEvent.click(actionBtn);

    expect(onDismiss).toHaveBeenCalledWith('test-action-dismiss');
  });

  it('dismisses modal when pressing Escape key', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-escape-dismiss',
          title: 'แจ้งเตือน',
          duration: 3500,
        }}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith('test-escape-dismiss');
  });

  it('auto-dismisses after duration has elapsed', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <ToastItem
        toast={{
          id: 'test-timer',
          title: 'กำลังปิดอัตโนมัติ',
          duration: 3000,
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledWith('test-timer');
  });

  it('runs countdown continuously without pausing on mouse hover', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <ToastItem
        toast={{
          id: 'test-continuous-timer',
          title: 'กำลังปิดอัตโนมัติ',
          duration: 3000,
        }}
        onDismiss={onDismiss}
      />,
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseEnter(dialog);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledWith('test-continuous-timer');
  });
});

function TestConsumer() {
  const { showToast, toasts } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          showToast({
            type: 'login-success',
            title: 'เข้าสู่ระบบสำเร็จ',
            description: 'ยินดีต้อนรับ',
          })
        }
      >
        Trigger Login Modal
      </button>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
}

describe('ToastProvider & useToast (Modal Mode)', () => {
  it('opens centered modal when showToast is invoked', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const button = screen.getByRole('button', {
      name: 'Trigger Login Modal',
    });
    fireEvent.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('เข้าสู่ระบบสำเร็จ')).toBeInTheDocument();
    expect(screen.getByText('ยินดีต้อนรับ')).toBeInTheDocument();
  });
});
