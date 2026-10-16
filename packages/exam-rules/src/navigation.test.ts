import { describe, expect, it } from 'vitest';
import { flattenNavigation, nextNavigationIndex, previousNavigationIndex } from './navigation';

describe('student CBT navigation', () => {
  it('preserves a deterministic question order and removes duplicate references', () => {
    expect(flattenNavigation([{ key: 'paper-b', sequence: 1, questionVersionIds: ['q3', 'q2'] }, { key: 'paper-a', sequence: 0, questionVersionIds: ['q1', 'q2'] }])).toEqual(['q1', 'q2', 'q3']);
  });

  it('supports a synthetic UGC-shaped 150-question form without changing navigation semantics', () => {
    const ids = Array.from({ length: 150 }, (_, index) => `q-${index + 1}`);
    const order = flattenNavigation([{ key: 'paper-ii', sequence: 1, questionVersionIds: ids.slice(50) }, { key: 'paper-i', sequence: 0, questionVersionIds: ids.slice(0, 50) }]);
    expect(order).toHaveLength(150);
    expect(order[0]).toBe('q-1');
    expect(order[149]).toBe('q-150');
    expect(nextNavigationIndex(148, 150)).toBe(149);
    expect(previousNavigationIndex(0, 150)).toBe(0);
  });

  it('fails closed for an empty palette', () => {
    expect(nextNavigationIndex(0, 0)).toBe(-1);
    expect(previousNavigationIndex(0, 0)).toBe(-1);
  });
});
