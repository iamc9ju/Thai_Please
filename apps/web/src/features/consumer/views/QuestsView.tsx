import {
  CheckCircle2,
  Clock3,
  History,
  ReceiptText,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import { PortalPageHeader } from '../components/PortalPageHeader';

type QuestTab = 'active' | 'history';

export function QuestsView() {
  const copy = th.consumerPortal.quests;
  const [activeTab, setActiveTab] = useState<QuestTab>('active');

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
          <span>{copy.cards.length}</span>
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
          <span>{copy.historyCards.length}</span>
        </button>
      </div>

      {activeTab === 'active' ? (
        <div className="quest-grid" role="tabpanel">
          {copy.cards.map((quest) => (
            <article
              className="portal-card quest-detail-card"
              key={quest.title}
            >
              <div className="quest-detail-heading">
                <span className="summary-icon">
                  <Sparkles aria-hidden="true" />
                </span>
                <span className="portal-status">{quest.status}</span>
              </div>
              <h2>{quest.title}</h2>
              <p>{quest.description}</p>
              <strong className="quest-reward">{quest.reward}</strong>
              <div className="quest-detail-meta">
                <span>
                  <Clock3 aria-hidden="true" />
                  {quest.expiry}
                </span>
                <span>{quest.progress}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="quest-history-panel" role="tabpanel">
          <p>{copy.historyDescription}</p>
          <div className="quest-history-list">
            {copy.historyCards.map((quest) => (
              <article
                className="portal-card quest-history-card"
                key={quest.receipt}
              >
                <span className="quest-completed-icon">
                  <CheckCircle2 aria-hidden="true" />
                </span>
                <div>
                  <span className="portal-status">{copy.completed}</span>
                  <h2>{quest.title}</h2>
                  <p>{quest.description}</p>
                  <small>
                    <Clock3 aria-hidden="true" />
                    {quest.completedAt}
                  </small>
                  <small>
                    <ReceiptText aria-hidden="true" />
                    {copy.receiptLabel} {quest.receipt}
                  </small>
                </div>
                <strong>{quest.reward}</strong>
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="portal-rule-note">{copy.ruleNote}</p>
    </section>
  );
}
