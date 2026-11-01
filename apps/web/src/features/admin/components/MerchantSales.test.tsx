import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MerchantSales } from './MerchantSales';
import { merchantSalesCopy as copy } from '../merchant-sales.copy';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});
afterEach(cleanup);
it('shows five merchants, then ten per page with global sorting and search', () => {
  const merchants = Array.from({ length: 24 }, (_, index) => ({
    merchantId: String(index),
    merchantName: `Merchant ${index}`,
    orderCount: index,
    totalSales: index,
    subsidyUsed: 0,
    personalPaid: index,
  }));
  render(<MerchantSales merchants={merchants} days={7} />);
  expect(screen.getByText('Merchant 23')).toBeTruthy();
  expect(screen.queryByText('Merchant 18')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /ดูร้านค้าทั้งหมด/ }));
  const dialog = within(screen.getByRole('dialog', { hidden: true }));
  expect(dialog.getAllByRole('row', { hidden: true })).toHaveLength(11);
  fireEvent.click(dialog.getByText(copy.next));
  expect(dialog.getByText('Merchant 13')).toBeTruthy();
  fireEvent.change(dialog.getByRole('combobox', { hidden: true }), {
    target: { value: 'asc' },
  });
  expect(dialog.getByText('Merchant 0')).toBeTruthy();
  expect(dialog.queryByText('Merchant 23')).toBeNull();
  fireEvent.change(dialog.getByLabelText(copy.search), {
    target: { value: 'Merchant 23' },
  });
  expect(dialog.getAllByRole('row', { hidden: true })).toHaveLength(2);
  fireEvent.change(dialog.getByLabelText(copy.search), {
    target: { value: 'missing' },
  });
  expect(dialog.getByText(copy.empty)).toBeTruthy();
  fireEvent.click(dialog.getByText(copy.close));
  expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
});
