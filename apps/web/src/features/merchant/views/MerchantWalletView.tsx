import { LoadingState } from '../../../components/LoadingState';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import { useLatestRequest } from '../../../lib/use-latest-request';
import { DigitalReceiptModal } from '../../consumer/components/DigitalReceiptModal';
import type { ReceiptDetail } from '../../consumer/consumer.types';
import {
  getMerchantOrderReceipt,
  getMerchantWalletOverview,
  getMerchantWalletTransactions,
  withdrawMerchantWallet,
} from '../api/merchant.api';
import type {
  MerchantWalletOverview,
  MerchantWalletTransaction,
  MerchantWithdrawalResult,
} from '../merchant.types';

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `mwithdraw-${crypto.randomUUID()}`;
  }
  return `mwithdraw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getMonthDateFilter(monthValue: string): {
  dateFrom?: string;
  dateTo?: string;
} {
  if (!monthValue) return {};

  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();
  return {
    dateFrom: `${monthValue}-01`,
    dateTo: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function MerchantWalletView() {
  const copy = th.merchantPortal.wallet;
  const [overview, setOverview] = useState<MerchantWalletOverview | null>(null);
  const [ledgerItems, setLedgerItems] = useState<MerchantWalletTransaction[]>(
    [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'orderIncomes' | 'ledger'>(
    'orderIncomes',
  );
  const [selectedMonth, setSelectedMonth] = useState('');

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    createIdempotencyKey(),
  );
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] =
    useState<MerchantWithdrawalResult | null>(null);

  // Receipt modal state
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(
    null,
  );
  const [loadingReceiptOrderId, setLoadingReceiptOrderId] = useState<
    string | null
  >(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const beginRequest = useLatestRequest();
  const loadWalletData = useCallback(
    async (monthValue = selectedMonth) => {
      const { isCurrent } = beginRequest();
      setIsLoading(true);
      setError(null);
      const dateFilter = getMonthDateFilter(monthValue);
      try {
        const [walletOverview, txPage] = await Promise.all([
          getMerchantWalletOverview(dateFilter),
          getMerchantWalletTransactions({
            ...dateFilter,
            limit: 20,
          }),
        ]);
        if (!isCurrent()) return;
        setOverview(walletOverview);
        setLedgerItems(txPage.items);
        setNextCursor(txPage.nextCursor);
      } catch (caughtError: unknown) {
        if (!isCurrent()) return;
        setError(
          caughtError instanceof Error ? caughtError.message : copy.errorTitle,
        );
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [beginRequest, copy.errorTitle, selectedMonth],
  );

  useEffect(() => {
    void loadWalletData();
  }, [loadWalletData]);

  const handleLoadMoreLedger = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getMerchantWalletTransactions({
        ...getMonthDateFilter(selectedMonth),
        cursor: nextCursor,
        limit: 20,
      });
      setLedgerItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error ? caughtError.message : copy.errorTitle,
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleWithdrawAmountChange = (value: string) => {
    setWithdrawAmount(value);
    setWithdrawError(null);
    setWithdrawSuccess(null);
    setIdempotencyKey(createIdempotencyKey());
  };

  const handleSubmitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overview || isWithdrawing) return;

    const parsedAmount = Number(withdrawAmount);
    if (
      !Number.isInteger(parsedAmount) ||
      parsedAmount < 1 ||
      parsedAmount > overview.wallet.merchantBalance
    ) {
      setWithdrawError(
        parsedAmount > overview.wallet.merchantBalance
          ? copy.withdraw.insufficientBalance
          : copy.withdraw.invalidAmount,
      );
      return;
    }

    setIsWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);

    try {
      const result = await withdrawMerchantWallet({
        amount: parsedAmount,
        idempotencyKey,
      });
      setWithdrawSuccess(result);
      setWithdrawAmount('');
      setIdempotencyKey(createIdempotencyKey());
      await loadWalletData();
    } catch (caughtError: unknown) {
      setWithdrawError(
        caughtError instanceof Error
          ? caughtError.message
          : 'ไม่สามารถถอนเงินได้ กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleOpenReceipt = async (orderId: string) => {
    setLoadingReceiptOrderId(orderId);
    try {
      const receipt = await getMerchantOrderReceipt(orderId);
      setSelectedReceipt(receipt);
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'ไม่สามารถเปิดใบเสร็จได้',
      );
    } finally {
      setLoadingReceiptOrderId(null);
    }
  };

  if (isLoading && !overview) {
    return <LoadingState label={copy.loading} variant="dashboard" />;
  }

  if (error && !overview) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
        <p className="text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => void loadWalletData()}
          className="mt-3 rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
        >
          {copy.retry}
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const { wallet, withdrawalEligibility, orderIncomes } = overview;

  return (
    <div className="space-y-6">
      {/* Wallet overview */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0056b3]">
              <Wallet className="size-3.5" />
              {copy.eyebrow}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
              {copy.description}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {copy.balanceLabel}
                </p>
                <p
                  data-testid="merchant-wallet-balance"
                  className="mt-0.5 font-mono text-3xl font-black tracking-tight text-[#003d82]"
                >
                  {formatCurrency(wallet.merchantBalance)}
                </p>
              </div>
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {wallet.paidOrderCount} {copy.paidOrdersUnit}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3">
            <button
              type="button"
              onClick={() => void loadWalletData()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-[#0056b3] transition-colors hover:bg-blue-100"
            >
              <RefreshCw className="size-3.5" />
              {copy.refresh}
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">
              {copy.totalSalesIncome}
            </p>
            <p className="mt-1 font-mono text-lg font-extrabold text-[#003d82]">
              {formatCurrency(wallet.totalSalesIncome)}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">
              {copy.subsidyPortion}
            </p>
            <p className="mt-1 font-mono text-lg font-extrabold text-sky-700">
              {formatCurrency(wallet.totalSubsidyPortion)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">
              {copy.personalPortion}
            </p>
            <p className="mt-1 font-mono text-lg font-extrabold text-emerald-700">
              {formatCurrency(wallet.totalPersonalPortion)}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5">
            <p className="text-[11px] font-medium text-slate-500">
              {copy.totalWithdrawn}
            </p>
            <p className="mt-1 font-mono text-lg font-extrabold text-amber-700">
              {formatCurrency(wallet.totalWithdrawn)}
            </p>
          </div>
        </div>
      </section>

      {/* Withdrawal Card (FR-M06 / BR-WALLET-06) */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
                <ArrowRightLeft className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {copy.withdraw.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {copy.withdraw.subtitle}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#003d82]">
                  <ShieldCheck className="size-4 text-[#0056b3]" />
                  <span>{copy.withdraw.destinationLabel}</span>
                </div>
                {withdrawalEligibility.canWithdraw ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    พร้อมโอนเงินทันที
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    {copy.withdraw.notEligibleTitle}
                  </span>
                )}
              </div>
              {withdrawalEligibility.consumerPersonalBalance !== null && (
                <div className="mt-2 flex items-baseline justify-between border-t border-blue-100 pt-2">
                  <span className="text-xs text-slate-600">
                    {copy.withdraw.currentPersonalBalance}
                  </span>
                  <span
                    data-testid="owner-consumer-personal-balance"
                    className="font-mono text-sm font-extrabold text-[#0056b3]"
                  >
                    {formatCurrency(
                      withdrawalEligibility.consumerPersonalBalance,
                    )}
                  </span>
                </div>
              )}
              {!withdrawalEligibility.canWithdraw && (
                <p className="mt-2 text-xs text-amber-700">
                  {!withdrawalEligibility.isOwner
                    ? copy.withdraw.notOwnerReason
                    : copy.withdraw.noConsumerWalletReason}
                </p>
              )}
            </div>
          </div>

          {/* Withdrawal Form */}
          <form
            onSubmit={(e) => void handleSubmitWithdraw(e)}
            className="w-full lg:max-w-md space-y-3"
          >
            <label
              htmlFor="merchant-withdraw-amount"
              className="block text-xs font-bold text-slate-700"
            >
              {copy.withdraw.amountLabel}
            </label>
            <div className="relative">
              <input
                id="merchant-withdraw-amount"
                type="number"
                min={1}
                step={1}
                max={Math.max(1, Math.floor(wallet.merchantBalance))}
                value={withdrawAmount}
                onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                placeholder={copy.withdraw.amountPlaceholder}
                disabled={
                  !withdrawalEligibility.canWithdraw ||
                  wallet.merchantBalance < 1 ||
                  isWithdrawing
                }
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                THB
              </span>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {copy.withdraw.quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={
                    !withdrawalEligibility.canWithdraw ||
                    wallet.merchantBalance < amt ||
                    isWithdrawing
                  }
                  onClick={() => handleWithdrawAmountChange(String(amt))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#0056b3] hover:bg-blue-50 hover:text-[#0056b3] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  ฿{amt.toLocaleString('th-TH')}
                </button>
              ))}
              <button
                type="button"
                disabled={
                  !withdrawalEligibility.canWithdraw ||
                  wallet.merchantBalance < 1 ||
                  isWithdrawing
                }
                onClick={() =>
                  handleWithdrawAmountChange(
                    String(Math.floor(wallet.merchantBalance)),
                  )
                }
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-blue-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {copy.withdraw.withdrawAll}
              </button>
            </div>

            {withdrawError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
              >
                {withdrawError}
              </div>
            )}

            {withdrawSuccess && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800"
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>{copy.withdraw.successTitle}</span>
                </div>
                <p className="mt-1">
                  โอนเงิน{' '}
                  <strong>{formatCurrency(withdrawSuccess.amount)}</strong>{' '}
                  เข้ากระเป๋าประชาชนสำเร็จ · คงเหลือร้านค้า{' '}
                  <strong>
                    {formatCurrency(withdrawSuccess.merchantBalanceAfter)}
                  </strong>{' '}
                  · ยอดเงินส่วนตัวประชาชน{' '}
                  <strong>
                    {formatCurrency(
                      withdrawSuccess.consumerPersonalBalanceAfter,
                    )}
                  </strong>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={
                !withdrawalEligibility.canWithdraw ||
                wallet.merchantBalance < 1 ||
                !withdrawAmount ||
                isWithdrawing
              }
              className="w-full rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] py-3 text-sm font-bold text-white shadow-md shadow-blue-900/15 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isWithdrawing ? copy.withdraw.submitting : copy.withdraw.submit}
            </button>
          </form>
        </div>
      </section>

      {/* Tabs: Order Incomes vs Wallet Ledger */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('orderIncomes')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orderIncomes'
                  ? 'bg-[#0056b3] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {copy.tabs.orderIncomes}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-[#0056b3] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {copy.tabs.ledger}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 focus-within:border-[#0056b3] focus-within:bg-white">
              <CalendarRange className="size-4 text-[#0056b3]" />
              <span>เดือนที่แสดง</span>
              <input
                type="month"
                aria-label="เดือนที่แสดงในกระเป๋าร้านค้า"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
            </label>
            {selectedMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth('')}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                ทุกเดือน
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Order Incomes */}
        {activeTab === 'orderIncomes' && (
          <div className="mt-4">
            {orderIncomes.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-500">
                <FileText className="size-8 text-slate-400" />
                <p className="text-sm">{copy.orderIncomes.empty}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderIncomes.map((income) => (
                  <div
                    key={income.orderId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#0056b3]">
                        <TrendingUp className="size-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#003d82]">
                            {income.receiptNumber}
                          </span>
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            ชำระแล้ว
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-700">
                          ลูกค้า: {income.consumerName ?? 'ประชาชนทั่วไป'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(income.paidAt).toLocaleString('th-TH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-200 pt-2.5 sm:pt-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-xl bg-sky-50 border border-sky-200 px-2.5 py-1 font-semibold text-sky-800">
                          {copy.orderIncomes.subsidyBadge}:{' '}
                          {formatCurrency(income.subsidyAmount)}
                        </span>
                        <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-semibold text-emerald-800">
                          {copy.orderIncomes.personalBadge}:{' '}
                          {formatCurrency(income.userPaidAmount)}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-500">
                          {copy.orderIncomes.finalBadge}
                        </p>
                        <p className="font-mono text-base font-black text-[#0056b3]">
                          +{formatCurrency(income.finalAmount)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleOpenReceipt(income.orderId)}
                        disabled={loadingReceiptOrderId === income.orderId}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Eye className="size-3.5" />
                        <span>
                          {loadingReceiptOrderId === income.orderId
                            ? copy.orderIncomes.loadingReceipt
                            : copy.orderIncomes.viewReceipt}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Wallet Ledger */}
        {activeTab === 'ledger' && (
          <div className="mt-4">
            {ledgerItems.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-500">
                <Wallet className="size-8 text-slate-400" />
                <p className="text-sm">{copy.ledger.empty}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {ledgerItems.map((tx) => {
                  const isWithdrawal =
                    tx.transactionType === 'MERCHANT_WITHDRAWAL';
                  return (
                    <div
                      key={tx.transactionId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                            isWithdrawal
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isWithdrawal ? (
                            <ArrowUpRight className="size-5" />
                          ) : (
                            <ArrowDownLeft className="size-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {isWithdrawal
                              ? copy.ledger.withdrawalDebit
                              : copy.ledger.saleCredit}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {tx.receiptNumber && (
                              <span className="font-mono font-semibold text-[#0056b3]">
                                ใบเสร็จ {tx.receiptNumber}
                              </span>
                            )}
                            {tx.consumerName && (
                              <span>· ลูกค้า: {tx.consumerName}</span>
                            )}
                            {tx.transferReference && (
                              <span className="font-mono">
                                Ref: {tx.transferReference}
                              </span>
                            )}
                          </div>
                          {tx.subsidyAmount !== null &&
                            tx.userPaidAmount !== null && (
                              <p className="mt-1 text-[11px] text-slate-600">
                                สิทธิ์รัฐ {formatCurrency(tx.subsidyAmount)} +
                                เงินลูกค้า {formatCurrency(tx.userPaidAmount)}
                              </p>
                            )}
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {new Date(tx.createdAt).toLocaleString('th-TH', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right border-t sm:border-t-0 border-slate-200 pt-2 sm:pt-0">
                        <p
                          className={`font-mono text-base font-black ${
                            isWithdrawal ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {isWithdrawal ? '-' : '+'}
                          {formatCurrency(tx.amount)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {copy.ledger.balanceAfterLabel}:{' '}
                          <span className="font-mono font-bold text-slate-700">
                            {formatCurrency(tx.balanceAfter)}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}

                {nextCursor && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => void handleLoadMoreLedger()}
                      disabled={isLoadingMore}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingMore
                        ? copy.ledger.loadingMore
                        : copy.ledger.loadMore}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {selectedReceipt && (
        <DigitalReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
