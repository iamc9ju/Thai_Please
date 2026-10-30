import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Search,
  Store,
  X,
} from 'lucide-react';
import { LoadingState } from '../../../components/LoadingState';
import { th } from '../../../i18n/th';
import { getPublicMerchants, type PublicMerchant } from '../landing.api';

export interface MerchantDiscoverySectionProps {
  onViewAllMerchants?: (() => void) | undefined;
}

export function MerchantDiscoverySection({
  onViewAllMerchants,
}: MerchantDiscoverySectionProps) {
  const copy = th.landing.merchantDiscovery;
  const pageCopy = th.landing.merchantSearchPage;
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
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
        const result = await getPublicMerchants(search);
        if (requestId.current !== currentRequestId) return;
        setMerchants(result);
        setActiveSearch(search.trim());
      } catch (caughtError) {
        if (requestId.current !== currentRequestId) return;
        setError(
          caughtError instanceof Error ? caughtError.message : copy.loadError,
        );
      } finally {
        if (requestId.current === currentRequestId) setIsLoading(false);
      }
    },
    [copy.loadError],
  );

  useEffect(() => {
    void loadMerchants('');
    return () => {
      requestId.current += 1;
    };
  }, [loadMerchants]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadMerchants(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    void loadMerchants('');
  };

  return (
    <section
      id="merchant-search-section"
      aria-labelledby="merchant-search-heading"
      className="border-t border-slate-100 bg-white px-4 py-14 sm:py-20"
    >
      <div id="actions-section" className="mx-auto max-w-6xl">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-[#0056b3]">
            <Store className="size-3.5" aria-hidden="true" />
            <span>{copy.eyebrow}</span>
          </span>
          <h2
            id="merchant-search-heading"
            className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0f172a]"
          >
            {copy.title}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base font-medium text-slate-500 leading-relaxed">
            {copy.subtitle}
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          role="search"
          className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xs focus-within:border-[#0056b3] transition-colors"
        >
          <label htmlFor="public-merchant-search" className="sr-only">
            {copy.searchLabel}
          </label>
          <Search
            className="ml-2.5 size-5 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="public-merchant-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm sm:text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label={copy.clearSearch}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="shrink-0 rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#004494] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {copy.searchButton}
          </button>
        </form>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a]">
              {activeSearch ? copy.searchResults : copy.recommendedTitle}
            </h3>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              {activeSearch
                ? copy.resultCount(merchants.length, activeSearch)
                : copy.randomHint}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {!activeSearch && (
              <button
                type="button"
                onClick={() => void loadMerchants('')}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-[#0056b3] disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`size-3.5 text-[#0056b3] ${isLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{copy.randomAgain}</span>
              </button>
            )}
            {onViewAllMerchants && (
              <button
                type="button"
                onClick={onViewAllMerchants}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200/80 px-3.5 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <span>{th.landing.nav.findShops}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6">
            <LoadingState label={copy.loading} variant="cards" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-bold text-slate-800">{error}</p>
            <button
              type="button"
              onClick={() => void loadMerchants(activeSearch)}
              className="mt-3 rounded-xl bg-[#0056b3] px-4 py-2 text-xs font-bold text-white hover:bg-[#004494] transition-colors cursor-pointer"
            >
              {copy.retry}
            </button>
          </div>
        ) : merchants.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
            {copy.empty}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {merchants.map((merchant) => (
              <article
                key={merchant.merchantId}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3] group-hover:bg-[#0056b3] group-hover:text-white transition-colors">
                      <Store className="size-5" aria-hidden="true" />
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0056b3]">
                      <CheckCircle2 className="size-3 text-[#0056b3]" aria-hidden="true" />
                      <span>{pageCopy.card.verifiedBadge}</span>
                    </span>
                  </div>

                  <h4 className="mt-3.5 line-clamp-2 text-base font-extrabold text-[#0f172a] group-hover:text-[#0056b3] transition-colors">
                    {merchant.merchantName}
                  </h4>

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

                  {merchant.description && (
                    <p className="mt-2.5 line-clamp-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                      {merchant.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                  {merchant.address ? (
                    <p className="flex items-start gap-1.5 min-w-0">
                      <MapPin
                        className="mt-0.5 size-3.5 shrink-0 text-[#0056b3]"
                        aria-hidden="true"
                      />
                      <span className="line-clamp-1">{merchant.address}</span>
                    </p>
                  ) : (
                    <span className="text-slate-400">
                      {pageCopy.card.unspecifiedAddress}
                    </span>
                  )}
                  <span className="shrink-0 font-bold text-[#0056b3]">
                    {pageCopy.card.acceptingQr}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
