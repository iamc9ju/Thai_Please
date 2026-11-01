import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LoadingState, type LoadingStateVariant } from './LoadingState';

afterEach(cleanup);

describe('LoadingState', () => {
  it('exposes an accessible loading status and visible label', () => {
    const label = 'กำลังโหลดข้อมูลทดสอบ...';
    render(<LoadingState label={label} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('data-loading-variant', 'compact');
    expect(screen.getByText(label)).toBeVisible();
    expect(status.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(
      status.querySelector('[class*="animate-pulse"]'),
    ).toBeInTheDocument();
  });

  it.each<LoadingStateVariant>([
    'compact',
    'dashboard',
    'cards',
    'table',
    'profile',
  ])('renders the %s skeleton variant', (variant) => {
    render(<LoadingState label="กำลังโหลด" variant={variant} />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'data-loading-variant',
      variant,
    );
  });
});
