import { useState } from 'react';
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
      setError(e instanceof Error ? e.message : 'ไม่สามารถโหลดข้อมูล QR ได้');
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
      setError(e instanceof Error ? e.message : 'ไม่สามารถชำระเงินได้');
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
        สแกน QR ชำระเงิน
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
              รหัส QR Token (วาง/สแกน QR Code)
            </label>
            <textarea
              id="qr-token-input"
              className="w-full resize-none rounded-xl bg-slate-800 px-3 py-2.5 font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              rows={3}
              placeholder="วาง QR Token ที่ได้รับจากร้านค้า..."
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
            />
          </div>

          {availableCoupons.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                ใช้คูปองส่วนลด (ไม่บังคับ)
              </label>
              <select
                className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedCouponId}
                onChange={(e) => setSelectedCouponId(e.target.value)}
              >
                <option value="">— ไม่ใช้คูปอง —</option>
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
                กำลังโหลด...
              </span>
            ) : (
              'ดูรายละเอียดก่อนชำระ →'
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
              <span>ราคารวม</span>
              <span>{formatCurrency(preview.subtotal)}</span>
            </div>
            {preview.discountAmount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>ส่วนลดคูปอง</span>
                <span>−{formatCurrency(preview.discountAmount)}</span>
              </div>
            )}
            {preview.subsidyAmount > 0 && (
              <div className="flex justify-between text-xs text-purple-400">
                <span>เงินอุดหนุนโครงการ</span>
                <span>−{formatCurrency(preview.subsidyAmount)}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-bold">
              <span className="text-white">คุณจ่าย</span>
              <span className="text-orange-400">
                {formatCurrency(preview.userPaidAmount)}
              </span>
            </div>
          </div>

          {/* Balance info */}
          <div className="rounded-xl bg-slate-800/50 p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">ยอดในกระเป๋า</span>
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
                ⚠️ ยอดเงินไม่เพียงพอ กรุณาเติมเงินก่อน
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
            >
              ← ยกเลิก
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
                  กำลังชำระ...
                </span>
              ) : (
                `✓ ยืนยันชำระ ${formatCurrency(preview.userPaidAmount)}`
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
            <p className="text-base font-bold text-white">ชำระเงินสำเร็จ!</p>
            <p className="text-sm text-slate-400">Order #{result.orderId}</p>
          </div>
          <div className="w-full rounded-xl bg-slate-800/50 p-3 space-y-1.5 text-left">
            <div className="flex justify-between text-xs text-slate-400">
              <span>ยอดชำระจริง</span>
              <span className="font-bold text-orange-400">
                {formatCurrency(result.userPaidAmount)}
              </span>
            </div>
            {result.subsidyAmount > 0 && (
              <div className="flex justify-between text-xs text-purple-400">
                <span>โครงการอุดหนุน</span>
                <span>{formatCurrency(result.subsidyAmount)}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
          >
            สแกน QR อีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
}
