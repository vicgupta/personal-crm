import { describe, it, expect } from 'vitest';
import { moveDealToStage, columnTotals } from './pipeline-utils';
import type { Deal } from './types';

const DEALS: Deal[] = [
  { id: 1, name: 'A', organization_id: null, contact_id: null, stage: 'new', value: 10000, probability: 10, close_date: '', created_at: '' },
  { id: 2, name: 'B', organization_id: null, contact_id: null, stage: 'proposal', value: 40000, probability: 50, close_date: '', created_at: '' },
  { id: 3, name: 'C', organization_id: null, contact_id: null, stage: 'negotiation', value: 80000, probability: 75, close_date: '', created_at: '' },
];

describe('moveDealToStage', () => {
  it('moves a deal to a new stage with the new probability', () => {
    const next = moveDealToStage(DEALS, 1, 'qualified', 25);
    expect(next.find((d) => d.id === 1)!.stage).toBe('qualified');
    expect(next.find((d) => d.id === 1)!.probability).toBe(25);
    expect(next.find((d) => d.id === 2)!.stage).toBe('proposal'); // others untouched
    expect(DEALS.find((d) => d.id === 1)!.stage).toBe('new'); // no mutation
  });

  it('handles Won and Lost moves', () => {
    const won = moveDealToStage(DEALS, 2, 'won', 100);
    expect(won.find((d) => d.id === 2)).toMatchObject({ stage: 'won', probability: 100 });
    const lost = moveDealToStage(DEALS, 3, 'lost', 0);
    expect(lost.find((d) => d.id === 3)).toMatchObject({ stage: 'lost', probability: 0 });
  });

  it('leaves the list unchanged for an unknown deal id', () => {
    expect(moveDealToStage(DEALS, 999, 'won', 100)).toEqual(DEALS);
  });
});

describe('columnTotals', () => {
  it('computes count, total value and probability-weighted expected value', () => {
    expect(columnTotals(DEALS, 'new')).toEqual({ count: 1, total: 10000, expected: 1000 });
    expect(columnTotals(DEALS, 'proposal')).toEqual({ count: 1, total: 40000, expected: 20000 });
    expect(columnTotals(DEALS, 'won')).toEqual({ count: 0, total: 0, expected: 0 });
  });
});
