import { useEffect, useRef, useState } from 'react';
import type { ConsumerQuestCancellationPreview } from '@thai-please/contracts';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import {
  cancelQuest,
  getQuestCancellation,
} from '../api/quest-cancellation.api';

const dateTime = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});

type Props = {
  assignmentId: string;
  questName: string;
  onClose: () => void;
  onCancelled: (nextEligibleAt: string) => Promise<void>;
};

export function QuestCancellationDialog({
  assignmentId,
  questName,
  onClose,
  onCancelled,
}: Props) {
  const copy = th.consumerPortal.quests.cancellation;
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const [preview, setPreview] =
    useState<ConsumerQuestCancellationPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      mounted.current = false;
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getQuestCancellation(assignmentId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPreview(data);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof ApiError && [401, 403].includes(cause.status)
            ? copy.permissionDenied
            : copy.previewError,
        );
      });
    return () => controller.abort();
  }, [assignmentId, revision, copy]);

  const confirm = async () => {
    if (!preview || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await cancelQuest(assignmentId);
      if (mounted.current) await onCancelled(result.nextEligibleAt);
    } catch (cause: unknown) {
      if (!mounted.current) return;
      const conflict =
        cause instanceof ApiError && [404, 409].includes(cause.status);
      const denied =
        cause instanceof ApiError && [401, 403].includes(cause.status);
      setError(
        conflict
          ? copy.stateChanged
          : denied
            ? copy.permissionDenied
            : copy.submitError,
      );
      if (conflict || denied) setPreview(null);
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="quest-cancel-title"
      aria-describedby="quest-cancel-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onClose();
      }}
      className="fixed inset-0 m-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40"
    >
      <h2 id="quest-cancel-title" className="text-lg font-bold text-slate-900">
        {copy.title}
      </h2>
      <p className="mt-2 font-semibold text-slate-700">{questName}</p>
      <p id="quest-cancel-description" className="mt-3 text-sm text-slate-600">
        {copy.description}
      </p>
      {!preview && !error && (
        <p role="status" className="mt-3">
          {copy.loading}
        </p>
      )}
      {preview && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          {copy.nextEligible(dateTime.format(new Date(preview.nextEligibleAt)))}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50"
        >
          {copy.keep}
        </button>
        {!preview && error && (
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setError(null);
              setRevision((n) => n + 1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2"
          >
            {copy.retry}
          </button>
        )}
        <button
          type="button"
          disabled={!preview || pending}
          onClick={() => void confirm()}
          className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {pending ? copy.pending : copy.confirm}
        </button>
      </div>
    </dialog>
  );
}
