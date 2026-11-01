import { expect, it } from 'vitest';
import { formatTrendDate } from './format-trend-date';

it.each([
  ['2026-10-25', 'อา.'],
  ['2026-10-26', 'จ.'],
  ['2026-10-27', 'อ.'],
  ['2026-10-28', 'พ.'],
  ['2026-10-29', 'พฤ.'],
  ['2026-10-30', 'ศ.'],
  ['2026-10-31', 'ส.'],
])('uses the explicit Thai abbreviation for %s', (date, abbreviation) => {
  expect(formatTrendDate(date).startsWith(`${abbreviation} `)).toBe(true);
});
it('uses the Bangkok day at the UTC date boundary', () => {
  expect(formatTrendDate('2026-10-29T18:00:00Z')).toBe('ศ. 30 ต.ค. 2569');
});
