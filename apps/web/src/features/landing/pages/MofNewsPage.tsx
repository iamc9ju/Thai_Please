import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Landmark,
  Newspaper,
  Phone,
  Search,
  Sparkles,
  X,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export interface MofNewsPageProps {
  onBackToHome: () => void;
  onLogin?: (() => void) | undefined;
}

type NewsCategoryFilter = 'all' | 'project' | 'announcement' | 'measures';

export function MofNewsPage({ onBackToHome }: MofNewsPageProps) {
  const pageCopy = th.landing.mofNewsPage;

  const [selectedCategory, setSelectedCategory] = useState<NewsCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    return pageCopy.articles.filter((article) => {
      const matchesCategory =
        selectedCategory === 'all' || article.category === selectedCategory;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.excerpt.toLowerCase().includes(normalizedQuery) ||
        article.content.some((para) => para.toLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesQuery;
    });
  }, [pageCopy.articles, selectedCategory, searchQuery]);

  const activeModalArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return pageCopy.articles.find((a) => a.id === selectedArticleId) || null;
  }, [pageCopy.articles, selectedArticleId]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Breadcrumb Bar */}
      <div className="border-b border-slate-100 bg-white">
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

      {/* Header Banner */}
      <section className="bg-white px-4 pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-100">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#0056b3]">
            <Landmark className="size-4" aria-hidden="true" />
            <span>{pageCopy.ministryBadge}</span>
          </div>
          <h1 className="mt-4 text-2xl sm:text-4xl lg:text-4xl font-extrabold tracking-tight text-[#0f172a]">
            {pageCopy.meta.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-500 leading-relaxed">
            {pageCopy.meta.subtitle}
          </p>

          {/* Search Box */}
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xs focus-within:border-[#0056b3] transition-colors">
            <Search className="ml-2.5 size-5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={pageCopy.search.placeholder}
              aria-label={pageCopy.search.label}
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm sm:text-base text-slate-900 outline-none placeholder:text-slate-400 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={pageCopy.search.clear}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {(
              [
                { id: 'all', label: pageCopy.categories.all },
                { id: 'project', label: pageCopy.categories.project },
                { id: 'announcement', label: pageCopy.categories.announcement },
                { id: 'measures', label: pageCopy.categories.measures },
              ] as const
            ).map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Empty Search Result */}
        {filteredArticles.length === 0 && (
          <div className="my-12 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Newspaper className="mx-auto size-10 text-slate-400" aria-hidden="true" />
            <h3 className="mt-4 text-base sm:text-lg font-bold text-slate-900">
              {pageCopy.emptyTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              {pageCopy.emptySubtitle}
            </p>
            {(searchQuery || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <span>{pageCopy.categories.all}</span>
              </button>
            )}
          </div>
        )}

        {/* Featured Card (When on 'all' and no active search) */}
        {selectedCategory === 'all' && !searchQuery && filteredArticles.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0056b3] px-3 py-1 text-xs font-bold text-white">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>{pageCopy.featuredBadge}</span>
              </span>
              <span className="rounded-full border border-blue-200/80 bg-blue-50 px-3 py-1 text-xs font-bold text-[#0056b3]">
                {filteredArticles[0]?.categoryLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Calendar className="size-3.5" aria-hidden="true" />
                <span>{filteredArticles[0]?.date}</span>
              </span>
            </div>

            <h2 className="mt-4 text-xl sm:text-3xl font-extrabold leading-snug tracking-tight text-[#0f172a] max-w-4xl">
              {filteredArticles[0]?.title}
            </h2>

            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
              {filteredArticles[0]?.excerpt}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">{pageCopy.source}</span>
              <button
                type="button"
                onClick={() => setSelectedArticleId(filteredArticles[0]?.id ?? null)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#004494] active:scale-98 transition-all cursor-pointer"
              >
                <BookOpen className="size-4" aria-hidden="true" />
                <span>{pageCopy.readFullArticle}</span>
              </button>
            </div>
          </div>
        )}

        {/* News Grid */}
        {filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:border-blue-300 hover:shadow-lg transition-all"
              >
                <div>
                  {/* Category & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#0056b3]">
                      {article.categoryLabel}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="size-3.5" aria-hidden="true" />
                      <span>{pageCopy.readDuration(article.readTime)}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0056b3] transition-colors leading-snug">
                    {article.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    <span>{article.date}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedArticleId(article.id)}
                    className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#0056b3] hover:text-[#004494] transition-colors cursor-pointer"
                  >
                    <span>{pageCopy.readFullArticle}</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Official Channels Contact Banner */}
        <div className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[#0056b3] font-bold text-sm">
                <Landmark className="size-4.5" aria-hidden="true" />
                <span>{pageCopy.contactBanner.title}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
                {pageCopy.contactBanner.desc}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3.5 py-2 text-[#0056b3]">
                <Phone className="size-4" aria-hidden="true" />
                <span>{pageCopy.contactBanner.hotline}</span>
              </div>
              <a
                href="https://www.mof.go.th"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-[#0056b3] transition-colors"
              >
                <span>{pageCopy.contactBanner.website}</span>
                <ExternalLink className="size-3.5 text-slate-400" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Article Detail Reading Modal */}
      {activeModalArticle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0056b3]">
                  {activeModalArticle.categoryLabel}
                </span>
                <span className="text-xs text-slate-400">
                  {pageCopy.publishedDate(activeModalArticle.date)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticleId(null)}
                aria-label={pageCopy.closeModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto px-6 py-6 space-y-4">
              <h2
                id="article-detail-title"
                className="text-lg sm:text-2xl font-extrabold text-slate-900 leading-snug"
              >
                {activeModalArticle.title}
              </h2>

              <div className="rounded-xl bg-blue-50/60 p-4 border border-blue-100 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                {activeModalArticle.excerpt}
              </div>

              <div className="space-y-3 pt-2 text-sm text-slate-700 leading-relaxed font-sans">
                {activeModalArticle.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 italic">
                {pageCopy.source}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedArticleId(null)}
                className="rounded-xl bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {pageCopy.closeModal}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
