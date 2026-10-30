import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { RewardHistoryPages } from './RewardHistoryPages';
import { adminManagementCopy as copy } from '../admin-management.copy';

afterEach(cleanup);
const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <p key={index}>record-{index + 1}</p>
  ));

it('limits pages to ten and supports next, previous and numbered navigation (FR-A01)', () => {
  render(<RewardHistoryPages>{rows(23)}</RewardHistoryPages>);
  expect(screen.getByText('record-10')).toBeInTheDocument();
  expect(screen.queryByText('record-11')).toBeNull();
  expect(screen.getByText(copy.previousPage)).toBeDisabled();
  fireEvent.click(screen.getByText(copy.nextPage));
  expect(screen.getByText('record-11')).toBeInTheDocument();
  expect(screen.getByText('record-20')).toBeInTheDocument();
  expect(screen.queryByText('record-10')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.rewardPage(3) }));
  expect(screen.getByText('record-23')).toBeInTheDocument();
  expect(screen.getByText(copy.nextPage)).toBeDisabled();
  fireEvent.click(screen.getByText(copy.previousPage));
  expect(screen.getByText('record-11')).toBeInTheDocument();
});

it('clamps the page after refresh removes rows and omits pagination for empty data', () => {
  const { rerender } = render(
    <RewardHistoryPages>{rows(23)}</RewardHistoryPages>,
  );
  fireEvent.click(screen.getByRole('button', { name: copy.rewardPage(3) }));
  rerender(<RewardHistoryPages>{rows(2)}</RewardHistoryPages>);
  expect(screen.getByText('record-1')).toBeInTheDocument();
  expect(screen.getByText(copy.rewardPageRange(1, 2, 2))).toBeInTheDocument();
  rerender(<RewardHistoryPages>{[]}</RewardHistoryPages>);
  expect(screen.queryByRole('navigation')).toBeNull();
});
