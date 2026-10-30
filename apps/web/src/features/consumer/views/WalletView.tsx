import { LoadingState } from '../../../components/LoadingState';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Plus,
  RotateCcw,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import {
  getConsumerOverview,
  getWalletTransactions,
  topUpPersonalWallet,
} from '../api/consumer.api';
import { PortalPageHeader } from '../components/PortalPageHeader';
import {
  TOP_UP_MAX_BAHT,
  TOP_UP_MIN_BAHT,
  TOP_UP_QUICK_AMOUNTS,
  WALLET_HISTORY_ITEMS_PER_PAGE,
  WALLET_HISTORY_PAGE_SIZE,
} from '../consumer.types';
import type {
  ConsumerOverviewResponse,
  WalletTransactionHistoryQuery,
  WalletTransactionItem,
} from '../consumer.types';

type WalletLoadState =
  | { status: 'loading' }
  | { status: 'success'; data: ConsumerOverviewResponse }
  | { status: 'permission-denied' }
  | { status: 'error' };

type TopUpState =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'validation'
  | 'permission-denied'
  | 'conflict'
  | 'network-error'
  | 'refresh-error';

type TopUpAttempt = { amount: number; key: string };

type WalletHistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'permission-denied' }
  | {
      status: 'success';
      items: WalletTransactionItem[];
      nextCursor: string | null;
      isLoadingMore: boolean;
      loadMoreError: boolean;
    };

const bahtFormatter = new Intl.NumberFormat(th.consumerDashboard.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});

function formatBaht(amount: number) {
  return bahtFormatter.format(amount);
}

function toBangkokDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: th.consumerDashboard.timeZone,
    year: 'numeric',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function currentBangkokMonth() {
  const date = toBangkokDate(new Date().toISOString());
  const [year, month] = date.split('-');
  if (!year || !month) return { first: '', last: '' };
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0))
    .getUTCDate()
    .toString()
    .padStart(2, '0');
  return {
    first: `${year}-${month}-01`,
    last: `${year}-${month}-${lastDay}`,
  };
}

function walletHistoryQuery(
  dateFrom: string,
  dateTo: string,
  cursor?: string,
): WalletTransactionHistoryQuery {
  const query: WalletTransactionHistoryQuery = {
    limit: WALLET_HISTORY_PAGE_SIZE,
  };
  if (dateFrom) query.dateFrom = dateFrom;
  if (dateTo) query.dateTo = dateTo;
  if (cursor) query.cursor = cursor;
  return query;
}

function loadErrorState(error: unknown): WalletLoadState {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return { status: 'permission-denied' };
  }
  return { status: 'error' };
}

function topUpErrorState(error: unknown): TopUpState {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'permission-denied';
    }
    if (error.status === 409) {
      return 'conflict';
    }
  }
  return 'network-error';
}

function historyErrorStatus(error: unknown): 'error' | 'permission-denied' {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return 'permission-denied';
  }
  return 'error';
}

function transactionTitle(type: string) {
  const types = th.consumerPortal.wallet.transactionTypes;
  if (type === 'PERSONAL_TOPUP' || type === 'TOPUP') {
    return types.personalTopUp;
  }
  if (type === 'SUBSIDY_GRANT') {
    return types.subsidyGrant;
  }
  if (
    type === 'PAYMENT' ||
    type === 'PAYMENT_PERSONAL' ||
    type === 'PAYMENT_SUBSIDY'
  ) {
    return types.payment;
  }
  if (type === 'MERCHANT_WITHDRAWAL_CREDIT') {
    return types.merchantWithdrawalCredit;
  }
  if (type === 'ADJUSTMENT') {
    return types.adjustment;
  }
  if (type === 'EXPIRY') {
    return types.expiry;
  }
  return types.other;
}

function transactionAmount(transaction: WalletTransactionItem) {
  const prefix =
    transaction.balanceAfter >= transaction.balanceBefore ? '+' : '-';
  return `${prefix}${formatBaht(Math.abs(transaction.amount))}`;
}

export function WalletView() {
  const [amount, setAmount] = useState('');
  const [walletState, setWalletState] = useState<WalletLoadState>({
    status: 'loading',
  });
  const [topUpState, setTopUpState] = useState<TopUpState>('idle');
  const [historyState, setHistoryState] = useState<WalletHistoryState>({
    status: 'loading',
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const attemptRef = useRef<TopUpAttempt | null>(null);
  const submittingRef = useRef(false);
  const historyRequestRef = useRef(0);
  const copy = th.consumerPortal.wallet;

  const loadWallet = async () => {
    try {
      const data = await getConsumerOverview();
      setWalletState({ status: 'success', data });
      return true;
    } catch (error) {
      setWalletState(loadErrorState(error));
      return false;
    }
  };

  const refreshWalletAfterTopUp = async () => {
    try {
      const data = await getConsumerOverview();
      setWalletState({ status: 'success', data });
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let isCurrent = true;
    void getConsumerOverview()
      .then((data) => {
        if (isCurrent) setWalletState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isCurrent) setWalletState(loadErrorState(error));
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const requestId = historyRequestRef.current + 1;
    historyRequestRef.current = requestId;
    const controller = new AbortController();

    void getWalletTransactions(
      walletHistoryQuery(dateFrom, dateTo),
      controller.signal,
    )
      .then((response) => {
        if (requestId === historyRequestRef.current) {
          setCurrentPage(1);
          setHistoryState({
            status: 'success',
            items: response.items,
            nextCursor: response.nextCursor,
            isLoadingMore: false,
            loadMoreError: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (
          requestId === historyRequestRef.current &&
          !controller.signal.aborted
        ) {
          setHistoryState({ status: historyErrorStatus(error) });
        }
      });

    return () => controller.abort();
  }, [dateFrom, dateTo, historyRefresh]);

  const loadMoreHistory = async () => {
    if (
      historyState.status !== 'success' ||
      !historyState.nextCursor ||
      historyState.isLoadingMore
    ) {
      return;
    }

    const requestId = historyRequestRef.current + 1;
    historyRequestRef.current = requestId;
    const currentItems = historyState.items;
    const cursor = historyState.nextCursor;
    setHistoryState({
      ...historyState,
      isLoadingMore: true,
      loadMoreError: false,
    });

    try {
      const response = await getWalletTransactions(
        walletHistoryQuery(dateFrom, dateTo, cursor),
      );
      if (requestId === historyRequestRef.current) {
        const knownIds = new Set(
          currentItems.map((item) => item.transactionId),
        );
        const addedItems = response.items.filter(
          (item) => !knownIds.has(item.transactionId),
        );
        const mergedItems = [...currentItems, ...addedItems];
        const nextPageNumber =
          addedItems.length > 0
            ? Math.floor(currentItems.length / WALLET_HISTORY_ITEMS_PER_PAGE) +
              1
            : currentPage;

        setCurrentPage(nextPageNumber);
        setHistoryState({
          status: 'success',
          items: mergedItems,
          nextCursor: response.nextCursor,
          isLoadingMore: false,
          loadMoreError: false,
        });
      }
    } catch {
      if (requestId === historyRequestRef.current) {
        setHistoryState({
          status: 'success',
          items: currentItems,
          nextCursor: cursor,
          isLoadingMore: false,
          loadMoreError: true,
        });
      }
    }
  };

  const showAllHistory = () => {
    setCurrentPage(1);
    setHistoryState({ status: 'loading' });
    setDateFrom('');
    setDateTo('');
    setHistoryRefresh((value) => value + 1);
  };

  const showCurrentMonth = () => {
    const month = currentBangkokMonth();
    setCurrentPage(1);
    setHistoryState({ status: 'loading' });
    setDateFrom(month.first);
    setDateTo(month.last);
  };

  const submitTopUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const numericAmount = Number(amount);
    if (
      !Number.isInteger(numericAmount) ||
      numericAmount < TOP_UP_MIN_BAHT ||
      numericAmount > TOP_UP_MAX_BAHT
    ) {
      setTopUpState('validation');
      return;
    }

    if (!attemptRef.current || attemptRef.current.amount !== numericAmount) {
      attemptRef.current = {
        amount: numericAmount,
        key: crypto.randomUUID(),
      };
    }

    submittingRef.current = true;
    setTopUpState('submitting');
    try {
      await topUpPersonalWallet(numericAmount, attemptRef.current.key);
      const refreshed = await refreshWalletAfterTopUp();
      if (refreshed) {
        setTopUpState('success');
        setAmount('');
        attemptRef.current = null;
        setCurrentPage(1);
        setHistoryState({ status: 'loading' });
        setDateFrom('');
        setDateTo('');
        setHistoryRefresh((value) => value + 1);
      } else {
        setTopUpState('refresh-error');
      }
    } catch (error) {
      setTopUpState(topUpErrorState(error));
    } finally {
      submittingRef.current = false;
    }
  };

  const handleAmountChange = (nextAmount: string) => {
    if (nextAmount !== amount) attemptRef.current = null;
    setAmount(nextAmount);
    setTopUpState('idle');
  };

  const isTopUpError =
    topUpState === 'permission-denied' ||
    topUpState === 'conflict' ||
    topUpState === 'network-error' ||
    topUpState === 'refresh-error';

  const topUpMessage =
    topUpState === 'validation'
      ? copy.invalidTopUp
      : topUpState === 'success'
        ? copy.topUpSuccess
        : topUpState === 'permission-denied'
          ? copy.permissionDenied
          : topUpState === 'conflict'
            ? copy.conflict
            : topUpState === 'network-error'
              ? copy.networkError
              : topUpState === 'refresh-error'
                ? copy.refreshError
                : topUpState === 'submitting'
                  ? copy.submitting
                  : '';

  if (walletState.status === 'loading') {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="space-y-6 animate-fade-in font-sans"
      >
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <LoadingState label={copy.loading} variant="dashboard" />
      </section>
    );
  }

  if (walletState.status === 'permission-denied') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center shadow-sm"
          role="alert"
        >
          <h2 className="text-lg font-extrabold text-red-700 mb-2">
            {copy.permissionDeniedTitle}
          </h2>
          <p className="text-sm font-medium text-red-600">
            {copy.permissionDeniedDescription}
          </p>
        </div>
      </section>
    );
  }

  if (walletState.status === 'error') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"
          role="alert"
        >
          <h2 className="text-lg font-extrabold text-slate-900 mb-1.5">
            {copy.loadErrorTitle}
          </h2>
          <p className="text-sm font-medium text-slate-600 mb-4">
            {copy.loadErrorDescription}
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
            onClick={() => {
              setWalletState({ status: 'loading' });
              void loadWallet();
            }}
            type="button"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {copy.retry}
          </button>
        </div>
      </section>
    );
  }

  const { wallet, program } = walletState.data;
  const currentMonth = currentBangkokMonth();
  const dailyUsagePercent =
    wallet.dailySubsidyLimit > 0
      ? Math.min(
          100,
          Math.round(
            (wallet.dailySubsidyUsed / wallet.dailySubsidyLimit) * 100,
          ),
        )
      : 0;

  const totalHistoryItems =
    historyState.status === 'success' ? historyState.items.length : 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalHistoryItems / WALLET_HISTORY_ITEMS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * WALLET_HISTORY_ITEMS_PER_PAGE;
  const pageEndIndex = Math.min(
    pageStartIndex + WALLET_HISTORY_ITEMS_PER_PAGE,
    totalHistoryItems,
  );
  const paginatedHistoryItems =
    historyState.status === 'success'
      ? historyState.items.slice(pageStartIndex, pageEndIndex)
      : [];

  return (
    <section className="space-y-6 animate-fade-in font-sans">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {/* 1. Balance KPI Grid (Unified Web Theme) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Personal Balance */}
        <article className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="size-2 rounded-full bg-[#0056b3]" />
              {copy.personalBalance}
            </span>
            <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
              <WalletCards className="size-5" aria-hidden="true" />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            ฿{formatBaht(wallet.personalBalance)}
          </strong>
        </article>

        {/* Subsidy Balance */}
        <article className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500" />
              {copy.subsidyBalance}
            </span>
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Coins className="size-5" aria-hidden="true" />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600">
            ฿{formatBaht(wallet.subsidyBalance)}
          </strong>
        </article>

        {/* Total Available Balance (Hero Blue Gradient) */}
        <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003d82] via-[#0056b3] to-[#0073e6] p-5 sm:p-6 text-white shadow-md shadow-blue-900/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-100">
              {copy.totalBalance}
            </span>
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-xs">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
          </div>
          <strong className="mt-3 block text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ฿{formatBaht(wallet.totalBalance)}
          </strong>
        </article>
      </div>

      {/* 2. Two-Column Section: Virtual Top-up & Subsidy Program */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Virtual Top-Up Form */}
        <form
          className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4"
          noValidate
          onSubmit={submitTopUp}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {copy.topUpTitle}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {copy.topUpDescription}
                </p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
                <Plus className="size-5" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="block text-xs font-bold text-slate-700"
                htmlFor="top-up-amount"
              >
                {copy.topUpAmount}
              </label>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition-all focus-within:border-[#0056b3] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
                <span className="text-base font-extrabold text-[#0056b3] pr-2.5">
                  ฿
                </span>
                <input
                  className="w-full bg-transparent text-base font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400 outline-none"
                  id="top-up-amount"
                  inputMode="numeric"
                  min={TOP_UP_MIN_BAHT}
                  max={TOP_UP_MAX_BAHT}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  placeholder={copy.topUpPlaceholder}
                  step="1"
                  type="number"
                  value={amount}
                />
              </div>

              {/* Quick Top-Up Amount Chips */}
              <div
                aria-label={copy.quickAmountLabel}
                className="flex flex-wrap gap-2 pt-1"
              >
                {TOP_UP_QUICK_AMOUNTS.map((presetAmount) => {
                  const isSelected = amount === String(presetAmount);
                  return (
                    <button
                      key={presetAmount}
                      type="button"
                      disabled={topUpState === 'submitting'}
                      onClick={() => handleAmountChange(String(presetAmount))}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? 'border-[#0056b3] bg-blue-50 text-[#0056b3] shadow-2xs'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50 hover:text-[#0056b3]'
                      }`}
                    >
                      +฿{presetAmount.toLocaleString(th.consumerDashboard.locale)}
                    </button>
                  );
                })}
              </div>

              <small className="block text-xs font-medium text-slate-400">
                {copy.maximum}
              </small>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              className="w-full rounded-2xl bg-[#0056b3] py-3.5 px-5 text-sm font-bold text-white shadow-sm shadow-blue-900/10 hover:bg-[#004494] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={topUpState === 'submitting'}
              type="submit"
            >
              {topUpState === 'submitting' ? copy.submitting : copy.topUpAction}
            </button>

            <p
              aria-live={isTopUpError ? 'assertive' : 'polite'}
              className={
                topUpMessage
                  ? `flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold ${
                      topUpState === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : isTopUpError || topUpState === 'validation'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-blue-200 bg-blue-50 text-[#0056b3]'
                    }`
                  : 'sr-only'
              }
              role={isTopUpError ? 'alert' : undefined}
            >
              {topUpState === 'success' && (
                <CheckCircle2
                  className="size-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              )}
              {(isTopUpError || topUpState === 'validation') && (
                <AlertCircle
                  className="size-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
              )}
              <span>{topUpMessage}</span>
            </p>
          </div>
        </form>

        {/* Right: Subsidy Program & Daily Rights Card */}
        <article className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                  program
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-100 text-slate-600'
                }`}
              >
                <Clock3 className="size-3.5" aria-hidden="true" />
                {program
                  ? copy.programPeriod(
                      dateTimeFormatter.format(new Date(program.startDate)),
                      dateTimeFormatter.format(new Date(program.endDate)),
                    )
                  : copy.noProgram}
              </span>
            </div>

            <h2 className="text-lg font-extrabold text-slate-900">
              {program?.programName ?? copy.noProgram}
            </h2>

            {/* Daily Subsidy Progress Bar */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                <span>{copy.dailyUsageLabel}</span>
                <span className="text-[#0056b3]">{dailyUsagePercent}%</span>
              </div>
              <div
                aria-label={copy.dailyUsageLabel}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={dailyUsagePercent}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0056b3] to-emerald-500 transition-all duration-300"
                  style={{ width: `${dailyUsagePercent}%` }}
                />
              </div>
            </div>

            {/* 2x2 Program Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                <small className="block text-xs font-semibold text-slate-500">
                  {copy.dailyCap}
                </small>
                <strong className="mt-1 block text-lg font-extrabold text-slate-900">
                  ฿{formatBaht(wallet.dailySubsidyLimit)}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                <small className="block text-xs font-semibold text-slate-500">
                  {copy.dailyUsed}
                </small>
                <strong className="mt-1 block text-lg font-extrabold text-slate-900">
                  ฿{formatBaht(wallet.dailySubsidyUsed)}
                </strong>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                <small className="block text-xs font-semibold text-emerald-700">
                  {copy.dailyRemaining}
                </small>
                <strong className="mt-1 block text-lg font-extrabold text-emerald-600">
                  ฿{formatBaht(wallet.dailySubsidyRemaining)}
                </strong>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5">
                <small className="block text-xs font-semibold text-[#0056b3]">
                  {copy.subsidyRate}
                </small>
                <strong className="mt-1 block text-lg font-extrabold text-[#0056b3]">
                  {program?.subsidyPercentage ?? 0}%
                </strong>
              </div>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-400 border-t border-slate-100 pt-3">
            {copy.dailyTimezone}
          </p>
        </article>
      </div>

      {/* 3. Wallet Transaction History with Filter Bar & Pagination */}
      <article className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
              <CalendarDays className="size-5" aria-hidden="true" />
            </div>
            <div>
              <strong className="block text-lg font-extrabold text-slate-900">
                {copy.historyTitle}
              </strong>
              <span className="text-xs font-medium text-slate-500">
                {copy.historyFilterTitle}
              </span>
            </div>
          </div>

          <small className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-bold text-slate-600">
            {copy.resultPrefix} {totalHistoryItems} {copy.resultSuffix}
          </small>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <button
              aria-pressed={!dateFrom && !dateTo}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                !dateFrom && !dateTo
                  ? 'bg-[#0056b3] text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-[#0056b3]'
              }`}
              onClick={showAllHistory}
              type="button"
            >
              {copy.filterAll}
            </button>
            <button
              aria-pressed={
                dateFrom === currentMonth.first && dateTo === currentMonth.last
              }
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                dateFrom === currentMonth.first && dateTo === currentMonth.last
                  ? 'bg-[#0056b3] text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-[#0056b3]'
              }`}
              onClick={showCurrentMonth}
              type="button"
            >
              {copy.filterMonth}
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-bold text-slate-600">
              <span>{copy.dateFrom}</span>
              <input
                aria-label={copy.dateFrom}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#0056b3] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                max={dateTo || undefined}
                onChange={(event) => {
                  setCurrentPage(1);
                  setHistoryState({ status: 'loading' });
                  setDateFrom(event.target.value);
                }}
                type="date"
                value={dateFrom}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-600">
              <span>{copy.dateTo}</span>
              <input
                aria-label={copy.dateTo}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#0056b3] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                min={dateFrom || undefined}
                onChange={(event) => {
                  setCurrentPage(1);
                  setHistoryState({ status: 'loading' });
                  setDateTo(event.target.value);
                }}
                type="date"
                value={dateTo}
              />
            </label>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-[#0056b3] transition-colors cursor-pointer"
              onClick={showAllHistory}
              type="button"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {copy.clearFilter}
            </button>
          </div>
        </div>

        {/* History States */}
        {historyState.status === 'loading' && (
          <LoadingState label={copy.historyLoading} variant="table" />
        )}

        {historyState.status === 'permission-denied' && (
          <div
            className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center"
            role="alert"
          >
            <p className="text-sm font-bold text-red-700">
              {copy.historyPermissionDenied}
            </p>
          </div>
        )}

        {historyState.status === 'error' && (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center gap-3"
            role="alert"
          >
            <p className="text-sm font-semibold text-red-700">
              {copy.historyError}
            </p>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#004494] transition-colors cursor-pointer"
              onClick={() => {
                setHistoryState({ status: 'loading' });
                setHistoryRefresh((value) => value + 1);
              }}
              type="button"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {copy.retry}
            </button>
          </div>
        )}

        {historyState.status === 'success' && historyState.items.length > 0 && (
          <div className="space-y-4">
            {/* Paginated Transaction Rows */}
            <div className="space-y-2.5">
              {paginatedHistoryItems.map((item) => {
                const isCredit = item.balanceAfter >= item.balanceBefore;
                const isSubsidy = item.fundType === 'SUBSIDY';

                return (
                  <div
                    key={item.transactionId}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 transition-all hover:border-blue-200/80 hover:bg-blue-50/20"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                          isCredit
                            ? 'border-emerald-200/70 bg-emerald-50 text-emerald-600'
                            : 'border-blue-200/70 bg-blue-50 text-[#0056b3]'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft
                            className="size-5"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowUpRight className="size-5" aria-hidden="true" />
                        )}
                      </span>

                      <span className="min-w-0">
                        <strong className="block text-sm font-bold text-slate-900 truncate">
                          {transactionTitle(item.transactionType)}
                        </strong>
                        <small className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              isSubsidy
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-blue-50 text-[#0056b3] border border-blue-200/60'
                            }`}
                          >
                            {copy.fundTypes[isSubsidy ? 'subsidy' : 'personal']}
                          </span>
                          <span>·</span>
                          <time dateTime={item.createdAt}>
                            {dateTimeFormatter.format(new Date(item.createdAt))}
                          </time>
                        </small>
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <strong
                        className={`block font-mono text-sm sm:text-base font-extrabold ${
                          isCredit ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {transactionAmount(item)}
                      </strong>
                      <span className="mt-0.5 block font-mono text-[11px] font-medium text-slate-400">
                        {copy.balanceAfterLabel(formatBaht(item.balanceAfter))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {historyState.loadMoreError && (
              <p
                aria-live="assertive"
                className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700"
                role="alert"
              >
                <AlertCircle
                  className="size-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                {copy.loadMoreError}
              </p>
            )}

            {/* Pagination Footer */}
            <nav
              aria-label={copy.pagination.label}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>
                  {copy.pagination.showingRange(
                    pageStartIndex + 1,
                    pageEndIndex,
                    totalHistoryItems,
                  )}
                </span>
                <span>·</span>
                <span className="text-slate-700 font-bold">
                  {copy.pagination.pageSummary(safeCurrentPage, totalPages)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:text-[#0056b3] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  {copy.pagination.previous}
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    aria-label={copy.pagination.page(pageNumber)}
                    aria-current={
                      pageNumber === safeCurrentPage ? 'page' : undefined
                    }
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`min-w-8 rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                      pageNumber === safeCurrentPage
                        ? 'bg-[#0056b3] text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-[#0056b3]'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={
                    safeCurrentPage === totalPages &&
                    (!historyState.nextCursor || historyState.isLoadingMore)
                  }
                  onClick={() => {
                    if (safeCurrentPage < totalPages) {
                      setCurrentPage(safeCurrentPage + 1);
                    } else if (historyState.nextCursor) {
                      void loadMoreHistory();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:text-[#0056b3] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  {copy.pagination.next}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </nav>

            {historyState.nextCursor && (
              <div className="pt-1 text-center">
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs font-bold text-[#0056b3] hover:bg-[#0056b3] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  disabled={historyState.isLoadingMore}
                  onClick={() => void loadMoreHistory()}
                  type="button"
                >
                  {historyState.isLoadingMore
                    ? copy.loadingMore
                    : copy.loadMore}
                </button>
              </div>
            )}
          </div>
        )}

        {historyState.status === 'success' &&
          historyState.items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
                <CalendarDays className="size-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-600">
                {copy.noResults}
              </p>
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={showAllHistory}
                type="button"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {copy.clearFilter}
              </button>
            </div>
          )}
      </article>
    </section>
  );
}
