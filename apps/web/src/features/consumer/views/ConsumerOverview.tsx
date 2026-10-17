import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Gift,
  History,
  Plus,
  ReceiptText,
  Star,
  Ticket,
} from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import type {
  ConsumerOverviewLoadState,
  ConsumerOverviewResponse,
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
  displayName,
  onNavigate,
}: Readonly<{
  data: ConsumerOverviewResponse;
  displayName: string;
  onNavigate: (view: ConsumerView) => void;
}>) {
  const [showBalance, setShowBalance] = useState(true);
  const { wallet, program, quests, coupons, recentOrders } = data;
  const activeQuest = quests[0];
  const activeCoupon = coupons[0];
  const dailyUsagePercent =
    wallet.dailySubsidyLimit > 0
      ? Math.min(
          100,
          Math.round(
            (wallet.dailySubsidyUsed / wallet.dailySubsidyLimit) * 100,
          ),
        )
      : 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      {/* Top Greeting Header (Mobile/Tablet Native Style) */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {th.consumerDashboard.greetingUser(displayName)}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
          {th.consumerDashboard.prototypeSubtitle}
        </p>
      </div>

      {/* 1. Main Wallet Card (กระเป๋าเงินของฉัน) */}
      <article className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs">
        {/* Card Header: Blue Wallet Icon + "กระเป๋าเงินของฉัน" + Eye Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/images/wallet-blue-icon.png"
              alt={th.consumerDashboard.wallet.eyebrow}
              className="size-9 sm:size-10 object-contain shrink-0"
            />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {th.consumerDashboard.wallet.eyebrow}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowBalance((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={showBalance ? 'Hide balance' : 'Show balance'}
          >
            {showBalance ? (
              <Eye className="size-5" />
            ) : (
              <EyeOff className="size-5" />
            )}
          </button>
        </div>

        {/* Total Balance Amount */}
        <p className="text-xs text-slate-500 font-medium mb-1">
          {th.consumerDashboard.wallet.totalLabel}
        </p>
        <div className="text-3xl sm:text-4xl font-extrabold text-[#0a2540] tracking-tight mb-5">
          <span>฿</span>
          <span>
            {showBalance ? formatBaht(wallet.totalBalance) : '••••••'}
          </span>
        </div>

        {/* Fund Breakdown: Personal & Subsidy */}
        <div className="grid grid-cols-2 gap-4 pb-5">
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
            <div className="text-lg sm:text-xl font-bold text-emerald-600">
              {showBalance ? `฿${formatBaht(wallet.subsidyBalance)}` : '••••••'}
            </div>
          </div>
        </div>

        {/* Action Buttons: เติมเงิน & ดูประวัติ */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#0056b3] text-white font-bold text-sm hover:bg-[#004494] active:scale-98 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>{th.consumerDashboard.wallet.topUp}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 active:scale-98 transition-all cursor-pointer"
          >
            <History className="size-4 text-slate-500" aria-hidden="true" />
            <span>{th.consumerDashboard.wallet.history}</span>
          </button>
        </div>
      </article>

      {/* 2. Two-Column Quick Status Cards (สิทธิ์วันนี้ & คะแนนสะสม) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Left: สิทธิ์วันนี้ */}
        <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="size-7 sm:size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Gift className="size-4 sm:size-4.5" aria-hidden="true" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800">
                {th.consumerDashboard.todaySubsidy}
              </h2>
            </div>

            <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 tracking-tight mb-1">
              ฿{formatBaht(wallet.dailySubsidyRemaining)}
            </div>

            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              {th.consumerDashboard.todaySubsidyUsedOf(
                formatBaht(wallet.dailySubsidyUsed),
                formatBaht(wallet.dailySubsidyLimit),
              )}
            </p>

            {/* Progress Bar */}
            <div className="mt-3">
              <div
                className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
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
              <div className="text-[10px] font-bold text-slate-400 text-right mt-1">
                {dailyUsagePercent}%
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 space-y-0.5 pt-2 mt-2 border-t border-slate-50">
            <p className="font-semibold text-slate-600 truncate">
              {program?.programName ??
                th.consumerDashboard.wallet.noActiveProgram}
            </p>
            {program && (
              <p className="text-slate-400 truncate">
                {th.consumerDashboard.wallet.programDetail(
                  program.subsidyPercentage,
                  formatDate(program.startDate),
                  formatDate(program.endDate),
                )}
              </p>
            )}
          </div>
        </article>

        {/* Right: คะแนนสะสม */}
        <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="size-7 sm:size-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Star className="size-4 sm:size-4.5" aria-hidden="true" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800">
                {th.consumerDashboard.points.title}
              </h2>
            </div>

            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
              {wallet.pointBalance.toLocaleString(th.consumerDashboard.locale)}{' '}
              <span className="text-xs sm:text-sm font-bold text-slate-500">
                {th.consumerDashboard.points.unit}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('rewards')}
            className="text-xs sm:text-sm font-bold text-[#0056b3] hover:underline flex items-center gap-1 cursor-pointer pt-3"
          >
            <span>{th.consumerDashboard.viewPoints}</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </article>
      </div>

      {/* 3. Quests Card (ภารกิจของคุณ) */}
      <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-blue-50 text-[#0056b3] flex items-center justify-center shrink-0">
              <ClipboardList className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {th.consumerDashboard.quest.title}
            </h2>
          </div>
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
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {activeQuest.questName}
              </h3>
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">
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
          <div className="py-6 text-center flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-slate-600">
              {th.consumerDashboard.states.noQuests}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {th.consumerDashboard.quest.emptySubtext}
            </p>
          </div>
        )}
      </article>

      {/* 4. Coupons Card (คูปองของฉัน) */}
      <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-blue-50 text-[#0056b3] flex items-center justify-center shrink-0">
              <Ticket className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {th.consumerDashboard.coupons.title}
              {coupons.length > 0 ? ` ${coupons.length} ใบ` : ''}
            </h2>
          </div>
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
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {activeCoupon.couponName}
              </h3>
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">
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
          <div className="py-6 text-center flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-slate-600">
              {th.consumerDashboard.states.noCoupons}
            </p>
          </div>
        )}
      </article>

      {/* 5. Recent Orders Card (รายการล่าสุด) */}
      <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-blue-50 text-[#0056b3] flex items-center justify-center shrink-0">
              <ReceiptText className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {th.consumerDashboard.activity.title}
            </h2>
          </div>
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
          <div className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <div
                key={order.orderId}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                {/* Shop icon + Shop name & datetime */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-blue-50 text-[#0056b3] flex items-center justify-center shrink-0">
                    <ReceiptText className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">
                      {order.merchantName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDateTime(order.paidAt)}
                    </p>
                  </div>
                </div>

                {/* Amount & Status Badge */}
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm sm:text-base text-slate-900">
                    ฿{formatBaht(order.finalAmount)}
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 mt-1">
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
        ) : (
          <div className="py-6 text-center text-sm font-medium text-slate-500">
            <p aria-live="polite">{th.consumerDashboard.states.noOrders}</p>
          </div>
        )}
      </article>
    </div>
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
          displayName={displayName}
          onNavigate={onNavigate}
        />
      ) : (
        <OverviewStatus state={overviewState} onRetry={onRetry} />
      )}
    </>
  );
}
