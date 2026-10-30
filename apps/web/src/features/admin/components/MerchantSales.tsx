import { useEffect, useRef, useState } from 'react';
import type { SocialImpactDashboardResponse } from '../admin.types';
import { th } from '../../../i18n/th';
import {
  merchantSalesCopy as copy,
  MERCHANT_SALES_DISPLAY as limits,
} from '../merchant-sales.copy';

type Merchant = SocialImpactDashboardResponse['salesByMerchant'][number];
const money = (value: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(value);

export function MerchantSales({
  merchants,
  days,
}: {
  merchants: Merchant[];
  days: number;
}) {
  const [open, setOpen] = useState(false);
  const ranked = [...merchants].sort(
    (a, b) =>
      b.totalSales - a.totalSales ||
      b.orderCount - a.orderCount ||
      a.merchantId.localeCompare(b.merchantId),
  );
  return (
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-sm lg:col-span-7">
      <h3 className="text-base font-bold">
        {th.adminPortal.socialImpact.salesByMerchantTitle}
      </h3>
      <div className="mt-4 space-y-3">
        {ranked.length === 0 && <p className="text-muted">{copy.empty}</p>}
        {ranked.slice(0, limits.preview).map((merchant, index) => (
          <div
            key={merchant.merchantId}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-brand px-3 py-1 font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-bold">{merchant.merchantName}</p>
                <p className="text-xs text-muted">
                  {copy.orders}: {merchant.orderCount} · {copy.subsidy}:{' '}
                  {money(merchant.subsidyUsed)} · {copy.personalPaid}:{' '}
                  {money(merchant.personalPaid)}
                </p>
              </div>
            </div>
            <strong className="text-brand">{money(merchant.totalSales)}</strong>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          {copy.count(Math.min(limits.preview, ranked.length), ranked.length)}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-brand px-4 py-2 font-semibold text-white"
        >
          {copy.all} ({ranked.length}) →
        </button>
      </div>
      {open && (
        <MerchantSalesDialog
          merchants={ranked}
          days={days}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function MerchantSalesDialog({
  merchants,
  days,
  onClose,
}: {
  merchants: Merchant[];
  days: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  const filtered = merchants
    .filter((m) =>
      m.merchantName
        .toLocaleLowerCase('th-TH')
        .includes(search.trim().toLocaleLowerCase('th-TH')),
    )
    .sort(
      (a, b) =>
        (ascending
          ? a.totalSales - b.totalSales
          : b.totalSales - a.totalSales) ||
        a.merchantId.localeCompare(b.merchantId),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / limits.pageSize));
  const current = Math.min(page, pages);
  const offset = (current - 1) * limits.pageSize;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="merchant-sales-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-screen w-full max-w-4xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 text-ink shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="merchant-sales-title" className="text-lg font-bold">
          {copy.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-2"
        >
          {copy.close}
        </button>
      </div>
      <p className="my-3 text-sm text-brand">{copy.days(days)}</p>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          aria-label={copy.search}
          placeholder={copy.search}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="min-w-0 flex-1 rounded-xl border border-line p-3"
        />
        <label className="flex items-center gap-2 text-sm">
          {copy.sort}
          <select
            value={ascending ? 'asc' : 'desc'}
            onChange={(event) => {
              setAscending(event.target.value === 'asc');
              setPage(1);
            }}
            className="rounded-xl border border-line p-3"
          >
            <option value="desc">{copy.descending}</option>
            <option value="asc">{copy.ascending}</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface">
            <tr>
              {[copy.rank, copy.name, copy.orders, copy.sales].map((title) => (
                <th key={title} className="p-3">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(offset, offset + limits.pageSize)
              .map((merchant, index) => (
                <tr key={merchant.merchantId} className="border-b border-line">
                  <td className="p-3 text-brand">{offset + index + 1}</td>
                  <td className="p-3 font-semibold">{merchant.merchantName}</td>
                  <td className="p-3">{merchant.orderCount}</td>
                  <td className="p-3 font-bold text-brand">
                    {money(merchant.totalSales)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p role="status" className="py-6 text-center text-muted">
          {copy.empty}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">
          {copy.count(
            Math.min(offset + limits.pageSize, filtered.length) - offset,
            filtered.length,
          )}{' '}
          · {copy.page(current, pages)}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="rounded-xl border border-line px-3 py-2 disabled:opacity-50"
          >
            {copy.previous}
          </button>
          {Array.from({ length: Math.min(3, pages) }, (_, index) => {
            const number =
              Math.max(1, Math.min(current - 1, pages - 2)) + index;
            return (
              <button
                key={number}
                type="button"
                aria-label={copy.page(number, pages)}
                aria-current={number === current ? 'page' : undefined}
                onClick={() => setPage(number)}
                className={
                  number === current
                    ? 'rounded-xl bg-brand px-3 py-2 text-white'
                    : 'rounded-xl border border-line px-3 py-2'
                }
              >
                {number}
              </button>
            );
          })}
          <button
            type="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
            className="rounded-xl bg-brand px-3 py-2 text-white disabled:opacity-50"
          >
            {copy.next}
          </button>
        </div>
      </div>
    </dialog>
  );
}
