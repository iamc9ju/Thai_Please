import {
  BarChart3,
  FileText,
  Menu,
  QrCode,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import type { PosView } from './MerchantSidebar';

export interface MerchantMobileNavProps {
  activeView: PosView;
  merchantRole?: string | undefined;
  hasActiveQr?: boolean | undefined;
  onNavigate: (view: PosView) => void;
  onOpenMenu: () => void;
}

export function MerchantMobileNav({
  activeView,
  merchantRole = 'OWNER',
  hasActiveQr = false,
  onNavigate,
  onOpenMenu,
}: MerchantMobileNavProps) {
  const isOwner = merchantRole === 'OWNER';
  const navCopy = th.merchantPortal.nav;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 select-none"
      aria-label="เมนูแถบล่างร้านค้า"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* POS Button */}
        <button
          type="button"
          onClick={() => onNavigate('pos')}
          aria-label="จุดขาย"
          aria-current={activeView === 'pos' ? 'page' : undefined}
          className={`flex-1 py-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            activeView === 'pos'
              ? 'text-[#0056b3] font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <ShoppingCart className="size-5" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 tracking-tight truncate">
            จุดขาย
          </span>
        </button>

        {/* Orders Button */}
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          aria-label="รายการขาย"
          aria-current={activeView === 'orders' ? 'page' : undefined}
          className={`flex-1 py-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            activeView === 'orders'
              ? 'text-[#0056b3] font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <FileText className="size-5" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 tracking-tight truncate">
            รายการขาย
          </span>
        </button>

        {/* Center QR Display Button - only visible when an order is active or QR is viewed */}
        {(hasActiveQr || activeView === 'qr') && (
          <button
            type="button"
            onClick={() => onNavigate('qr')}
            aria-current={activeView === 'qr' ? 'page' : undefined}
            className="-mt-5 flex flex-col items-center group cursor-pointer"
          >
            <div
              className={`size-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-transform active:scale-95 ${
                activeView === 'qr'
                  ? 'bg-[#004494] shadow-blue-600/40'
                  : 'bg-emerald-600 shadow-emerald-600/40 animate-pulse'
              }`}
            >
              <QrCode className="size-6 text-white" aria-hidden="true" />
            </div>
            <span
              className={`text-[10px] font-bold mt-0.5 ${
                activeView === 'qr' ? 'text-[#0056b3]' : 'text-slate-600'
              }`}
            >
              {navCopy.qr}
            </span>
          </button>
        )}

        {/* Wallet (Owner only) or Dashboard */}
        {isOwner ? (
          <>
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              aria-current={activeView === 'wallet' ? 'page' : undefined}
              className={`flex-1 py-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                activeView === 'wallet'
                  ? 'text-[#0056b3] font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <Wallet className="size-5" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 tracking-tight truncate">
                กระเป๋าเงิน
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              aria-current={activeView === 'dashboard' ? 'page' : undefined}
              className={`flex-1 py-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                activeView === 'dashboard'
                  ? 'text-[#0056b3] font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <BarChart3 className="size-5" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 tracking-tight truncate">
                ยอดขาย
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="เปิดเมนูเพิ่มเติม"
            className="flex-1 py-1 flex flex-col items-center justify-center transition-colors cursor-pointer text-slate-500 hover:text-slate-800 font-medium"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span className="text-[10px] mt-0.5 tracking-tight">เมนู</span>
          </button>
        )}
      </div>
    </nav>
  );
}
