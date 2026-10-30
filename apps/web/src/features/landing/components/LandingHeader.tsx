import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { th } from '../../../i18n/th';

export type LandingNavSection =
  | 'home'
  | 'project-info'
  | 'how-to-join'
  | 'merchant-search'
  | 'news'
  | 'faq';

export interface LandingHeaderProps {
  onLogin: () => void;
  onOpenNews?: (() => void) | undefined;
  onOpenFaq?: (() => void) | undefined;
  activeNav?: LandingNavSection | undefined;
  onNavigateHome?: (() => void) | undefined;
  onNavigateProjectInfo?: (() => void) | undefined;
  onNavigateHowToJoin?: ((role?: 'consumer' | 'merchant') => void) | undefined;
  onNavigateMerchantSearch?: (() => void) | undefined;
  onNavigateNews?: (() => void) | undefined;
  onNavigateFaq?: (() => void) | undefined;
}

export function LandingHeader({
  onLogin,
  onOpenNews,
  onOpenFaq,
  activeNav = 'home',
  onNavigateHome,
  onNavigateProjectInfo,
  onNavigateHowToJoin,
  onNavigateMerchantSearch,
  onNavigateNews,
  onNavigateFaq,
}: LandingHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/98 shadow-xs backdrop-blur-xs">
      <div className="mx-auto flex min-h-[4.75rem] sm:min-h-[5.5rem] md:min-h-[6rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
        {/* Brand Logo */}
        <a
          href="/"
          onClick={(e) => {
            if (onNavigateHome) {
              e.preventDefault();
              onNavigateHome();
            }
          }}
          className="flex items-center gap-2 shrink-0 transition-transform duration-200 hover:scale-[1.02]"
          aria-label={th.landing.brand}
        >
          <img
            src="/images/brand-logo.png"
            alt={th.landing.brand}
            className="h-12 sm:h-16 md:h-20 w-auto object-contain transition-all"
          />
        </a>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="เมนูหลัก"
          className="hidden md:flex items-center gap-6 lg:gap-8 whitespace-nowrap text-sm lg:text-[15px]"
        >
          {/* Active Home Tab */}
          <a
            href="/"
            onClick={(e) => {
              if (onNavigateHome) {
                e.preventDefault();
                onNavigateHome();
              }
            }}
            className={`relative font-bold transition-colors py-2 ${
              activeNav === 'home'
                ? 'text-[#0056b3]'
                : 'text-slate-800 hover:text-[#0056b3]'
            }`}
          >
            {th.landing.nav.home}
            {activeNav === 'home' && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full max-w-[48px] h-[3.5px] bg-[#0056b3] rounded-full"
              />
            )}
          </a>

          {/* Project Info */}
          <a
            href="#schedule-section"
            onClick={(e) => {
              if (onNavigateProjectInfo) {
                e.preventDefault();
                onNavigateProjectInfo();
              }
            }}
            className={`relative font-bold transition-colors py-2 cursor-pointer ${
              activeNav === 'project-info'
                ? 'text-[#0056b3]'
                : 'text-slate-800 hover:text-[#0056b3]'
            }`}
          >
            {th.landing.nav.projectInfo}
            {activeNav === 'project-info' && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full max-w-[48px] h-[3.5px] bg-[#0056b3] rounded-full"
              />
            )}
          </a>

          {/* Eligibility with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              className={`relative flex items-center gap-1 font-bold transition-colors cursor-pointer py-2 ${
                activeNav === 'how-to-join'
                  ? 'text-[#0056b3]'
                  : 'text-slate-800 hover:text-[#0056b3]'
              }`}
            >
              <span>{th.landing.nav.eligibility}</span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 text-slate-500 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
              {activeNav === 'how-to-join' && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full max-w-[48px] h-[3.5px] bg-[#0056b3] rounded-full"
                />
              )}
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl border border-slate-100 bg-white p-2 shadow-lg ring-1 ring-black/5 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (onNavigateHowToJoin) {
                      onNavigateHowToJoin('consumer');
                    } else {
                      onLogin();
                    }
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-[#0056b3] cursor-pointer"
                >
                  {th.landing.nav.forConsumers}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (onNavigateHowToJoin) {
                      onNavigateHowToJoin('merchant');
                    } else {
                      onLogin();
                    }
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-[#0056b3] cursor-pointer"
                >
                  {th.landing.nav.forMerchants}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogin();
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#0056b3] transition-colors hover:bg-blue-50 cursor-pointer"
                >
                  {th.landing.nav.login}
                </button>
              </div>
            )}
          </div>

          {/* Find Shops */}
          <a
            href="#merchant-search-section"
            onClick={(e) => {
              if (onNavigateMerchantSearch) {
                e.preventDefault();
                onNavigateMerchantSearch();
              }
            }}
            className={`relative font-bold transition-colors py-2 cursor-pointer ${
              activeNav === 'merchant-search'
                ? 'text-[#0056b3]'
                : 'text-slate-800 hover:text-[#0056b3]'
            }`}
          >
            {th.landing.nav.findShops}
            {activeNav === 'merchant-search' && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full max-w-[48px] h-[3.5px] bg-[#0056b3] rounded-full"
              />
            )}
          </a>

          {/* MOF News */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateNews) {
                onNavigateNews();
              } else {
                onOpenNews?.();
              }
            }}
            className={`relative font-bold transition-colors py-2 cursor-pointer ${
              activeNav === 'news'
                ? 'text-[#0056b3]'
                : 'text-slate-800 hover:text-[#0056b3]'
            }`}
          >
            {th.landing.nav.mofNews}
            {activeNav === 'news' && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full max-w-[48px] h-[3.5px] bg-[#0056b3] rounded-full"
              />
            )}
          </button>

          {/* FAQ */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateFaq) {
                onNavigateFaq();
              } else {
                onOpenFaq?.();
              }
            }}
            className={`relative font-bold transition-colors py-2 cursor-pointer ${
              activeNav === 'faq'
                ? 'text-[#0056b3]'
                : 'text-slate-800 hover:text-[#0056b3]'
            }`}
          >
            {th.landing.nav.faq}
            {activeNav === 'faq' && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full max-w-[48px] h-[3.5px] bg-[#0056b3] rounded-full"
              />
            )}
          </button>

          {/* Login Button */}
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center justify-center rounded-xl bg-[#0056b3] px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-[#004494] active:scale-98 transition-all cursor-pointer"
          >
            {th.landing.nav.login}
          </button>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-label={
              isMobileMenuOpen
                ? th.landing.nav.menuClose
                : th.landing.nav.menuToggle
            }
            className="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isMobileMenuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 shadow-md">
          <nav className="flex flex-col gap-3 text-base font-semibold text-slate-800">
            <a
              href="/"
              onClick={(e) => {
                setIsMobileMenuOpen(false);
                if (onNavigateHome) {
                  e.preventDefault();
                  onNavigateHome();
                }
              }}
              className={`rounded-lg px-3 py-2 ${
                activeNav === 'home'
                  ? 'text-[#0056b3] bg-blue-50/70 font-bold'
                  : 'hover:bg-slate-50'
              }`}
            >
              {th.landing.nav.home}
            </a>
            <a
              href="#schedule-section"
              onClick={(e) => {
                setIsMobileMenuOpen(false);
                if (onNavigateProjectInfo) {
                  e.preventDefault();
                  onNavigateProjectInfo();
                }
              }}
              className={`rounded-lg px-3 py-2 cursor-pointer ${
                activeNav === 'project-info'
                  ? 'text-[#0056b3] bg-blue-50/70 font-bold'
                  : 'hover:bg-slate-50'
              }`}
            >
              {th.landing.nav.projectInfo}
            </a>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onNavigateHowToJoin) {
                  onNavigateHowToJoin('consumer');
                } else {
                  onLogin();
                }
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left cursor-pointer ${
                activeNav === 'how-to-join'
                  ? 'text-[#0056b3] bg-blue-50/70 font-bold'
                  : 'hover:bg-slate-50'
              }`}
            >
              <span>{th.landing.nav.eligibility}</span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>
            <a
              href="#merchant-search-section"
              onClick={(e) => {
                setIsMobileMenuOpen(false);
                if (onNavigateMerchantSearch) {
                  e.preventDefault();
                  onNavigateMerchantSearch();
                }
              }}
              className={`rounded-lg px-3 py-2 cursor-pointer ${
                activeNav === 'merchant-search'
                  ? 'text-[#0056b3] bg-blue-50/70 font-bold'
                  : 'hover:bg-slate-50'
              }`}
            >
              {th.landing.nav.findShops}
            </a>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onNavigateNews) {
                  onNavigateNews();
                } else {
                  onOpenNews?.();
                }
              }}
              className={`rounded-lg px-3 py-2 text-left cursor-pointer ${
                activeNav === 'news'
                  ? 'text-[#0056b3] bg-blue-50/70 font-bold'
                  : 'hover:bg-slate-50'
              }`}
            >
              {th.landing.nav.mofNews}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onNavigateFaq) {
                  onNavigateFaq();
                } else {
                  onOpenFaq?.();
                }
              }}
              className={`rounded-lg px-3 py-2 text-left cursor-pointer ${
                activeNav === 'faq'
                  ? 'text-[#0056b3] bg-blue-50/70 font-bold'
                  : 'hover:bg-slate-50'
              }`}
            >
              {th.landing.nav.faq}
            </button>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogin();
                }}
                className="w-full rounded-xl bg-[#0056b3] py-2.5 text-center text-sm font-bold text-white shadow-xs hover:bg-[#004494] cursor-pointer"
              >
                {th.landing.nav.login}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
