import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import * as consumerApi from '../api/consumer.api';
import type {
  ConsumerCouponsResponse,
  ConsumerPointsResponse,
  RedeemCouponResponse,
} from '../consumer.types';
import { CouponsView } from './CouponsView';

vi.mock('../api/consumer.api', () => ({
  getConsumerPoints: vi.fn(),
  getConsumerCoupons: vi.fn(),
  redeemConsumerCoupon: vi.fn(),
}));

const mockedGetConsumerPoints = vi.mocked(consumerApi.getConsumerPoints);
const mockedGetConsumerCoupons = vi.mocked(consumerApi.getConsumerCoupons);
const mockedRedeemConsumerCoupon = vi.mocked(consumerApi.redeemConsumerCoupon);

const mockPointsData: ConsumerPointsResponse = {
  pointBalance: 160,
  expiringPoints: 60,
  nearestExpiryAt: '2026-11-01T10:00:00.000Z',
  items: [
    {
      pointTransactionId: '1',
      transactionType: 'QUEST_REWARD',
      points: 60,
      sourceName: 'อุดหนุนร้านอาหารชุมชน',
      userQuestId: '10',
      completedOrderId: '99',
      userCouponId: null,
      expiresAt: '2026-11-01T10:00:00.000Z',
      createdAt: '2026-10-15T10:00:00.000Z',
    },
    {
      pointTransactionId: '2',
      transactionType: 'COUPON_REDEEM',
      points: -100,
      sourceName: 'ส่วนลด 20 บาท',
      userQuestId: null,
      completedOrderId: null,
      userCouponId: '5',
      expiresAt: null,
      createdAt: '2026-10-12T08:00:00.000Z',
    },
  ],
};

const mockCouponsData: ConsumerCouponsResponse = {
  pointBalance: 160,
  catalogue: [
    {
      couponId: '1',
      couponName: 'ส่วนลด 20 บาท',
      description: 'เมื่อซื้อครบ 150 บาท',
      discountType: 'FIXED',
      discountValue: 20,
      minPurchase: 150,
      pointCost: 100,
      validityDays: 14,
      merchantId: null,
      merchantName: null,
      canRedeem: true,
    },
    {
      couponId: '2',
      couponName: 'ส่วนลด 50 บาท',
      description: 'เมื่อซื้อครบ 300 บาท',
      discountType: 'FIXED',
      discountValue: 50,
      minPurchase: 300,
      pointCost: 250,
      validityDays: 30,
      merchantId: '5',
      merchantName: 'ร้านครัวบ้านเรา',
      canRedeem: false,
    },
  ],
  ownedCoupons: [
    {
      userCouponId: '5',
      couponId: '1',
      couponName: 'คูปองลด 20 บาท พร้อมใช้',
      description: 'เมื่อซื้อครบ 150 บาท',
      discountType: 'FIXED',
      discountValue: 20,
      minPurchase: 150,
      pointCost: 100,
      merchantId: null,
      merchantName: null,
      status: 'AVAILABLE',
      redeemedAt: '2026-10-12T08:00:00.000Z',
      expiresAt: '2026-10-26T08:00:00.000Z',
      usedAt: null,
      usedOrderId: null,
    },
  ],
};

describe('CouponsView (FR-C08 & FR-C09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('ignores a canceled StrictMode load while the current load is pending (NFR-UI-01)', async () => {
    mockedGetConsumerPoints.mockImplementationOnce(
      (signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new Error('Wrapped cancellation')),
          );
        }),
    );
    let resolvePoints: ((data: ConsumerPointsResponse) => void) | undefined;
    mockedGetConsumerPoints.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoints = resolve;
        }),
    );
    mockedGetConsumerCoupons.mockResolvedValue(mockCouponsData);

    render(
      <StrictMode>
        <CouponsView />
      </StrictMode>,
    );
    await act(async () => {});
    expect(
      screen.getByText(th.consumerPortal.rewards.loading),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(th.consumerPortal.rewards.loadError),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolvePoints?.(mockPointsData);
    });
    expect(screen.getByText('160')).toBeInTheDocument();
  });

  it('shows a genuine load error and recovers when retried', async () => {
    mockedGetConsumerPoints.mockRejectedValueOnce(new Error('Network failed'));
    mockedGetConsumerCoupons.mockResolvedValue(mockCouponsData);
    render(<CouponsView />);
    expect(
      await screen.findByText(th.consumerPortal.rewards.loadError),
    ).toBeInTheDocument();
    mockedGetConsumerPoints.mockResolvedValueOnce(mockPointsData);
    fireEvent.click(
      screen.getByRole('button', { name: th.consumerPortal.rewards.retry }),
    );
    expect(await screen.findByText('160')).toBeInTheDocument();
  });

  it('renders point balance, point history, owned coupons, and coupon catalogue', async () => {
    mockedGetConsumerPoints.mockResolvedValueOnce(mockPointsData);
    mockedGetConsumerCoupons.mockResolvedValueOnce(mockCouponsData);

    render(<CouponsView />);

    expect(
      screen.getByText(th.consumerPortal.rewards.loading),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('160')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/รางวัลภารกิจสำเร็จ: อุดหนุนร้านอาหารชุมชน/),
    ).toBeInTheDocument();
    expect(screen.getByText('+60 พอยต์')).toBeInTheDocument();
    expect(screen.getByText('-100 พอยต์')).toBeInTheDocument();
    expect(screen.getByText('คูปองลด 20 บาท พร้อมใช้')).toBeInTheDocument();
    expect(screen.getByText('ส่วนลด 50 บาท')).toBeInTheDocument();
    expect(
      screen.getByText(th.consumerPortal.rewards.insufficientPoints),
    ).toBeInTheDocument();
  });

  it('redeems a coupon and refreshes balance and owned coupons', async () => {
    mockedGetConsumerPoints.mockResolvedValueOnce(mockPointsData);
    mockedGetConsumerCoupons.mockResolvedValueOnce(mockCouponsData);

    const redeemResult: RedeemCouponResponse = {
      success: true,
      pointBalance: 60,
      pointTransactionId: '3',
      pointsDeducted: 100,
      userCoupon: {
        userCouponId: '6',
        couponId: '1',
        couponName: 'ส่วนลด 20 บาท',
        description: 'เมื่อซื้อครบ 150 บาท',
        discountType: 'FIXED',
        discountValue: 20,
        minPurchase: 150,
        pointCost: 100,
        merchantId: null,
        merchantName: null,
        status: 'AVAILABLE',
        redeemedAt: '2026-10-17T03:00:00.000Z',
        expiresAt: '2026-10-31T03:00:00.000Z',
        usedAt: null,
        usedOrderId: null,
      },
    };
    mockedRedeemConsumerCoupon.mockResolvedValueOnce(redeemResult);
    mockedGetConsumerPoints.mockResolvedValueOnce({
      ...mockPointsData,
      pointBalance: 60,
    });
    mockedGetConsumerCoupons.mockResolvedValueOnce({
      ...mockCouponsData,
      pointBalance: 60,
      ownedCoupons: [...mockCouponsData.ownedCoupons, redeemResult.userCoupon],
    });

    const onCouponRedeemed = vi.fn();
    const onNavigate = vi.fn();

    render(
      <CouponsView
        onCouponRedeemed={onCouponRedeemed}
        onNavigate={onNavigate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('160')).toBeInTheDocument();
    });

    const redeemButton = screen.getByRole('button', {
      name: th.consumerPortal.rewards.redeem,
    });
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(mockedRedeemConsumerCoupon).toHaveBeenCalledWith('1');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/แลกคูปอง "ส่วนลด 20 บาท" สำเร็จ/),
      ).toBeInTheDocument();
    });

    expect(onCouponRedeemed).toHaveBeenCalledTimes(1);
  });

  it('renders permission denied state on 403 ApiError', async () => {
    mockedGetConsumerPoints.mockRejectedValueOnce(
      new ApiError(403, 'Forbidden'),
    );
    mockedGetConsumerCoupons.mockResolvedValueOnce(mockCouponsData);

    render(<CouponsView />);

    await waitFor(() => {
      expect(
        screen.getByText(th.consumerPortal.rewards.permissionDenied),
      ).toBeInTheDocument();
    });
  });
});
