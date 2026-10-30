import { Search, Ticket, Power, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { th } from '../../../i18n/th';
import type { AdminCouponInput, AdminCouponItem } from '../admin.types';

type CouponDraft = Omit<AdminCouponInput, 'pointCost' | 'validityDays'> & {
  pointCost: string;
  validityDays: string;
};

const COUPON_PAGE_SIZE = 10;

const empty: CouponDraft = {
  couponName: '',
  discountType: 'FIXED',
  discountValue: '',
  pointCost: '',
  minPurchase: '',
  validityDays: '',
  status: 'ACTIVE',
};

export function CouponManager({
  items,
  busy,
  onCreate,
  onUpdate,
  onDelete,
  hasMore = false,
  onLoadMore,
  onSearchChange,
}: {
  items: AdminCouponItem[];
  busy: boolean;
  onCreate: (input: AdminCouponInput) => Promise<void>;
  onUpdate: (id: string, input: AdminCouponInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSearchChange?: (query: string) => void;
}) {
  const copy = th.adminPortal.coupons;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const matchingItems = items.filter((coupon) =>
    [coupon.couponName, coupon.description, coupon.merchantName].some((value) =>
      value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    ),
  );
  const pageCount = Math.max(
    1,
    Math.ceil(matchingItems.length / COUPON_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount - 1);
  const visibleItems = matchingItems.slice(
    currentPage * COUPON_PAGE_SIZE,
    (currentPage + 1) * COUPON_PAGE_SIZE,
  );
  const [form, setForm] = useState<CouponDraft>(empty);
  const createKey = useRef<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const set = <K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const input: AdminCouponInput = {
        ...form,
        minPurchase: form.minPurchase?.trim() || '0',
        pointCost: Number(form.pointCost),
        validityDays: Number(form.validityDays),
      };
      if (editing) await onUpdate(editing, input);
      else
        await onCreate({
          ...input,
          idempotencyKey:
            createKey.current ?? (createKey.current = crypto.randomUUID()),
        });
      setForm(empty);
      createKey.current = null;
      setEditing(null);
    } catch {
      // The parent displays the error; retain the draft and its retry key.
    }
  };
  return (
    <section className="space-y-6">
      <div className="admin-section-hero">
        <p className="text-xs font-medium tracking-wide text-blue-100 uppercase">
          {copy.eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold sm:text-2xl">{copy.title}</h2>
        <p className="mt-1 text-sm text-blue-100">{copy.description}</p>
      </div>
      <form
        onSubmit={(event) => void submit(event)}
        className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <fieldset disabled={busy} className="contents">
          <input
            aria-label={copy.name}
            required
            maxLength={150}
            value={form.couponName}
            onChange={(e) => set('couponName', e.target.value)}
            placeholder={copy.name}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <select
            aria-label={copy.discountType}
            value={form.discountType}
            onChange={(e) =>
              set(
                'discountType',
                e.target.value as AdminCouponInput['discountType'],
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="FIXED">{copy.fixed}</option>
            <option value="PERCENTAGE">{copy.percentage}</option>
          </select>
          <input
            aria-label={copy.value}
            required
            inputMode="decimal"
            value={form.discountValue}
            onChange={(e) => set('discountValue', e.target.value)}
            placeholder={copy.value}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <input
            aria-label={copy.pointCost}
            required
            type="number"
            min="1"
            value={form.pointCost}
            onChange={(e) => set('pointCost', e.target.value)}
            placeholder={copy.pointCost}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <input
            aria-label={copy.minPurchase}
            inputMode="decimal"
            value={form.minPurchase}
            onChange={(e) => set('minPurchase', e.target.value)}
            placeholder={copy.minPurchase}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <input
            aria-label={copy.validityDays}
            required
            type="number"
            min="1"
            value={form.validityDays}
            onChange={(e) => set('validityDays', e.target.value)}
            placeholder={copy.validityDays}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <textarea
            aria-label={copy.descriptionLabel}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            placeholder={copy.descriptionLabel}
            className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 md:col-span-2"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong disabled:opacity-50"
            >
              {editing ? copy.save : copy.create}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                  createKey.current = null;
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {copy.cancel}
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-7 top-7 text-slate-400"
        />
        <input
          aria-label={copy.search}
          placeholder={copy.search}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
            onSearchChange?.(event.target.value);
          }}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-10 text-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div className="space-y-3">
        {matchingItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            {copy.empty}
          </p>
        ) : (
          visibleItems.map((coupon) => (
            <article
              key={coupon.couponId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/30"
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Ticket size={18} className="text-brand" aria-hidden="true" />
                  {coupon.couponName}
                </p>
                <p className="text-sm text-slate-500">
                  {copy.summary(
                    coupon.discountType === 'FIXED'
                      ? `${copy.fixed} ${coupon.discountValue}`
                      : `${copy.percentage} ${coupon.discountValue}%`,
                    coupon.pointCost,
                    coupon.issuedCount,
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {coupon.merchantName ?? copy.platformWide} ·{' '}
                  {coupon.status === 'ACTIVE' ? copy.active : copy.inactive}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || coupon.issuedCount > 0}
                  onClick={() =>
                    void onUpdate(coupon.couponId, {
                      couponName: coupon.couponName,
                      description: coupon.description ?? '',
                      discountType: coupon.discountType,
                      discountValue: String(coupon.discountValue),
                      pointCost: coupon.pointCost,
                      minPurchase: String(coupon.minPurchase),
                      validityDays: coupon.validityDays,
                      status:
                        coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                    }).catch(() => undefined)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${coupon.status === 'ACTIVE' ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                >
                  <Power size={14} aria-hidden="true" />
                  {coupon.status === 'ACTIVE' ? copy.disable : copy.enable}
                </button>
                <button
                  disabled={busy || coupon.issuedCount > 0}
                  onClick={() => {
                    setEditing(coupon.couponId);
                    setForm({
                      couponName: coupon.couponName,
                      description: coupon.description ?? '',
                      discountType: coupon.discountType,
                      discountValue: String(coupon.discountValue),
                      pointCost: String(coupon.pointCost),
                      minPurchase: String(coupon.minPurchase),
                      validityDays: String(coupon.validityDays),
                      status: coupon.status,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Pencil size={14} aria-hidden="true" />
                  {copy.edit}
                </button>
                <button
                  disabled={busy || coupon.issuedCount > 0}
                  onClick={() => {
                    if (window.confirm(copy.removeConfirm(coupon.couponName)))
                      void onDelete(coupon.couponId).catch(() => undefined);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {copy.remove}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <nav
        aria-label={copy.pagination}
        className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-500 shadow-sm"
      >
        <button
          type="button"
          disabled={busy || currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {copy.previous}
        </button>
        <span>{copy.page(currentPage + 1, pageCount)}</span>
        <button
          type="button"
          disabled={busy || currentPage >= pageCount - 1}
          onClick={() => setPage(currentPage + 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {copy.next}
        </button>
      </nav>
      {hasMore && (
        <button
          type="button"
          disabled={busy}
          onClick={onLoadMore}
          className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {copy.loadMore}
        </button>
      )}
    </section>
  );
}
