import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CouponManager } from './CouponManager';

const coupon = {
  couponId: '1',
  couponName: 'ลด 20 บาท',
  description: null,
  discountType: 'FIXED' as const,
  discountValue: 20,
  pointCost: 30,
  minPurchase: 100,
  validityDays: 30,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  merchantId: null,
  merchantName: null,
  issuedCount: 0,
};

describe('CouponManager', () => {
  afterEach(cleanup);
  it('creates a coupon with a retry key and keeps the draft after an error', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(undefined);
    render(
      <CouponManager
        items={[]}
        busy={false}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('ชื่อคูปอง'), {
      target: { value: 'ใหม่' },
    });
    fireEvent.change(screen.getByLabelText('มูลค่าส่วนลด'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('แต้มที่ใช้แลก'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('อายุคูปอง (วัน)'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'สร้างคูปอง' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      couponName: 'ใหม่',
      idempotencyKey: expect.any(String),
    });
    expect(screen.getByLabelText('ชื่อคูปอง')).toHaveValue('ใหม่');
    fireEvent.click(screen.getByRole('button', { name: 'สร้างคูปอง' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate.mock.calls[1]?.[0]?.idempotencyKey).toBe(
      onCreate.mock.calls[0]?.[0]?.idempotencyKey,
    );
  });

  it('starts numeric fields empty and toggles status before edit', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <CouponManager
        items={[coupon]}
        busy={false}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('แต้มที่ใช้แลก')).toHaveValue(null);
    expect(screen.getByLabelText('ยอดซื้อขั้นต่ำ')).toHaveValue('');
    expect(screen.getByLabelText('อายุคูปอง (วัน)')).toHaveValue(null);
    expect(
      screen.queryByRole('combobox', { name: 'สถานะ' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ปิดใช้งาน' }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          status: 'INACTIVE',
          pointCost: 30,
          validityDays: 30,
        }),
      ),
    );
  });

  it('shows ten coupons per page and searches the catalogue', () => {
    const onSearchChange = vi.fn();
    const items = Array.from({ length: 11 }, (_, index) => ({
      ...coupon,
      couponId: String(index + 1),
      couponName: `Coupon ${index + 1}`,
    }));
    render(
      <CouponManager
        items={items}
        busy={false}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onSearchChange={onSearchChange}
      />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(
      screen.getByLabelText('ค้นหาชื่อคูปอง รายละเอียด หรือร้านค้า'),
      { target: { value: 'Coupon 11' } },
    );
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(onSearchChange).toHaveBeenCalledWith('Coupon 11');
  });

  it('disables edits and deletes for issued coupons', () => {
    render(
      <CouponManager
        items={[{ ...coupon, issuedCount: 1 }]}
        busy={false}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'แก้ไข' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ลบ' })).toBeDisabled();
  });
});
