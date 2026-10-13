import { Gift, Sparkles, TicketPercent } from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import { consumerMock } from '../consumer.mock';
import { PortalPageHeader } from '../components/PortalPageHeader';

export function RewardsView() {
  const [message, setMessage] = useState('');
  const copy = th.consumerPortal.rewards;
  return (
    <section className="consumer-view">
      <PortalPageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="rewards-summary-grid">
        <article className="portal-card point-balance-card"><Sparkles aria-hidden="true" /><span>{copy.pointBalance}</span><strong>{consumerMock.wallet.pointBalance.toLocaleString('th-TH')}</strong><small>{copy.expiring}</small></article>
        <article className="portal-card"><h2>{copy.pointHistory}</h2><div className="portal-history-list compact">{copy.pointItems.map((item) => <div key={`${item.title}-${item.detail}`}><span><strong>{item.title}</strong><small>{item.detail}</small></span><strong className={item.amount.startsWith('+') ? 'amount-positive' : undefined}>{item.amount}</strong></div>)}</div></article>
      </div>
      <article className="portal-card">
        <div className="portal-card-heading"><div><h2>{copy.myCoupons}</h2><p>{copy.usageNote}</p></div><TicketPercent aria-hidden="true" /></div>
        <div className="coupon-ticket-grid">{copy.couponItems.map((coupon) => <div className="coupon-ticket" key={coupon.title}><TicketPercent aria-hidden="true" /><span><strong>{coupon.title}</strong><small>{coupon.condition}</small><small>{coupon.expiry}</small></span></div>)}</div>
      </article>
      <article className="portal-card">
        <div className="portal-card-heading"><div><h2>{copy.catalogue}</h2><p>{th.consumerPortal.common.mockNotice}</p></div><Gift aria-hidden="true" /></div>
        <div className="reward-catalogue">{copy.catalogueItems.map((coupon) => <div key={coupon.title}><span><strong>{coupon.title}</strong><small>{coupon.condition}</small></span><strong>{coupon.cost} {th.consumerPortal.common.points}</strong><button onClick={() => setMessage(copy.redeemed)} type="button">{copy.redeem}</button></div>)}</div>
        <p aria-live="polite" className="portal-form-message">{message}</p>
      </article>
    </section>
  );
}
