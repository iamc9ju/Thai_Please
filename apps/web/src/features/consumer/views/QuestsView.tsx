import { CheckCircle2, Clock3, History, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { PortalPageHeader } from '../components/PortalPageHeader';
import { getConsumerQuests } from '../api/consumer.api';
import type { ConsumerQuest, ConsumerQuestLoadState } from '../consumer.types';

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
      <section className="consumer-view">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="polite"
          className="portal-card order-empty-state"
          role="status"
        >
          <p>{copy.loading}</p>
        </div>
      </section>
    );
  }

  if (loadState.status === 'permission-denied') {
    return (
      <section className="consumer-view">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="assertive"
          className="portal-card order-empty-state"
          role="alert"
        >
          <p>{copy.permissionDenied}</p>
        </div>
      </section>
    );
  }

  if (loadState.status === 'error') {
    return (
      <section className="consumer-view">
        <PortalPageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
        />
        <div
          aria-live="assertive"
          className="portal-card order-empty-state"
          role="alert"
        >
          <p>{copy.loadError}</p>
          <button onClick={handleRetry} type="button">
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

  return (
    <section className="consumer-view">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <div className="quest-tabs" aria-label={copy.tabsLabel} role="tablist">
        <button
          aria-selected={activeTab === 'active'}
          className={activeTab === 'active' ? 'is-active' : undefined}
          onClick={() => setActiveTab('active')}
          role="tab"
          type="button"
        >
          <Sparkles aria-hidden="true" />
          {copy.activeTab}
          <span>{activeQuests.length}</span>
        </button>
        <button
          aria-selected={activeTab === 'history'}
          className={activeTab === 'history' ? 'is-active' : undefined}
          onClick={() => setActiveTab('history')}
          role="tab"
          type="button"
        >
          <History aria-hidden="true" />
          {copy.historyTab}
          <span>{historyQuests.length}</span>
        </button>
      </div>

      {activeTab === 'active' ? (
        activeQuests.length === 0 ? (
          <div className="portal-card order-empty-state">
            <p>{copy.emptyActive}</p>
          </div>
        ) : (
          <div className="quest-grid" role="tabpanel">
            {activeQuests.map((quest) => (
              <article className="portal-card quest-detail-card" key={quest.id}>
                <div className="quest-detail-heading">
                  <span className="summary-icon">
                    <Sparkles aria-hidden="true" />
                  </span>
                  <span className="portal-status">{copy.active}</span>
                </div>
                <h2>{getQuestTitle(quest)}</h2>
                <p>{getQuestDescription(quest)}</p>
                <strong className="quest-reward">
                  {copy.rewardPrefix}
                  {quest.rewardPoints} {copy.pointsSuffix}
                </strong>
                <div className="quest-detail-meta">
                  <span>
                    <Clock3 aria-hidden="true" />
                    {copy.expiryPrefix}{' '}
                    {dateFormatter.format(new Date(quest.expiresAt))}
                  </span>
                  <span>{copy.defaultProgress}</span>
                </div>
              </article>
            ))}
          </div>
        )
      ) : historyQuests.length === 0 ? (
        <div className="portal-card order-empty-state">
          <p>{copy.emptyHistory}</p>
        </div>
      ) : (
        <div className="quest-history-panel" role="tabpanel">
          <p>{copy.historyDescription}</p>
          <div className="quest-history-list">
            {historyQuests.map((quest) => (
              <article
                className="portal-card quest-history-card"
                key={quest.id}
              >
                <span className="quest-completed-icon">
                  {quest.status === 'COMPLETED' ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : (
                    <Clock3 aria-hidden="true" />
                  )}
                </span>
                <div>
                  <span className="portal-status">
                    {quest.status === 'COMPLETED'
                      ? copy.completed
                      : copy.expiredStatus}
                  </span>
                  <h2>{getQuestTitle(quest)}</h2>
                  <p>{getQuestDescription(quest)}</p>
                  <small>
                    <Clock3 aria-hidden="true" />
                    {quest.completedAt
                      ? `${copy.completedPrefix} ${dateTimeFormatter.format(new Date(quest.completedAt))}`
                      : `${copy.expiryPrefix} ${dateFormatter.format(new Date(quest.expiresAt))}`}
                  </small>
                </div>
                <strong>
                  {copy.rewardPrefix}
                  {quest.rewardPoints} {copy.pointsSuffix}
                </strong>
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="portal-rule-note">{copy.ruleNote}</p>
    </section>
  );
}
