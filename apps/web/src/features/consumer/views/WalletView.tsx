import { CalendarDays, Coins, Plus, RotateCcw, WalletCards } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { th } from '../../../i18n/th';
import { consumerMock, formatBaht } from '../consumer.mock';
import { PortalPageHeader } from '../components/PortalPageHeader';

export function WalletView() {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const wallet = consumerMock.wallet;
  const copy = th.consumerPortal.wallet;
  const filteredHistory = copy.history.filter(
    (item) =>
      (!dateFrom || item.isoDate >= dateFrom) &&
      (!dateTo || item.isoDate <= dateTo),
  );

  const showAllHistory = () => {
    setDateFrom('');
    setDateTo('');
  };

  const showCurrentMonth = () => {
    setDateFrom('2026-10-01');
    setDateTo('2026-10-31');
  };

  const submitTopUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const satang = Number(amount) * 100;
    setMessage(Number.isFinite(satang) && satang > 0 && satang <= consumerMock.topUpMaximumSatang
      ? th.consumerPortal.wallet.topUpSuccess
      : th.consumerPortal.wallet.invalidTopUp);
  };

  return (
    <section className="consumer-view">
      <PortalPageHeader eyebrow={th.consumerPortal.wallet.eyebrow} title={th.consumerPortal.wallet.title} description={th.consumerPortal.wallet.description} />
      <div className="portal-balance-grid">
        <article><WalletCards aria-hidden="true" /><span>{th.consumerPortal.wallet.personalBalance}</span><strong>฿{formatBaht(wallet.personalBalanceSatang)}</strong></article>
        <article><Coins aria-hidden="true" /><span>{th.consumerPortal.wallet.subsidyBalance}</span><strong>฿{formatBaht(wallet.subsidyBalanceSatang)}</strong></article>
        <article><span>{th.consumerPortal.wallet.totalBalance}</span><strong>฿{formatBaht(wallet.personalBalanceSatang + wallet.subsidyBalanceSatang)}</strong></article>
      </div>

      <div className="portal-two-column">
        <form className="portal-card top-up-form" onSubmit={submitTopUp}>
          <div className="portal-card-heading"><div><h2>{th.consumerPortal.wallet.topUpTitle}</h2><p>{th.consumerPortal.wallet.topUpDescription}</p></div><Plus aria-hidden="true" /></div>
          <label htmlFor="top-up-amount">{th.consumerPortal.wallet.topUpAmount}</label>
          <div className="amount-input"><span>฿</span><input id="top-up-amount" inputMode="decimal" min="0" max="5000" onChange={(event) => setAmount(event.target.value)} placeholder={th.consumerPortal.wallet.topUpPlaceholder} type="number" value={amount} /></div>
          <small>{th.consumerPortal.wallet.maximum}</small>
          <button className="portal-primary-button" type="submit">{th.consumerPortal.wallet.topUpAction}</button>
          <p aria-live="polite" className="portal-form-message">{message}</p>
        </form>

        <article className="portal-card subsidy-program-card">
          <span className="portal-status">{th.consumerPortal.wallet.programPeriod}</span>
          <h2>{th.consumerPortal.wallet.subsidyProgram}</h2>
          <div className="program-stats">
            <span><small>{th.consumerPortal.wallet.dailyCap}</small><strong>฿{formatBaht(wallet.dailyCapSatang)}</strong></span>
            <span><small>{th.consumerPortal.wallet.dailyUsed}</small><strong>฿{formatBaht(wallet.dailyUsedSatang)}</strong></span>
            <span><small>{th.consumerPortal.wallet.dailyRemaining}</small><strong>฿{formatBaht(wallet.dailyRemainingSatang)}</strong></span>
            <span><small>{th.consumerPortal.wallet.subsidyRate}</small><strong>{wallet.subsidyPercentage}%</strong></span>
          </div>
          <p>{th.consumerPortal.wallet.dailyTimezone}</p>
        </article>
      </div>

      <article className="portal-card wallet-history-card">
        <div className="order-filter-heading">
          <span><CalendarDays aria-hidden="true" /><strong>{copy.historyTitle}</strong></span>
          <small>{copy.resultPrefix} {filteredHistory.length} {copy.resultSuffix}</small>
        </div>
        <div className="order-filter-controls wallet-history-filters">
          <div className="order-filter-presets">
            <button aria-pressed={!dateFrom && !dateTo} className={!dateFrom && !dateTo ? 'is-active' : undefined} onClick={showAllHistory} type="button">{copy.filterAll}</button>
            <button aria-pressed={dateFrom === '2026-10-01' && dateTo === '2026-10-31'} className={dateFrom === '2026-10-01' && dateTo === '2026-10-31' ? 'is-active' : undefined} onClick={showCurrentMonth} type="button">{copy.filterMonth}</button>
          </div>
          <div className="order-date-fields">
            <label>{copy.dateFrom}<input aria-label={copy.dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
            <label>{copy.dateTo}<input aria-label={copy.dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
            <button onClick={showAllHistory} type="button"><RotateCcw aria-hidden="true" />{copy.clearFilter}</button>
          </div>
        </div>
        {filteredHistory.length > 0 ? (
          <div className="portal-history-list">
            {filteredHistory.map((item) => (
              <div key={`${item.title}-${item.date}`}><span><strong>{item.title}</strong><small>{item.detail} · {item.date}</small></span><strong className={item.amount.startsWith('+') ? 'amount-positive' : undefined}>{item.amount}</strong></div>
            ))}
          </div>
        ) : (
          <div className="wallet-history-empty"><CalendarDays aria-hidden="true" /><p>{copy.noResults}</p><button onClick={showAllHistory} type="button">{copy.clearFilter}</button></div>
        )}
      </article>
    </section>
  );
}
