import { X } from 'lucide-react';
import { QrPaymentScanner } from '../../merchant/components/QrPaymentScanner';
import type { PaymentResult } from '../../merchant/merchant.types';

type QrPaymentModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  availableCoupons: Array<{
    userCouponId: string;
    couponName: string;
    discountType: string;
    discountValue: number;
    expiresAt: string;
  }>;
  onSuccess: () => void;
}>;

export function QrPaymentModal({
  isOpen,
  onClose,
  availableCoupons,
  onSuccess,
}: QrPaymentModalProps) {
  if (!isOpen) return null;

  const handlePaymentSuccess = (_result: PaymentResult) => {
    onSuccess();
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700/60 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="ปิดหน้าต่าง"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="size-5" />
        </button>

        <QrPaymentScanner
          availableCoupons={availableCoupons}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  );
}
