import { LogOut, Menu, QrCode, ShoppingCart, Store } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { PosView } from './MerchantSidebar';

export interface MerchantTopBarProps {
  activeView: PosView;
  merchantName: string;
  merchantRole?: string | undefined;
  hasActiveQr?: boolean | undefined;
  onOpenMobile: () => void;
  onNavigate: (view: PosView) => void;
  onLogout: () => void;
}

const viewTitles: Record<PosView, string> = {
  pos: th.merchantPortal.nav.pos,
  orders: th.merchantPortal.nav.orders,
  wallet: th.merchantPortal.nav.wallet,
  dashboard: th.merchantPortal.nav.dashboard,
  qr: th.merchantPortal.nav.qr,
};

export function MerchantTopBar({
  activeView,
  merchantName,
  merchantRole = 'OWNER',
  hasActiveQr = false,
  onOpenMobile,
  onNavigate,
  onLogout,
}: MerchantTopBarProps) {
  const isOwner = merchantRole === 'OWNER';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between select-none">
      {/* Left: Mobile Menu Toggle / Brand Logo & Desktop Page Title */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger & Logo */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label="เปิดเมนูนำทาง"
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Menu className="size-5" />
          </button>
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-8 sm:h-9 w-auto object-contain"
          />
        </div>

        {/* Desktop Breadcrumbs and Title */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">
            {th.consumerDashboard.brand}
          </span>
          <span className="text-slate-300">/</span>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {viewTitles[activeView]}
          </h1>
        </div>
      </div>

      {/* Right: Quick Actions & Profile Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Fast Action CTA (Desktop) */}
        {hasActiveQr && activeView !== 'qr' && (
          <button
            type="button"
            onClick={() => onNavigate('qr')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
          >
            <QrCode className="size-4 text-emerald-600" aria-hidden="true" />
            <span>{th.merchantPortal.nav.qr}</span>
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        )}

        {activeView !== 'pos' && (
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0056b3] text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            <span>{th.merchantPortal.nav.pos}</span>
          </button>
        )}

        {/* Profile Avatar Button (Mobile/Tablet circular avatar) */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="ข้อมูลร้านค้า"
          className="lg:hidden size-9 rounded-full bg-blue-100 text-[#0056b3] flex items-center justify-center font-bold text-sm hover:ring-2 hover:ring-[#0056b3]/30 transition-all cursor-pointer"
        >
          {merchantName.slice(0, 1)}
        </button>

        {/* Profile Summary Badge (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 pl-2.5 pr-3 py-1 rounded-xl border border-slate-200 bg-white">
          <Store className="size-4.5 text-[#0056b3]" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-800 max-w-[140px] truncate">
            {merchantName}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              isOwner
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {isOwner ? 'เจ้าของร้าน' : 'พนักงาน'}
          </span>
        </div>

        {/* Direct Logout Icon Button */}
        <button
          type="button"
          onClick={onLogout}
          aria-label={th.merchantPortal.logout}
          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
