import { expect, test } from 'bun:test';
import { comparablePeriods, type PeriodResult } from './market-filter';

function period(month: string, overrides: Partial<PeriodResult> = {}): PeriodResult {
  return {
    period: month, total: 20, matching: 6, observedDays: 30, complete: true,
    scopes: ['taipei', 'new-taipei'], evidence: [], ruleVersions: ['1'], ...overrides,
  };
}

test('trend lines show only a continuous comparable interval and omit the current partial month', () => {
  expect(comparablePeriods([
    period('2026-05', { complete: false }), period('2026-06'),
    period('2026-07'), period('2026-08'), period('2026-09', { complete: false }),
  ])).toEqual(['2026-06', '2026-07', '2026-08']);
  expect(comparablePeriods([
    period('2026-05'), period('2026-07'), period('2026-08', { scopes: ['taipei'] }),
  ])).toEqual([]);
  expect(comparablePeriods([
    period('2026-05'), period('2026-06', { ruleVersions: ['1', '2'] }), period('2026-07'),
  ])).toEqual([]);
});
