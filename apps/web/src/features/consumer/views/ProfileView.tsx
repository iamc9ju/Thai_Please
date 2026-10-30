import { useCallback, useEffect, useState } from 'react';
import type { ConsumerProfileResponse } from '@thai-please/contracts';
import { ApiError } from '../../../lib/api-client';
import { useLatestRequest } from '../../../lib/use-latest-request';
import { LoadingState } from '../../../components/LoadingState';
import { getConsumerProfile } from '../api/profile.api';
import {
  ChevronRight,
  LockKeyhole,
  MapPin,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import { PortalPageHeader } from '../components/PortalPageHeader';

type ProfileState =
  | { status: 'loading' | 'error' | 'permission-denied' }
  | { status: 'success'; data: ConsumerProfileResponse };

export function ProfileView() {
  const copy = th.consumerPortal.profile;
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const beginRequest = useLatestRequest();
  const load = useCallback(async () => {
    const request = beginRequest();
    try {
      const data = await getConsumerProfile(request.signal);
      if (request.isCurrent()) setState({ status: 'success', data });
    } catch (error) {
      if (request.isCurrent())
        setState({
          status:
            error instanceof ApiError &&
            (error.status === 401 || error.status === 403)
              ? 'permission-denied'
              : 'error',
        });
    }
  }, [beginRequest]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-6 animate-fade-in font-sans">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      {state.status === 'loading' && (
        <LoadingState label={copy.loading} variant="profile" />
      )}

      {(state.status === 'error' || state.status === 'permission-denied') && (
        <div
          className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm gap-4"
          role="alert"
        >
          <p className="text-sm font-bold text-red-700">
            {state.status === 'permission-denied'
              ? copy.permissionDenied
              : copy.loadError}
          </p>
          {state.status === 'error' && (
            <button
              type="button"
              onClick={() => {
                setState({ status: 'loading' });
                void load();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0056b3] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#004494] transition-colors cursor-pointer"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {copy.retry}
            </button>
          )}
        </div>
      )}

      {state.status === 'success' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <article className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003d82] via-[#0056b3] to-[#0073e6] text-white shadow-md shadow-blue-900/15">
                <UserRound className="size-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {state.data.fullName}
                </h2>
                <p className="mt-0.5 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#0056b3]">
                  {copy.roleValue}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                {copy.identity}
              </h3>
              <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60 px-4">
                <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <dt className="font-semibold text-slate-500">{copy.name}</dt>
                  <dd className="font-bold text-slate-900 text-right">
                    {state.data.fullName}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <dt className="font-semibold text-slate-500">
                    {copy.citizenId}
                  </dt>
                  <dd className="font-mono font-bold text-slate-900 text-right">
                    {state.data.maskedCitizenId}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <dt className="font-semibold text-slate-500">{copy.phone}</dt>
                  <dd className="font-bold text-slate-900 text-right">
                    {state.data.phone || copy.notProvided}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <dt className="font-semibold text-slate-500">{copy.role}</dt>
                  <dd className="font-bold text-[#0056b3] text-right">
                    {copy.roleValue}
                  </dd>
                </div>
              </dl>
            </div>
          </article>

          <div className="lg:col-span-5 space-y-6">
            <article className="flex items-start gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3]">
                <MapPin className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {copy.address}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600 leading-relaxed">
                  {state.data.address || copy.notProvided}
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {copy.security}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {copy.settingsUnavailable}
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <LockKeyhole className="size-5" aria-hidden="true" />
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60 overflow-hidden">
                {[copy.changePassword, copy.privacy, copy.terms].map((item) => (
                  <button
                    key={item}
                    disabled
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold text-slate-400 disabled:cursor-not-allowed"
                  >
                    <span>{item}</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
