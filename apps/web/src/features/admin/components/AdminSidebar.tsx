import {
  Award,
  BarChart3,
  Coins,
  Layers,
  LogOut,
  ShieldCheck,
  Sparkles,
  Store,
  UserCheck,
  X,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export type AdminTab =
  | 'overview'
  | 'merchants'
  | 'programs'
  | 'quests'
  | 'rewards'
  | 'socialImpact'
  | 'admins';

export interface AdminSidebarProps {
  activeTab: AdminTab;
  adminName: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectTab: (tab: AdminTab) => void;
  onLogout: () => void;
}

export function AdminSidebar({
  activeTab,
  adminName,
  isMobileOpen,
  onCloseMobile,
  onSelectTab,
  onLogout,
}: AdminSidebarProps) {
  const copy = th.adminPortal;

  const navTabs: Array<{
    key: AdminTab;
    label: string;
    icon: typeof Layers;
  }> = [
    { key: 'overview', label: copy.nav.overview, icon: Layers },
    { key: 'merchants', label: copy.nav.merchants, icon: Store },
    { key: 'programs', label: copy.nav.programs, icon: Coins },
    { key: 'quests', label: copy.nav.quests, icon: Sparkles },
    { key: 'rewards', label: copy.nav.rewards, icon: Award },
    { key: 'socialImpact', label: copy.nav.socialImpact, icon: BarChart3 },
    { key: 'admins', label: copy.nav.admins, icon: UserCheck },
  ];

  const handleItemClick = (key: AdminTab) => {
    onSelectTab(key);
    onCloseMobile();
  };

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

        {/* Role & Duty Indicator Badge */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#0056b3] shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-700 block truncate">
              {copy.roleBadge}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              ศูนย์ควบคุม: อนุมัติร้านค้า · โครงการ · ระบบ
            </span>
          </div>
        </div>

        {/* Navigation Tabs List */}
        <nav
          className="p-4 pt-1 space-y-1.5"
          aria-label="เมนูหลักผู้ดูแลระบบ"
        >
          {navTabs.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                onClick={() => handleItemClick(key)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs xl:text-sm font-semibold transition-all cursor-pointer ${
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
                <span className="truncate flex-1 text-left">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Card & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 m-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-blue-100 text-[#0056b3] flex items-center justify-center font-bold text-base shrink-0">
            {adminName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold text-slate-900 truncate block">
              {adminName}
            </span>
            <small className="text-xs text-slate-500 font-medium block truncate">
              {copy.roleBadge}
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-100/60 transition-all cursor-pointer"
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span>{copy.logout}</span>
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
            aria-label="เมนูหลักผู้ดูแลระบบ"
          >
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
