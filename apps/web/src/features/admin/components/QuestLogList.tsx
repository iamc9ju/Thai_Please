import { useState, type ReactNode } from 'react';
import type { QuestGenerationLogItem } from '../admin.types';
import { questLogCopy as copy } from '../quest-log.copy';
import { RewardHistoryPages } from './RewardHistoryPages';

export function QuestLogList({
  logs,
  children,
}: {
  logs: QuestGenerationLogItem[];
  children: (log: QuestGenerationLogItem) => ReactNode;
}) {
  const [sort, setSort] = useState('newest');
  const [status, setStatus] = useState('');
  const statuses = [...new Set(logs.map((log) => log.status))].sort();
  const filtered = logs
    .filter((log) => !status || log.status === status)
    .sort((a, b) => {
      const time = Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
      if (sort === 'oldest')
        return -time || a.generationId.localeCompare(b.generationId);
      if (sort === 'status')
        return (
          a.status.localeCompare(b.status) ||
          time ||
          a.generationId.localeCompare(b.generationId)
        );
      return time || a.generationId.localeCompare(b.generationId);
    });
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          {copy.sort}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="ml-2 rounded-xl border border-line bg-panel p-2"
          >
            <option value="newest">{copy.newest}</option>
            <option value="oldest">{copy.oldest}</option>
            <option value="status">{copy.byStatus}</option>
          </select>
        </label>
        <label className="text-sm">
          {copy.status}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="ml-2 rounded-xl border border-line bg-panel p-2"
          >
            <option value="">{copy.allStatuses}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <p role="status" className="py-6 text-sm text-muted">
          {copy.empty}
        </p>
      ) : (
        <RewardHistoryPages key={`${sort}-${status}`}>
          {filtered.map(children)}
        </RewardHistoryPages>
      )}
    </div>
  );
}
