import { useEffect, useMemo, useState } from 'react';
import { LoadingState } from '../../../components/LoadingState';
import { th } from '../../../i18n/th';
import {
  CalendarRange,
  CheckCircle2,
  CircleX,
  Clock,
  Eye,
  FileText,
  Search,
} from 'lucide-react';
import { DigitalReceiptModal } from '../../consumer/components/DigitalReceiptModal';
import type { ReceiptDetail } from '../../consumer/consumer.types';
import {
  getMerchantOrderReceipt,
  getMerchantOrders,
} from '../api/merchant.api';
import type { MerchantOrder } from '../merchant.types';
import { useLatestRequest } from '../../../lib/use-latest-request';

type OrderDisplayStatus = 'PAID' | 'PENDING' | 'EXPIRED';
type OrderDateFilter = { dateFrom?: string; dateTo?: string };

function getOrderDisplayStatus(
  order: MerchantOrder,
  now: number,
): OrderDisplayStatus {
  if (order.status === 'PAID') return 'PAID';
  if (
    order.qrExpiresAt !== null &&
    new Date(order.qrExpiresAt).getTime() <= now
  ) {
    return 'EXPIRED';
  }
  return 'PENDING';
}

// FR-M08: Merchant order history and immutable digital receipts.
export function MerchantOrdersView() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderDisplayStatus>(
    'ALL',
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [appliedDateFilter, setAppliedDateFilter] = useState<OrderDateFilter>(
    {},
  );
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(
    null,
  );
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const beginRequest = useLatestRequest();

  const fetchOrders = (dateFilter: OrderDateFilter = appliedDateFilter) => {
    const { isCurrent } = beginRequest();
    setIsLoading(true);
    setError(null);
    getMerchantOrders(dateFilter)
      .then((loadedOrders) => {
        if (isCurrent()) setOrders(loadedOrders);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent()) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'ไม่สามารถโหลดประวัติ Order ได้',
        );
      })
      .finally(() => {
        if (isCurrent()) setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setCurrentTime(Date.now()),
      30_000,
    );
    return () => window.clearInterval(intervalId);
  }, []);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const handleOpenReceipt = async (orderId: string) => {
    setLoadingReceiptId(orderId);
    try {
      const receipt = await getMerchantOrderReceipt(orderId);
      setSelectedReceipt(receipt);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ไม่สามารถเปิดใบเสร็จได้');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const handleMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);

    if (!monthValue) {
      setAppliedDateFilter({});
      fetchOrders({});
      return;
    }

    const year = Number(monthValue.slice(0, 4));
    const month = Number(monthValue.slice(5, 7));
    const lastDay = new Date(year, month, 0).getDate();
    const nextFilter: OrderDateFilter = {
      dateFrom: `${monthValue}-01`,
      dateTo: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
    };
    setAppliedDateFilter(nextFilter);
    fetchOrders(nextFilter);
  };

  const clearMonthFilter = () => handleMonthChange('');

  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === 'PAID');
    const totalSales = paidOrders.reduce((sum, o) => sum + o.finalAmount, 0);
    const paidCount = paidOrders.length;
    const pendingCount = orders.filter(
      (order) => getOrderDisplayStatus(order, currentTime) === 'PENDING',
    ).length;
    return { totalSales, paidCount, pendingCount };
  }, [orders, currentTime]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const displayStatus = getOrderDisplayStatus(order, currentTime);
      if (statusFilter !== 'ALL' && displayStatus !== statusFilter)
        return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = order.orderId.toLowerCase().includes(query);
        const matchesName = (order.consumerName ?? '')
          .toLowerCase()
          .includes(query);
        if (!matchesId && !matchesName) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery, currentTime]);

  if (isLoading) {
    return (
      <LoadingState label={th.merchantPortal.orders.loading} variant="table" />
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-center">
        <p className="mb-2 text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => fetchOrders()}
          className="rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white hover:bg-[#004494] transition-colors cursor-pointer"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            ประวัติคำสั่งซื้อและใบเสร็จดิจิทัล
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            บันทึกคำสั่งซื้อทั้งหมดของร้านค้า ตรวจสอบยอดเงิน
            และเรียกดูใบเสร็จย้อนหลัง
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm focus-within:border-[#0056b3]">
            <CalendarRange className="size-4 text-[#0056b3]" />
            <span>เดือนที่แสดง</span>
            <input
              type="month"
              aria-label="เดือนที่แสดง"
              value={selectedMonth}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
            />
          </label>
          {selectedMonth && (
            <button
              type="button"
              onClick={clearMonthFilter}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
            >
              ทุกเดือน
            </button>
          )}
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#0056b3] shadow-sm hover:bg-blue-50 transition-colors cursor-pointer"
          >
            ↻ รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>ยอดขายที่ชำระแล้ว</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-[#003d82]">
            {formatCurrency(stats.totalSales)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            รวมเงินสนับสนุนภาครัฐและเงินส่วนตัวลูกค้า
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>ชำระสำเร็จ</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-700">
            {stats.paidCount}{' '}
            <span className="text-xs font-bold text-slate-500">ออเดอร์</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            ออกใบเสร็จดิจิทัลและบันทึกเข้ากระเป๋าร้านค้าแล้ว
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>รอลูกค้าชำระเงิน</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-amber-600">
            {stats.pendingCount}{' '}
            <span className="text-xs font-bold text-slate-500">ออเดอร์</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            สร้าง QR แล้วแต่ยังไม่ได้ชำระ
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา Order # หรือชื่อลูกค้า..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
          {(
            [
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'PAID', label: 'ชำระแล้ว' },
              { id: 'PENDING', label: 'รอชำระ' },
              { id: 'EXPIRED', label: 'ยกเลิกการชำระ' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === t.id
                  ? 'bg-[#0056b3] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-white text-slate-500">
          <FileText className="size-8 text-slate-400" />
          <p className="text-sm">ไม่พบรายการคำสั่งซื้อ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const displayStatus = getOrderDisplayStatus(order, currentTime);
            const isPaid = displayStatus === 'PAID';
            const isExpired = displayStatus === 'EXPIRED';

            return (
              <div
                key={order.orderId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-blue-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-label={`สถานะ${
                      isPaid
                        ? 'ชำระแล้ว'
                        : isExpired
                          ? 'ยกเลิกการชำระ'
                          : 'รอชำระ'
                    }`}
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-700'
                        : isExpired
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isPaid ? (
                      <CheckCircle2 className="size-5" aria-hidden="true" />
                    ) : isExpired ? (
                      <CircleX className="size-5" aria-hidden="true" />
                    ) : (
                      <Clock className="size-5" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-700'
                            : isExpired
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isPaid
                          ? 'ชำระแล้ว'
                          : isExpired
                            ? 'ยกเลิกการชำระ'
                            : 'รอชำระ'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">
                      {isExpired
                        ? 'QR หมดอายุ'
                        : order.consumerName
                          ? `ลูกค้า: ${order.consumerName}`
                          : 'รอลูกค้าสแกน'}{' '}
                      · {order.itemCount} รายการ
                    </p>
                    <p className="text-[11px] text-slate-500">
                      เวลา:{' '}
                      {order.paidAt
                        ? new Date(order.paidAt).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) + ' น.'
                        : new Date(order.createdAt).toLocaleTimeString(
                            'th-TH',
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          ) + ' น.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-base font-black text-[#0056b3]">
                      {formatCurrency(order.finalAmount)}
                    </p>
                    {isPaid && (
                      <p className="text-[11px] font-semibold text-emerald-700">
                        สิทธิ์ร่วมจ่าย {formatCurrency(order.subsidyAmount)}
                      </p>
                    )}
                  </div>

                  {isPaid && (
                    <button
                      type="button"
                      onClick={() => void handleOpenReceipt(order.orderId)}
                      disabled={loadingReceiptId === order.orderId}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Eye className="size-3.5" />
                      <span>
                        {loadingReceiptId === order.orderId
                          ? 'กำลังโหลด...'
                          : 'ดูใบเสร็จ'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedReceipt && (
        <DigitalReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
