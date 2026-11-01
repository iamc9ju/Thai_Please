import { LogOut, Menu, RefreshCw, ShieldCheck } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { AdminTab } from './AdminSidebar';

export interface AdminTopBarProps {
  activeTab: AdminTab;
  adminName: string;
  isLoading?: boolean | undefined;
  onOpenMobile: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export function AdminTopBar({
  activeTab,
  adminName,
  isLoading = false,
  onOpenMobile,
  onRefresh,
  onLogout,
}: AdminTopBarProps) {
  const copy = th.adminPortal;

  const tabTitles: Record<AdminTab, string> = {
    overview: copy.nav.overview,
    merchants: copy.nav.merchants,
    programs: copy.nav.programs,
    coupons: copy.nav.coupons,
    quests: copy.nav.quests,
    rewards: copy.nav.rewards,
    socialImpact: copy.nav.socialImpact,
    admins: copy.nav.admins,
  };

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
            alt=""
            aria-hidden="true"
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
            {tabTitles[activeTab]}
          </h1>
        </div>
      </div>

      {/* Right: Quick Actions & Profile Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Refresh Action CTA */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0056b3] text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200/60 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{copy.refresh}</span>
        </button>

        {/* Profile Avatar Button (Mobile/Tablet circular avatar) */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="ข้อมูลผู้ดูแลระบบ"
          className="lg:hidden size-9 rounded-full bg-blue-100 text-[#0056b3] flex items-center justify-center font-bold text-sm hover:ring-2 hover:ring-[#0056b3]/30 transition-all cursor-pointer"
        >
          {adminName.slice(0, 1)}
        </button>

        {/* Profile Summary Badge (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 pl-2.5 pr-3 py-1 rounded-xl border border-slate-200 bg-white">
          <ShieldCheck className="size-4.5 text-[#0056b3]" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-800 max-w-[140px] truncate">
            {adminName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-blue-50 text-[#0056b3] border border-blue-200">
            {copy.roleBadge}
          </span>
        </div>

        {/* Direct Logout Icon Button */}
        <button
          type="button"
          onClick={onLogout}
          aria-label="ออกจากระบบแถบบน"
          title={copy.logout}
          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
