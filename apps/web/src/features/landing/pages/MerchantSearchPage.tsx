import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  Store,
  X,
  AlertCircle,
} from 'lucide-react';
import { LoadingState } from '../../../components/LoadingState';
import { th } from '../../../i18n/th';
import { getPublicMerchants, type PublicMerchant } from '../landing.api';

export interface MerchantSearchPageProps {
  onBackToHome: () => void;
  onLogin?: (() => void) | undefined;
}

type MerchantCategoryFilter = 'all' | 'food' | 'general' | 'otop' | 'community' | 'transport';

export function MerchantSearchPage({ onBackToHome }: MerchantSearchPageProps) {
  const pageCopy = th.landing.merchantSearchPage;
  const discoveryCopy = th.landing.merchantDiscovery;

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MerchantCategoryFilter>('all');
  const [merchants, setMerchants] = useState<PublicMerchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadMerchants = useCallback(
    async (search: string) => {
      const currentRequestId = ++requestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const result = await getPublicMerchants(search, 20);
        if (requestId.current !== currentRequestId) return;
        setMerchants(result);
        setActiveSearch(search.trim());
      } catch (caughtError) {
        if (requestId.current !== currentRequestId) return;
        setError(
          caughtError instanceof Error ? caughtError.message : pageCopy.states.errorTitle,
        );
      } finally {
        if (requestId.current === currentRequestId) setIsLoading(false);
      }
    },
    [pageCopy.states.errorTitle],
  );

  useEffect(() => {
    void loadMerchants('');
    return () => {
      requestId.current += 1;
    };
  }, [loadMerchants]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadMerchants(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    void loadMerchants('');
  };

  const filteredMerchants = useMemo(() => {
    if (selectedCategory === 'all') return merchants;

    const categoryKeywords: Record<Exclude<MerchantCategoryFilter, 'all'>, string[]> = {
      food: ['อาหาร', 'เครื่องดื่ม', 'food', 'beverage'],
      general: ['ทั่วไป', 'ของใช้', 'general'],
      otop: ['otop', 'โอทอป'],
      community: ['ชุมชน', 'วิสาหกิจ', 'community'],
      transport: ['ขนส่ง', 'รถ', 'transport'],
    };

    const keywords = categoryKeywords[selectedCategory];

    return merchants.filter((m) => {
      const typeMatches = m.merchantTypes.some((type) =>
        keywords.some((kw) => type.toLowerCase().includes(kw)),
      );
      const nameMatches = keywords.some((kw) =>
        m.merchantName.toLowerCase().includes(kw),
      );
      return typeMatches || nameMatches;
    });
  }, [merchants, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Breadcrumb Bar */}
      <div className="border-b border-slate-200/80 bg-white shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
            <button
              type="button"
              onClick={onBackToHome}
              className="font-medium text-slate-600 hover:text-[#0056b3] transition-colors cursor-pointer"
            >
              {pageCopy.meta.breadcrumbHome}
            </button>
            <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
            <span className="font-semibold text-slate-900" aria-current="page">
              {pageCopy.meta.breadcrumbCurrent}
            </span>
          </nav>
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0056b3] hover:text-[#004494] transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>{pageCopy.meta.backToHome}</span>
          </button>
        </div>
      </div>

      {/* Hero Search Header */}
      <section className="bg-slate-50 px-4 pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-200/80">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#0056b3] shadow-2xs">
            <Store className="size-4" aria-hidden="true" />
            <span>{discoveryCopy.eyebrow}</span>
          </div>
          <h1 className="mt-4 text-2xl sm:text-4xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            {pageCopy.meta.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
            {pageCopy.meta.subtitle}
          </p>

          {/* Search Box */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-2xl border-2 border-blue-200/80 bg-white p-2.5 shadow-xl shadow-blue-900/5 focus-within:border-[#0056b3] transition-colors"
          >
            <label htmlFor="merchant-search-input" className="sr-only">
              {pageCopy.search.label}
            </label>
            <Search className="ml-2.5 size-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              id="merchant-search-input"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={pageCopy.search.placeholder}
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm sm:text-base text-slate-900 outline-none placeholder:text-slate-400 font-sans"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label={pageCopy.search.clear}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#004494] active:scale-98 transition-all cursor-pointer shrink-0"
            >
              {pageCopy.search.button}
            </button>
          </form>

          {/* Category Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
              <Filter className="size-3.5 text-slate-400" aria-hidden="true" />
              <span>{pageCopy.filters.label}</span>
            </span>
            {(
              [
                { id: 'all', label: pageCopy.filters.all },
                { id: 'food', label: pageCopy.filters.food },
                { id: 'general', label: pageCopy.filters.general },
                { id: 'otop', label: pageCopy.filters.otop },
                { id: 'community', label: pageCopy.filters.community },
                { id: 'transport', label: pageCopy.filters.transport },
              ] as const
            ).map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0056b3] text-white shadow-xs scale-102'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Results Header / Stats */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {activeSearch
                ? pageCopy.stats.resultsFound(filteredMerchants.length, activeSearch)
                : pageCopy.stats.recommendedHeading}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {activeSearch
                ? pageCopy.stats.totalShowing(filteredMerchants.length)
                : pageCopy.stats.recommendedSub}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMerchants(activeSearch)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{pageCopy.randomRefresh}</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-16 text-center">
            <LoadingState label={pageCopy.states.loading} />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            role="alert"
            className="my-10 rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center"
          >
            <AlertCircle className="mx-auto size-8 text-rose-500" aria-hidden="true" />
            <h3 className="mt-2 text-base font-bold text-rose-800">
              {pageCopy.states.errorTitle}
            </h3>
            <p className="mt-1 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadMerchants(searchInput)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-rose-700 active:scale-98 transition-all cursor-pointer"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span>{pageCopy.states.retry}</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredMerchants.length === 0 && (
          <div className="my-12 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Store className="size-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base sm:text-lg font-bold text-slate-900">
              {pageCopy.states.emptyTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              {pageCopy.states.emptySubtitle}
            </p>
            {(activeSearch || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  handleClearSearch();
                }}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <span>{discoveryCopy.clearSearch}</span>
              </button>
            )}
          </div>
        )}

        {/* Merchants Grid */}
        {!isLoading && !error && filteredMerchants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMerchants.map((merchant) => (
              <article
                key={merchant.merchantId}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div>
                  {/* Card Header: Icon & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3] group-hover:bg-[#0056b3] group-hover:text-white transition-colors">
                      <Store className="size-5.5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0056b3] border border-blue-200">
                        <CheckCircle2 className="size-3 text-[#0056b3]" aria-hidden="true" />
                        <span>{pageCopy.card.verifiedBadge}</span>
                      </span>
                    </div>
                  </div>

                  {/* Merchant Name */}
                  <h3 className="mt-3.5 text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0056b3] transition-colors leading-snug">
                    {merchant.merchantName}
                  </h3>

                  {/* Types Badges */}
                  {merchant.merchantTypes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {merchant.merchantTypes.map((type) => (
                        <span
                          key={type}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {merchant.description || pageCopy.card.defaultDesc}
                  </p>
                </div>

                {/* Card Footer: Address & Benefit Pill */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-start gap-1.5 text-xs text-slate-500">
                    <MapPin className="size-3.5 shrink-0 text-slate-400 mt-0.5" aria-hidden="true" />
                    <span className="line-clamp-1">
                      {merchant.address || pageCopy.card.unspecifiedAddress}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0056b3]">
                      {pageCopy.card.acceptingQr}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#0056b3]">
                      <span className="size-1.5 rounded-full bg-[#0056b3]" aria-hidden="true" />
                      <span>{pageCopy.card.statusActive}</span>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
