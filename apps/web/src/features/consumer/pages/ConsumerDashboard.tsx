import {
  ChevronRight,
  Clock3,
  Coins,
  History,
  Loader2,
  Plus,
  QrCode,
  ReceiptText,
  Sparkles,
  Tag,
  TicketPercent,
  WalletCards,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { th } from '../../../i18n/th';
import { getConsumerOverview } from '../api/consumer.api';
import { ConsumerBottomNavigation } from '../components/ConsumerBottomNavigation';
import { ConsumerHeader } from '../components/ConsumerHeader';
import { TopUpModal } from '../components/TopUpModal';
import { QrPaymentModal } from '../components/QrPaymentModal';
import type { ConsumerOverviewResponse } from '../consumer.types';

type ConsumerDashboardProps = Readonly<{
  citizenId: string;
  fullName?: string;
  onLogout: () => void;
}>;

const numberFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ConsumerDashboard({
  citizenId,
  fullName,
  onLogout,
}: ConsumerDashboardProps) {
  const [overview, setOverview] = useState<ConsumerOverviewResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const displayName = fullName ?? th.consumerDashboard.displayName;
  const maskedCitizenId = `X-XXXX-${citizenId.slice(-4)}`;

  const refreshOverview = useCallback(async () => {
    try {
      const data = await getConsumerOverview();
      setOverview(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'ไม่สามารถโหลดข้อมูลกระเป๋าเงินได้';
      setError(msg);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    getConsumerOverview()
      .then((data) => {
        if (isMounted) {
          setOverview(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg =
            err instanceof Error
              ? err.message
              : 'ไม่สามารถโหลดข้อมูลกระเป๋าเงินได้';
          setError(msg);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const announcePrototypeAction = (msg?: string) => {
    setAnnouncement(msg ?? th.consumerDashboard.pendingAction);
  };

  const personalBalance = overview?.wallet.personalBalance ?? 0;
  const subsidyBalance = overview?.wallet.subsidyBalance ?? 0;
  const totalBalance =
    overview?.wallet.totalBalance ?? personalBalance + subsidyBalance;
  const dailySubsidyRemaining = overview?.wallet.dailySubsidyRemaining ?? 0;
  const pointBalance = overview?.wallet.pointBalance ?? 0;

  const firstQuest = overview?.quests?.[0];
  const coupons = overview?.coupons ?? [];
  const recentTransactions = overview?.recentTransactions ?? [];

  return (
    <main className="consumer-shell">
      <ConsumerHeader
        displayName={displayName}
        maskedCitizenId={maskedCitizenId}
        onLogout={onLogout}
        onPrototypeAction={() => announcePrototypeAction()}
      />

      <div className="consumer-content" id="dashboard-top">
        <section className="consumer-welcome">
          <div>
            <p>{th.consumerDashboard.greeting}</p>
            <h1>{displayName}</h1>
            <span>{th.consumerDashboard.identityLabel}</span>
          </div>
          {announcement && (
            <p aria-live="polite" className="consumer-announcement">
              {announcement}
            </p>
          )}
          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-300 mt-2">
              {error}
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="size-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm">กำลังโหลดข้อมูลกระเป๋าเงิน...</p>
          </div>
        ) : (
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
                    <strong>฿{numberFormatter.format(personalBalance)}</strong>
                  </span>
                  <span>
                    <small>{th.consumerDashboard.wallet.subsidy}</small>
                    <strong>฿{numberFormatter.format(subsidyBalance)}</strong>
                  </span>
                </div>
                <div className="wallet-actions">
                  <button onClick={() => setIsTopUpOpen(true)} type="button">
                    <Plus aria-hidden="true" />
                    {th.consumerDashboard.wallet.topUp}
                  </button>
                  <button
                    onClick={() =>
                      announcePrototypeAction('กำลังเปิดประวัติการทำรายการ...')
                    }
                    type="button"
                  >
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
                      ฿{numberFormatter.format(dailySubsidyRemaining)}
                    </strong>
                    <small>
                      {overview?.program
                        ? `จากวงเงิน ${overview.program.dailySubsidyLimit} บาท/วัน (ร่วมจ่าย ${overview.program.subsidyPercentage}%)`
                        : th.consumerDashboard.wallet.dailyLimit}
                    </small>
                  </div>
                </article>
                <article className="point-card">
                  <div className="summary-icon summary-icon-gold">
                    <Sparkles aria-hidden="true" />
                  </div>
                  <div>
                    <p>{th.consumerDashboard.points.title}</p>
                    <strong>
                      {pointBalance.toLocaleString('th-TH')}{' '}
                      <span>{th.consumerDashboard.points.unit}</span>
                    </strong>
                    <button
                      onClick={() =>
                        announcePrototypeAction('กำลังเปิดประวัติคะแนน...')
                      }
                      type="button"
                    >
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
                <button onClick={() => setIsQrScannerOpen(true)} type="button">
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
                      {firstQuest?.questName ??
                        th.consumerDashboard.quest.title}
                    </h2>
                  </div>
                  <span className="reward-badge">
                    +{firstQuest?.rewardPoint ?? 50} พอยต์
                  </span>
                </div>
                <p className="quest-description">
                  {firstQuest?.description ??
                    th.consumerDashboard.quest.description}
                </p>
                <div className="quest-meta">
                  <span>
                    <Clock3 aria-hidden="true" />
                    {firstQuest?.expiresAt
                      ? `หมดเขต ${new Date(firstQuest.expiresAt).toLocaleDateString('th-TH')}`
                      : th.consumerDashboard.quest.expiry}
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
                  onClick={() =>
                    announcePrototypeAction('กำลังเปิดหน้ารายการเควสต์ทั้งหมด')
                  }
                  type="button"
                >
                  {th.consumerDashboard.quest.viewAll}
                  <ChevronRight aria-hidden="true" />
                </button>
              </article>

              <article className="coupon-card">
                <div className="section-heading">
                  <div>
                    <p>
                      {coupons.length > 0
                        ? `มีคูปองพร้อมใช้ ${coupons.length} ใบ`
                        : th.consumerDashboard.coupons.count}
                    </p>
                    <h2>{th.consumerDashboard.coupons.title}</h2>
                  </div>
                  <TicketPercent aria-hidden="true" />
                </div>
                {coupons.length > 0 ? (
                  coupons.slice(0, 2).map((c) => (
                    <div key={c.userCouponId} className="coupon-row">
                      <Tag aria-hidden="true" />
                      <span>{c.couponName}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="coupon-row">
                      <Tag aria-hidden="true" />
                      <span>{th.consumerDashboard.coupons.first}</span>
                    </div>
                    <div className="coupon-row">
                      <Tag aria-hidden="true" />
                      <span>{th.consumerDashboard.coupons.second}</span>
                    </div>
                  </>
                )}
                <button
                  className="text-action"
                  onClick={() =>
                    announcePrototypeAction('กำลังเปิดหน้ารายการคูปองทั้งหมด')
                  }
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
                <button
                  onClick={() =>
                    announcePrototypeAction('กำลังเปิดประวัติธุรกรรมทั้งหมด')
                  }
                  type="button"
                >
                  {th.consumerDashboard.activity.viewAll}
                </button>
              </div>
              <div className="activity-list">
                {recentTransactions.length > 0
                  ? recentTransactions.map((item) => {
                      const isCredit =
                        item.transactionType === 'PERSONAL_TOPUP' ||
                        item.transactionType === 'SUBSIDY_GRANT';
                      const title =
                        item.transactionType === 'PERSONAL_TOPUP'
                          ? 'เติมเงินส่วนตัว'
                          : item.transactionType === 'SUBSIDY_GRANT'
                            ? 'รับสิทธิ์เงินสนับสนุน'
                            : 'ชำระค่าสินค้า';
                      const dateFormatted = new Date(
                        item.createdAt,
                      ).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <article key={item.transactionId}>
                          <span aria-hidden="true" className="activity-icon">
                            {isCredit ? <Plus /> : <ReceiptText />}
                          </span>
                          <span className="activity-copy">
                            <strong>{title}</strong>
                            <small>
                              {item.fundType === 'SUBSIDY'
                                ? 'เงินสนับสนุน'
                                : 'กระเป๋าส่วนตัว'}{' '}
                              · {dateFormatted}
                            </small>
                          </span>
                          <strong className={isCredit ? 'amount-positive' : ''}>
                            {isCredit ? '+' : '-'}฿
                            {numberFormatter.format(item.amount)}
                          </strong>
                        </article>
                      );
                    })
                  : th.consumerDashboard.activity.items.map((item, index) => (
                      <article key={item.merchant}>
                        <span aria-hidden="true" className="activity-icon">
                          {index === 1 ? <Plus /> : <ReceiptText />}
                        </span>
                        <span className="activity-copy">
                          <strong>{item.merchant}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <strong
                          className={index === 1 ? 'amount-positive' : ''}
                        >
                          {item.amount}
                        </strong>
                      </article>
                    ))}
              </div>
            </section>
          </>
        )}
      </div>

      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        onSuccess={() => void refreshOverview()}
      />

      <QrPaymentModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        availableCoupons={coupons.filter((c) => c.status === 'ACTIVE')}
        onSuccess={() => void refreshOverview()}
      />

      <ConsumerBottomNavigation
        onPrototypeAction={() => announcePrototypeAction()}
      />
    </main>
  );
}
