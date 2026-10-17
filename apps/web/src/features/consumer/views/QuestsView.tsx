import {
  Award,
  CheckCircle2,
  Clock3,
  History,
  Info,
  Receipt,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { getConsumerQuests, getOrderReceipt } from '../api/consumer.api';
import { DigitalReceiptModal } from '../components/DigitalReceiptModal';
import { PortalPageHeader } from '../components/PortalPageHeader';
import type {
  ConsumerQuest,
  ConsumerQuestLoadState,
  ReceiptDetail,
} from '../consumer.types';

type QuestTab = 'active' | 'history';

const dateFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeZone: th.consumerDashboard.timeZone,
});

const dateTimeFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});

function formatBahtMinor(minorString: string | null): string {
  if (!minorString) return '0.00';
  const val = Number(minorString) / 100;
  return new Intl.NumberFormat(th.consumerDashboard.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function getQuestDescription(quest: ConsumerQuest): string {
  const copy = th.consumerPortal.quests;
  const amount = formatBahtMinor(quest.minimumSpendMinor);
  switch (quest.type) {
    case 'CATEGORY_SPEND':
      return copy.categorySpendCondition(
        quest.targetCategoryName ?? quest.targetCategoryId ?? '',
        amount,
      );
    case 'MERCHANT_SPEND':
      return copy.merchantSpendCondition(
        quest.targetMerchantName ?? quest.targetMerchantId ?? '',
        amount,
      );
    case 'PRODUCT_PURCHASE':
      return copy.productPurchaseCondition(
        quest.targetProductName ?? quest.targetProductId ?? '',
      );
    case 'MIN_SPEND':
    default:
      return copy.spendMinSpendCondition(amount);
  }
}

function getQuestTitle(quest: ConsumerQuest): string {
  if (quest.questName) return quest.questName;
  const copy = th.consumerPortal.quests;
  return copy.fallbackTitles[quest.type] ?? copy.title;
}

export function QuestsView() {
  const copy = th.consumerPortal.quests;
  const [activeTab, setActiveTab] = useState<QuestTab>('active');
  const [loadState, setLoadState] = useState<ConsumerQuestLoadState>({
    status: 'loading',
  });
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(
    null,
  );
  const [loadingReceiptOrderId, setLoadingReceiptOrderId] = useState<
    string | null
  >(null);

  const applyQuestError = (err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      setLoadState({ status: 'permission-denied' });
    } else {
      setLoadState({ status: 'error' });
    }
  };

  const handleRetry = () => {
    setLoadState({ status: 'loading' });
    void getConsumerQuests()
      .then((data) => {
        setLoadState({ status: 'success', data });
      })
      .catch((err: unknown) => {
        applyQuestError(err);
      });
  };

  const handleOpenCompletedReceipt = async (orderId: string) => {
    setLoadingReceiptOrderId(orderId);
    try {
      const detail = await getOrderReceipt(orderId);
      setSelectedReceipt(detail);
    } catch {
      // Ignore if receipt cannot be fetched
    } finally {
      setLoadingReceiptOrderId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    void getConsumerQuests(undefined, controller.signal)
      .then((data) => {
        if (isCurrent) {
          setLoadState({ status: 'success', data });
        }
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          applyQuestError(err);
        }
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, []);

  if (loadState.status === 'loading') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="polite"
          className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm"
          role="status"
        >
          <div className="mb-3 inline-block size-8 animate-spin rounded-full border-3 border-solid border-[#0056b3] border-r-transparent" />
          <p className="text-sm font-medium text-slate-600">{copy.loading}</p>
        </div>
      </section>
    );
  }

  if (loadState.status === 'permission-denied') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="assertive"
          className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center shadow-sm"
          role="alert"
        >
          <p className="text-sm font-bold text-red-700">
            {copy.permissionDenied}
          </p>
        </div>
      </section>
    );
  }

  if (loadState.status === 'error') {
    return (
      <section className="space-y-6 animate-fade-in font-sans">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="assertive"
          className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"
          role="alert"
        >
          <p className="mb-4 text-sm font-semibold text-slate-800">
            {copy.loadError}
          </p>
          <button
            onClick={handleRetry}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {copy.retry}
          </button>
        </div>
      </section>
    );
  }

  const quests = loadState.data.items;
  const activeQuests = quests.filter((q) => q.status === 'ACTIVE');
  const historyQuests = quests.filter(
    (q) => q.status === 'COMPLETED' || q.status === 'EXPIRED',
  );
  const completedQuestsCount = quests.filter(
    (q) => q.status === 'COMPLETED',
  ).length;
  const totalEarnedPoints = quests
    .filter((q) => q.status === 'COMPLETED')
    .reduce((sum, q) => sum + q.rewardPoints, 0);

  return (
    <section className="space-y-6 animate-fade-in font-sans">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {/* Summary KPI Cards (Blue Theme) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003d82] via-[#0056b3] to-[#0073e6] p-5 text-white shadow-md shadow-blue-900/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-100">
              {copy.totalActiveLabel}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-xs">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold tracking-tight">
            {activeQuests.length.toLocaleString('th-TH')}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {copy.totalCompletedLabel}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-emerald-600">
            {completedQuestsCount.toLocaleString('th-TH')}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {copy.totalPointsEarnedLabel}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
              <Award className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[#0056b3]">
            +{totalEarnedPoints.toLocaleString('th-TH')} {copy.pointsSuffix}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs w-fit"
        aria-label={copy.tabsLabel}
        role="tablist"
      >
        <button
          aria-selected={activeTab === 'active'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#0056b3] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('active')}
          role="tab"
          type="button"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {copy.activeTab}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${
              activeTab === 'active'
                ? 'bg-white/20 text-white'
                : 'bg-blue-50 text-[#0056b3]'
            }`}
          >
            {activeQuests.length}
          </span>
        </button>
        <button
          aria-selected={activeTab === 'history'}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#0056b3] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('history')}
          role="tab"
          type="button"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          {copy.historyTab}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${
              activeTab === 'history'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {historyQuests.length}
          </span>
        </button>
      </div>

      {activeTab === 'active' ? (
        activeQuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {copy.emptyActive}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            role="tabpanel"
          >
            {activeQuests.map((quest) => (
              <article
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                key={quest.id}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#0056b3] border border-blue-200/60">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.active}
                    </span>
                    <strong className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#0056b3] to-[#0073e6] px-3 py-1 text-xs font-extrabold text-white shadow-xs">
                      {copy.rewardPrefix}
                      {quest.rewardPoints} {copy.pointsSuffix}
                    </strong>
                  </div>

                  <h2 className="mt-4 text-lg font-extrabold text-slate-900">
                    {getQuestTitle(quest)}
                  </h2>
                  <p className="mt-1.5 text-sm font-medium text-slate-600 leading-relaxed">
                    {getQuestDescription(quest)}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <Clock3
                      className="h-3.5 w-3.5 text-[#0056b3]"
                      aria-hidden="true"
                    />
                    {copy.expiryPrefix}{' '}
                    {dateFormatter.format(new Date(quest.expiresAt))}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 font-semibold">
                    {copy.defaultProgress}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )
      ) : historyQuests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <History className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {copy.emptyHistory}
          </p>
        </div>
      ) : (
        <div className="space-y-4" role="tabpanel">
          <p className="text-xs font-semibold text-slate-500">
            {copy.historyDescription}
          </p>
          <div className="space-y-3">
            {historyQuests.map((quest) => {
              const isCompleted = quest.status === 'COMPLETED';
              const receiptRef =
                quest.receiptNumber ??
                (quest.completedOrderId
                  ? `TP-${quest.completedOrderId.padStart(6, '0')}`
                  : null);

              return (
                <article
                  className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  key={quest.id}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <Clock3 className="h-6 w-6" aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isCompleted ? copy.completed : copy.expiredStatus}
                        </span>
                        {receiptRef && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0056b3]">
                            <Receipt className="h-3 w-3" aria-hidden="true" />
                            {copy.receiptLabel}: {receiptRef}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1.5 text-base font-bold text-slate-900">
                        {getQuestTitle(quest)}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {getQuestDescription(quest)}
                      </p>
                      <small className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        {quest.completedAt
                          ? `${copy.completedPrefix} ${dateTimeFormatter.format(new Date(quest.completedAt))}`
                          : `${copy.expiryPrefix} ${dateFormatter.format(new Date(quest.expiresAt))}`}
                      </small>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <strong
                      className={`text-base font-extrabold ${
                        isCompleted ? 'text-[#0056b3]' : 'text-slate-400'
                      }`}
                    >
                      {copy.rewardPrefix}
                      {quest.rewardPoints} {copy.pointsSuffix}
                    </strong>
                    {quest.completedOrderId && (
                      <button
                        type="button"
                        disabled={
                          loadingReceiptOrderId === quest.completedOrderId
                        }
                        onClick={() =>
                          void handleOpenCompletedReceipt(
                            quest.completedOrderId!,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-[#0056b3] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy.viewReceipt}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs font-medium text-slate-600">
        <Info className="h-4 w-4 shrink-0 text-[#0056b3]" aria-hidden="true" />
        <p>{copy.ruleNote}</p>
      </div>

      <DigitalReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </section>
  );
}
