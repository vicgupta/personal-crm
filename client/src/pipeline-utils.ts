import type { Deal, Stage } from './types';

/** Pure helper used by the pipeline drag-and-drop handler: returns the deal
 *  list with one deal moved to a new stage (probability follows the server). */
export function moveDealToStage(deals: Deal[], dealId: number, stage: Stage, probability: number): Deal[] {
  return deals.map((d) => (d.id === dealId ? { ...d, stage, probability } : d));
}

export interface ColumnTotals {
  count: number;
  total: number;
  expected: number;
}

/** Total value and probability-weighted expected value for one pipeline column. */
export function columnTotals(deals: Deal[], stage: Stage): ColumnTotals {
  const inStage = deals.filter((d) => d.stage === stage);
  return {
    count: inStage.length,
    total: inStage.reduce((n, d) => n + d.value, 0),
    expected: inStage.reduce((n, d) => n + (d.value * d.probability) / 100, 0),
  };
}
