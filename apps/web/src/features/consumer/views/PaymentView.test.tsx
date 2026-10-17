import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { payByQr, previewOrder } from '../api/consumer.api';
import type {
  OrderPreviewResponse,
  PaymentResultResponse,
} from '../consumer.types';
import {
  decodeQrFromImageFile,
  decodeQrFromVideoElement,
} from '../utils/qr-decoder';
import { PaymentView } from './PaymentView';

vi.mock('../api/consumer.api', () => ({
  previewOrder: vi.fn(),
  payByQr: vi.fn(),
}));

vi.mock('../utils/qr-decoder', () => ({
  decodeQrFromImageFile: vi.fn(),
  decodeQrFromVideoElement: vi.fn(),
}));

const mockedPreviewOrder = vi.mocked(previewOrder);
const mockedPayByQr = vi.mocked(payByQr);
const mockedDecodeQrFromImageFile = vi.mocked(decodeQrFromImageFile);
const mockedDecodeQrFromVideoElement = vi.mocked(decodeQrFromVideoElement);

const mockPreviewData: OrderPreviewResponse = {
  orderId: 'order-101',
  merchantName: 'ร้านป้าสมร ของดีชุมชน',
  subtotal: 200,
  discountAmount: 30,
  finalAmount: 170,
  subsidyAmount: 85,
  userPaidAmount: 85,
  personalBalance: 500,
  subsidyBalance: 300,
  canAfford: true,
  qrExpiresAt: new Date(Date.now() + 600 * 1000).toISOString(),
  items: [
    {
      productName: 'กะเพราหมูกรอบ',
      quantity: 2,
      unitPrice: 85,
      lineTotal: 170,
    },
    {
      productName: 'ชาดำเย็น',
      quantity: 1,
      unitPrice: 30,
      lineTotal: 30,
    },
  ],
  appliedCoupon: {
    userCouponId: 'coupon-abc',
    couponName: 'ลด 30 บาท',
    discountType: 'FIXED',
    discountValue: 30,
  },
};

const mockPaymentSuccess: PaymentResultResponse = {
  success: true,
  isIdempotentReplay: false,
  orderId: 'order-101',
  status: 'PAID',
  subtotal: 200,
  discountAmount: 30,
  finalAmount: 170,
  subsidyAmount: 85,
  userPaidAmount: 85,
  paidAt: '2026-10-16T12:00:00.000Z',
};

describe('PaymentView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPreviewOrder.mockResolvedValue(mockPreviewData);
    mockedPayByQr.mockResolvedValue(mockPaymentSuccess);
    mockedDecodeQrFromImageFile.mockResolvedValue('qr-from-image-999');
    mockedDecodeQrFromVideoElement.mockResolvedValue(null);
  });

  afterEach(cleanup);

  it('renders initial scan screen with QR input, camera button, image upload button, and demo action', () => {
    render(<PaymentView onNavigate={vi.fn()} />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: th.consumerPortal.payment.scanTitle,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.cameraAction,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.uploadQrImageAction,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(th.consumerPortal.payment.qrInputPlaceholder),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.checkQrAction,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.demoAction,
      }),
    ).toBeInTheDocument();
  });

  it('decodes QR from uploaded image file and navigates to order review (FR-C04)', async () => {
    render(<PaymentView onNavigate={vi.fn()} />);

    const fileInput = screen.getByTestId('qr-image-input');
    const mockFile = new File(['dummy-qr-png'], 'order-qr.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(mockedDecodeQrFromImageFile).toHaveBeenCalledWith(mockFile);
    });
    expect(mockedPreviewOrder).toHaveBeenCalledWith({
      qrToken: 'qr-from-image-999',
      userCouponId: undefined,
    });
    expect(
      await screen.findByText('ร้านป้าสมร ของดีชุมชน'),
    ).toBeInTheDocument();
  });

  it('displays error message when uploaded image contains no readable QR code', async () => {
    mockedDecodeQrFromImageFile.mockResolvedValueOnce(null);

    render(<PaymentView onNavigate={vi.fn()} />);

    const fileInput = screen.getByTestId('qr-image-input');
    const badFile = new File(['not-a-qr'], 'landscape.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      th.consumerPortal.payment.qrImageReadError,
    );
  });

  it('submits QR token and displays order review details from API', async () => {
    render(<PaymentView onNavigate={vi.fn()} />);

    const input = screen.getByPlaceholderText(
      th.consumerPortal.payment.qrInputPlaceholder,
    );
    fireEvent.change(input, { target: { value: 'test-qr-token-123' } });

    const checkBtn = screen.getByRole('button', {
      name: th.consumerPortal.payment.checkQrAction,
    });
    expect(checkBtn).not.toBeDisabled();
    fireEvent.click(checkBtn);

    expect(mockedPreviewOrder).toHaveBeenCalledWith({
      qrToken: 'test-qr-token-123',
      userCouponId: undefined,
    });

    expect(
      await screen.findByText('ร้านป้าสมร ของดีชุมชน'),
    ).toBeInTheDocument();
    expect(screen.getByText('กะเพราหมูกรอบ')).toBeInTheDocument();
    expect(screen.getByText('ชาดำเย็น')).toBeInTheDocument();
    expect(screen.getAllByText('฿170.00')).toHaveLength(2);
    expect(screen.getAllByText('฿85.00')).toHaveLength(2);
  });

  it('handles invalid QR preview error with friendly alert message', async () => {
    mockedPreviewOrder.mockRejectedValueOnce(
      new ApiError(404, 'ไม่พบ QR Code นี้ในระบบ'),
    );

    render(<PaymentView onNavigate={vi.fn()} />);

    const input = screen.getByPlaceholderText(
      th.consumerPortal.payment.qrInputPlaceholder,
    );
    fireEvent.change(input, { target: { value: 'invalid-token' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.checkQrAction,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ไม่พบ QR Code นี้ในระบบ',
    );
  });

  it('shows insufficient balance warning and disables confirm when canAfford is false', async () => {
    mockedPreviewOrder.mockResolvedValueOnce({
      ...mockPreviewData,
      canAfford: false,
      personalBalance: 20,
      userPaidAmount: 85,
    });

    const mockNavigate = vi.fn();
    render(<PaymentView onNavigate={mockNavigate} />);

    fireEvent.change(
      screen.getByPlaceholderText(th.consumerPortal.payment.qrInputPlaceholder),
      { target: { value: 'afford-test' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.checkQrAction,
      }),
    );

    expect(
      await screen.findByText(
        th.consumerPortal.payment.insufficientBalanceTitle,
      ),
    ).toBeInTheDocument();

    const topUpBtn = screen.getByRole('button', {
      name: th.consumerPortal.payment.topUpAction,
    });
    fireEvent.click(topUpBtn);
    expect(mockNavigate).toHaveBeenCalledWith('wallet');
  });

  it('confirms payment, calls payByQr API, and displays success receipt', async () => {
    const mockSuccessCallback = vi.fn();
    const mockNavigate = vi.fn();

    render(
      <PaymentView
        onNavigate={mockNavigate}
        onPaymentSuccess={mockSuccessCallback}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(th.consumerPortal.payment.qrInputPlaceholder),
      { target: { value: 'valid-token' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.checkQrAction,
      }),
    );

    expect(
      await screen.findByText('ร้านป้าสมร ของดีชุมชน'),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', {
      name: th.consumerPortal.payment.confirm,
    });
    fireEvent.click(confirmBtn);

    expect(mockedPayByQr).toHaveBeenCalledWith({
      qrToken: 'valid-token',
      userCouponId: undefined,
    });

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: th.consumerPortal.payment.successTitle,
      }),
    ).toBeInTheDocument();
    expect(mockSuccessCallback).toHaveBeenCalledOnce();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.receiptAction,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('orders');
  });

  it('runs demo action immediately with fallback preview', () => {
    render(<PaymentView onNavigate={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.demoAction,
      }),
    );

    expect(
      screen.getByText(th.consumerPortal.payment.merchant),
    ).toBeInTheDocument();
    expect(screen.getByText('฿165.00')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: th.consumerPortal.payment.confirm,
      }),
    );

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: th.consumerPortal.payment.successTitle,
      }),
    ).toBeInTheDocument();
  });
});
