import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
