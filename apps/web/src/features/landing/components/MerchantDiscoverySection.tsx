import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MapPin, RefreshCw, Search, Store, Tags, X } from 'lucide-react';
import { LoadingState } from '../../../components/LoadingState';
import { th } from '../../../i18n/th';
import { getPublicMerchants, type PublicMerchant } from '../landing.api';

export function MerchantDiscoverySection() {
  const copy = th.landing.merchantDiscovery;
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
      className="border-t border-blue-100 bg-gradient-to-b from-blue-50/60 to-white px-4 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-[#0056b3]">
            <Store className="size-3.5" />
            {copy.eyebrow}
          </span>
          <h2
            id="merchant-search-heading"
            className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl"
          >
            {copy.title}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
            {copy.subtitle}
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          role="search"
          className="mx-auto mt-7 flex max-w-2xl gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-blue-900/5"
        >
          <label htmlFor="public-merchant-search" className="sr-only">
            {copy.searchLabel}
          </label>
          <Search className="ml-2 mt-2.5 size-5 shrink-0 text-slate-400" />
          <input
            id="public-merchant-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label={copy.clearSearch}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="shrink-0 rounded-xl bg-[#0056b3] px-4 py-2 text-sm font-bold text-white hover:bg-[#004494] disabled:opacity-50"
          >
            {copy.searchButton}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">
              {activeSearch ? copy.searchResults : copy.recommendedTitle}
            </h3>
            <p className="text-xs text-slate-500">
              {activeSearch
                ? copy.resultCount(merchants.length, activeSearch)
                : copy.randomHint}
            </p>
          </div>
          {!activeSearch && (
            <button
              type="button"
              onClick={() => void loadMerchants('')}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              {copy.randomAgain}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="mt-5">
            <LoadingState label={copy.loading} variant="cards" />
          </div>
        ) : error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadMerchants(activeSearch)}
              className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
            >
              {copy.retry}
            </button>
          </div>
        ) : merchants.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            {copy.empty}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {merchants.map((merchant) => (
              <article
                key={merchant.merchantId}
                className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3]">
                  <Store className="size-5" />
                </div>
                <h4 className="mt-3 line-clamp-2 text-sm font-extrabold text-slate-900">
                  {merchant.merchantName}
                </h4>
                {merchant.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {merchant.description}
                  </p>
                )}
                <div className="mt-auto space-y-2 pt-4 text-[11px] text-slate-500">
                  {merchant.merchantTypes.length > 0 && (
                    <p className="flex items-start gap-1.5">
                      <Tags className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
                      <span className="line-clamp-2">
                        {merchant.merchantTypes.join(' · ')}
                      </span>
                    </p>
                  )}
                  {merchant.address && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                      <span className="line-clamp-2">{merchant.address}</span>
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
