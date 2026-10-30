import { useState } from 'react';
import {
  Clock,
  Store,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { BrandLogoAnimation } from '../../../components/BrandLoadingScreen';
import { th } from '../../../i18n/th';

export interface MerchantPendingApprovalProps {
  merchantName: string;
  citizenId: string;
  status?: string | null;
  merchantRole?: string | null;
  onRefresh?: () => Promise<void> | void;
  onLogout: () => void;
}

export function MerchantPendingApproval({
  merchantName,
  citizenId,
  status = 'PENDING',
  merchantRole = 'OWNER',
  onRefresh,
  onLogout,
}: MerchantPendingApprovalProps) {
  const copy = th.merchantPortal.pendingApproval;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  const isSuspended = status === 'SUSPENDED';
  const isRejected = status === 'REJECTED';
  const isPending = !isSuspended && !isRejected;

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      await onRefresh();
    } catch {
      setRefreshFeedback('ไม่สามารถตรวจสอบสถานะได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsRefreshing(false);
    }
  };

  const maskedCitizenId =
    citizenId.length === 13
      ? `${citizenId.slice(0, 1)}-${citizenId.slice(1, 5)}-xxxxx-${citizenId.slice(10, 12)}-${citizenId.slice(12)}`
      : citizenId;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Store className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {th.brand}
              </h1>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {copy.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {th.merchantPortal.brandSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-bold text-slate-900">{merchantName}</div>
            <div className="text-[11px] text-slate-500">
              {merchantRole === 'OWNER' ? copy.ownerRole : copy.staffRole}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <LogOut className="size-4" />
            <span>{copy.logoutButton}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          {/* Status Icon Header */}
          <div className="text-center">
            {isPending && (
              <div className="mx-auto mb-3 flex flex-col items-center justify-center">
                <BrandLogoAnimation size="md" />
              </div>
            )}
            {isSuspended && (
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-8 ring-orange-50/50">
                <AlertTriangle className="size-8" />
              </div>
            )}
            {isRejected && (
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-50/50">
                <XCircle className="size-8" />
              </div>
            )}

            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {isPending && copy.title}
              {isSuspended && copy.suspendedTitle}
              {isRejected && copy.rejectedTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {isPending && copy.subtitle}
              {isSuspended && copy.suspendedSubtitle}
              {isRejected && copy.rejectedSubtitle}
            </p>
          </div>

          {/* Registration Details Card */}
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Building2 className="size-4 text-slate-400" />
              ข้อมูลการลงทะเบียนร้านค้า
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-xs text-slate-500">{copy.merchantNameLabel}:</span>
                <p className="font-semibold text-slate-900">{merchantName}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{copy.citizenIdLabel}:</span>
                <p className="font-mono font-medium text-slate-800">{maskedCitizenId}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{copy.roleLabel}:</span>
                <p className="font-medium text-slate-800">
                  {merchantRole === 'OWNER' ? copy.ownerRole : copy.staffRole}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">สถานะคำขอ:</span>
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                    {copy.badge}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lifecycle Steps / Timeline */}
          {isPending && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      1. {copy.step1Title}
                    </h4>
                    <p className="text-xs text-slate-500">{copy.step1Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 animate-pulse">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900">
                      2. {copy.step2Title}
                    </h4>
                    <p className="text-xs text-blue-700">{copy.step2Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400">
                      3. {copy.step3Title}
                    </h4>
                    <p className="text-xs text-slate-400">{copy.step3Desc}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {refreshFeedback && (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-center text-xs font-medium text-red-700"
            >
              {refreshFeedback}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {onRefresh && (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
              >
                <RefreshCw
                  className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <span>
                  {isRefreshing ? copy.checkingStatus : copy.checkStatusButton}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <LogOut className="size-4 text-slate-400" />
              <span>{copy.logoutButton}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
