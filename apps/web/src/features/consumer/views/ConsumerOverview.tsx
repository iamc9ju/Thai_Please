import {
  ChevronRight,
  Clock3,
  Coins,
  History,
  Plus,
  QrCode,
  ReceiptText,
  Sparkles,
  Tag,
  TicketPercent,
  WalletCards,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import type {
  ConsumerOverviewLoadState,
  ConsumerOverviewResponse,
  ConsumerSubsidyStatusResponse,
  ConsumerView,
} from '../consumer.types';

type ConsumerOverviewProps = Readonly<{
  displayName: string;
  maskedCitizenId: string;
  announcement: string;
  overviewState: ConsumerOverviewLoadState;
  onNavigate: (view: ConsumerView) => void;
  onRetry: () => void;
}>;

const bahtFormatter = new Intl.NumberFormat(th.consumerDashboard.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});

const dateFormatter = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeZone: th.consumerDashboard.timeZone,
});

function formatBaht(amount: number) {
  return bahtFormatter.format(amount);
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function OverviewStatus({
  state,
  onRetry,
}: Readonly<{
  state: Exclude<ConsumerOverviewLoadState, { status: 'success' }>;
  onRetry: () => void;
}>) {
  if (state.status === 'loading') {
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className="portal-card order-empty-state"
        role="status"
      >
        <p>{th.consumerDashboard.states.loading}</p>
      </section>
    );
  }

  if (state.status === 'permission-denied') {
    return (
      <section
        aria-live="assertive"
        className="portal-card order-empty-state"
        role="alert"
      >
        <h2>{th.consumerDashboard.states.permissionDeniedTitle}</h2>
        <p>{th.consumerDashboard.states.permissionDeniedDescription}</p>
      </section>
    );
  }

  return (
    <section aria-live="assertive" className="portal-card order-empty-state">
      <h2>{th.consumerDashboard.states.errorTitle}</h2>
      <p>{th.consumerDashboard.states.errorDescription}</p>
      <button onClick={onRetry} type="button">
        {th.consumerDashboard.states.retry}
      </button>
    </section>
  );
}

function OverviewContent({
  data,
  subsidy,
  onNavigate,
}: Readonly<{
  data: ConsumerOverviewResponse;
  subsidy: ConsumerSubsidyStatusResponse;
  onNavigate: (view: ConsumerView) => void;
}>) {
  const { wallet, quests, coupons, recentOrders } = data;
  const { program } = subsidy;
  const activeQuest = quests[0];
  const dailyUsagePercent =
    subsidy.dailySubsidyLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (subsidy.dailySubsidyUsed / subsidy.dailySubsidyLimit) * 100,
            ),
          ),
        )
      : 0;

  return (
    <>
      <section
        className="dashboard-grid"
        aria-label={th.consumerDashboard.wallet.title}
      >
        <article className="wallet-card">
          <div className="wallet-card-heading">
            <span>
              <small>{th.consumerDashboard.wallet.eyebrow}</small>
              <strong>{th.consumerDashboard.wallet.title}</strong>
            </span>
            <WalletCards aria-hidden="true" />
          </div>
          <div className="wallet-primary-balance">
            <small>{th.consumerDashboard.wallet.personal}</small>
            <strong>฿{formatBaht(wallet.personalBalance)}</strong>
          </div>
          <div className="wallet-subsidy-balance">
            <small>{th.consumerDashboard.wallet.subsidy}</small>
            <strong>฿{formatBaht(subsidy.subsidyBalance)}</strong>
          </div>
          <div className="wallet-actions">
            <button onClick={() => onNavigate('wallet')} type="button">
              <Plus aria-hidden="true" />
              {th.consumerDashboard.wallet.topUp}
            </button>
            <button onClick={() => onNavigate('wallet')} type="button">
              <History aria-hidden="true" />
              {th.consumerDashboard.wallet.history}
            </button>
          </div>
        </article>

        <div className="dashboard-side-column">
          <article className="daily-subsidy-card">
            <div className="summary-icon summary-icon-blue">
              <Coins aria-hidden="true" />
            </div>
            <div>
              <p>{th.consumerDashboard.wallet.dailyRemaining}</p>
              <strong>฿{formatBaht(subsidy.dailySubsidyRemaining)}</strong>
              <small>
                {th.consumerDashboard.wallet.dailyUsage(
                  formatBaht(subsidy.dailySubsidyUsed),
                  formatBaht(subsidy.dailySubsidyLimit),
                )}
              </small>
              <small>
                {program?.programName ??
                  th.consumerDashboard.wallet.noActiveProgram}
              </small>
              {program && (
                <small>
                  {th.consumerDashboard.wallet.programDetail(
                    program.subsidyPercentage,
                    formatDate(program.startDate),
                    formatDate(program.endDate),
                  )}
                </small>
              )}
              <div
                aria-label={th.consumerDashboard.wallet.dailyProgressLabel}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={dailyUsagePercent}
                className="quest-progress"
                role="progressbar"
              >
                <span style={{ width: `${dailyUsagePercent}%` }} />
              </div>
            </div>
          </article>
          <article className="point-card">
            <div className="summary-icon summary-icon-gold">
              <Sparkles aria-hidden="true" />
            </div>
            <div>
              <p>{th.consumerDashboard.points.title}</p>
              <strong>
                {wallet.pointBalance.toLocaleString(
                  th.consumerDashboard.locale,
                )}{' '}
                <span>{th.consumerDashboard.points.unit}</span>
              </strong>
              <button onClick={() => onNavigate('rewards')} type="button">
                {th.consumerDashboard.points.history}
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </article>
        </div>

        <article className="qr-card">
          <div className="qr-icon">
            <QrCode aria-hidden="true" />
          </div>
          <div>
            <h2>{th.consumerDashboard.payment.title}</h2>
            <p>{th.consumerDashboard.payment.description}</p>
          </div>
          <button onClick={() => onNavigate('payment')} type="button">
            <QrCode aria-hidden="true" />
            {th.consumerDashboard.payment.action}
          </button>
        </article>
      </section>

      <section className="consumer-detail-grid">
        <article className="quest-card">
          <div className="section-heading">
            <div>
              <p>{th.consumerDashboard.quest.eyebrow}</p>
              <h2>
                {activeQuest?.questName ?? th.consumerDashboard.quest.title}
              </h2>
            </div>
            {activeQuest && (
              <span className="reward-badge">
                {th.consumerDashboard.quest.reward(activeQuest.rewardPoint)}
              </span>
            )}
          </div>
          {activeQuest ? (
            <>
              <p className="quest-description">
                {activeQuest.description ?? activeQuest.questName}
              </p>
              <div className="quest-meta">
                <span>
                  <Clock3 aria-hidden="true" />
                  {th.consumerDashboard.quest.expiry(
                    formatDate(activeQuest.expiresAt),
                  )}
                </span>
                <span>{th.consumerDashboard.quest.activeStatus}</span>
              </div>
            </>
          ) : (
            <p className="quest-description">
              {th.consumerDashboard.states.noQuests}
            </p>
          )}
          <button
            className="text-action"
            onClick={() => onNavigate('quests')}
            type="button"
          >
            {th.consumerDashboard.quest.viewAll}
            <ChevronRight aria-hidden="true" />
          </button>
        </article>

        <article className="coupon-card">
          <div className="section-heading">
            <div>
              <p>{th.consumerDashboard.coupons.count(coupons.length)}</p>
              <h2>{th.consumerDashboard.coupons.title}</h2>
            </div>
            <TicketPercent aria-hidden="true" />
          </div>
          {coupons.length > 0 ? (
            coupons.slice(0, 2).map((coupon) => (
              <div className="coupon-row" key={coupon.userCouponId}>
                <Tag aria-hidden="true" />
                <span>{coupon.description ?? coupon.couponName}</span>
              </div>
            ))
          ) : (
            <p>{th.consumerDashboard.states.noCoupons}</p>
          )}
          <button
            className="text-action"
            onClick={() => onNavigate('rewards')}
            type="button"
          >
            {th.consumerDashboard.coupons.viewAll}
            <ChevronRight aria-hidden="true" />
          </button>
        </article>
      </section>

      <section className="activity-card">
        <div className="activity-heading">
          <h2>{th.consumerDashboard.activity.title}</h2>
          <button onClick={() => onNavigate('orders')} type="button">
            {th.consumerDashboard.activity.viewAll}
          </button>
        </div>
        {recentOrders.length > 0 ? (
          <div className="activity-list">
            {recentOrders.map((order) => (
              <article key={order.orderId}>
                <span aria-hidden="true" className="activity-icon">
                  <ReceiptText />
                </span>
                <span className="activity-copy">
                  <strong>{order.merchantName}</strong>
                  <small>
                    {th.consumerDashboard.activity.paidAt}{' '}
                    <time dateTime={order.paidAt}>
                      {formatDateTime(order.paidAt)}
                    </time>
                  </small>
                </span>
                <strong>
                  {th.consumerDashboard.activity.paidAmount(
                    formatBaht(order.finalAmount),
                  )}
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <p aria-live="polite">{th.consumerDashboard.states.noOrders}</p>
        )}
      </section>
    </>
  );
}

export function ConsumerOverview({
  displayName,
  maskedCitizenId,
  announcement,
  overviewState,
  onNavigate,
  onRetry,
}: ConsumerOverviewProps) {
  return (
    <>
      <section className="consumer-welcome">
        <div>
          <p>{th.consumerDashboard.greeting}</p>
          <h1>{displayName}</h1>
          <span>
            {th.consumerDashboard.identityLabel} · {maskedCitizenId}
          </span>
        </div>
        <p aria-live="polite" className="consumer-announcement">
          {announcement}
        </p>
      </section>

      {overviewState.status === 'success' ? (
        <OverviewContent
          data={overviewState.data}
          subsidy={overviewState.subsidy}
          onNavigate={onNavigate}
        />
      ) : (
        <OverviewStatus state={overviewState} onRetry={onRetry} />
      )}
    </>
  );
}
