import {
  CheckCircle2,
  QrCode,
  ReceiptText,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { th } from '../../../i18n/th';
import { consumerMock, formatBaht } from '../consumer.mock';
import type { ConsumerView, PaymentStep } from '../consumer.types';
import { PortalPageHeader } from '../components/PortalPageHeader';

type PaymentViewProps = Readonly<{ onNavigate: (view: ConsumerView) => void }>;

export function PaymentView({ onNavigate }: PaymentViewProps) {
  const [step, setStep] = useState<PaymentStep>('scan');
  const copy = th.consumerPortal.payment;

  return (
    <section className="consumer-view">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {step === 'scan' && (
        <article className="portal-card payment-scan-card">
          <div className="scanner-frame">
            <ScanLine aria-hidden="true" />
            <span />
          </div>
          <h2>{copy.scanTitle}</h2>
          <p>{copy.scanDescription}</p>
          <div className="payment-actions">
            <button
              className="portal-secondary-button"
              onClick={() => setStep('review')}
              type="button"
            >
              <QrCode aria-hidden="true" />
              {copy.cameraAction}
            </button>
            <button
              className="portal-primary-button"
              onClick={() => setStep('review')}
              type="button"
            >
              {copy.demoAction}
            </button>
          </div>
        </article>
      )}

      {step === 'review' && (
        <div className="payment-review-layout">
          <article className="portal-card payment-order-card">
            <div className="merchant-summary">
              <span className="activity-icon">
                <ReceiptText aria-hidden="true" />
              </span>
              <span>
                <small>{copy.reviewTitle}</small>
                <h2>{copy.merchant}</h2>
                <p>{copy.merchantLocation}</p>
              </span>
            </div>
            <p className="qr-expiry">{copy.expires}</p>
            <h3>{copy.itemsTitle}</h3>
            <div className="payment-items">
              {copy.items.map((item) => (
                <div key={item.name}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.quantity}</small>
                  </span>
                  <strong>{item.total}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="portal-card payment-summary-card">
            <h2>{copy.reviewTitle}</h2>
            <dl>
              <div>
                <dt>{copy.subtotal}</dt>
                <dd>฿{formatBaht(consumerMock.payment.subtotalSatang)}</dd>
              </div>
              <div>
                <dt>
                  {copy.coupon}
                  <small>{copy.selectedCoupon}</small>
                </dt>
                <dd className="discount-value">
                  -฿{formatBaht(consumerMock.payment.discountSatang)}
                </dd>
              </div>
              <div className="payment-total">
                <dt>{copy.finalAmount}</dt>
                <dd>฿{formatBaht(consumerMock.payment.finalAmountSatang)}</dd>
              </div>
              <div>
                <dt>{copy.subsidyExpected}</dt>
                <dd>฿{formatBaht(consumerMock.payment.subsidyPaidSatang)}</dd>
              </div>
              <div>
                <dt>{copy.personalExpected}</dt>
                <dd>฿{formatBaht(consumerMock.payment.personalPaidSatang)}</dd>
              </div>
            </dl>
            <p className="wallet-after-payment">{copy.walletAfter}</p>
            <button
              className="portal-primary-button"
              onClick={() => setStep('success')}
              type="button"
            >
              {copy.confirm}
            </button>
            <p className="portal-safety-note">
              <ShieldCheck aria-hidden="true" />
              {copy.safetyNote}
            </p>
          </article>
        </div>
      )}

      {step === 'success' && (
        <article className="portal-card payment-success-card">
          <CheckCircle2 aria-hidden="true" />
          <p>{th.consumerPortal.draftLabel}</p>
          <h2>{copy.successTitle}</h2>
          <strong>{copy.successAmount}</strong>
          <span>{copy.successDescription}</span>
          <div className="payment-actions">
            <button
              className="portal-primary-button"
              onClick={() => onNavigate('orders')}
              type="button"
            >
              {copy.receiptAction}
            </button>
            <button
              className="portal-secondary-button"
              onClick={() => onNavigate('overview')}
              type="button"
            >
              {copy.homeAction}
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
