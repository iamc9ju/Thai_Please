import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Gift,
  Info,
  QrCode,
  RotateCcw,
  Sparkles,
  Store,
  TicketPercent,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import {
  getConsumerCoupons,
  getConsumerPoints,
  redeemConsumerCoupon,
} from '../api/consumer.api';
import { PortalPageHeader } from '../components/PortalPageHeader';
import type {
  ConsumerCouponsResponse,
  ConsumerPointsResponse,
  ConsumerPointTransactionItem,
  ConsumerView,
  CouponCatalogueItem,
  OwnedConsumerCoupon,
} from '../consumer.types';

const dateFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeZone: th.consumerDashboard.timeZone,
});

const dateTimeFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});

const numberFormatter = new Intl.NumberFormat(th.consumerDashboard.locale);

function formatCouponDiscount(
  discountType: string,
  discountValue: number,
): string {
  if (discountType === 'PERCENTAGE' || discountType === 'PERCENT') {
    return `ลด ${numberFormatter.format(discountValue)}%`;
  }
  return `ลด ฿${numberFormatter.format(discountValue)}`;
}

function getPointTransactionTitle(tx: ConsumerPointTransactionItem): string {
  const copy = th.consumerPortal.rewards;
  if (tx.sourceName) {
    if (tx.points > 0) {
      return `${copy.questRewardLabel}: ${tx.sourceName}`;
    }
    return `${copy.couponRedeemLabel}: ${tx.sourceName}`;
  }
  if (tx.transactionType === 'QUEST_REWARD') {
    return copy.questRewardLabel;
  }
  if (tx.transactionType === 'COUPON_REDEEM') {
    return copy.couponRedeemLabel;
  }
  if (tx.transactionType === 'EXPIRE' || tx.transactionType === 'EXPIRED') {
    return copy.pointExpireLabel;
  }
  return tx.transactionType;
}

export type CouponsViewProps = Readonly<{
  onNavigate?: (view: ConsumerView) => void;
  onCouponRedeemed?: () => void;
}>;

type RewardsLoadState =
  | { status: 'loading' }
  | {
      status: 'success';
      points: ConsumerPointsResponse;
      coupons: ConsumerCouponsResponse;
    }
  | { status: 'permission-denied' }
  | { status: 'error' };

export function CouponsView({
  onNavigate,
  onCouponRedeemed,
}: CouponsViewProps) {
  const copy = th.consumerPortal.rewards;
  const [loadState, setLoadState] = useState<RewardsLoadState>({
    status: 'loading',
  });
  const [redeemingCouponId, setRedeemingCouponId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchRewardsData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [points, coupons] = await Promise.all([
        getConsumerPoints(signal),
        getConsumerCoupons(signal),
      ]);
      if (signal?.aborted) return;
      setLoadState({ status: 'success', points, coupons });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        setLoadState({ status: 'permission-denied' });
      } else {
        setLoadState({ status: 'error' });
      }
    }
  }, []);

  const handleRetry = () => {
    setLoadState({ status: 'loading' });
    void fetchRewardsData();
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchRewardsData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchRewardsData]);

  const handleRedeem = async (item: CouponCatalogueItem) => {
    if (redeemingCouponId) return;
    setRedeemingCouponId(item.couponId);
    setFeedback(null);

    try {
      const result = await redeemConsumerCoupon(item.couponId);
      setFeedback({
        type: 'success',
        message: copy.redeemSuccess(item.couponName, result.pointsDeducted),
      });
      const [points, coupons] = await Promise.all([
        getConsumerPoints(),
        getConsumerCoupons(),
      ]);
      setLoadState({ status: 'success', points, coupons });
      onCouponRedeemed?.();
    } catch (err) {
      const errMsg =
        err instanceof ApiError && err.message ? err.message : copy.redeemError;
      setFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setRedeemingCouponId(null);
    }
  };

  if (loadState.status === 'loading') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="polite"
          className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm"
          role="status"
        >
          <div className="mb-3 inline-block size-8 animate-spin rounded-full border-3 border-solid border-[#0056b3] border-r-transparent" />
          <p className="text-sm font-medium text-slate-600">{copy.loading}</p>
        </div>
      </section>
    );
  }

  if (loadState.status === 'permission-denied') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="assertive"
          className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center shadow-sm"
          role="alert"
        >
          <p className="text-sm font-bold text-red-700">
            {copy.permissionDenied}
          </p>
        </div>
      </section>
    );
  }

  if (loadState.status === 'error') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="assertive"
          className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"
          role="alert"
        >
          <p className="mb-4 text-sm font-semibold text-slate-800">
            {copy.loadError}
          </p>
          <button
            onClick={handleRetry}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {copy.retry}
          </button>
        </div>
      </section>
    );
  }

  const { points, coupons } = loadState;
  const pointBalance = points.pointBalance;
  const availableOwnedCoupons = coupons.ownedCoupons.filter(
    (c: OwnedConsumerCoupon) => c.status === 'AVAILABLE',
  );

  return (
    <section className="space-y-6 animate-fade-in font-sans">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {feedback && (
        <div
          aria-live="polite"
          role="status"
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <Info
                className="h-5 w-5 shrink-0 text-red-600"
                aria-hidden="true"
              />
            )}
            <span>{feedback.message}</span>
          </div>
          {feedback.type === 'success' && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('payment')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056b3] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#004494] transition-colors cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.useNowAction}
            </button>
          )}
        </div>
      )}

      {/* Top Grid: Point Balance Card (Blue Theme) + Point History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Point Balance Hero Card */}
        <article className="lg:col-span-5 flex flex-col justify-between rounded-3xl bg-gradient-to-br from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg shadow-blue-900/15">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-blue-50 backdrop-blur-xs">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.pointBalance}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-6">
              <strong className="block text-4xl font-extrabold tracking-tight">
                {pointBalance.toLocaleString('th-TH')}
              </strong>
              <span className="mt-1 block text-xs font-semibold text-blue-100">
                {th.consumerPortal.common.points}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs border border-white/15">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-50">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {points.expiringPoints > 0 && points.nearestExpiryAt
                  ? copy.expiringSoonFormat(
                      points.expiringPoints,
                      dateFormatter.format(new Date(points.nearestExpiryAt)),
                    )
                  : copy.noExpiringPoints}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-blue-100/90">
              {copy.usageNote}
            </p>
          </div>
        </article>

        {/* Point History Card (FR-C08) */}
        <article className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {copy.pointHistory}
              </h2>
              <p className="text-xs font-medium text-slate-500">
                {copy.description}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          {points.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                {copy.emptyPointHistory}
              </p>
            </div>
          ) : (
            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {points.items.map((item) => {
                const isPositive = item.points > 0;
                return (
                  <div
                    key={item.pointTransactionId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 transition-colors hover:bg-blue-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isPositive
                            ? 'bg-blue-100/80 text-[#0056b3]'
                            : 'bg-slate-200/70 text-slate-600'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDownRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <div>
                        <strong className="block text-sm font-bold text-slate-900">
                          {getPointTransactionTitle(item)}
                        </strong>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>
                            {dateTimeFormatter.format(new Date(item.createdAt))}
                          </span>
                          {item.expiresAt && isPositive && (
                            <span className="text-blue-700 font-medium">
                              {copy.pointExpiresPrefix}{' '}
                              {dateFormatter.format(new Date(item.expiresAt))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <strong
                      className={`text-sm font-extrabold ${
                        isPositive ? 'text-[#0056b3]' : 'text-slate-700'
                      }`}
                    >
                      {isPositive ? `+${item.points}` : `${item.points}`}{' '}
                      {th.consumerPortal.common.points}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>

      {/* My Coupons Section (FR-C09) */}
      <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">
                {copy.myCoupons}
              </h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-extrabold text-[#0056b3]">
                {availableOwnedCoupons.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {copy.usageNote}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
            <TicketPercent className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        {coupons.ownedCoupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              {copy.emptyMyCoupons}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {coupons.ownedCoupons.map((coupon) => {
              const isAvailable = coupon.status === 'AVAILABLE';
              const isUsed = coupon.status === 'USED';

              return (
                <div
                  key={coupon.userCouponId}
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                    isAvailable
                      ? 'border-blue-200/90 bg-gradient-to-br from-blue-50/60 via-white to-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0056b3] px-2.5 py-1 text-xs font-extrabold text-white">
                        <TicketPercent
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {formatCouponDiscount(
                          coupon.discountType,
                          coupon.discountValue,
                        )}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isUsed
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isAvailable
                          ? copy.availableBadge
                          : isUsed
                            ? copy.usedBadge
                            : copy.expiredBadge}
                      </span>
                    </div>

                    <strong className="mt-3 block text-base font-extrabold text-slate-900">
                      {coupon.couponName}
                    </strong>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {coupon.minPurchase > 0
                        ? copy.minPurchaseCondition(
                            numberFormatter.format(coupon.minPurchase),
                          )
                        : copy.noMinPurchase}
                      {' · '}
                      {coupon.merchantName ?? copy.allMerchants}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.pointExpiresPrefix}{' '}
                      {dateFormatter.format(new Date(coupon.expiresAt))}
                    </span>
                    {isAvailable && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('payment')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056b3] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#004494] transition-colors cursor-pointer"
                      >
                        <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy.useNowAction}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>

      {/* Coupon Catalogue Section (FR-C09) */}
      <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {copy.catalogue}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {copy.usageNote}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        {coupons.catalogue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              {copy.emptyCatalogue}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {coupons.catalogue.map((item) => {
              const canAfford = pointBalance >= item.pointCost;
              const isRedeeming = redeemingCouponId === item.couponId;

              return (
                <div
                  key={item.couponId}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-[#0056b3]">
                        {formatCouponDiscount(
                          item.discountType,
                          item.discountValue,
                        )}
                      </span>
                      <strong className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-[#0056b3] border border-blue-200/60">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {item.pointCost.toLocaleString('th-TH')}{' '}
                        {th.consumerPortal.common.points}
                      </strong>
                    </div>

                    <strong className="mt-3 block text-base font-extrabold text-slate-900">
                      {item.couponName}
                    </strong>

                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {item.minPurchase > 0
                        ? copy.minPurchaseCondition(
                            numberFormatter.format(item.minPurchase),
                          )
                        : copy.noMinPurchase}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Store className="h-3 w-3" aria-hidden="true" />
                        {item.merchantName ?? copy.allMerchants}
                      </span>
                      <span>·</span>
                      <span>{copy.validityDaysNote(item.validityDays)}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={!canAfford || isRedeeming}
                      onClick={() => void handleRedeem(item)}
                      className={`w-full rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                        canAfford
                          ? 'bg-[#0056b3] text-white shadow-xs hover:bg-[#004494] cursor-pointer'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isRedeeming
                        ? copy.redeeming
                        : canAfford
                          ? copy.redeem
                          : copy.insufficientPoints}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
