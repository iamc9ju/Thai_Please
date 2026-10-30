import { useRef, useState, type FormEvent } from 'react';
import { th } from '../../../i18n/th';
import type { AdminCouponInput, AdminCouponItem } from '../admin.types';

const empty: AdminCouponInput = {
  couponName: '',
  discountType: 'FIXED',
  discountValue: '',
  pointCost: 1,
  minPurchase: '0',
  validityDays: 30,
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
}: {
  items: AdminCouponItem[];
  busy: boolean;
  onCreate: (input: AdminCouponInput) => Promise<void>;
  onUpdate: (id: string, input: AdminCouponInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const copy = th.adminPortal.coupons;
  const [form, setForm] = useState<AdminCouponInput>(empty);
  const createKey = useRef<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const set = <K extends keyof AdminCouponInput>(
    key: K,
    value: AdminCouponInput[K],
  ) => setForm((previous) => ({ ...previous, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editing) await onUpdate(editing, form);
      else
        await onCreate({
          ...form,
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
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <fieldset disabled={busy} className="contents">
          <input
            aria-label={copy.name}
            required
            maxLength={150}
            value={form.couponName}
            onChange={(e) => set('couponName', e.target.value)}
            placeholder={copy.name}
            className="rounded-xl border p-3"
          />
          <select
            aria-label={copy.status}
            value={form.status}
            onChange={(event) =>
              set('status', event.target.value as AdminCouponInput['status'])
            }
            className="rounded-xl border p-3"
          >
            <option value="ACTIVE">{copy.active}</option>
            <option value="INACTIVE">{copy.inactive}</option>
          </select>
          <select
            aria-label={copy.discountType}
            value={form.discountType}
            onChange={(e) =>
              set(
                'discountType',
                e.target.value as AdminCouponInput['discountType'],
              )
            }
            className="rounded-xl border p-3"
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
            className="rounded-xl border p-3"
          />
          <input
            aria-label={copy.pointCost}
            required
            type="number"
            min="1"
            value={form.pointCost}
            onChange={(e) => set('pointCost', Number(e.target.value))}
            placeholder={copy.pointCost}
            className="rounded-xl border p-3"
          />
          <input
            aria-label={copy.minPurchase}
            inputMode="decimal"
            value={form.minPurchase}
            onChange={(e) => set('minPurchase', e.target.value)}
            placeholder={copy.minPurchase}
            className="rounded-xl border p-3"
          />
          <input
            aria-label={copy.validityDays}
            required
            type="number"
            min="1"
            value={form.validityDays}
            onChange={(e) => set('validityDays', Number(e.target.value))}
            placeholder={copy.validityDays}
            className="rounded-xl border p-3"
          />
          <textarea
            aria-label={copy.descriptionLabel}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            placeholder={copy.descriptionLabel}
            className="rounded-xl border p-3 md:col-span-2"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
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
                className="rounded-xl border px-4 py-2"
              >
                {copy.cancel}
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            {copy.empty}
          </p>
        ) : (
          items.map((coupon) => (
            <article
              key={coupon.couponId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4"
            >
              <div>
                <p className="font-bold">{coupon.couponName}</p>
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
                  disabled={busy || coupon.issuedCount > 0}
                  onClick={() => {
                    setEditing(coupon.couponId);
                    setForm({
                      couponName: coupon.couponName,
                      description: coupon.description ?? '',
                      discountType: coupon.discountType,
                      discountValue: String(coupon.discountValue),
                      pointCost: coupon.pointCost,
                      minPurchase: String(coupon.minPurchase),
                      validityDays: coupon.validityDays,
                      status: coupon.status,
                    });
                  }}
                  className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                >
                  {copy.edit}
                </button>
                <button
                  disabled={busy || coupon.issuedCount > 0}
                  onClick={() => {
                    if (window.confirm(copy.removeConfirm(coupon.couponName)))
                      void onDelete(coupon.couponId).catch(() => undefined);
                  }}
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                >
                  {copy.remove}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <p className="text-xs text-slate-500">{copy.listLimit}</p>
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
