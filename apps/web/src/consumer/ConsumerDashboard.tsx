import {
  Bell,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Coins,
  HandHeart,
  History,
  Home,
  LogOut,
  Plus,
  QrCode,
  ReceiptText,
  Sparkles,
  Tag,
  TicketPercent,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { th } from '../i18n/th';

type ConsumerDashboardProps = Readonly<{
  citizenId: string;
  fullName?: string;
  onLogout: () => void;
}>;

const walletSummary = {
  personalBalance: 1850,
  subsidyBalance: 760,
  dailySubsidyRemaining: 200,
  pointBalance: 1250,
} as const;

const numberFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ConsumerDashboard({
  citizenId,
  fullName,
  onLogout,
}: ConsumerDashboardProps) {
  const [announcement, setAnnouncement] = useState('');
  const displayName = fullName ?? th.consumerDashboard.displayName;
  const totalBalance =
    walletSummary.personalBalance + walletSummary.subsidyBalance;
  const maskedCitizenId = `X-XXXX-${citizenId.slice(-4)}`;

  const announcePrototypeAction = () => {
    setAnnouncement(th.consumerDashboard.pendingAction);
  };

  return (
    <main className="consumer-shell">
      <header className="consumer-header">
        <a className="consumer-brand" href="#dashboard-top">
          <span aria-hidden="true" className="consumer-brand-mark">
            <HandHeart />
          </span>
          <span>
            <strong>{th.consumerDashboard.brand}</strong>
            <small>{th.consumerDashboard.prototype}</small>
          </span>
        </a>
        <div className="consumer-header-actions">
          <button
            aria-label={th.consumerDashboard.notification}
            className="consumer-icon-button"
            onClick={announcePrototypeAction}
            type="button"
          >
            <Bell aria-hidden="true" />
            <span aria-hidden="true" className="notification-dot" />
          </button>
          <div className="consumer-profile-summary">
            <span aria-hidden="true" className="profile-avatar">
              <CircleUserRound />
            </span>
            <span>
              <strong>{displayName}</strong>
              <small>{maskedCitizenId}</small>
            </span>
          </div>
          <button className="logout-button" onClick={onLogout} type="button">
            <LogOut aria-hidden="true" />
            {th.consumerDashboard.logout}
          </button>
        </div>
      </header>

      <div className="consumer-content" id="dashboard-top">
        <section className="consumer-welcome">
          <div>
            <p>{th.consumerDashboard.greeting}</p>
            <h1>{displayName}</h1>
            <span>{th.consumerDashboard.identityLabel}</span>
          </div>
          <p aria-live="polite" className="consumer-announcement">
            {announcement}
          </p>
        </section>

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
            <p className="wallet-total-label">
              {th.consumerDashboard.wallet.totalLabel}
            </p>
            <p className="wallet-total">
              <span>฿</span>
              {numberFormatter.format(totalBalance)}
            </p>
            <div className="wallet-breakdown">
              <span>
                <small>{th.consumerDashboard.wallet.personal}</small>
                <strong>
                  ฿{numberFormatter.format(walletSummary.personalBalance)}
                </strong>
              </span>
              <span>
                <small>{th.consumerDashboard.wallet.subsidy}</small>
                <strong>
                  ฿{numberFormatter.format(walletSummary.subsidyBalance)}
                </strong>
              </span>
            </div>
            <div className="wallet-actions">
              <button onClick={announcePrototypeAction} type="button">
                <Plus aria-hidden="true" />
                {th.consumerDashboard.wallet.topUp}
              </button>
              <button onClick={announcePrototypeAction} type="button">
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
                <strong>
                  ฿{numberFormatter.format(walletSummary.dailySubsidyRemaining)}
                </strong>
                <small>{th.consumerDashboard.wallet.dailyLimit}</small>
              </div>
            </article>
            <article className="point-card">
              <div className="summary-icon summary-icon-gold">
                <Sparkles aria-hidden="true" />
              </div>
              <div>
                <p>{th.consumerDashboard.points.title}</p>
                <strong>
                  {walletSummary.pointBalance.toLocaleString('th-TH')}{' '}
                  <span>{th.consumerDashboard.points.unit}</span>
                </strong>
                <button onClick={announcePrototypeAction} type="button">
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
            <button onClick={announcePrototypeAction} type="button">
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
                <h2>{th.consumerDashboard.quest.title}</h2>
              </div>
              <span className="reward-badge">
                {th.consumerDashboard.quest.reward}
              </span>
            </div>
            <p className="quest-description">
              {th.consumerDashboard.quest.description}
            </p>
            <div className="quest-meta">
              <span>
                <Clock3 aria-hidden="true" />
                {th.consumerDashboard.quest.expiry}
              </span>
              <span>{th.consumerDashboard.quest.progress}</span>
            </div>
            <div
              aria-label={th.consumerDashboard.quest.progressLabel}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={0}
              className="quest-progress"
              role="progressbar"
            >
              <span />
            </div>
            <button
              className="text-action"
              onClick={announcePrototypeAction}
              type="button"
            >
              {th.consumerDashboard.quest.viewAll}
              <ChevronRight aria-hidden="true" />
            </button>
          </article>

          <article className="coupon-card">
            <div className="section-heading">
              <div>
                <p>{th.consumerDashboard.coupons.count}</p>
                <h2>{th.consumerDashboard.coupons.title}</h2>
              </div>
              <TicketPercent aria-hidden="true" />
            </div>
            <div className="coupon-row">
              <Tag aria-hidden="true" />
              <span>{th.consumerDashboard.coupons.first}</span>
            </div>
            <div className="coupon-row">
              <Tag aria-hidden="true" />
              <span>{th.consumerDashboard.coupons.second}</span>
            </div>
            <button
              className="text-action"
              onClick={announcePrototypeAction}
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
            <button onClick={announcePrototypeAction} type="button">
              {th.consumerDashboard.activity.viewAll}
            </button>
          </div>
          <div className="activity-list">
            {th.consumerDashboard.activity.items.map((item, index) => (
              <article key={item.merchant}>
                <span aria-hidden="true" className="activity-icon">
                  {index === 1 ? <Plus /> : <ReceiptText />}
                </span>
                <span className="activity-copy">
                  <strong>{item.merchant}</strong>
                  <small>{item.detail}</small>
                </span>
                <strong className={index === 1 ? 'amount-positive' : ''}>
                  {item.amount}
                </strong>
              </article>
            ))}
          </div>
        </section>
      </div>

      <nav className="consumer-bottom-nav" aria-label="เมนูหลัก">
        <button className="is-active" type="button">
          <Home aria-hidden="true" />
          {th.consumerDashboard.navigation.home}
        </button>
        <button onClick={announcePrototypeAction} type="button">
          <ReceiptText aria-hidden="true" />
          {th.consumerDashboard.navigation.orders}
        </button>
        <button onClick={announcePrototypeAction} type="button">
          <Sparkles aria-hidden="true" />
          {th.consumerDashboard.navigation.quests}
        </button>
        <button onClick={announcePrototypeAction} type="button">
          <TicketPercent aria-hidden="true" />
          {th.consumerDashboard.navigation.coupons}
        </button>
        <button onClick={announcePrototypeAction} type="button">
          <CircleUserRound aria-hidden="true" />
          {th.consumerDashboard.navigation.profile}
        </button>
      </nav>
    </main>
  );
}
