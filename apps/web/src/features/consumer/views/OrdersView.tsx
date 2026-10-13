import {
  CalendarDays,
  LockKeyhole,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import { PortalPageHeader } from '../components/PortalPageHeader';

export function OrdersView() {
  const copy = th.consumerPortal.orders;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    copy.list[0].id,
  );

  const filteredOrders = copy.list.filter(
    (item) =>
      (!dateFrom || item.isoDate >= dateFrom) &&
      (!dateTo || item.isoDate <= dateTo),
  );
  const order =
    filteredOrders.find((item) => item.id === selectedOrderId) ??
    filteredOrders[0];
  const isPrimaryReceipt = order?.id === copy.list[0].id;

  const showAll = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedOrderId(copy.list[0].id);
  };

  const showCurrentMonth = () => {
    setDateFrom('2026-10-01');
    setDateTo('2026-10-31');
    setSelectedOrderId(copy.list[0].id);
  };

  return (
    <section className="consumer-view">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <article className="portal-card order-filter-card">
        <div className="order-filter-heading">
          <span>
            <CalendarDays aria-hidden="true" />
            <strong>{copy.filterTitle}</strong>
          </span>
          <small>
            {copy.resultPrefix} {filteredOrders.length} {copy.resultSuffix}
          </small>
        </div>
        <div className="order-filter-controls">
          <div className="order-filter-presets">
            <button
              aria-pressed={!dateFrom && !dateTo}
              className={!dateFrom && !dateTo ? 'is-active' : undefined}
              onClick={showAll}
              type="button"
            >
              {copy.filterAll}
            </button>
            <button
              aria-pressed={
                dateFrom === '2026-10-01' && dateTo === '2026-10-31'
              }
              className={
                dateFrom === '2026-10-01' && dateTo === '2026-10-31'
                  ? 'is-active'
                  : undefined
              }
              onClick={showCurrentMonth}
              type="button"
            >
              {copy.filterMonth}
            </button>
          </div>
          <div className="order-date-fields">
            <label>
              {copy.dateFrom}
              <input
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                type="date"
                value={dateFrom}
              />
            </label>
            <label>
              {copy.dateTo}
              <input
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                type="date"
                value={dateTo}
              />
            </label>
            <button onClick={showAll} type="button">
              <RotateCcw aria-hidden="true" />
              {copy.clearFilter}
            </button>
          </div>
        </div>
      </article>

      {order ? (
        <div className="orders-layout">
          <div className="order-list" aria-label={copy.title}>
            {filteredOrders.map((item) => (
              <button
                aria-current={order.id === item.id ? 'true' : undefined}
                className={order.id === item.id ? 'is-active' : undefined}
                key={item.id}
                onClick={() => setSelectedOrderId(item.id)}
                type="button"
              >
                <span className="activity-icon">
                  <ReceiptText aria-hidden="true" />
                </span>
                <span>
                  <strong>{item.merchant}</strong>
                  <small>{item.date}</small>
                  <small>{item.id}</small>
                </span>
                <strong>{item.amount}</strong>
              </button>
            ))}
          </div>

          <article className="portal-card receipt-card">
            <div className="receipt-heading">
              <div>
                <small>{copy.receiptTitle}</small>
                <h2>{order.id}</h2>
              </div>
              <span className="portal-status">{copy.paid}</span>
            </div>
            <div className="receipt-merchant">
              <strong>
                {isPrimaryReceipt ? copy.merchantSnapshot : order.merchant}
              </strong>
              <small>{order.date}</small>
            </div>
            <div className="receipt-items">
              {copy.itemSnapshots.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <dl>
              <div>
                <dt>{th.consumerPortal.payment.subtotal}</dt>
                <dd>{isPrimaryReceipt ? copy.subtotal : order.amount}</dd>
              </div>
              <div>
                <dt>{th.consumerPortal.payment.coupon}</dt>
                <dd>{isPrimaryReceipt ? copy.discount : '-'}</dd>
              </div>
              <div className="receipt-total">
                <dt>{th.consumerPortal.payment.finalAmount}</dt>
                <dd>{order.amount}</dd>
              </div>
              <div>
                <dt>{th.consumerPortal.payment.subsidyExpected}</dt>
                <dd>{isPrimaryReceipt ? copy.subsidyPaid : '-'}</dd>
              </div>
              <div>
                <dt>{th.consumerPortal.payment.personalExpected}</dt>
                <dd>{isPrimaryReceipt ? copy.personalPaid : order.amount}</dd>
              </div>
            </dl>
            {isPrimaryReceipt && (
              <p className="receipt-coupon">{copy.coupon}</p>
            )}
            <p className="portal-safety-note">
              <LockKeyhole aria-hidden="true" />
              {copy.immutableNote}
            </p>
          </article>
        </div>
      ) : (
        <div className="portal-card order-empty-state">
          <CalendarDays aria-hidden="true" />
          <p>{copy.noResults}</p>
          <button onClick={showAll} type="button">
            {copy.clearFilter}
          </button>
        </div>
      )}
    </section>
  );
}
