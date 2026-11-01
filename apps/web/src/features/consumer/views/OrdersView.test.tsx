import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersView } from './OrdersView';
import * as consumerApi from '../api/consumer.api';
import type { ConsumerOrder } from '../consumer.types';
import { th } from '../../../i18n/th';

const mockOrders: ConsumerOrder[] = [
  {
    orderId: '10',
    receiptNumber: 'TP-000010',
    status: 'PAID',
    merchantId: '1',
    merchantName: 'ร้านครัวบ้านเรา',
    merchantAddress: 'ตลาดบางรัก กรุงเทพมหานคร',
    subtotal: 200,
    discountAmount: 20,
    finalAmount: 180,
    subsidyAmount: 90,
    userPaidAmount: 90,
    createdAt: '2026-10-17T00:00:00.000Z',
    paidAt: '2026-10-17T00:05:00.000Z',
    itemCount: 2,
    items: [
      {
        orderItemId: '1',
        productId: '101',
        productName: 'ข้าวกะเพราหมูกรอบ',
        unitPrice: 60,
        quantity: 2,
        lineTotal: 120,
      },
      {
        orderItemId: '2',
        productId: '102',
        productName: 'ต้มยำกุ้ง',
        unitPrice: 80,
        quantity: 1,
        lineTotal: 80,
      },
    ],
    appliedCoupon: {
      couponName: 'ลด 20 บาท',
      discountValue: 20,
      discountType: 'FIXED',
    },
  },
  {
    orderId: '11',
    receiptNumber: 'TP-000011',
    status: 'PAID',
    merchantId: '2',
    merchantName: 'ร้านกาแฟดอยช้าง',
    merchantAddress: 'ตลาดกลาง',
    subtotal: 70,
    discountAmount: 0,
    finalAmount: 70,
    subsidyAmount: 35,
    userPaidAmount: 35,
    createdAt: '2026-10-16T12:00:00.000Z',
    paidAt: '2026-10-16T12:02:00.000Z',
    itemCount: 1,
    items: [
      {
        orderItemId: '3',
        productId: '201',
        productName: 'อเมริกาโน่เย็น',
        unitPrice: 70,
        quantity: 1,
        lineTotal: 70,
      },
    ],
    appliedCoupon: null,
  },
];

describe('OrdersView (FR-C06)', () => {
  beforeEach(() => {
    vi.spyOn(consumerApi, 'getConsumerOrders').mockResolvedValue(mockOrders);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders orders list and KPI statistics correctly', async () => {
    render(<OrdersView />);

    // Wait for orders to load
    expect(await screen.findByText('ร้านครัวบ้านเรา')).toBeInTheDocument();
    expect(screen.getByText('ร้านกาแฟดอยช้าง')).toBeInTheDocument();

    // Check KPI cards
    expect(
      screen.getByText(th.consumerPortal.orders.totalSpent),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.orders.totalSubsidy),
    ).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.orders.totalOrders),
    ).toBeInTheDocument();
  });

  it('filters orders by search query', async () => {
    render(<OrdersView />);

    await screen.findByText('ร้านครัวบ้านเรา');

    const searchInput = screen.getByPlaceholderText(
      th.consumerPortal.orders.searchPlaceholder,
    );
    fireEvent.change(searchInput, { target: { value: 'ดอยช้าง' } });

    expect(screen.getByText('ร้านกาแฟดอยช้าง')).toBeInTheDocument();
    expect(screen.queryByText('ร้านครัวบ้านเรา')).not.toBeInTheDocument();
  });

  it('opens digital receipt modal when clicking an order card', async () => {
    render(<OrdersView />);

    const orderCard = await screen.findByText('ร้านครัวบ้านเรา');
    fireEvent.click(orderCard);

    // Verify modal appears
    expect(
      screen.getByText(th.consumerPortal.orders.receiptElectronic),
    ).toBeInTheDocument();
    expect(screen.getByText('ข้าวกะเพราหมูกรอบ')).toBeInTheDocument();
    expect(screen.getByText('ต้มยำกุ้ง')).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.orders.printReceipt),
    ).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByLabelText(
      th.consumerPortal.orders.closeReceipt,
    );
    fireEvent.click(closeBtn);

    expect(
      screen.queryByText(th.consumerPortal.orders.receiptElectronic),
    ).not.toBeInTheDocument();
  });

  it('renders empty state when no orders match filter', async () => {
    render(<OrdersView />);

    await screen.findByText('ร้านครัวบ้านเรา');

    const searchInput = screen.getByPlaceholderText(
      th.consumerPortal.orders.searchPlaceholder,
    );
    fireEvent.change(searchInput, {
      target: { value: 'ร้านที่ไม่มีอยู่จริง' },
    });

    expect(
      screen.getByText(th.consumerPortal.orders.emptyTitle),
    ).toBeInTheDocument();
  });

  it('renders error state and retry button on API failure', async () => {
    vi.spyOn(consumerApi, 'getConsumerOrders').mockRejectedValueOnce(
      new Error('Network error'),
    );

    render(<OrdersView />);

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: th.consumerPortal.orders.retry }),
    ).toBeInTheDocument();
  });
});
