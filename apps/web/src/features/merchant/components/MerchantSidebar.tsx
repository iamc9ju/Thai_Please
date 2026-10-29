import {
  BarChart3,
  FileText,
  LogOut,
  QrCode,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Wallet,
  X,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export type PosView = 'pos' | 'qr' | 'orders' | 'wallet' | 'dashboard';

export interface MerchantSidebarProps {
  activeView: PosView;
  merchantName: string;
  merchantRole?: string | undefined;
  citizenId?: string | undefined;
  hasActiveQr?: boolean | undefined;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (view: PosView) => void;
  onLogout: () => void;
}

export function MerchantSidebar({
  activeView,
  merchantName,
  merchantRole = 'OWNER',
  citizenId,
  hasActiveQr = false,
  isMobileOpen,
  onCloseMobile,
  onNavigate,
  onLogout,
}: MerchantSidebarProps) {
  const isOwner = merchantRole === 'OWNER';
  const navCopy = th.merchantPortal.nav;

  // Role-based navigation items (BR-MERCHANT-01)
  // OWNER: Full capabilities (POS, Orders, Wallet & Withdrawal, Analytics Dashboard)
  // STAFF: Operational duties only (POS, Orders, QR Display). Wallet & Dashboard restricted.
  const baseItems: Array<{
    id: PosView;
    label: string;
    icon: typeof ShoppingCart;
    ownerOnly?: boolean;
  }> = [
    { id: 'pos', label: navCopy.pos, icon: ShoppingCart },
    { id: 'orders', label: navCopy.orders, icon: FileText },
  ];

  if (hasActiveQr || activeView === 'qr') {
    baseItems.push({ id: 'qr', label: navCopy.qr, icon: QrCode });
  }

  if (isOwner) {
    baseItems.push(
      { id: 'wallet', label: navCopy.wallet, icon: Wallet, ownerOnly: true },
      { id: 'dashboard', label: navCopy.dashboard, icon: BarChart3, ownerOnly: true },
    );
  }

  const handleItemClick = (viewId: PosView) => {
    onNavigate(viewId);
    onCloseMobile();
  };

  const maskedCitizenId = citizenId
    ? `X-XXXX-${citizenId.slice(-4)}`
    : null;

  const roleLabel = isOwner
    ? th.merchantPortal.pendingApproval.ownerRole
    : th.merchantPortal.pendingApproval.staffRole;

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Top Branding & Main Navigation */}
      <div>
        {/* Brand Logo */}
        <div className="px-6 py-6 flex items-center justify-center relative">
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-14 xl:h-16 w-auto max-w-[210px] object-contain object-center mx-auto"
          />

          {/* Close Button on Mobile Drawer */}
          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="ปิดเมนูนำทาง"
              className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Role Duty Indicator Badge */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
          {isOwner ? (
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
          ) : (
            <Shield className="size-4 text-[#0056b3] shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-700 block truncate">
              {roleLabel}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {isOwner
                ? 'สิทธิ์ครบถ้วน: ขาย · โอนเงิน · แดชบอร์ด'
                : 'สิทธิ์พนักงาน: จุดขาย · บันทึกบิล · สแกนรับเงิน'}
            </span>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav
          className="p-4 pt-1 space-y-1.5"
          aria-label="เมนูหลักร้านค้า"
        >
          {baseItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0056b3] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:scale-98'
                }`}
              >
                <Icon
                  className={`size-4.5 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate flex-1 text-left">{item.label}</span>
                {item.id === 'qr' && (
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Merchant Profile Card & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 m-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-blue-100 text-[#0056b3] flex items-center justify-center font-bold text-base shrink-0">
            {merchantName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold text-slate-900 truncate block">
              {merchantName}
            </span>
            <small className="text-xs text-slate-500 font-medium block truncate">
              {isOwner ? 'เจ้าของร้าน' : 'พนักงานร้าน'}
              {maskedCitizenId ? ` • ${maskedCitizenId}` : ''}
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-100/60 transition-all cursor-pointer"
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span>{th.merchantPortal.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 bg-white border-r border-slate-200/80 flex-col shrink-0 min-h-screen sticky top-0 h-screen select-none">
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col z-50 select-none animate-in slide-in-from-left duration-200"
            aria-label="เมนูหลักร้านค้า"
          >
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
