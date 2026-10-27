import type { ReactNode } from 'react';
import {
  Award,
  BarChart3,
  ChevronRight,
  Coins,
  Layers,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  UserCheck,
} from 'lucide-react';
import { th } from '../../../i18n/th';

const navigation = [
  { key: 'overview', icon: Layers },
  { key: 'merchants', icon: Store },
  { key: 'programs', icon: Coins },
  { key: 'quests', icon: Sparkles },
  { key: 'rewards', icon: Award },
  { key: 'socialImpact', icon: BarChart3 },
  { key: 'admins', icon: UserCheck },
] as const;

export type AdminTab = (typeof navigation)[number]['key'];

interface AdminShellProps {
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
  const copy = th.adminPortal;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/images/brand-logo.png" alt={th.brand} />
          <span>
            <ShieldCheck size={14} aria-hidden="true" />
            {copy.roleBadge}
          </span>
        </div>
        <p className="admin-navigation-label">{copy.shell.navigation}</p>
        <nav className="admin-navigation" aria-label={copy.shell.navigation}>
          {navigation.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-current={activeTab === key ? 'page' : undefined}
              aria-label={copy.nav[key]}
              onClick={() => onNavigate(key)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{copy.shell.sections[key]}</span>
              <ChevronRight
                size={15}
                className="admin-nav-chevron"
                aria-hidden="true"
              />
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-note">
          <ShieldCheck size={23} aria-hidden="true" />
          <strong>{copy.shell.workspaceTitle}</strong>
          <p>{copy.shell.workspaceDescription}</p>
        </div>
        <div className="admin-sidebar-profile">
          <span className="admin-avatar">{adminName.slice(0, 1)}</span>
          <div>
            <strong>{adminName}</strong>
            <small>{copy.roleBadge}</small>
          </div>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>{copy.shell.portalTitle}</span>
            <ChevronRight size={14} aria-hidden="true" />
            <h1>{copy.shell.sections[activeTab]}</h1>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={isLoading ? 'animate-spin' : undefined}
              />
              <span>{copy.refresh}</span>
            </button>
            <span className="admin-topbar-name">
              <ShieldCheck size={16} aria-hidden="true" />
              {adminName}
            </span>
            <button
              type="button"
              onClick={onLogout}
              aria-label={copy.logout}
              title={copy.logout}
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="admin-main space-y-6" aria-busy={isLoading}>
          {children}
        </main>
        <footer className="admin-footer">{copy.shell.footer}</footer>
      </div>
    </div>
  );
}
