import { describe, expect, it } from 'vitest';
import type { Curve2dStepSpec } from '../../src/domain/semi-essay';
import { computeTrapezoidArea, gradeCurve2dStep } from '../../src/core/learning/curve-2d';

const vtSpec: Curve2dStepSpec = {
  kind: 'curve-2d',
  mode: 'select-regions',
  xLabel: 't',
  yLabel: 'v',
  xUnit: 's',
  yUnit: 'm/s',
  xMax: 16,
  yMax: 10,
  points: [
    { x: 0, y: 0 },
    { x: 2, y: 8 },
    { x: 10, y: 8 },
    { x: 12, y: 4 },
    { x: 16, y: 4 },
  ],
  segments: [
    { id: 's1', label: '0–2 s', fromIndex: 0, toIndex: 1 },
    { id: 's2', label: '2–10 s', fromIndex: 1, toIndex: 2 },
    { id: 's3', label: '10–12 s', fromIndex: 2, toIndex: 3 },
    { id: 's4', label: '12–16 s', fromIndex: 3, toIndex: 4 },
  ],
  expectedSegmentIds: ['s2', 's4'],
};

const pvSpec: Curve2dStepSpec = {
  kind: 'curve-2d',
  mode: 'sign-matrix',
  xLabel: 'V',
  yLabel: 'P',
  xUnit: 'L',
  yUnit: 'atm',
  xMax: 6,
  yMax: 4,
  points: [
    { x: 1, y: 2, label: '1' },
    { x: 4, y: 2, label: '2' },
  ],
  segments: [{ id: 'p12', label: '1 → 2 (Đẳng áp giãn nở)', fromIndex: 0, toIndex: 1 }],
  matrixColumns: [
    { id: 'dU', labelLatex: '\\Delta U' },
    { id: 'A', labelLatex: 'A' },
    { id: 'Q', labelLatex: 'Q' },
  ],
  signRows: [
    {
      segmentId: 'p12',
      label: '1 → 2',
      expectedSigns: { dU: '+', A: '+', Q: '+' },
      hint: 'Giãn nở đẳng áp làm tăng thể tích (A > 0) và tăng nhiệt độ (ΔU > 0), nên hệ nhận nhiệt (Q > 0).',
    },
  ],
};

describe('Curve2d core geometry & grading', () => {
  it('computes exact trapezoid area under v(t)', () => {
    expect(computeTrapezoidArea(0, 0, 2, 8)).toBe(8);
    expect(computeTrapezoidArea(2, 8, 10, 8)).toBe(64);
    expect(computeTrapezoidArea(10, 8, 12, 4)).toBe(12);
    expect(computeTrapezoidArea(12, 4, 16, 4)).toBe(16);
  });

  it('grades select-regions accurately and ignores unknown IDs', () => {
    expect(gradeCurve2dStep({ selectedSegmentIds: ['s2', 's4', 'bogus'] }, vtSpec).correct).toBe(true);
    const wrong = gradeCurve2dStep({ selectedSegmentIds: ['s1'] }, vtSpec);
    expect(wrong.correct).toBe(false);
    expect(wrong.diagnostics.length).toBeGreaterThanOrEqual(2);
  });

  it('grades P-V sign-matrix with process-specific hints', () => {
    expect(
      gradeCurve2dStep({ signMatrix: { p12: { dU: '+', A: '+', Q: '+' } } }, pvSpec).correct,
    ).toBe(true);
    const wrong = gradeCurve2dStep({ signMatrix: { p12: { dU: '+', A: '-', Q: '+' } } }, pvSpec);
    expect(wrong.correct).toBe(false);
    expect(wrong.diagnostics[0]?.message).toContain('Giãn nở đẳng áp');
  });
});
