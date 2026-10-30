import { useState, type ReactNode } from 'react';
import { AdminSidebar, type AdminTab } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';

export type { AdminTab };

export interface AdminShellProps {
  activeTab: AdminTab;
  adminName: string;
  isLoading: boolean;
  onNavigate: (tab: AdminTab) => void;
  onRefresh: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AdminShell({
  activeTab,
  adminName,
  isLoading,
  onNavigate,
  onRefresh,
  onLogout,
  children,
}: AdminShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50/70 flex font-sans text-slate-900">
      {/* Left Sidebar Navigation (Unified Theme) */}
      <AdminSidebar
        activeTab={activeTab}
        adminName={adminName}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onSelectTab={onNavigate}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopBar
          activeTab={activeTab}
          adminName={adminName}
          isLoading={isLoading}
          onOpenMobile={() => setIsMobileOpen(true)}
          onRefresh={onRefresh}
          onLogout={onLogout}
        />

        <main
          className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 w-full max-w-[1800px] mx-auto space-y-6"
          aria-busy={isLoading}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
