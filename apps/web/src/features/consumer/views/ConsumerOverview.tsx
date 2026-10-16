import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  History,
  Plus,
  QrCode,
  ReceiptText,
  Ticket,
} from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import type {
  ConsumerOverviewLoadState,
  ConsumerOverviewResponse,
  ConsumerSubsidyStatusResponse,
  ConsumerView,
} from '../consumer.types';

type ConsumerOverviewProps = Readonly<{
  displayName: string;
  maskedCitizenId: string;
  announcement: string;
  overviewState: ConsumerOverviewLoadState;
  onNavigate: (view: ConsumerView) => void;
  onRetry: () => void;
}>;

const bahtFormatter = new Intl.NumberFormat(th.consumerDashboard.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});

const dateFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeZone: th.consumerDashboard.timeZone,
});

function formatBaht(amount: number) {
  return bahtFormatter.format(amount);
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value)).replace(' เวลา ', ' · ');
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function OverviewStatus({
  state,
  onRetry,
}: Readonly<{
  state: Exclude<ConsumerOverviewLoadState, { status: 'success' }>;
  onRetry: () => void;
}>) {
  if (state.status === 'loading') {
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        role="status"
        className="p-10 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs"
      >
        <div className="inline-block size-8 animate-spin rounded-full border-3 border-solid border-[#0056b3] border-r-transparent mb-3" />
        <p className="text-slate-500 font-medium text-sm">
          {th.consumerDashboard.states.loading}
        </p>
      </section>
    );
  }

  if (state.status === 'permission-denied') {
    return (
      <section
        aria-live="assertive"
        role="alert"
        className="p-8 text-center bg-white rounded-3xl border border-red-200 shadow-xs"
      >
        <h2 className="text-lg font-bold text-red-600 mb-2">
          {th.consumerDashboard.states.permissionDeniedTitle}
        </h2>
        <p className="text-slate-600 text-sm">
          {th.consumerDashboard.states.permissionDeniedDescription}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-live="assertive"
      className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs"
    >
      <h2 className="text-lg font-bold text-slate-900 mb-2">
        {th.consumerDashboard.states.errorTitle}
      </h2>
      <p className="text-slate-600 text-sm mb-4">
        {th.consumerDashboard.states.errorDescription}
      </p>
      <button
        onClick={onRetry}
        type="button"
        className="px-5 py-2.5 rounded-xl bg-[#0056b3] text-white text-sm font-bold shadow-xs hover:bg-[#004494] transition-all cursor-pointer"
      >
        {th.consumerDashboard.states.retry}
      </button>
    </section>
  );
}

function OverviewContent({
  data,
  subsidy,
  onNavigate,
}: Readonly<{
  data: ConsumerOverviewResponse;
  subsidy: ConsumerSubsidyStatusResponse;
  onNavigate: (view: ConsumerView) => void;
}>) {
  const [showBalance, setShowBalance] = useState(true);
  const { wallet, quests, coupons, recentOrders } = data;
  const { program } = subsidy;
  const activeQuest = quests[0];
  const activeCoupon = coupons[0];
  const dailyUsagePercent =
    subsidy.dailySubsidyLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (subsidy.dailySubsidyUsed / subsidy.dailySubsidyLimit) * 100,
            ),
          ),
        )
      : 0;

  return (
    <>
      {/* Row 1: Wallet Card + Daily Subsidy & Points Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
        {/* Left: My Wallet Card */}
        <article className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            {/* Card Header: Icon + Title + Eye Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/images/wallet-blue-icon.png"
                  alt={th.consumerDashboard.wallet.eyebrow}
                  className="size-10 sm:size-11 object-contain shrink-0"
                />
                <strong className="text-lg font-bold text-slate-900 tracking-tight">
                  {th.consumerDashboard.wallet.eyebrow}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setShowBalance((prev) => !prev)}
                className="size-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                aria-label={
                  showBalance
                    ? th.consumerDashboard.wallet.hideBalance
                    : th.consumerDashboard.wallet.showBalance
                }
              >
                {showBalance ? (
                  <Eye className="size-4.5" />
                ) : (
                  <EyeOff className="size-4.5" />
                )}
              </button>
            </div>

            {/* Fund Breakdown: Personal & Subsidy */}
            <div className="grid grid-cols-2 gap-4 pb-6">
              {/* Personal Fund */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                  <span className="size-2 rounded-full bg-blue-600 inline-block" />
                  <span>{th.consumerDashboard.wallet.personal}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-900">
                  {showBalance
                    ? `฿${formatBaht(wallet.personalBalance)}`
                    : '••••••'}
                </div>
              </div>

              {/* Subsidy Fund */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                  <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                  <span>{th.consumerDashboard.wallet.subsidy}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-900">
                  {showBalance
                    ? `฿${formatBaht(subsidy.subsidyBalance)}`
                    : '••••••'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0056b3] text-white font-bold text-sm hover:bg-[#004494] active:scale-98 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{th.consumerDashboard.wallet.topUp}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-blue-200/80 bg-white text-[#0056b3] font-bold text-sm hover:bg-blue-50/50 active:scale-98 transition-all cursor-pointer"
            >
              <History className="size-4" aria-hidden="true" />
              <span>{th.consumerDashboard.wallet.history}</span>
            </button>
          </div>
        </article>

        {/* Right: Daily Subsidy & Reward Points Column */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Daily Subsidy Card */}
          <article className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3.5 mb-2.5">
                <img
                  src="/images/subsidy-icon.png"
                  alt={th.consumerDashboard.wallet.subsidy}
                  className="size-11 object-contain shrink-0"
                />
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    {th.consumerDashboard.wallet.dailyRemaining}
                  </p>
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    ฿{formatBaht(subsidy.dailySubsidyRemaining)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-2.5">
                {th.consumerDashboard.wallet.dailyUsage(
                  formatBaht(subsidy.dailySubsidyUsed),
                  formatBaht(subsidy.dailySubsidyLimit),
                )}
              </p>

              {/* Progress Bar */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-label={th.consumerDashboard.wallet.dailyProgressLabel}
                  aria-valuenow={dailyUsagePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${dailyUsagePercent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-400 shrink-0">
                  {dailyUsagePercent}%
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 space-y-0.5 pt-2 border-t border-slate-50">
              <p className="font-semibold text-slate-600 truncate">
                {program?.programName ??
                  th.consumerDashboard.wallet.noActiveProgram}
              </p>
              {program && (
                <p className="text-slate-400">
                  {th.consumerDashboard.wallet.programDetail(
                    program.subsidyPercentage,
                    formatDate(program.startDate),
                    formatDate(program.endDate),
                  )}
                </p>
              )}
            </div>
          </article>

          {/* Reward Points Card */}
          <article className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <img
                src="/images/points-coin-icon.png"
                alt={th.consumerDashboard.points.title}
                className="size-11 object-contain shrink-0"
              />
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  {th.consumerDashboard.points.title}
                </p>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {wallet.pointBalance.toLocaleString(
                    th.consumerDashboard.locale,
                  )}{' '}
                  <span className="text-sm font-bold text-slate-600">
                    {th.consumerDashboard.points.unit}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('rewards')}
              className="text-xs sm:text-sm font-bold text-[#0056b3] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{th.consumerDashboard.points.history}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </article>
        </div>
      </div>

      {/* Row 2: Scan to Pay Banner */}
      <article className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 sm:size-16 flex items-center justify-center shrink-0">
            <img
              src="/images/scan-qr-icon.png"
              alt=""
              className="size-12 sm:size-14 object-contain drop-shadow-md hover:scale-105 transition-transform"
            />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {th.consumerDashboard.payment.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {th.consumerDashboard.payment.description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('payment')}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[#0056b3] hover:bg-[#004494] text-white font-bold text-sm shadow-xs active:scale-98 transition-all cursor-pointer shrink-0"
        >
          <QrCode className="size-4" aria-hidden="true" />
          <span>{th.consumerDashboard.payment.action}</span>
        </button>
      </article>

      {/* Row 3: Quests and Coupons Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Quests Card */}
        <article className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              {th.consumerDashboard.quest.title}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('quests')}
              className="text-xs font-bold text-[#0056b3] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{th.consumerDashboard.quest.viewAll}</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {activeQuest ? (
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {activeQuest.questName}
                </h3>
                <p className="text-xs text-slate-500 mb-2">
                  {activeQuest.description}
                </p>
                <span className="text-[11px] text-slate-400">
                  {th.consumerDashboard.quest.expiry(
                    formatDate(activeQuest.expiresAt),
                  )}
                </span>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                {th.consumerDashboard.quest.reward(activeQuest.rewardPoint)}
              </span>
            </div>
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
                <Flag className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {th.consumerDashboard.states.noQuests}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {th.consumerDashboard.quest.emptySubtext}
              </p>
            </div>
          )}
        </article>

        {/* Coupons Card */}
        <article className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              {th.consumerDashboard.coupons.title} {coupons.length} ใบ
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('rewards')}
              className="text-xs font-bold text-[#0056b3] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{th.consumerDashboard.coupons.viewAll}</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {activeCoupon ? (
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {activeCoupon.couponName}
                </h3>
                <p className="text-xs text-slate-500 mb-2">
                  {activeCoupon.description}
                </p>
                <span className="text-[11px] text-slate-400">
                  {th.consumerDashboard.quest.expiry(
                    formatDate(activeCoupon.expiresAt),
                  )}
                </span>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0056b3] border border-blue-200/60 shrink-0">
                {activeCoupon.discountType === 'FIXED'
                  ? `ลด ${activeCoupon.discountValue} บาท`
                  : `ลด ${activeCoupon.discountValue}%`}
              </span>
            </div>
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
                <Ticket className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {th.consumerDashboard.states.noCoupons}
              </p>
            </div>
          )}
        </article>
      </div>

      {/* Row 4: Recent Purchases / Orders Table */}
      <article className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden mb-6">
        <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            {th.consumerDashboard.activity.title}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-xs font-bold text-[#0056b3] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{th.consumerDashboard.activity.viewAll}</span>
            <ArrowRight className="size-3" aria-hidden="true" />
          </button>
        </div>

        {recentOrders.length > 0 ? (
          <div className="w-full overflow-x-auto">
            {/* Table Column Headers */}
            <div className="grid grid-cols-12 min-w-[500px] bg-slate-50/80 px-6 py-2.5 text-xs font-semibold text-slate-500 border-b border-slate-100">
              <div className="col-span-5 sm:col-span-4">
                {th.consumerDashboard.activity.tableMerchant}
              </div>
              <div className="col-span-3 sm:col-span-4">
                {th.consumerDashboard.activity.tableDatetime}
              </div>
              <div className="col-span-2 sm:col-span-2 text-right">
                {th.consumerDashboard.activity.tableNetAmount}
              </div>
              <div className="col-span-2 sm:col-span-2 text-right">
                {th.consumerDashboard.activity.tableStatus}
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100 min-w-[500px]">
              {recentOrders.map((order) => (
                <div
                  key={order.orderId}
                  className="grid grid-cols-12 items-center px-6 py-4 hover:bg-slate-50/50 transition-colors text-sm"
                >
                  {/* Shop / Merchant */}
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0 pr-2">
                    <div className="size-8 rounded-xl bg-blue-50 text-[#0056b3] flex items-center justify-center shrink-0">
                      <ReceiptText className="size-4" aria-hidden="true" />
                    </div>
                    <span className="font-bold text-slate-900 truncate">
                      {order.merchantName}
                    </span>
                  </div>

                  {/* Date & Time */}
                  <div className="col-span-3 sm:col-span-4 text-xs text-slate-500">
                    {formatDateTime(order.paidAt)}
                  </div>

                  {/* Net Amount */}
                  <div className="col-span-2 sm:col-span-2 text-right font-extrabold text-slate-900">
                    ฿{formatBaht(order.finalAmount)}
                  </div>

                  {/* Status */}
                  <div className="col-span-2 sm:col-span-2 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <CheckCircle2
                        className="size-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{th.consumerDashboard.activity.statusSuccess}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm font-medium text-slate-500">
            <p aria-live="polite">{th.consumerDashboard.states.noOrders}</p>
          </div>
        )}
      </article>
    </>
  );
}

export function ConsumerOverview({
  displayName,
  maskedCitizenId,
  announcement,
  overviewState,
  onNavigate,
  onRetry,
}: ConsumerOverviewProps) {
  return (
    <>
      {/* Visually-hidden for screen readers & identity accessibility */}
      <div className="sr-only">
        <h2>{displayName}</h2>
        <span>{maskedCitizenId}</span>
      </div>

      {announcement && (
        <p
          aria-live="polite"
          className="mb-4 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/80 font-medium"
        >
          {announcement}
        </p>
      )}

      {overviewState.status === 'success' ? (
        <OverviewContent
          data={overviewState.data}
          subsidy={overviewState.subsidy}
          onNavigate={onNavigate}
        />
      ) : (
        <OverviewStatus state={overviewState} onRetry={onRetry} />
      )}
    </>
  );
}
