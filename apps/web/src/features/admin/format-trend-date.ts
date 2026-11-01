import { th } from '../../i18n/th';

export function formatTrendDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
  }).format(parsed);
  const abbreviations = th.adminPortal.socialImpact.weekdayAbbreviations;
  const abbreviation = Object.entries(abbreviations).find(
    ([name]) => name === weekday,
  )?.[1];
  const date = parsed.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `${abbreviation ?? weekday} ${date}`;
}
