import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderResponse, MerchantOrder } from '../merchant.types';
import { MerchantQrView } from './MerchantQrView';

const createdOrder: CreateOrderResponse = {
  orderId: '501',
  status: 'PENDING',
  subtotal: 55,
  finalAmount: 55,
  qrToken: 'private-token-501',
  qrExpiresAt: '2026-10-30T12:00:00.000Z',
  items: [
    {
      productId: '10',
      productName: 'ข้าวกะเพราหมูสับ',
      unitPrice: 55,
      quantity: 1,
      lineTotal: 55,
    },
  ],
};

const paidOrder: MerchantOrder = {
  orderId: '501',
  status: 'PAID',
  subtotal: 55,
  discountAmount: 0,
  finalAmount: 55,
  subsidyAmount: 33,
  userPaidAmount: 22,
  consumerName: 'สมชาย ใจดี',
  itemCount: 1,
  createdAt: '2026-10-30T11:50:00.000Z',
  qrExpiresAt: '2026-10-30T12:00:00.000Z',
  paidAt: '2026-10-30T11:51:00.000Z',
};

afterEach(cleanup);

describe('MerchantQrView', () => {
  it('shows the in-page payment success state without exposing the QR token', () => {
    const openReceipt = vi.fn().mockResolvedValue(undefined);

    render(
      <MerchantQrView
        createdOrder={createdOrder}
        qrDataUrl="data:image/png;base64,qr"
        paidOrderNotification={paidOrder}
        formatCurrency={(value) => `฿${value.toFixed(2)}`}
        handleOpenPaidQrReceipt={openReceipt}
        isLoadingQrReceipt={false}
        setCreatedOrder={vi.fn()}
        setQrDataUrl={vi.fn()}
        setPaidOrderNotification={vi.fn()}
        setView={vi.fn()}
        qrCountdown={300}
        formatTime={() => '5:00'}
      />,
    );

    expect(screen.getByText('ลูกค้าชำระเงินสำเร็จแล้ว!')).toBeVisible();
    expect(screen.getByText(/Order #501/)).toBeVisible();
    expect(screen.getByText('฿55.00')).toBeVisible();
    expect(screen.queryByText('private-token-501')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: '📄 เปิดดูใบเสร็จรับเงินดิจิทัล',
      }),
    );
    expect(openReceipt).toHaveBeenCalledWith('501');
  });
});
