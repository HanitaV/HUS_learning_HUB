import { describe, expect, it } from 'vitest';
import { matchRealElement, PERIODIC_ELEMENTS } from '../../src/core/learning/elements';

describe('Periodic element shell matching', () => {
  it('verifies every element shell sum equals its atomic number', () => {
    for (const element of PERIODIC_ELEMENTS) {
      const total = element.shells.reduce((sum, count) => sum + count, 0);
      expect(total).toBe(element.atomicNumber);
      expect(element.funFact.trim().length).toBeGreaterThan(20);
    }
  });

  it('matches PHY1159 [2, 3] exactly to Boron (B, Z = 5)', () => {
    const match = matchRealElement([2, 3]);
    expect(match).not.toBeNull();
    expect(match?.symbol).toBe('B');
    expect(match?.atomicNumber).toBe(5);
    expect(match?.nameVi).toBe('Bo');
  });

  it('matches other real ground-state configurations accurately', () => {
    expect(matchRealElement([1])?.symbol).toBe('H');
    expect(matchRealElement([2])?.symbol).toBe('He');
    expect(matchRealElement([2, 4])?.symbol).toBe('C');
    expect(matchRealElement([2, 8, 1])?.symbol).toBe('Na');
    expect(matchRealElement([2, 8, 18, 8])?.symbol).toBe('Kr');
  });

  it('returns null for empty or non-physical shell configurations', () => {
    expect(matchRealElement([])).toBeNull();
    expect(matchRealElement([0])).toBeNull();
    expect(matchRealElement([2, 0])).toBeNull();
    expect(matchRealElement([3])).toBeNull();
    expect(matchRealElement([5, 2])).toBeNull();
    expect(matchRealElement([2, 9])).toBeNull();
  });
});
