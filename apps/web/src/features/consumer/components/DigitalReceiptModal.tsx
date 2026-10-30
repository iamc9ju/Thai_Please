import { CheckCircle2, Lock, Printer, X } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
    >
      <div className="relative w-full max-w-md my-6 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-900">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.closeReceipt}
          className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer print:hidden"
        >
          <X className="size-4.5" />
        </button>

        {/* Printable Paper Receipt Area */}
        <div
          id="printable-receipt"
          className="px-6 pt-7 pb-6 space-y-4 bg-white text-slate-900"
        >
          {/* Centered Brand Logo & Receipt Title */}
          <div className="text-center border-b border-dashed border-slate-300 pb-4">
            <img
              src="/images/brand-logo.png"
              alt={th.brand}
              className="h-11 sm:h-12 w-auto object-contain mx-auto mb-2"
            />
            <span className="sr-only">{th.brand}</span>
            <h3
              id="receipt-modal-title"
              className="text-sm font-bold text-slate-900 tracking-tight"
            >
              {copy.receiptElectronic}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {formatThaiDateTime(receipt.paidAt ?? receipt.createdAt)}
            </p>
          </div>

          {/* Order Reference & Status Row */}
          <div className="flex items-center justify-between text-xs border-b border-dashed border-slate-300 pb-3.5">
            <div>
              <span className="text-[11px] text-slate-500 block">
                {copy.orderReference}
              </span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {receipt.receiptNumber}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-bold text-slate-800 border border-slate-300 bg-slate-50">
              <CheckCircle2 className="size-3 text-slate-700" />
              <span>{copy.paid}</span>
            </span>
          </div>

          {/* Merchant & Customer Details (Clean Paper Text Layout) */}
          <div className="grid grid-cols-2 gap-4 text-xs border-b border-dashed border-slate-300 pb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 block">ร้านค้า</span>
              <p className="font-bold text-slate-900 leading-snug">
                {receipt.merchant.merchantName}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {receipt.merchant.address}
              </p>
              {receipt.merchant.phone && (
                <p className="text-[11px] text-slate-500 tabular-nums">
                  โทร: {receipt.merchant.phone}
                </p>
              )}
            </div>

            <div className="space-y-0.5 border-l border-slate-200 pl-4">
              <span className="text-[11px] text-slate-500 block">
                {copy.customerName}
              </span>
              <p className="font-bold text-slate-900 leading-snug">
                {receipt.consumer.fullName}
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {receipt.consumer.maskedCitizenId}
              </p>
              <p className="text-[11px] text-slate-600 font-medium pt-0.5">
                {copy.paymentMethodWallet}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-200">
              <span>{copy.itemsBreakdown}</span>
              <span>จำนวนเงิน</span>
            </div>
            <div className="divide-y divide-slate-100">
              {receipt.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between py-2.5 text-xs"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-semibold text-slate-900 leading-snug">
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900 shrink-0 tabular-nums">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-slate-300" />

          {/* Totals & Payment Split */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{th.consumerPortal.payment.subtotal}</span>
              <span className="tabular-nums text-slate-900">
                {formatCurrency(receipt.subtotal)}
              </span>
            </div>

            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  {th.consumerPortal.payment.coupon}{' '}
                  {receipt.appliedCoupon && (
                    <span className="text-[11px] text-slate-500">
                      ({receipt.appliedCoupon.couponName})
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-slate-900">
                  -{formatCurrency(receipt.discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline text-sm font-extrabold text-slate-900 pt-2 pb-2 border-y border-slate-200 my-1">
              <span>{th.consumerPortal.payment.finalAmount}</span>
              <span className="text-base font-extrabold text-slate-900 tabular-nums">
                {formatCurrency(receipt.finalAmount)}
              </span>
            </div>

            {/* Co-pay Breakdown */}
            <div className="pt-1 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>{copy.subsidyLabel}</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatCurrency(receipt.subsidyAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{copy.personalLabel}</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatCurrency(receipt.userPaidAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Immutable Audit Footer */}
          <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
            <Lock className="size-3.5 shrink-0 text-slate-400" />
            <span>{copy.immutableNote}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 px-6 py-3.5 bg-slate-50 border-t border-slate-200 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copy.closeReceipt}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-10 px-4 rounded-md bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Printer className="size-3.5 shrink-0" />
            <span>{copy.printReceipt}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
