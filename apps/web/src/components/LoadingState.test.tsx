import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { LoadingState } from './LoadingState';

afterEach(cleanup);

it('shows a consistent visible label and decorative spinner with reduced-motion support (NFR-UI-03, NFR-A11Y-01)', () => {
  const label = 'กำลังโหลดข้อมูลทดสอบ...';
  render(<LoadingState label={label} />);
  const status = screen.getByRole('status');
  expect(status).toHaveAttribute('aria-busy', 'true');
  expect(status).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.getByText(label)).not.toHaveClass('sr-only');
  expect(status.querySelector('[aria-hidden="true"]')).toHaveClass(
    'size-8',
    'border-loading',
    'motion-safe:animate-spin',
  );
});
