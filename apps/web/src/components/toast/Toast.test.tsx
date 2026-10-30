import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastItem } from './ToastItem';
import { ToastProvider, useToast } from './ToastProvider';
import { th } from '../../i18n/th';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastItem (blocks.so UI pattern)', () => {
  it('renders login-success notification with role badge and description', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-login',
          type: 'login-success',
          title: th.authToast.loginSuccessTitle,
          description: 'ยินดีต้อนรับคุณ สมชาย ใจดี เข้าสู่ระบบเรียบร้อยแล้ว',
          badge: 'ประชาชน',
          duration: 4000,
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(th.authToast.loginSuccessTitle)).toBeInTheDocument();
    expect(
      screen.getByText('ยินดีต้อนรับคุณ สมชาย ใจดี เข้าสู่ระบบเรียบร้อยแล้ว'),
    ).toBeInTheDocument();
    expect(screen.getByText('ประชาชน')).toBeInTheDocument();
    expect(screen.getByText(th.authToast.timeJustNow)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders logout-success notification with logout title', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-logout',
          type: 'logout-success',
          title: th.authToast.logoutSuccessTitle,
          description: th.authToast.logoutSuccessDesc,
          duration: 4000,
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(th.authToast.logoutSuccessTitle)).toBeInTheDocument();
    expect(screen.getByText(th.authToast.logoutSuccessDesc)).toBeInTheDocument();
  });

  it('dismisses toast when clicking close button', () => {
    const onDismiss = vi.fn();
    render(
      <ToastItem
        toast={{
          id: 'test-dismiss',
          title: 'แจ้งเตือน',
          duration: 4000,
        }}
        onDismiss={onDismiss}
      />,
    );

    const closeBtn = screen.getByRole('button', {
      name: th.authToast.dismiss,
    });
    fireEvent.click(closeBtn);

    expect(onDismiss).toHaveBeenCalledWith('test-dismiss');
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
        Trigger Login Toast
      </button>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
}

describe('ToastProvider & useToast', () => {
  it('adds and displays toast when showToast is invoked', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const button = screen.getByRole('button', {
      name: 'Trigger Login Toast',
    });
    fireEvent.click(button);

    expect(screen.getByText('เข้าสู่ระบบสำเร็จ')).toBeInTheDocument();
    expect(screen.getByText('ยินดีต้อนรับ')).toBeInTheDocument();
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
  });

  it('provides safe fallback when useToast is used outside ToastProvider', () => {
    render(<TestConsumer />);
    const button = screen.getByRole('button', {
      name: 'Trigger Login Toast',
    });
    // Should not throw
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
