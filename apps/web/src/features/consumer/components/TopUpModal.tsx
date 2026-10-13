import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { topUpPersonalWallet } from '../api/consumer.api';

type TopUpModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}>;

const PRESET_AMOUNTS = [100, 300, 500, 1000] as const;

export function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(300);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveAmount = customAmount
    ? Number.parseInt(customAmount, 10) || 0
    : selectedAmount;

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveAmount < 1) {
      setError('กรุณาระบุจำนวนเงินขั้นต่ำ 1 บาท');
      return;
    }
    if (effectiveAmount > 50000) {
      setError('เติมเงินได้สูงสุด 50,000 บาทต่อครั้ง');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      await topUpPersonalWallet(effectiveAmount, idempotencyKey);
      setSuccessMessage(
        `เติมเงินสำเร็จ ฿${effectiveAmount.toLocaleString('th-TH')}`,
      );
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเติมเงิน';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
        <button
          aria-label="ปิดหน้าต่าง"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          onClick={onClose}
          type="button"
        >
          <X className="size-5" />
        </button>

        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Virtual Wallet Top-up
          </span>
          <h2 className="text-2xl font-bold mt-1">เติมเงินกระเป๋าส่วนตัว</h2>
          <p className="text-sm text-slate-400 mt-1">
            เลือกจำนวนเงินจำลองเพื่อใช้ร่วมจ่ายกับสิทธิ์ของโครงการ
          </p>
        </div>

        {successMessage ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
            <CheckCircle2 className="size-16 text-emerald-400 mb-3" />
            <h3 className="text-xl font-bold text-white">{successMessage}</h3>
            <p className="text-sm text-slate-400 mt-1">
              ระบบได้อัปเดตยอดเงินส่วนตัวของคุณแล้ว
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                aria-live="assertive"
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-300"
              >
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                เลือกจำนวนเงินด่วน
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = selectedAmount === amt && !customAmount;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`h-12 rounded-xl font-semibold border text-base transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
                          : 'bg-slate-800/80 border-slate-750 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      ฿{amt.toLocaleString('th-TH')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="custom-topup-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                หรือระบุจำนวนเงินเอง (บาท)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-semibold">
                  ฿
                </span>
                <input
                  id="custom-topup-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="เช่น 250"
                  value={customAmount}
                  onChange={handleCustomChange}
                  className="w-full rounded-xl bg-slate-950 border border-slate-750 py-3 pl-9 pr-4 text-white text-lg font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ขั้นต่ำ 1 บาท สูงสุด 50,000 บาท
              </p>
            </div>

            <div className="rounded-xl bg-blue-950/40 border border-blue-800/30 p-3 text-xs text-blue-200/90 leading-relaxed">
              💡 <strong>ข้อสังเกต:</strong> ระบบ Prototype ใช้เงินเสมือน
              (Virtual Baht) ไม่มีการตัดบัญชีธนาคารจริง
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-750 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || effectiveAmount < 1}
                className="flex-1 h-12 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>กำลังเติมเงิน...</span>
                  </>
                ) : (
                  <span>
                    ยืนยันเติมเงิน ฿{effectiveAmount.toLocaleString('th-TH')}
                  </span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
