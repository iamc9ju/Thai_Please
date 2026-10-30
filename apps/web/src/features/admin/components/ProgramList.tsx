import { useState, type ReactNode } from 'react';
import type { SubsidyProgramItem } from '../admin.types';
import { adminManagementCopy as copy } from '../admin-management.copy';
import { RewardHistoryPages } from './RewardHistoryPages';

export function ProgramList({
  programs,
  children,
}: {
  programs: SubsidyProgramItem[];
  children: (program: SubsidyProgramItem) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('th-TH');
  const filtered = programs.filter((program) =>
    program.programName.toLocaleLowerCase('th-TH').includes(query),
  );
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        {copy.programSearch}
        <input
          type="search"
          value={search}
          placeholder={copy.programSearch}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-line bg-panel p-3 font-normal"
        />
      </label>
      {filtered.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-line bg-panel p-6 text-sm text-muted"
        >
          {programs.length === 0 ? copy.noPrograms : copy.programSearchEmpty}
        </p>
      ) : (
        <RewardHistoryPages key={query}>
          {filtered.map(children)}
        </RewardHistoryPages>
      )}
    </div>
  );
}
