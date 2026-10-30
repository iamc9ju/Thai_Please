import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Mail,
  Phone,
  Search,
  Sparkles,
  Users,
  Store,
  ShieldCheck,
  X,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export interface FaqPageProps {
  onBackToHome: () => void;
  onLogin?: (() => void) | undefined;
  onContactSupport?: (() => void) | undefined;
}

type FaqCategoryFilter = 'all' | 'consumer' | 'merchant' | 'system';

export function FaqPage({
  onBackToHome,
  onContactSupport,
}: FaqPageProps) {
  const pageCopy = th.landing.faqPage;

  const [selectedCategory, setSelectedCategory] = useState<FaqCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(['faq-c1', 'faq-c2']),
  );

  const filteredFaqs = useMemo(() => {
    return pageCopy.faqs.filter((faq) => {
      const matchesCategory =
        selectedCategory === 'all' || faq.category === selectedCategory;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        faq.question.toLowerCase().includes(normalizedQuery) ||
        faq.answer.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [pageCopy.faqs, selectedCategory, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(filteredFaqs.map((f) => f.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consumer':
        return <Users className="size-3.5 text-[#0056b3]" aria-hidden="true" />;
      case 'merchant':
        return <Store className="size-3.5 text-[#0056b3]" aria-hidden="true" />;
      case 'system':
        return <ShieldCheck className="size-3.5 text-[#0056b3]" aria-hidden="true" />;
      default:
        return <Sparkles className="size-3.5 text-[#0056b3]" aria-hidden="true" />;
    }
  };

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
            <HelpCircle className="size-4" aria-hidden="true" />
            <span>{pageCopy.meta.breadcrumbCurrent}</span>
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
                { id: 'consumer', label: pageCopy.categories.consumer },
                { id: 'merchant', label: pageCopy.categories.merchant },
                { id: 'system', label: pageCopy.categories.system },
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
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Controls: Count & Expand/Collapse */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 pb-4">
          <span className="text-xs sm:text-sm font-semibold text-slate-600">
            {pageCopy.resultsCount(filteredFaqs.length)}
          </span>
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold">
            <button
              type="button"
              onClick={handleExpandAll}
              className="text-[#0056b3] hover:underline cursor-pointer"
            >
              {pageCopy.expandAll}
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              {pageCopy.collapseAll}
            </button>
          </div>
        </div>

        {/* Empty Search Result */}
        {filteredFaqs.length === 0 && (
          <div className="my-12 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <HelpCircle className="mx-auto size-10 text-slate-400" aria-hidden="true" />
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

        {/* FAQ Accordion List */}
        {filteredFaqs.length > 0 && (
          <div className="space-y-3.5">
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedIds.has(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                    isExpanded
                      ? 'border-blue-300 shadow-sm'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(faq.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-${faq.id}`}
                    className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        {getCategoryIcon(faq.category)}
                        <span>{faq.categoryLabel}</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {faq.question}
                      </h2>
                    </div>
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-xl transition-all ${
                        isExpanded
                          ? 'bg-blue-100/80 text-[#0056b3] rotate-180'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      id={`faq-answer-${faq.id}`}
                      className="border-t border-slate-100 bg-blue-50/30 px-5 pt-3.5 pb-5 text-sm text-slate-700 leading-relaxed font-sans"
                    >
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Still Have Questions Banner */}
        <div className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {pageCopy.contactCard.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                {pageCopy.contactCard.subtitle}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs sm:text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 text-[#0056b3]">
                  <Phone className="size-4" aria-hidden="true" />
                  <span>{pageCopy.contactCard.phone}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Mail className="size-4" aria-hidden="true" />
                  <span>{pageCopy.contactCard.email}</span>
                </span>
              </div>
            </div>

            {onContactSupport && (
              <button
                type="button"
                onClick={onContactSupport}
                className="self-start sm:self-auto rounded-xl bg-[#0056b3] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#004494] active:scale-98 transition-all cursor-pointer"
              >
                {pageCopy.contactCard.action}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
