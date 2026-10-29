import { LoadingState } from '../../../components/LoadingState';
import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Clock,
  Percent,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrendingUp,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import { useLatestRequest } from '../../../lib/use-latest-request';
import { getMerchantDashboard } from '../api/merchant.api';
import type { MerchantDashboardData } from '../merchant.types';

export function MerchantDashboardView() {
  const copy = th.merchantPortal.dashboard;
  const [data, setData] = useState<MerchantDashboardData | null>(null);
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const beginRequest = useLatestRequest();
  const loadDashboard = useCallback(
    async (selectedDays = days) => {
      const { isCurrent } = beginRequest();
      setIsLoading(true);
      setError(null);
      try {
        const result = await getMerchantDashboard(selectedDays);
        if (!isCurrent()) return;
        setData(result);
      } catch (caughtError: unknown) {
        if (!isCurrent()) return;
        setError(
          caughtError instanceof Error ? caughtError.message : copy.errorTitle,
        );
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [beginRequest, copy.errorTitle, days],
  );

  useEffect(() => {
    void loadDashboard(days);
  }, [days, loadDashboard]);

  if (isLoading && !data) {
    return <LoadingState label={copy.loading} variant="dashboard" />;
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
        <p className="text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => void loadDashboard(days)}
          className="mt-3 rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
        >
          {copy.retry}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, topProducts, salesTrend, dataFreshness } = data;
  const maxTrendSale = Math.max(
    1,
    ...salesTrend.map((point) => point.totalSales),
  );

  return (
    <div className="space-y-6">
      {/* Blue Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003d82] via-[#0056b3] to-[#0073e6] p-6 text-white shadow-lg shadow-blue-900/15">
        <div className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-sm">
              <BarChart3 className="size-3.5" />
              {copy.eyebrow}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-blue-100/90 leading-relaxed">
              {copy.description}
            </p>
            <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] text-blue-100 backdrop-blur-sm border border-white/15">
              <Clock className="size-3.5 text-sky-200" />
              <span>
                {copy.freshnessLabel}:{' '}
                <strong data-testid="dashboard-freshness-time">
                  {new Date(dataFreshness.asOf).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </strong>
              </span>
              <span>· {copy.timezoneLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white/15 p-1 backdrop-blur-sm">
              {(
                [
                  { value: 7, label: copy.periods.days7 },
                  { value: 14, label: copy.periods.days14 },
                  { value: 30, label: copy.periods.days30 },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDays(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    days === option.value
                      ? 'bg-white text-[#003d82] shadow-sm'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard(days)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25 transition-colors backdrop-blur-sm cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              {copy.refresh}
            </button>
          </div>
        </div>
      </section>

      {/* 5 Core KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Total Sales */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{copy.kpi.totalSales}</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3]">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p
            data-testid="dashboard-total-sales"
            className="mt-2 font-mono text-2xl font-black text-[#003d82]"
          >
            {formatCurrency(summary.totalSales)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {copy.kpi.avgOrder}:{' '}
            <span className="font-mono font-bold text-slate-700">
              {formatCurrency(summary.orderCount.averageOrderValue)}
            </span>
          </p>
        </div>

        {/* 2. Order Count */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{copy.kpi.orderCount}</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShoppingBag className="size-4" />
            </div>
          </div>
          <p
            data-testid="dashboard-paid-order-count"
            className="mt-2 font-mono text-2xl font-black text-emerald-700"
          >
            {summary.orderCount.paid.toLocaleString('th-TH')}{' '}
            <span className="text-xs font-bold text-slate-500">บิล</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {copy.kpi.pendingOrders}:{' '}
            <span className="font-mono font-bold text-amber-600">
              {summary.orderCount.pending} บิล
            </span>
          </p>
        </div>

        {/* 3. Subsidy Received */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{copy.kpi.subsidyReceived}</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Sparkles className="size-4" />
            </div>
          </div>
          <p
            data-testid="dashboard-subsidy-received"
            className="mt-2 font-mono text-2xl font-black text-sky-700"
          >
            {formatCurrency(summary.subsidyReceived)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            สัดส่วน{' '}
            <span className="font-mono font-bold text-sky-700">
              {summary.subsidySharePercent}%
            </span>{' '}
            ของยอดขาย
          </p>
        </div>

        {/* 4. Personal Payment Received */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{copy.kpi.personalReceived}</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Percent className="size-4" />
            </div>
          </div>
          <p
            data-testid="dashboard-personal-received"
            className="mt-2 font-mono text-2xl font-black text-indigo-700"
          >
            {formatCurrency(summary.personalPaymentReceived)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            สัดส่วน{' '}
            <span className="font-mono font-bold text-indigo-700">
              {summary.personalSharePercent}%
            </span>{' '}
            ของยอดขาย
          </p>
        </div>

        {/* 5. Coupon Orders */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{copy.kpi.couponOrders}</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Ticket className="size-4" />
            </div>
          </div>
          <p
            data-testid="dashboard-coupon-orders"
            className="mt-2 font-mono text-2xl font-black text-amber-700"
          >
            {summary.couponOrders.count}{' '}
            <span className="text-xs font-bold text-slate-500">บิล</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {copy.kpi.totalDiscount}{' '}
            <span className="font-mono font-bold text-slate-700">
              {formatCurrency(summary.couponOrders.totalDiscount)}
            </span>{' '}
            ({summary.couponOrders.usageRatePercent}%)
          </p>
        </div>
      </section>

      {/* Co-payment Split Bar */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {copy.split.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {copy.split.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-[#0056b3]">
              <span className="size-2.5 rounded-full bg-[#0056b3]" />
              {copy.split.subsidyLabel}: {summary.subsidySharePercent}%
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              {copy.split.personalLabel}: {summary.personalSharePercent}%
            </span>
          </div>
        </div>

        <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-100 flex">
          <div
            style={{ width: `${summary.subsidySharePercent}%` }}
            className="h-full bg-gradient-to-r from-[#003d82] to-[#0073e6] transition-all duration-500"
          />
          <div
            style={{ width: `${summary.personalSharePercent}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
          />
        </div>
      </section>

      {/* Two Columns: Sales Trend & Top-selling Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Daily Sales Trend (7/14/30 days) */}
        <section className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {copy.trend.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {copy.trend.subtitle}
              </p>
            </div>
            <span className="rounded-xl bg-blue-50 px-3 py-1 text-xs font-bold text-[#0056b3]">
              {days} วันล่าสุด
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {salesTrend.map((point) => {
              const barPercent =
                point.totalSales > 0
                  ? Math.max(
                      6,
                      Math.round((point.totalSales / maxTrendSale) * 100),
                    )
                  : 0;
              return (
                <div
                  key={point.date}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700">
                        {point.date}
                      </span>
                      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 border border-slate-200">
                        {point.orderCount} {copy.trend.ordersUnit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-black text-[#003d82]">
                        {formatCurrency(point.totalSales)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      style={{ width: `${barPercent}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-[#0056b3] to-[#0073e6] transition-all"
                    />
                  </div>

                  {point.totalSales > 0 && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        สิทธิ์รัฐ: {formatCurrency(point.subsidyAmount)}
                      </span>
                      <span>
                        เงินลูกค้า: {formatCurrency(point.personalAmount)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Top-selling Products */}
        <section className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {copy.topProducts.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {copy.topProducts.subtitle}
            </p>
          </div>

          <div className="mt-5">
            {topProducts.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-500">
                <Award className="size-8 text-slate-400" />
                <p className="text-sm">{copy.topProducts.empty}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                          index === 0
                            ? 'bg-gradient-to-br from-[#003d82] to-[#0073e6] text-white shadow-sm'
                            : index === 1
                              ? 'bg-blue-100 text-[#0056b3]'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        #{index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {product.productName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {product.categoryName} ·{' '}
                          {copy.topProducts.quantitySold}{' '}
                          <strong className="text-slate-700">
                            {product.totalQuantity}{' '}
                            {copy.topProducts.piecesUnit}
                          </strong>{' '}
                          ({product.orderCount} {copy.topProducts.ordersUnit})
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-medium text-slate-400">
                        {copy.topProducts.revenueLabel}
                      </p>
                      <p className="font-mono text-sm font-black text-[#0056b3]">
                        {formatCurrency(product.totalRevenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
