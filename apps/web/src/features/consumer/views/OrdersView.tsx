import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Receipt,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { th } from '../../../i18n/th';
import { useLatestRequest } from '../../../lib/use-latest-request';
import { getConsumerOrders } from '../api/consumer.api';
import { DigitalReceiptModal } from '../components/DigitalReceiptModal';
import { PortalPageHeader } from '../components/PortalPageHeader';
import type { ConsumerOrder, ReceiptDetail } from '../consumer.types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount);
}

function formatThaiDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function OrdersView() {
  const copy = th.consumerPortal.orders;

  const [orders, setOrders] = useState<ConsumerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preset, setPreset] = useState<'all' | 'month' | '7days'>('all');

  // Selected receipt modal
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(
    null,
  );

  const beginRequest = useLatestRequest();
  const fetchOrders = useCallback(async () => {
    const { signal, isCurrent } = beginRequest();
    setIsLoading(true);
    setError(null);
    try {
      const data = await getConsumerOrders(
        {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        signal,
      );
      if (!isCurrent()) return;
      setOrders(data);
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err.message : copy.error);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [beginRequest, dateFrom, dateTo, copy.error]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Preset handlers
  const handlePresetAll = () => {
    setPreset('all');
    setDateFrom('');
    setDateTo('');
  };

  const handlePresetMonth = () => {
    setPreset('month');
    const now = new Date();
    const firstDay =
      new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0] ?? '';
    const lastDay =
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0] ?? '';
    setDateFrom(firstDay);
    setDateTo(lastDay);
  };

  const handlePreset7Days = () => {
    setPreset('7days');
    const now = new Date();
    const sevenDaysAgo =
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] ?? '';
    const today = now.toISOString().split('T')[0] ?? '';
    setDateFrom(sevenDaysAgo);
    setDateTo(today);
  };

  // Filtered orders by search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const query = searchQuery.toLowerCase().trim();
    return orders.filter(
      (order) =>
        order.merchantName.toLowerCase().includes(query) ||
        order.orderId.toLowerCase().includes(query) ||
        order.receiptNumber.toLowerCase().includes(query),
    );
  }, [orders, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalSpent = orders.reduce((sum, o) => sum + o.finalAmount, 0);
    const totalSubsidy = orders.reduce((sum, o) => sum + o.subsidyAmount, 0);
    const totalOrders = orders.length;
    return { totalSpent, totalSubsidy, totalOrders };
  }, [orders]);

  // Open modal from ConsumerOrder
  const handleOpenReceipt = (order: ConsumerOrder) => {
    const detail: ReceiptDetail = {
      orderId: order.orderId,
      receiptNumber: order.receiptNumber,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      finalAmount: order.finalAmount,
      subsidyAmount: order.subsidyAmount,
      userPaidAmount: order.userPaidAmount,
      merchant: {
        merchantId: order.merchantId,
        merchantName: order.merchantName,
        address: order.merchantAddress ?? 'ร้านค้าในระบบ',
        phone: null,
      },
      consumer: {
        fullName: 'ประชาชนผู้รับสิทธิ์',
        maskedCitizenId: 'X-XXXX-XXXX',
      },
      items: order.items.map((i) => ({
        orderItemId: i.orderItemId,
        productId: i.productId,
        productName: i.productName,
        categoryName: i.categoryName ?? '',
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      appliedCoupon: order.appliedCoupon,
    };
    setSelectedReceipt(detail);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Spent */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {copy.totalSpent}
            </span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ShoppingBag className="size-4.5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(stats.totalSpent)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            ยอดสุทธิจากกระเป๋าและสิทธิ์ร่วมจ่าย
          </p>
        </div>

        {/* Subsidy Saved */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {copy.totalSubsidy}
            </span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Sparkles className="size-4.5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-emerald-600 tracking-tight">
            {formatCurrency(stats.totalSubsidy)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            เงินสนับสนุน 50% จากโครงการ
          </p>
        </div>

        {/* Total Orders */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {copy.totalOrders}
            </span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Receipt className="size-4.5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
            {stats.totalOrders}{' '}
            <span className="text-sm font-semibold text-slate-500">รายการ</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            ใบเสร็จดิจิทัลตรวจสอบย้อนหลังได้
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
            />
          </div>

          {/* Quick Preset Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={handlePresetAll}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {copy.filterAll}
            </button>
            <button
              type="button"
              onClick={handlePresetMonth}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {copy.filterMonth}
            </button>
            <button
              type="button"
              onClick={handlePreset7Days}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === '7days'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {copy.filter7Days}
            </button>
          </div>
        </div>

        {/* Date Pickers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <CalendarDays className="size-3.5 text-blue-600" />
              <span>ช่วงวันที่:</span>
            </span>
            <input
              type="date"
              aria-label={copy.dateFrom}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPreset('all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
            <span>ถึง</span>
            <input
              type="date"
              aria-label={copy.dateTo}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPreset('all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handlePresetAll}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors ml-1 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>{copy.clearFilter}</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-medium">
            {copy.resultPrefix}{' '}
            <strong className="text-slate-800 font-bold">
              {filteredOrders.length}
            </strong>{' '}
            {copy.resultSuffix}
          </div>
        </div>
      </div>

      {/* Orders List Section */}
      {isLoading ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="sr-only">{copy.loading}</p>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-sm animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            className="px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            {copy.retry}
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
            <ShoppingBag className="size-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {copy.emptyTitle}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {copy.emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.orderId}
              onClick={() => handleOpenReceipt(order)}
              className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border border-blue-100">
                  <Store className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {order.merchantName}
                    </h4>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3" />
                      <span>{copy.paid}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatThaiDate(order.paidAt ?? order.createdAt)} ·{' '}
                    <span className="font-mono text-slate-500">
                      {order.receiptNumber}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {order.itemCount} รายการสินค้า
                    {order.appliedCoupon && (
                      <span className="ml-2 inline-flex items-center text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        ใช้คูปองส่วนลด
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Price & Action */}
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="text-left sm:text-right">
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight font-mono">
                    {formatCurrency(order.finalAmount)}
                  </p>
                  <p className="text-xs text-emerald-600 font-medium">
                    รับสิทธิ์ร่วมจ่าย {formatCurrency(order.subsidyAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>{copy.viewReceipt}</span>
                  <ChevronRight className="size-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Digital Receipt Modal */}
      {selectedReceipt && (
        <DigitalReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
