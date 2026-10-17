import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  ImageUp,
  QrCode,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Tag,
  Wallet,
} from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { payByQr, previewOrder } from '../api/consumer.api';
import type {
  ConsumerOverviewResponse,
  ConsumerView,
  OrderPreviewResponse,
  PaymentResultResponse,
  PaymentStep,
} from '../consumer.types';
import { PortalPageHeader } from '../components/PortalPageHeader';
import {
  decodeQrFromImageFile,
  decodeQrFromVideoElement,
} from '../utils/qr-decoder';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const DEMO_PREVIEW_FALLBACK: OrderPreviewResponse = {
  orderId: 'TP-2569-001284',
  merchantName: th.consumerPortal.payment.merchant,
  subtotal: 185,
  discountAmount: 20,
  finalAmount: 165,
  subsidyAmount: 82.5,
  userPaidAmount: 82.5,
  personalBalance: 1850,
  subsidyBalance: 760,
  canAfford: true,
  qrExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  items: [
    {
      productName: 'ข้าวกะเพราไก่',
      quantity: 2,
      unitPrice: 65,
      lineTotal: 130,
    },
    {
      productName: 'น้ำสมุนไพร',
      quantity: 1,
      unitPrice: 35,
      lineTotal: 35,
    },
    {
      productName: 'ไข่ดาว',
      quantity: 1,
      unitPrice: 20,
      lineTotal: 20,
    },
  ],
  appliedCoupon: {
    userCouponId: 'demo-coupon-1',
    couponName: 'ลด 20 บาท เมื่อซื้อครบ 150 บาท',
    discountType: 'FIXED',
    discountValue: 20,
  },
};

type PaymentViewProps = Readonly<{
  onNavigate: (view: ConsumerView) => void;
  availableCoupons?: ConsumerOverviewResponse['coupons'];
  onPaymentSuccess?: () => void;
}>;

export function PaymentView({
  onNavigate,
  availableCoupons = [],
  onPaymentSuccess,
}: PaymentViewProps) {
  const [step, setStep] = useState<PaymentStep>('scan');
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [activeQrToken, setActiveQrToken] = useState('');
  const [preview, setPreview] = useState<OrderPreviewResponse | null>(null);
  const [paymentResult, setPaymentResult] =
    useState<PaymentResultResponse | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  // Camera & Image QR scanner states (FR-C04)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const copy = th.consumerPortal.payment;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Ensure camera is stopped when leaving scan step or unmounting
  useEffect(() => {
    if (step !== 'scan') {
      stopCamera();
    }
  }, [step, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Countdown timer for previewed QR
  useEffect(() => {
    if (step !== 'review' || !preview) return;

    const expiresTime = new Date(preview.qrExpiresAt).getTime();
    const updateCountdown = () => {
      const diffSeconds = Math.max(
        0,
        Math.floor((expiresTime - Date.now()) / 1000),
      );
      setSecondsRemaining(diffSeconds);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [step, preview]);

  // Request order preview by token
  const handleFetchPreview = useCallback(
    async (token: string, couponId?: string): Promise<void> => {
      if (!token.trim()) {
        setErrorMessage(copy.invalidQrMessage);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await previewOrder({
          qrToken: token.trim(),
          userCouponId: couponId || undefined,
        });
        setPreview(data);
        setActiveQrToken(token.trim());
        setStep('review');
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message || copy.invalidQrMessage);
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : copy.invalidQrMessage,
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [copy.invalidQrMessage],
  );

  // Live camera frame scanning loop
  useEffect(() => {
    if (!isCameraActive || step !== 'scan') return;
    let active = true;

    const intervalId = setInterval(() => {
      if (!active || !videoRef.current || !canvasRef.current) return;
      void decodeQrFromVideoElement(videoRef.current, canvasRef.current).then(
        (decodedToken) => {
          if (!active || !decodedToken) return;
          active = false;
          stopCamera();
          setQrTokenInput(decodedToken);
          void handleFetchPreview(decodedToken);
        },
      );
    }, 250);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isCameraActive, step, stopCamera, handleFetchPreview]);

  const handleStartCamera = async () => {
    setErrorMessage(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage(copy.cameraPermissionError);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      // Attach stream after video element renders
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          void videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      stopCamera();
      setErrorMessage(copy.cameraPermissionError);
    }
  };

  const handleQrImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsDecodingImage(true);
    setErrorMessage(null);
    try {
      const decodedToken = await decodeQrFromImageFile(file);
      if (!decodedToken) {
        setErrorMessage(copy.qrImageReadError);
        return;
      }
      setQrTokenInput(decodedToken);
      await handleFetchPreview(decodedToken);
    } catch {
      setErrorMessage(copy.qrImageReadError);
    } finally {
      setIsDecodingImage(false);
    }
  };

  // Submit manual QR token form
  const handleScanSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleFetchPreview(qrTokenInput);
  };

  // Fast demo preview action
  const handleDemoAction = () => {
    stopCamera();
    setPreview(DEMO_PREVIEW_FALLBACK);
    setActiveQrToken('demo-qr-token');
    setSelectedCouponId('demo-coupon-1');
    setErrorMessage(null);
    setStep('review');
  };

  // Coupon change handler
  const handleCouponChange = async (couponId: string) => {
    setSelectedCouponId(couponId);
    if (activeQrToken === 'demo-qr-token') {
      // Demo mock update
      if (couponId) {
        const found = availableCoupons.find((c) => c.userCouponId === couponId);
        if (found) {
          setPreview((prev) =>
            prev
              ? {
                  ...prev,
                  discountAmount: found.discountValue,
                  finalAmount: Math.max(0, prev.subtotal - found.discountValue),
                  userPaidAmount:
                    Math.max(0, prev.subtotal - found.discountValue) / 2,
                  subsidyAmount:
                    Math.max(0, prev.subtotal - found.discountValue) / 2,
                  appliedCoupon: {
                    userCouponId: found.userCouponId,
                    couponName: found.couponName,
                    discountType: found.discountType,
                    discountValue: found.discountValue,
                  },
                }
              : null,
          );
        }
      } else {
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                discountAmount: 0,
                finalAmount: prev.subtotal,
                userPaidAmount: prev.subtotal / 2,
                subsidyAmount: prev.subtotal / 2,
                appliedCoupon: null,
              }
            : null,
        );
      }
      return;
    }

    if (activeQrToken) {
      await handleFetchPreview(activeQrToken, couponId);
    }
  };

  // Confirm and pay
  const handleConfirmPay = async () => {
    if (!preview || isPaying) return;

    if (activeQrToken === 'demo-qr-token') {
      // Instant demo payment confirmation for demo tests
      setPaymentResult({
        success: true,
        isIdempotentReplay: false,
        orderId: preview.orderId,
        status: 'PAID',
        subtotal: preview.subtotal,
        discountAmount: preview.discountAmount,
        finalAmount: preview.finalAmount,
        subsidyAmount: preview.subsidyAmount,
        userPaidAmount: preview.userPaidAmount,
        paidAt: new Date().toISOString(),
      });
      setStep('success');
      onPaymentSuccess?.();
      return;
    }

    setIsPaying(true);
    setErrorMessage(null);

    try {
      const result = await payByQr({
        qrToken: activeQrToken,
        userCouponId: selectedCouponId || undefined,
      });
      setPaymentResult(result);
      setStep('success');
      onPaymentSuccess?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'การชำระเงินไม่สำเร็จ');
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'การชำระเงินไม่สำเร็จ',
        );
      }
    } finally {
      setIsPaying(false);
    }
  };

  const minutesLeft = Math.floor(secondsRemaining / 60);
  const secondsLeft = secondsRemaining % 60;
  const isExpired = secondsRemaining === 0 && preview !== null;

  return (
    <section className="consumer-view max-w-[1200px] mx-auto py-2">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {/* ── STEP 1: SCAN OR INPUT QR (FR-C04) ── */}
      {step === 'scan' && (
        <article className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs max-w-xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <div className="size-24 rounded-3xl bg-blue-50/60 p-4 flex items-center justify-center border border-blue-100 shadow-inner">
              <img
                src="/images/scan-qr-icon.png"
                alt=""
                className="size-18 object-contain drop-shadow-md hover:scale-105 transition-transform"
              />
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-1.5">
            {copy.scanTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            {copy.scanDescription}
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-red-700 text-xs font-medium flex items-center gap-2.5 text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600" />
              <span className="flex-1">{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-700 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Camera & QR Image Upload Action Buttons (FR-C04) */}
          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {isCameraActive ? (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <CameraOff className="size-4" />
                <span>{copy.stopCameraAction}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStartCamera()}
                disabled={isLoading || isDecodingImage}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[#0056b3] hover:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Camera className="size-4" />
                <span>{copy.cameraAction}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isDecodingImage}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[#0056b3] hover:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <ImageUp className="size-4" />
              <span>
                {isDecodingImage ? copy.scanning : copy.uploadQrImageAction}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              data-testid="qr-image-input"
              onChange={(e) => void handleQrImageFileChange(e)}
              className="hidden"
            />
          </div>

          {/* Live Camera Viewfinder */}
          {isCameraActive && (
            <div className="mb-6 overflow-hidden rounded-2xl border-2 border-[#0056b3] bg-slate-950 p-3 text-white shadow-md">
              <div className="relative mx-auto aspect-video max-h-64 overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  data-testid="qr-camera-video"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-sky-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <p className="mt-2.5 text-[11px] font-medium text-blue-100">
                {copy.cameraHint}
              </p>
            </div>
          )}

          {/* QR Token Form */}
          <form onSubmit={handleScanSubmit} className="space-y-4">
            <div className="text-left">
              <label
                htmlFor="qr-token-input"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                {copy.qrInputLabel}
              </label>
              <div className="relative">
                <input
                  id="qr-token-input"
                  type="text"
                  value={qrTokenInput}
                  onChange={(e) => setQrTokenInput(e.target.value)}
                  placeholder={copy.qrInputPlaceholder}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#0056b3] focus:ring-2 focus:ring-[#0056b3]/15 text-sm font-mono text-slate-800 placeholder:text-slate-400 transition-all outline-none"
                />
                {qrTokenInput && (
                  <button
                    type="button"
                    onClick={() => setQrTokenInput('')}
                    className="absolute right-3 top-3.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!qrTokenInput.trim() || isLoading}
              className="w-full py-3 px-5 rounded-xl bg-[#0056b3] hover:bg-[#004494] text-white font-bold text-sm shadow-xs active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  <span>{copy.scanning}</span>
                </>
              ) : (
                <>
                  <QrCode className="size-4" />
                  <span>{copy.checkQrAction}</span>
                </>
              )}
            </button>
          </form>

          {/* Alternative Demo Action */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDemoAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <span>{copy.demoAction}</span>
            </button>
          </div>
        </article>
      )}

      {/* ── STEP 2: REVIEW ORDER BEFORE PAYMENT ── */}
      {step === 'review' && preview && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Merchant & Items details */}
          <article className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header: Merchant + Expiry */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3.5">
                  <div className="size-11 rounded-2xl bg-blue-50 text-[#0056b3] flex items-center justify-center shrink-0">
                    <ReceiptText className="size-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {copy.reviewTitle}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {preview.merchantName}
                    </h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      Order #{preview.orderId}
                    </p>
                  </div>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold shrink-0 ${
                    isExpired
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : secondsRemaining < 60
                        ? 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Clock className="size-3.5" />
                  <span>
                    {isExpired
                      ? copy.qrExpiredMessage
                      : copy.expiresIn(minutesLeft, secondsLeft)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3 mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {copy.itemsTitle}
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {preview.items.map((item) => (
                    <div
                      key={item.productName}
                      className="p-3.5 flex items-center justify-between text-sm bg-white hover:bg-slate-50/50 transition-colors"
                    >
                      <div>
                        <strong className="font-bold text-slate-800 block">
                          {item.productName}
                        </strong>
                        <span className="text-xs text-slate-400">
                          {item.quantity} × ฿{formatCurrency(item.unitPrice)}
                        </span>
                      </div>
                      <strong className="font-extrabold text-slate-900 font-mono">
                        ฿{formatCurrency(item.lineTotal)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Back to Scan button */}
            <button
              type="button"
              onClick={() => {
                setStep('scan');
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer pt-3"
            >
              <RotateCcw className="size-3.5" />
              <span>{copy.backToScan}</span>
            </button>
          </article>

          {/* Right: Payment Calculation & Confirmation */}
          <article className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                {copy.reviewTitle}
              </h2>

              {errorMessage && (
                <div
                  role="alert"
                  className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Coupon Selector */}
              {availableCoupons.length > 0 && (
                <div className="mb-4 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 mb-1.5">
                    <Tag className="size-3.5 text-amber-600" />
                    <span>{copy.coupon}</span>
                  </div>
                  <select
                    value={selectedCouponId}
                    onChange={(e) => void handleCouponChange(e.target.value)}
                    disabled={isPaying}
                    aria-label={copy.coupon}
                    className="w-full text-xs font-medium bg-white border border-amber-300 rounded-xl p-2 text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">{copy.noCoupon}</option>
                    {availableCoupons.map((c) => (
                      <option key={c.userCouponId} value={c.userCouponId}>
                        {c.couponName} (ลด ฿{formatCurrency(c.discountValue)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Financial Calculation Breakdown */}
              <dl className="space-y-2.5 text-sm mb-5">
                <div className="flex justify-between text-slate-600">
                  <dt>{copy.subtotal}</dt>
                  <dd className="font-mono">
                    ฿{formatCurrency(preview.subtotal)}
                  </dd>
                </div>

                {preview.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <dt className="flex items-center gap-1">
                      <span>{copy.coupon}</span>
                      {preview.appliedCoupon && (
                        <small className="text-[11px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md">
                          {preview.appliedCoupon.couponName}
                        </small>
                      )}
                    </dt>
                    <dd className="font-mono">
                      -฿{formatCurrency(preview.discountAmount)}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-3 border-t border-slate-100 text-slate-900">
                  <dt className="text-base font-bold">{copy.finalAmount}</dt>
                  <dd className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                    ฿{formatCurrency(preview.finalAmount)}
                  </dd>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 mt-3">
                  <div className="flex justify-between text-xs text-slate-600">
                    <dt className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span>{copy.subsidyExpected}</span>
                    </dt>
                    <dd className="font-mono font-bold text-slate-900">
                      ฿{formatCurrency(preview.subsidyAmount)}
                    </dd>
                  </div>

                  <div className="flex justify-between text-xs text-slate-600">
                    <dt className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#0056b3]" />
                      <span>{copy.personalExpected}</span>
                    </dt>
                    <dd className="font-mono font-bold text-[#0056b3]">
                      ฿{formatCurrency(preview.userPaidAmount)}
                    </dd>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 text-right pt-1 font-mono">
                  {copy.walletAfterAmount(
                    formatCurrency(
                      Math.max(
                        0,
                        preview.personalBalance - preview.userPaidAmount,
                      ),
                    ),
                  )}
                </div>
              </dl>

              {/* Insufficient Balance Alert */}
              {!preview.canAfford && (
                <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertCircle className="size-4 text-amber-600" />
                    <span>{copy.insufficientBalanceTitle}</span>
                  </div>
                  <p className="text-amber-700 mb-2.5">
                    {copy.insufficientBalanceMessage(
                      formatCurrency(
                        preview.userPaidAmount - preview.personalBalance,
                      ),
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('wallet')}
                    className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="size-3.5" />
                    <span>{copy.topUpAction}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Confirmation & Safety Note */}
            <div>
              <button
                type="button"
                onClick={() => void handleConfirmPay()}
                disabled={!preview.canAfford || isPaying || isExpired}
                aria-label={copy.confirm}
                className="w-full py-3.5 px-5 rounded-xl bg-[#0056b3] hover:bg-[#004494] text-white font-bold text-sm shadow-md active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer mb-3"
              >
                {isPaying ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    <span>{copy.paymentProcessing}</span>
                  </>
                ) : (
                  <span>
                    {copy.confirmPaymentWithAmount(
                      formatCurrency(preview.finalAmount),
                    )}
                  </span>
                )}
              </button>

              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 text-center">
                <ShieldCheck className="size-3.5 text-slate-400 shrink-0" />
                <span>{copy.safetyNote}</span>
              </p>
            </div>
          </article>
        </div>
      )}

      {/* ── STEP 3: PAYMENT SUCCESS & RECEIPT SUMMARY ── */}
      {step === 'success' && paymentResult && (
        <article className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 shadow-xs max-w-lg mx-auto text-center">
          <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
            <CheckCircle2 className="size-9" />
          </div>

          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
            {copy.orderIdPrefix(paymentResult.orderId)}
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
            {copy.successTitle}
          </h2>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight my-3">
            ฿{formatCurrency(paymentResult.finalAmount)}
          </div>
          <p className="text-xs text-slate-500 mb-6">
            {copy.successDescriptionWithId(paymentResult.orderId)}
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2 mb-6 text-left">
            <div className="flex justify-between text-slate-600">
              <span>{copy.personalExpected}</span>
              <strong className="font-mono text-slate-900">
                ฿{formatCurrency(paymentResult.userPaidAmount)}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{copy.subsidyExpected}</span>
              <strong className="font-mono text-slate-900">
                ฿{formatCurrency(paymentResult.subsidyAmount)}
              </strong>
            </div>
            {paymentResult.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{copy.coupon}</span>
                <strong className="font-mono">
                  -฿{formatCurrency(paymentResult.discountAmount)}
                </strong>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="flex-1 py-3 px-4 rounded-xl bg-[#0056b3] hover:bg-[#004494] text-white font-bold text-sm shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ReceiptText className="size-4" />
              <span>{copy.receiptAction}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
            >
              <span>{copy.homeAction}</span>
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
