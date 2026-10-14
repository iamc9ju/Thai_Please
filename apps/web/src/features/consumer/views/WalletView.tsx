import {
  CalendarDays,
  Coins,
  Plus,
  RotateCcw,
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
  if (type === 'PERSONAL_TOPUP' || type === 'TOPUP') {
    return th.consumerPortal.wallet.transactionTypes.personalTopUp;
  }
  if (type === 'SUBSIDY_GRANT') {
    return th.consumerPortal.wallet.transactionTypes.subsidyGrant;
  }
  if (type === 'PAYMENT') {
    return th.consumerPortal.wallet.transactionTypes.payment;
  }
  return th.consumerPortal.wallet.transactionTypes.other;
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
        setHistoryState({
          status: 'success',
          items: [
            ...currentItems,
            ...response.items.filter(
              (item) => !knownIds.has(item.transactionId),
            ),
          ],
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
    setHistoryState({ status: 'loading' });
    setDateFrom('');
    setDateTo('');
    setHistoryRefresh((value) => value + 1);
  };

  const showCurrentMonth = () => {
    const month = currentBangkokMonth();
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
      <section aria-busy="true" aria-live="polite" className="consumer-view">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div className="portal-card order-empty-state" role="status">
          <p>{copy.loading}</p>
        </div>
      </section>
    );
  }

  if (walletState.status === 'permission-denied') {
    return (
      <section className="consumer-view">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div className="portal-card order-empty-state" role="alert">
          <h2>{copy.permissionDeniedTitle}</h2>
          <p>{copy.permissionDeniedDescription}</p>
        </div>
      </section>
    );
  }

  if (walletState.status === 'error') {
    return (
      <section className="consumer-view">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div className="portal-card order-empty-state" role="alert">
          <h2>{copy.loadErrorTitle}</h2>
          <p>{copy.loadErrorDescription}</p>
          <button
            onClick={() => {
              setWalletState({ status: 'loading' });
              void loadWallet();
            }}
            type="button"
          >
            {copy.retry}
          </button>
        </div>
      </section>
    );
  }

  const { wallet, program } = walletState.data;
  const currentMonth = currentBangkokMonth();

  return (
    <section className="consumer-view">
      <PortalPageHeader
        eyebrow={th.consumerPortal.wallet.eyebrow}
        title={th.consumerPortal.wallet.title}
        description={th.consumerPortal.wallet.description}
      />
      <div className="portal-balance-grid">
        <article>
          <WalletCards aria-hidden="true" />
          <span>{th.consumerPortal.wallet.personalBalance}</span>
          <strong>฿{formatBaht(wallet.personalBalance)}</strong>
        </article>
        <article>
          <Coins aria-hidden="true" />
          <span>{th.consumerPortal.wallet.subsidyBalance}</span>
          <strong>฿{formatBaht(wallet.subsidyBalance)}</strong>
        </article>
        <article>
          <span>{th.consumerPortal.wallet.totalBalance}</span>
          <strong>฿{formatBaht(wallet.totalBalance)}</strong>
        </article>
      </div>

      <div className="portal-two-column">
        <form
          className="portal-card top-up-form"
          noValidate
          onSubmit={submitTopUp}
        >
          <div className="portal-card-heading">
            <div>
              <h2>{th.consumerPortal.wallet.topUpTitle}</h2>
              <p>{th.consumerPortal.wallet.topUpDescription}</p>
            </div>
            <Plus aria-hidden="true" />
          </div>
          <label htmlFor="top-up-amount">
            {th.consumerPortal.wallet.topUpAmount}
          </label>
          <div className="amount-input">
            <span>฿</span>
            <input
              id="top-up-amount"
              inputMode="numeric"
              min={TOP_UP_MIN_BAHT}
              max={TOP_UP_MAX_BAHT}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder={th.consumerPortal.wallet.topUpPlaceholder}
              step="1"
              type="number"
              value={amount}
            />
          </div>
          <small>{th.consumerPortal.wallet.maximum}</small>
          <button
            className="portal-primary-button"
            disabled={topUpState === 'submitting'}
            type="submit"
          >
            {topUpState === 'submitting' ? copy.submitting : copy.topUpAction}
          </button>
          <p
            aria-live={
              topUpState === 'permission-denied' ||
              topUpState === 'conflict' ||
              topUpState === 'network-error' ||
              topUpState === 'refresh-error'
                ? 'assertive'
                : 'polite'
            }
            className="portal-form-message"
            role={
              topUpState === 'permission-denied' ||
              topUpState === 'conflict' ||
              topUpState === 'network-error' ||
              topUpState === 'refresh-error'
                ? 'alert'
                : undefined
            }
          >
            {topUpMessage}
          </p>
        </form>

        <article className="portal-card subsidy-program-card">
          <span className="portal-status">
            {program
              ? copy.programPeriod(
                  dateTimeFormatter.format(new Date(program.startDate)),
                  dateTimeFormatter.format(new Date(program.endDate)),
                )
              : copy.noProgram}
          </span>
          <h2>{program?.programName ?? copy.noProgram}</h2>
          <div className="program-stats">
            <span>
              <small>{th.consumerPortal.wallet.dailyCap}</small>
              <strong>฿{formatBaht(wallet.dailySubsidyLimit)}</strong>
            </span>
            <span>
              <small>{th.consumerPortal.wallet.dailyUsed}</small>
              <strong>฿{formatBaht(wallet.dailySubsidyUsed)}</strong>
            </span>
            <span>
              <small>{th.consumerPortal.wallet.dailyRemaining}</small>
              <strong>฿{formatBaht(wallet.dailySubsidyRemaining)}</strong>
            </span>
            <span>
              <small>{th.consumerPortal.wallet.subsidyRate}</small>
              <strong>{program?.subsidyPercentage ?? 0}%</strong>
            </span>
          </div>
          <p>{th.consumerPortal.wallet.dailyTimezone}</p>
        </article>
      </div>

      <article className="portal-card wallet-history-card">
        <div className="order-filter-heading">
          <span>
            <CalendarDays aria-hidden="true" />
            <strong>{copy.historyTitle}</strong>
          </span>
          <small>
            {copy.resultPrefix}{' '}
            {historyState.status === 'success' ? historyState.items.length : 0}{' '}
            {copy.resultSuffix}
          </small>
        </div>
        <div className="order-filter-controls wallet-history-filters">
          <div className="order-filter-presets">
            <button
              aria-pressed={!dateFrom && !dateTo}
              className={!dateFrom && !dateTo ? 'is-active' : undefined}
              onClick={showAllHistory}
              type="button"
            >
              {copy.filterAll}
            </button>
            <button
              aria-pressed={
                dateFrom === currentMonth.first && dateTo === currentMonth.last
              }
              className={
                dateFrom === currentMonth.first && dateTo === currentMonth.last
                  ? 'is-active'
                  : undefined
              }
              onClick={showCurrentMonth}
              type="button"
            >
              {copy.filterMonth}
            </button>
          </div>
          <div className="order-date-fields">
            <label>
              {copy.dateFrom}
              <input
                aria-label={copy.dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  setHistoryState({ status: 'loading' });
                  setDateFrom(event.target.value);
                }}
                type="date"
                value={dateFrom}
              />
            </label>
            <label>
              {copy.dateTo}
              <input
                aria-label={copy.dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  setHistoryState({ status: 'loading' });
                  setDateTo(event.target.value);
                }}
                type="date"
                value={dateTo}
              />
            </label>
            <button onClick={showAllHistory} type="button">
              <RotateCcw aria-hidden="true" />
              {copy.clearFilter}
            </button>
          </div>
        </div>
        {historyState.status === 'loading' && (
          <div
            aria-live="polite"
            className="wallet-history-empty"
            role="status"
          >
            <p>{copy.historyLoading}</p>
          </div>
        )}
        {historyState.status === 'permission-denied' && (
          <div className="wallet-history-empty" role="alert">
            <p>{copy.historyPermissionDenied}</p>
          </div>
        )}
        {historyState.status === 'error' && (
          <div className="wallet-history-empty" role="alert">
            <p>{copy.historyError}</p>
            <button
              onClick={() => {
                setHistoryState({ status: 'loading' });
                setHistoryRefresh((value) => value + 1);
              }}
              type="button"
            >
              {copy.retry}
            </button>
          </div>
        )}
        {historyState.status === 'success' && historyState.items.length > 0 && (
          <>
            <div className="portal-history-list">
              {historyState.items.map((item) => (
                <div key={item.transactionId}>
                  <span>
                    <strong>{transactionTitle(item.transactionType)}</strong>
                    <small>
                      {
                        copy.fundTypes[
                          item.fundType === 'SUBSIDY' ? 'subsidy' : 'personal'
                        ]
                      }{' '}
                      ·{' '}
                      <time dateTime={item.createdAt}>
                        {dateTimeFormatter.format(new Date(item.createdAt))}
                      </time>
                    </small>
                  </span>
                  <strong
                    className={
                      item.balanceAfter >= item.balanceBefore
                        ? 'amount-positive'
                        : undefined
                    }
                  >
                    {transactionAmount(item)}
                  </strong>
                </div>
              ))}
            </div>
            {historyState.loadMoreError && (
              <p
                aria-live="assertive"
                className="portal-form-message"
                role="alert"
              >
                {copy.loadMoreError}
              </p>
            )}
            {historyState.nextCursor && (
              <button
                className="portal-primary-button"
                disabled={historyState.isLoadingMore}
                onClick={() => void loadMoreHistory()}
                type="button"
              >
                {historyState.isLoadingMore ? copy.loadingMore : copy.loadMore}
              </button>
            )}
          </>
        )}
        {historyState.status === 'success' &&
          historyState.items.length === 0 && (
            <div className="wallet-history-empty">
              <CalendarDays aria-hidden="true" />
              <p>{copy.noResults}</p>
              <button onClick={showAllHistory} type="button">
                {copy.clearFilter}
              </button>
            </div>
          )}
      </article>
    </section>
  );
}
