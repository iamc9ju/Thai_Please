import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import { th } from '../i18n/th';

afterEach(() => {
  cleanup();
});

describe('LogoutConfirmDialog', () => {
  it('renders confirmation dialog when isOpen is true', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <LogoutConfirmDialog
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(th.logoutConfirm.title)).toBeInTheDocument();
    expect(screen.getByText(th.logoutConfirm.description)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.logoutConfirm.cancel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.logoutConfirm.confirm }),
    ).toBeInTheDocument();
  });

  it('does not render dialog when isOpen is false', () => {
    render(
      <LogoutConfirmDialog
        isOpen={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onConfirm when clicking confirm button', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <LogoutConfirmDialog
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirmBtn = screen.getByRole('button', {
      name: th.logoutConfirm.confirm,
    });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when clicking cancel button', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <LogoutConfirmDialog
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const cancelBtn = screen.getByRole('button', {
      name: th.logoutConfirm.cancel,
    });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when pressing Escape key', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <LogoutConfirmDialog
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
