import { useState, type FormEvent } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { adminManagementCopy as copy } from '../admin-management.copy';
import { updateSubsidyProgram } from '../api/admin.api';
import type { SubsidyProgramItem } from '../admin.types';

interface Props {
  program: SubsidyProgramItem;
  onSaved: (program: SubsidyProgramItem) => void;
}
const inputClass =
  'mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm';

export function SubsidyProgramEditor({ program, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const policyInUse = (program.walletCount ?? 0) + (program.orderCount ?? 0) + (program.walletTransactionCount ?? 0) > 0;
  const fields = th.adminPortal.programs;
  const id = `edit-program-${program.programId}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const textField = (name: string): string => {
      const value = data.get(name);
      return typeof value === 'string' ? value : '';
    };
    const startDate = textField('startDate');
    const endDate = textField('endDate');
    if (startDate > endDate) {
      setError(copy.dateOrder);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateSubsidyProgram(program.programId, {
        programName: textField('programName').trim(),
        initialGrant: Number(data.get('initialGrant')),
        subsidyPercentage: Number(data.get('subsidyPercentage')),
        dailySubsidyLimit: Number(data.get('dailySubsidyLimit')),
        startDate,
        endDate,
      });
      onSaved(updated);
      setOpen(false);
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 409
          ? copy.programPolicyNote
          : copy.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        disabled={busy || policyInUse}
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
          setSaved(false);
        }}
        className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-strong"
      >
        {open ? copy.programCancel : copy.programEdit}
      </button>
      {policyInUse && <p className="mt-3 text-xs leading-relaxed text-muted">{copy.programPolicyNote}</p>}
      {saved && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {copy.programSaved}
        </p>
      )}
      {open && (
        <form
          id={id}
          aria-label={`${copy.programEditTitle} ${program.programName}`}
          onSubmit={(event) => void submit(event)}
          className="mt-4 space-y-4"
        >
          <p className="text-xs leading-relaxed text-muted">
            {copy.programPolicyNote}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor={`${id}-name`}
              className="text-xs font-semibold sm:col-span-2"
            >
              {fields.programNameLabel}
              <input
                id={`${id}-name`}
                name="programName"
                required
                minLength={3}
                maxLength={150}
                defaultValue={program.programName}
                className={inputClass}
              />
            </label>
            <label htmlFor={`${id}-grant`} className="text-xs font-semibold">
              {fields.initialGrantLabel}
              <input
                id={`${id}-grant`}
                name="initialGrant"
                type="number"
                required
                min={1}
                max={100000}
                step={1}
                defaultValue={program.initialGrant}
                className={inputClass}
              />
            </label>
            <label
              htmlFor={`${id}-percentage`}
              className="text-xs font-semibold"
            >
              {fields.subsidyPercentLabel}
              <input
                id={`${id}-percentage`}
                name="subsidyPercentage"
                type="number"
                required
                min={1}
                max={100}
                step={1}
                defaultValue={program.subsidyPercentage}
                className={inputClass}
              />
            </label>
            <label htmlFor={`${id}-cap`} className="text-xs font-semibold">
              {fields.dailyCapLabel}
              <input
                id={`${id}-cap`}
                name="dailySubsidyLimit"
                type="number"
                required
                min={1}
                max={50000}
                step={1}
                defaultValue={program.dailySubsidyLimit}
                className={inputClass}
              />
            </label>
            <label htmlFor={`${id}-start`} className="text-xs font-semibold">
              {fields.startDateLabel}
              <input
                id={`${id}-start`}
                name="startDate"
                type="date"
                required
                defaultValue={program.startDate.slice(0, 10)}
                className={inputClass}
              />
            </label>
            <label htmlFor={`${id}-end`} className="text-xs font-semibold">
              {fields.endDateLabel}
              <input
                id={`${id}-end`}
                name="endDate"
                type="date"
                required
                defaultValue={program.endDate.slice(0, 10)}
                className={inputClass}
              />
            </label>
            <label htmlFor={`${id}-currency`} className="text-xs font-semibold">
              {copy.currency}
              <input
                id={`${id}-currency`}
                value={program.currency}
                readOnly
                className={inputClass}
              />
            </label>
            <label htmlFor={`${id}-timezone`} className="text-xs font-semibold">
              {copy.timezone}
              <input
                id={`${id}-timezone`}
                value={program.timezone}
                readOnly
                className={inputClass}
              />
            </label>
            <p className="text-xs text-muted sm:col-span-2">
              {copy.supportedPolicy}
            </p>
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? copy.saving : copy.programSave}
            </button>
          </fieldset>
        </form>
      )}
    </div>
  );
}
