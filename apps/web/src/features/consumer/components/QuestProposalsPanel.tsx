import { useEffect, useRef, useState } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import {
  createConsumerQuestProposals,
  getConsumerQuestProposals,
  selectConsumerQuestProposal,
} from '../api/consumer.api';
import type { ConsumerQuestProposalsResponse } from '../consumer.types';

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 20;
const EXPIRY_CLOCK_INTERVAL_MS = 1_000;
const dateTime = new Intl.DateTimeFormat(th.consumerDashboard.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: th.consumerDashboard.timeZone,
});
const money = new Intl.NumberFormat(th.consumerDashboard.locale, {
  maximumFractionDigits: 2,
});

type PanelState =
  'loading' | 'loaded' | 'waiting' | 'error' | 'permission-denied';

export function QuestProposalsPanel({
  onSelected,
}: {
  onSelected: () => Promise<void>;
}) {
  const copy = th.consumerPortal.quests;
  const [data, setData] = useState<ConsumerQuestProposalsResponse | null>(null);
  const [state, setState] = useState<PanelState>('loading');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState(false);
  const [selectionSuccess, setSelectionSuccess] = useState(false);
  const forceCreate = useRef(false);
  const selectionController = useRef<AbortController | null>(null);
  const selectionKey = useRef<{
    requestKey: string;
    proposalId: string;
    key: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const accept = (result: ConsumerQuestProposalsResponse) => {
      if (controller.signal.aborted) return;
      setData(result);
      setState('loaded');
      if (result.status === 'PENDING') {
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setState('waiting');
          return;
        }
        attempts += 1;
        timer = setTimeout(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      }
    };
    const failed = (error: unknown) => {
      if (controller.signal.aborted) return;
      setState(
        error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
          ? 'permission-denied'
          : 'error',
      );
    };
    const poll = async () => {
      try {
        accept(await getConsumerQuestProposals(controller.signal));
      } catch (error: unknown) {
        failed(error);
      }
    };
    const initial = async () => {
      try {
        const result = await getConsumerQuestProposals(controller.signal);
        if (controller.signal.aborted) return;
        const retry = forceCreate.current;
        forceCreate.current = false;
        if (
          result.status === 'ELIGIBLE' ||
          (retry && result.status === 'FAILED')
        ) {
          accept(
            await createConsumerQuestProposals(
              crypto.randomUUID(),
              controller.signal,
            ),
          );
        } else {
          accept(result);
        }
      } catch (error: unknown) {
        failed(error);
      }
    };
    void initial();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [revision]);

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      EXPIRY_CLOCK_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      selectionController.current?.abort();
    },
    [],
  );

  const refresh = (create = false) => {
    setState('loading');
    forceCreate.current = create;
    setRevision((value) => value + 1);
  };

  const select = async (proposalId: string) => {
    if (selecting || !data?.requestKey || data.status !== 'READY') return;
    if (data.expiresAt && Date.parse(data.expiresAt) <= now) {
      refresh();
      return;
    }
    setSelecting(proposalId);
    setSelectionError(false);
    const controller = new AbortController();
    selectionController.current = controller;
    const prior = selectionKey.current;
    const key =
      prior?.requestKey === data.requestKey && prior.proposalId === proposalId
        ? prior.key
        : crypto.randomUUID();
    selectionKey.current = { requestKey: data.requestKey, proposalId, key };
    try {
      const selected = await selectConsumerQuestProposal(
        data.requestKey,
        proposalId,
        key,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setData({
        status: 'COOLDOWN',
        requestKey: null,
        expiresAt: null,
        nextEligibleAt: selected.nextEligibleAt,
        reason: null,
        items: [],
      });
      setSelectionSuccess(true);
      await onSelected();
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        setState('permission-denied');
      } else {
        setSelectionError(true);
      }
    } finally {
      if (!controller.signal.aborted) setSelecting(null);
    }
  };

  const expired = data?.expiresAt ? Date.parse(data.expiresAt) <= now : false;
  return (
    <section
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="quest-proposals-title"
      aria-busy={state === 'loading' || selecting !== null}
    >
      <div>
        <h2
          id="quest-proposals-title"
          className="text-lg font-bold text-slate-900"
        >
          {copy.proposals.title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {copy.proposals.description}
        </p>
      </div>
      <div aria-live="polite" role="status">
        {state === 'loading' && <p>{copy.proposals.loading}</p>}
        {state === 'permission-denied' && (
          <p>{copy.proposals.permissionDenied}</p>
        )}
        {state === 'error' && <p>{copy.proposals.error}</p>}
        {state === 'waiting' && <p>{copy.proposals.waiting}</p>}
        {state === 'loaded' && data?.status === 'PENDING' && (
          <p>{copy.proposals.generating}</p>
        )}
        {state === 'loaded' && data?.status === 'FAILED' && (
          <p>{copy.proposals.error}</p>
        )}
        {selectionSuccess && (
          <p className="text-emerald-700">{copy.proposals.selected}</p>
        )}
        {data?.status === 'COOLDOWN' && (
          <p>
            {data.nextEligibleAt
              ? copy.proposals.nextRound(
                  dateTime.format(new Date(data.nextEligibleAt)),
                )
              : copy.proposals.active}
          </p>
        )}
        {selectionError && (
          <p className="text-red-700" role="alert">
            {copy.proposals.selectError}
          </p>
        )}
      </div>
      {state === 'loaded' && data?.status === 'READY' && !expired && (
        <>
          {data.expiresAt && (
            <p className="text-xs text-slate-500">
              {copy.proposals.expiry(dateTime.format(new Date(data.expiresAt)))}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {data.items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-blue-100 p-4"
              >
                <h3 className="font-bold text-slate-900">
                  {item.type === 'CATEGORY_SPEND'
                    ? copy.personalCategoryCondition(
                        item.targetCategoryName ?? item.targetCategoryId ?? '',
                        money.format(Number(item.minimumSpend)),
                      )
                    : copy.personalSpendCondition(
                        money.format(Number(item.minimumSpend)),
                      )}
                </h3>
                <p className="text-sm text-slate-600">
                  {copy.proposals.duration(item.durationDays)}
                </p>
                <p className="font-bold text-blue-700">
                  {copy.rewardPrefix}
                  {item.rewardPoints} {copy.pointsSuffix}
                </p>
                <button
                  className="mt-auto rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
                  type="button"
                  disabled={selecting !== null}
                  onClick={() => {
                    void select(item.id);
                  }}
                >
                  {selecting === item.id
                    ? copy.proposals.selecting
                    : copy.proposals.select}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {state === 'loaded' && data?.status === 'READY' && expired && (
        <p role="alert">{copy.proposals.expired}</p>
      )}
      {(state === 'error' ||
        state === 'permission-denied' ||
        state === 'waiting' ||
        (state === 'loaded' && (data?.status === 'FAILED' || expired))) && (
        <button
          type="button"
          disabled={selecting !== null}
          onClick={() => refresh(data?.status === 'FAILED')}
          className="rounded-xl border border-blue-200 px-4 py-2 font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
        >
          {data?.status === 'FAILED'
            ? copy.proposals.retry
            : copy.proposals.refresh}
        </button>
      )}
    </section>
  );
}
