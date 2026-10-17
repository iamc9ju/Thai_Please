import { CheckCircle2, Lock, Printer, Store, User, X } from 'lucide-react';
import type { ReceiptDetail } from '../consumer.types';
import { th } from '../../../i18n/th';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount);
}

function formatThaiDateTime(isoString: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

interface DigitalReceiptModalProps {
  receipt: ReceiptDetail | null;
  onClose: () => void;
}

export function DigitalReceiptModal({
  receipt,
  onClose,
}: DigitalReceiptModalProps) {
  if (!receipt) return null;

  const copy = th.consumerPortal.orders;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="relative w-full max-w-lg my-8 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Receipt Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-6 py-5 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.closeReceipt}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center">
              <img
                src="/images/brand-logo.png"
                alt="Logo"
                className="size-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 tracking-wide uppercase">
                {th.brand}
              </p>
              <h3
                id="receipt-modal-title"
                className="text-base sm:text-lg font-bold text-white leading-tight"
              >
                {copy.receiptElectronic}
              </h3>
            </div>
          </div>
        </div>

        {/* Receipt Body */}
        <div
          id="printable-receipt"
          className="p-6 space-y-5 bg-white text-slate-800"
        >
          {/* Status and Order Meta */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-400">
                {copy.orderReference}
              </span>
              <p className="font-mono text-base font-bold text-slate-900">
                {receipt.receiptNumber}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3.5" />
                <span>{copy.paid}</span>
              </span>
              <p className="text-xs text-slate-500 mt-1">
                {formatThaiDateTime(receipt.paidAt ?? receipt.createdAt)}
              </p>
            </div>
          </div>

          {/* Merchant & Customer Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs">
            {/* Merchant */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                <Store className="size-3.5 text-blue-600" />
                <span>ร้านค้า</span>
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {receipt.merchant.merchantName}
              </p>
              <p className="text-slate-500 leading-relaxed">
                {receipt.merchant.address}
              </p>
              {receipt.merchant.phone && (
                <p className="text-slate-500">โทร: {receipt.merchant.phone}</p>
              )}
            </div>

            {/* Consumer */}
            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                <User className="size-3.5 text-blue-600" />
                <span>{copy.customerName}</span>
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {receipt.consumer.fullName}
              </p>
              <p className="text-slate-500 font-mono">
                {receipt.consumer.maskedCitizenId}
              </p>
              <p className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                {copy.paymentMethodWallet}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {copy.itemsBreakdown}
            </h4>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
              {receipt.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-semibold text-slate-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-slate-400">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-bold text-slate-800 shrink-0 font-mono">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scalloped / Dashed separator */}
          <div className="relative border-t-2 border-dashed border-slate-200 my-4" />

          {/* Financial Breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>{th.consumerPortal.payment.subtotal}</span>
              <span className="font-mono">
                {formatCurrency(receipt.subtotal)}
              </span>
            </div>

            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>
                  {th.consumerPortal.payment.coupon}{' '}
                  {receipt.appliedCoupon && (
                    <span className="text-[11px] text-emerald-500">
                      ({receipt.appliedCoupon.couponName})
                    </span>
                  )}
                </span>
                <span className="font-mono">
                  -{formatCurrency(receipt.discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-100">
              <span>{th.consumerPortal.payment.finalAmount}</span>
              <span className="font-mono text-base text-blue-700">
                {formatCurrency(receipt.finalAmount)}
              </span>
            </div>

            {/* Subsidy vs Personal Share */}
            <div className="mt-3 p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-blue-900 font-semibold">
                <span>{copy.subsidyLabel}</span>
                <span className="font-mono text-emerald-700">
                  {formatCurrency(receipt.subsidyAmount)}
                </span>
              </div>
              <div className="flex justify-between text-blue-800">
                <span>{copy.personalLabel}</span>
                <span className="font-mono">
                  {formatCurrency(receipt.userPaidAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Immutable Audit Trail Footer */}
          <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-2 text-[11px] text-slate-500">
            <Lock className="size-4 shrink-0 text-slate-400" />
            <span>{copy.immutableNote}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 p-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {copy.closeReceipt}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-700 text-xs font-bold text-white hover:bg-blue-800 shadow-md shadow-blue-700/20 active:scale-98 transition-all cursor-pointer"
          >
            <Printer className="size-4" />
            <span>{copy.printReceipt}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
