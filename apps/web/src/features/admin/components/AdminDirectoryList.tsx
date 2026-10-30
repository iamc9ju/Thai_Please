import { useState, type ReactNode } from 'react';
import { adminManagementCopy as copy } from '../admin-management.copy';

const DIRECTORY_PAGE_SIZE = 10;

export function AdminDirectoryList<
  T extends { userId: string; fullName: string; citizenIdMasked: string },
>({
  items,
  label,
  children,
}: {
  items: T[];
  label: string;
  children: (item: T) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = search.trim().toLocaleLowerCase('th-TH');
  const filtered = items.filter((item) =>
    `${item.fullName} ${item.citizenIdMasked}`
      .toLocaleLowerCase('th-TH')
      .includes(query),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE));
  const current = Math.min(page, pages);
  const offset = (current - 1) * DIRECTORY_PAGE_SIZE;
  return (
    <div className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">
        {copy.directorySearch} · {label}
        <input
          type="search"
          value={search}
          placeholder={copy.directorySearchHint}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="mt-2 block w-full rounded-xl border border-line bg-panel p-3 font-normal"
        />
      </label>
      {filtered.slice(offset, offset + DIRECTORY_PAGE_SIZE).map(children)}
      {filtered.length === 0 && (
        <p role="status" className="py-4 text-sm text-muted">
          {copy.directoryEmpty}
        </p>
      )}
      <nav
        aria-label={`${copy.directoryPagination} ${label}`}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
      >
        <p role="status" className="text-sm text-muted">
          {copy.directoryRange(
            filtered.length ? offset + 1 : 0,
            Math.min(offset + DIRECTORY_PAGE_SIZE, filtered.length),
            filtered.length,
          )}{' '}
          · {copy.rewardPage(current)} / {pages}
        </p>
        <div className="flex gap-2">
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
    </div>
  );
}
