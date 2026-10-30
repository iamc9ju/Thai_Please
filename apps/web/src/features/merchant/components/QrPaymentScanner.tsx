import { useState } from 'react';
import { th } from '../../../i18n/th';
import { previewOrder, payByQr } from '../api/merchant.api';
import type { OrderPreview, PaymentResult } from '../merchant.types';

type ScanStep = 'input' | 'preview' | 'success';

interface QrScannerProps {
  availableCoupons?: Array<{
    userCouponId: string;
    couponName: string;
    discountType: string;
    discountValue: number;
    expiresAt: string;
  }>;
  onPaymentSuccess?: (result: PaymentResult) => void;
}

export function QrPaymentScanner({
  availableCoupons = [],
  onPaymentSuccess,
}: QrScannerProps) {
  const [step, setStep] = useState<ScanStep>('input');
  const [qrToken, setQrToken] = useState('');
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const handlePreview = async () => {
    if (!qrToken.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await previewOrder(
        selectedCouponId
          ? { qrToken: qrToken.trim(), userCouponId: selectedCouponId }
          : { qrToken: qrToken.trim() },
      );
      setPreview(data);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : th.consumerPortal.qrScanner.loadError);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    if (!preview) return;
    setIsLoading(true);
    setError(null);
    try {
      const paid = await payByQr(
        selectedCouponId
          ? { qrToken: qrToken.trim(), userCouponId: selectedCouponId }
          : { qrToken: qrToken.trim() },
      );
      setResult(paid);
      setStep('success');
      onPaymentSuccess?.(paid);
    } catch (e) {
      setError(e instanceof Error ? e.message : th.consumerPortal.qrScanner.payError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('input');
    setQrToken('');
    setSelectedCouponId('');
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 backdrop-blur-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
        <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm shadow">
          📱
        </span>
        {th.consumerPortal.qrScanner.title}
      </h2>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
          <span>⚠️</span> {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* Step 1: Input QR Token */}
      {step === 'input' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              {th.consumerPortal.qrScanner.inputLabel}
            </label>
            <textarea
              id="qr-token-input"
              className="w-full resize-none rounded-xl bg-slate-800 px-3 py-2.5 font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              rows={3}
              placeholder={th.consumerPortal.qrScanner.inputPlaceholder}
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
            />
          </div>

          {availableCoupons.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                {th.consumerPortal.qrScanner.couponLabel}
              </label>
              <select
                className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedCouponId}
                onChange={(e) => setSelectedCouponId(e.target.value)}
              >
                <option value="">{th.consumerPortal.qrScanner.noCoupon}</option>
                {availableCoupons.map((c) => (
                  <option key={c.userCouponId} value={c.userCouponId}>
                    {c.couponName} (
                    {c.discountType === 'FIXED'
                      ? `ลด ${c.discountValue} บาท`
                      : `ลด ${c.discountValue}%`}
                    )
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            id="qr-preview-btn"
            onClick={() => void handlePreview()}
            disabled={!qrToken.trim() || isLoading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                {th.consumerPortal.qrScanner.loading}
              </span>
            ) : (
              th.consumerPortal.qrScanner.previewAction
            )}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-800/50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">
              🏪 {preview.merchantName}
            </p>
            <div className="space-y-1">
              {preview.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-xs text-slate-400"
                >
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <span>{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{th.consumerPortal.qrScanner.totalPrice}</span>
              <span>{formatCurrency(preview.subtotal)}</span>
            </div>
            {preview.discountAmount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>{th.consumerPortal.qrScanner.couponDiscount}</span>
                <span>−{formatCurrency(preview.discountAmount)}</span>
              </div>
            )}
            {preview.subsidyAmount > 0 && (
              <div className="flex justify-between text-xs text-purple-400">
                <span>{th.consumerPortal.qrScanner.subsidyShare}</span>
                <span>−{formatCurrency(preview.subsidyAmount)}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-bold">
              <span className="text-white">{th.consumerPortal.qrScanner.youPay}</span>
              <span className="text-orange-400">
                {formatCurrency(preview.userPaidAmount)}
              </span>
            </div>
          </div>

          {/* Balance info */}
          <div className="rounded-xl bg-slate-800/50 p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">{th.consumerPortal.qrScanner.walletBalance}</span>
              <span
                className={
                  preview.canAfford ? 'text-green-400' : 'text-red-400'
                }
              >
                {formatCurrency(preview.personalBalance)}
              </span>
            </div>
            {!preview.canAfford && (
              <p className="text-xs text-red-400">
                {th.consumerPortal.qrScanner.insufficientFunds}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
            >
              {th.consumerPortal.qrScanner.cancelAction}
            </button>
            <button
              id="confirm-payment-btn"
              onClick={() => void handlePay()}
              disabled={!preview.canAfford || isLoading}
              className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/25 hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  {th.consumerPortal.qrScanner.paying}
                </span>
              ) : (
                th.consumerPortal.qrScanner.confirmPay(formatCurrency(preview.userPaidAmount))
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 'success' && result && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-xl shadow-green-500/30">
            <span className="text-3xl">✓</span>
          </div>
          <div>
            <p className="text-base font-bold text-white">{th.consumerPortal.qrScanner.successTitle}</p>
            <p className="text-sm text-slate-400">Order #{result.orderId}</p>
          </div>
          <div className="w-full rounded-xl bg-slate-800/50 p-3 space-y-1.5 text-left">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{th.consumerPortal.qrScanner.actualPaid}</span>
              <span className="font-bold text-orange-400">
                {formatCurrency(result.userPaidAmount)}
              </span>
            </div>
            {result.subsidyAmount > 0 && (
              <div className="flex justify-between text-xs text-purple-400">
                <span>{th.consumerPortal.qrScanner.subsidyReceived}</span>
                <span>{formatCurrency(result.subsidyAmount)}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
          >
            {th.consumerPortal.qrScanner.scanAgain}
          </button>
        </div>
      )}
    </div>
  );
}
