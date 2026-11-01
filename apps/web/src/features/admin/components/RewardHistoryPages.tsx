import { useState, type ReactNode } from 'react';
import { adminManagementCopy as copy } from '../admin-management.copy';

export const REWARD_HISTORY_PAGE_SIZE = 10;

/** FR-A01: paginate the bounded recent-history report without changing summary totals. */
export function RewardHistoryPages({ children }: { children: ReactNode[] }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(
    1,
    Math.ceil(children.length / REWARD_HISTORY_PAGE_SIZE),
  );
  const current = Math.min(page, pages);
  const offset = (current - 1) * REWARD_HISTORY_PAGE_SIZE;
  if (children.length === 0) return null;
  return (
    <>
      {children.slice(offset, offset + REWARD_HISTORY_PAGE_SIZE)}
      <nav
        aria-label={copy.rewardPagination}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
      >
        <p role="status" className="text-sm text-muted">
          {copy.rewardPageRange(
            offset + 1,
            Math.min(offset + REWARD_HISTORY_PAGE_SIZE, children.length),
            children.length,
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            {copy.previousPage}
          </button>
          {Array.from({ length: pages }, (_, index) => index + 1).map(
            (number) => (
              <button
                key={number}
                type="button"
                aria-label={copy.rewardPage(number)}
                aria-current={number === current ? 'page' : undefined}
                onClick={() => setPage(number)}
                className={
                  number === current
                    ? 'rounded-xl bg-brand px-3 py-2 text-sm text-white'
                    : 'rounded-xl border border-line px-3 py-2 text-sm'
                }
              >
                {number}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
            className="rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            {copy.nextPage}
          </button>
        </div>
      </nav>
    </>
  );
}
