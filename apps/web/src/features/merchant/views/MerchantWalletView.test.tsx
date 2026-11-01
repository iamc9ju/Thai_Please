import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantWalletView } from './MerchantWalletView';

const mockGetMerchantWalletOverview = vi.fn();
const mockGetMerchantWalletTransactions = vi.fn();
const mockWithdrawMerchantWallet = vi.fn();
const mockGetMerchantOrderReceipt = vi.fn();

vi.mock('../api/merchant.api', () => ({
  getMerchantWalletOverview: (...args: unknown[]) =>
    mockGetMerchantWalletOverview(...args),
  getMerchantWalletTransactions: (...args: unknown[]) =>
    mockGetMerchantWalletTransactions(...args),
  withdrawMerchantWallet: (...args: unknown[]) =>
    mockWithdrawMerchantWallet(...args),
  getMerchantOrderReceipt: (...args: unknown[]) =>
    mockGetMerchantOrderReceipt(...args),
}));

describe('MerchantWalletView (FR-M06)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetMerchantWalletOverview.mockResolvedValue({
      wallet: {
        walletId: '801',
        merchantId: '301',
        merchantName: 'ร้านป้าศรี ข้าวแกงไทย',
        merchantStatus: 'ACTIVE',
        walletStatus: 'ACTIVE',
        merchantBalance: 450,
        totalSalesIncome: 500,
        totalSubsidyPortion: 250,
        totalPersonalPortion: 250,
        totalWithdrawn: 50,
        paidOrderCount: 3,
      },
      withdrawalEligibility: {
        isOwner: true,
        hasConsumerRole: true,
        hasConsumerWallet: true,
        consumerWalletId: '501',
        consumerPersonalBalance: 200,
        canWithdraw: true,
      },
      orderIncomes: [
        {
          orderId: '55',
          receiptNumber: 'TP-000055',
          subtotal: 120,
          discountAmount: 20,
          finalAmount: 100,
          subsidyAmount: 50,
          userPaidAmount: 50,
          consumerName: 'สมชาย ใจดี',
          paidAt: '2026-10-17T03:00:00.000Z',
        },
      ],
      recentTransactions: [],
    });

    mockGetMerchantWalletTransactions.mockResolvedValue({
      items: [
        {
          transactionId: '900',
          fundType: 'MERCHANT',
          transactionType: 'MERCHANT_SALE_CREDIT',
          amount: 100,
          balanceBefore: 350,
          balanceAfter: 450,
          businessRef: 'payment:55:merchant',
          transferReference: null,
          orderId: '55',
          receiptNumber: 'TP-000055',
          subsidyAmount: 50,
          userPaidAmount: 50,
          finalAmount: 100,
          consumerName: 'สมชาย ใจดี',
          createdAt: '2026-10-17T03:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
  });

  it('renders merchant balance, order income breakdown, and owner consumer balance', async () => {
    render(<MerchantWalletView />);

    await waitFor(() => {
      expect(screen.getByTestId('merchant-wallet-balance')).toHaveTextContent(
        '450',
      );
    });

    expect(
      screen.getByTestId('owner-consumer-personal-balance'),
    ).toHaveTextContent('200');
    expect(screen.getByText('TP-000055')).toBeInTheDocument();
    expect(screen.getByText(/สมชาย ใจดี/)).toBeInTheDocument();
  });

  it('filters order incomes and wallet transactions using the selected month', async () => {
    render(<MerchantWalletView />);

    fireEvent.change(
      await screen.findByLabelText('เดือนที่แสดงในกระเป๋าร้านค้า'),
      { target: { value: '2026-10' } },
    );

    await waitFor(() => {
      expect(mockGetMerchantWalletOverview).toHaveBeenLastCalledWith({
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      });
      expect(mockGetMerchantWalletTransactions).toHaveBeenLastCalledWith({
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        limit: 20,
      });
    });
  });

  it('submits withdrawal and refreshes balances on success', async () => {
    mockWithdrawMerchantWallet.mockResolvedValueOnce({
      success: true,
      isIdempotentReplay: false,
      withdrawalId: '1001',
      creditTransactionId: '1002',
      transferReference: 'transfer_801_key',
      amount: 150,
      merchantBalanceBefore: 450,
      merchantBalanceAfter: 300,
      consumerPersonalBalanceBefore: 200,
      consumerPersonalBalanceAfter: 350,
      createdAt: '2026-10-17T04:00:00.000Z',
    });

    render(<MerchantWalletView />);

    await waitFor(() => {
      expect(screen.getByTestId('merchant-wallet-balance')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('จำนวนเงินที่ต้องการถอน (บาท)');
    fireEvent.change(input, { target: { value: '150' } });

    const submitButton = screen.getByRole('button', {
      name: 'ยืนยันถอนเงินเข้ากระเป๋าส่วนตัว',
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockWithdrawMerchantWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 150,
          idempotencyKey: expect.stringMatching(/^mwithdraw-/),
        }),
      );
    });

    expect(
      await screen.findByText('ถอนเงินเข้ากระเป๋าประชาชนสำเร็จ'),
    ).toBeInTheDocument();
  });
});
