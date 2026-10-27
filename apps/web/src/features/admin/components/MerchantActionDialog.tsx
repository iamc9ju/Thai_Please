import { useEffect, useRef } from 'react';
import type { AdminMerchantItem } from '../admin.types';
import { merchantActionsCopy as copy } from '../merchant-actions.copy';

export interface MerchantConfirmation {
  action: 'approve' | 'reject';
  bulk: boolean;
  merchants: Pick<
    AdminMerchantItem,
    'merchantId' | 'merchantName' | 'status'
  >[];
}
interface Props {
  confirmation: MerchantConfirmation;
  busy: boolean;
  completed: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MerchantActionDialog({
  confirmation,
  busy,
  completed,
  onConfirm,
  onCancel,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement;
    element.showModal();
    cancelButton.current?.focus();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);
  const rejecting = confirmation.action === 'reject';
  return (
    <dialog
      ref={dialog}
      aria-modal="true"
      aria-labelledby="merchant-confirm-title"
      aria-describedby="merchant-confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-full max-w-lg rounded-2xl border border-line bg-panel p-6 text-ink shadow-xl backdrop:bg-slate-950/50"
    >
      <h2 id="merchant-confirm-title" className="text-lg font-bold">
        {confirmation.bulk
          ? copy.confirmBulk
          : rejecting
            ? copy.confirmReject
            : copy.confirmApprove}
      </h2>
      <p
        id="merchant-confirm-description"
        className="mt-3 text-sm leading-relaxed text-muted"
      >
        {confirmation.bulk
          ? copy.bulkHint
          : rejecting
            ? copy.rejectDescription
            : copy.approveDescription}
      </p>
      {confirmation.bulk && (
        <p className="mt-3 text-sm font-semibold">
          {copy.total(confirmation.merchants.length)}
        </p>
      )}
      <ul className="my-4 max-h-52 space-y-2 overflow-y-auto rounded-xl bg-surface p-4 text-sm">
        {confirmation.merchants.map((merchant) => (
          <li key={merchant.merchantId}>{merchant.merchantName}</li>
        ))}
      </ul>
      {busy && (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 text-sm text-brand-strong"
        >
          {copy.progress(completed, confirmation.merchants.length)}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          ref={cancelButton}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${rejecting ? 'bg-red-600' : 'bg-brand'}`}
        >
          {busy ? copy.processing : rejecting ? copy.reject : copy.approve}
        </button>
      </div>
    </dialog>
  );
}
