import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2, Copy, Download, QrCode } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { CreateOrderResponse, MerchantOrder } from '../merchant.types';

interface MerchantQrViewProps {
  createdOrder: CreateOrderResponse | null;
  qrDataUrl: string | null;
  paidOrderNotification: MerchantOrder | null;
  formatCurrency: (value: number) => string;
  handleOpenPaidQrReceipt: (orderId: string) => Promise<void>;
  isLoadingQrReceipt: boolean;
  setCreatedOrder: Dispatch<SetStateAction<CreateOrderResponse | null>>;
  setQrDataUrl: Dispatch<SetStateAction<string | null>>;
  setPaidOrderNotification: Dispatch<SetStateAction<MerchantOrder | null>>;
  setView: (view: 'pos') => void;
  qrCountdown: number;
  formatTime: (seconds: number) => string;
  copiedToken: boolean;
  setCopiedToken: Dispatch<SetStateAction<boolean>>;
}

export function MerchantQrView({
  createdOrder,
  qrDataUrl,
  paidOrderNotification,
  formatCurrency,
  handleOpenPaidQrReceipt,
  isLoadingQrReceipt,
  setCreatedOrder,
  setQrDataUrl,
  setPaidOrderNotification,
  setView,
  qrCountdown,
  formatTime,
  copiedToken,
  setCopiedToken,
}: MerchantQrViewProps) {
  const posCopy = th.merchantPortal.pos;

  return (
    <div className="flex flex-col items-center py-4">
      {createdOrder && qrDataUrl ? (
        <div className="w-full max-w-md">
          {paidOrderNotification ? (
            <div className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-9" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-emerald-800">
                ลูกค้าชำระเงินสำเร็จแล้ว!
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Order #{paidOrderNotification.orderId} · ลูกค้า:{' '}
                {paidOrderNotification.consumerName ?? 'ประชาชน'}
              </p>
              <p className="mt-3 font-mono text-3xl font-black text-[#0056b3]">
                {formatCurrency(paidOrderNotification.finalAmount)}
              </p>
              <div className="mt-3 flex justify-center gap-2 text-xs">
                <span className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-1 font-semibold text-sky-800">
                  เงินสนับสนุนรัฐ:{' '}
                  {formatCurrency(paidOrderNotification.subsidyAmount)}
                </span>
                <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 font-semibold text-emerald-800">
                  เงินลูกค้า:{' '}
                  {formatCurrency(paidOrderNotification.userPaidAmount)}
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenPaidQrReceipt(paidOrderNotification.orderId)
                  }
                  disabled={isLoadingQrReceipt}
                  className="w-full rounded-2xl bg-[#0056b3] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
                >
                  {isLoadingQrReceipt
                    ? 'กำลังเปิดใบเสร็จ...'
                    : '📄 เปิดดูใบเสร็จรับเงินดิจิทัล'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedOrder(null);
                    setQrDataUrl(null);
                    setPaidOrderNotification(null);
                    setView('pos');
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  ← สร้างรายการขายใหม่
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg">
              <div className="mb-4 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0056b3]">
                  Order #{createdOrder.orderId} · รอลูกค้าสแกนชำระ
                </span>
                <p className="mt-2 font-mono text-3xl font-black text-[#003d82]">
                  {formatCurrency(createdOrder.finalAmount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  หมดอายุใน{' '}
                  <span
                    className={`font-mono font-bold ${
                      qrCountdown < 60 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatTime(qrCountdown)}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-md">
                  <img src={qrDataUrl} alt="QR Code" className="size-56" />
                </div>

                <a
                  href={qrDataUrl}
                  download={`thai-please-order-${createdOrder.orderId}.png`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors"
                >
                  <Download className="size-3.5" />
                  <span>{posCopy.downloadQrImage}</span>
                </a>
              </div>

              {/* QR Token copy box for desktop testing & manual input */}
              {createdOrder.qrToken && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#003d82]">
                      <span>🔑</span> รหัส QR Token
                    </span>
                    <button
                      type="button"
                      id="copy-token-btn"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          createdOrder.qrToken,
                        );
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                        copiedToken
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-[#0056b3] text-white hover:bg-[#004494]'
                      }`}
                    >
                      <Copy className="size-3" />
                      <span>
                        {copiedToken ? 'คัดลอกแล้ว!' : 'คัดลอก Token'}
                      </span>
                    </button>
                  </div>
                  <p className="select-all break-all rounded-xl border border-blue-200/70 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-slate-700">
                    {createdOrder.qrToken}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-600">
                    💡 สแกนด้วยกล้อง อัปโหลดไฟล์รูป QR
                    หรือคัดลอกรหัสนี้ไปวางในเมนู{' '}
                    <strong>&quot;สแกนจ่าย&quot;</strong>{' '}
                    ฝั่งประชาชนเพื่อทดสอบชำระเงิน
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="mb-2 text-xs font-bold text-slate-700">
                  รายการสินค้าในบิลนี้
                </p>
                {createdOrder.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs text-slate-600"
                  >
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setCreatedOrder(null);
              setQrDataUrl(null);
              setPaidOrderNotification(null);
              setView('pos');
            }}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            ← กลับไปหน้าร้าน POS
          </button>
        </div>
      ) : (
        <div className="flex h-64 w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-500">
          <QrCode className="size-10 text-[#0056b3]" />
          <p className="text-sm font-semibold">
            ยังไม่มี QR Code ที่กำลังรอชำระ
          </p>
          <button
            type="button"
            onClick={() => setView('pos')}
            className="rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
          >
            ไปเลือกสินค้าเพื่อสร้าง QR
          </button>
        </div>
      )}
    </div>
  );
}
