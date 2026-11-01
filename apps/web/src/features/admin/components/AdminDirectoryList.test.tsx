import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AdminDirectoryList } from './AdminDirectoryList';
import { adminManagementCopy as copy } from '../admin-management.copy';

afterEach(cleanup);
it('shows at most ten names and searches before pagination (FR-A01)', () => {
  const items = Array.from({ length: 23 }, (_, index) => ({
    userId: String(index),
    fullName: `person-${index}`,
    citizenIdMasked: `masked-${index}`,
  }));
  render(
    <AdminDirectoryList items={items} label="directory">
      {(item) => <p key={item.userId}>{item.fullName}</p>}
    </AdminDirectoryList>,
  );
  expect(screen.getByText('person-9')).toBeInTheDocument();
  expect(screen.queryByText('person-10')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: copy.rewardPage(3) }));
  expect(screen.getByText('person-22')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: copy.rewardPage(3) }),
  ).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: copy.rewardPage(1) }));
  fireEvent.click(screen.getByText(copy.nextPage));
  expect(screen.getByText('person-10')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'masked-22' },
  });
  expect(screen.getByText('person-22')).toBeInTheDocument();
  expect(screen.queryByText('person-10')).toBeNull();
  expect(screen.getByText(copy.nextPage)).toBeDisabled();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'missing' },
  });
  expect(screen.getByText(copy.directoryEmpty)).toBeInTheDocument();
});
