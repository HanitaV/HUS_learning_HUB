import { describe, expect, it } from 'vitest';
import {
  gradeAlgoTraceStep,
  gradeProbTreeStep,
  parseFractionOrDecimal,
} from '../../src/core/learning/hybrid-diagrams';
import type { AlgoTraceStepSpec, ProbTreeStepSpec } from '../../src/domain/semi-essay';
import { getDiagramLabel, getDiagramModule } from '../../src/modules/diagrams/registry';

describe('Hybrid characteristic diagram engines across Math, Stats, Chemistry, and CS', () => {
  it('parses localized decimals, rational fractions, and percentages accurately', () => {
    expect(parseFractionOrDecimal('1/3')).toBeCloseTo(1 / 3, 6);
    expect(parseFractionOrDecimal('9 / 25')).toBeCloseTo(0.36, 6);
    expect(parseFractionOrDecimal('0,36')).toBeCloseTo(0.36, 6);
    expect(parseFractionOrDecimal('36%')).toBeCloseTo(0.36, 6);
    expect(parseFractionOrDecimal('1/0')).toBeNull();
    expect(parseFractionOrDecimal('abc')).toBeNull();
  });

  it('grades Bayes / Total Probability partition trees with sum-to-one and branch diagnostics', () => {
    const spec: ProbTreeStepSpec = {
      kind: 'prob-tree',
      rootLabel: 'Chọn lô hàng',
      eventLabel: 'Rút hoàn lại 2 lần đều tốt',
      eventSymbolLatex: 'A',
      branches: [
        {
          id: 'h1',
          label: 'Lô 1 (6/10 tốt)',
          symbolLatex: 'H_1',
          expectedPrior: 1 / 3,
          expectedConditional: 9 / 25,
          hint: 'P(H₁) = 1/3 và P(A|H₁) = (6/10)² = 9/25.',
        },
        {
          id: 'h2',
          label: 'Lô 2 (8/15 tốt)',
          symbolLatex: 'H_2',
          expectedPrior: 1 / 3,
          expectedConditional: 64 / 225,
          hint: 'P(H₂) = 1/3 và P(A|H₂) = 64/225.',
        },
        {
          id: 'h3',
          label: 'Lô 3 (12/20 tốt)',
          symbolLatex: 'H_3',
          expectedPrior: 1 / 3,
          expectedConditional: 9 / 25,
          hint: 'P(H₃) = 1/3 và P(A|H₃) = 9/25.',
        },
      ],
    };

    const ok = gradeProbTreeStep(
      {
        h1: { prior: '1/3', conditional: '9/25' },
        h2: { prior: '1/3', conditional: '64/225' },
        h3: { prior: '1/3', conditional: '0,36' },
      },
      spec,
    );
    expect(ok.correct).toBe(true);
    expect(ok.totalProbability).toBeCloseTo(226 / 675, 5);

    const badPriorSum = gradeProbTreeStep(
      {
        h1: { prior: '1/2', conditional: '9/25' },
        h2: { prior: '1/2', conditional: '64/225' },
        h3: { prior: '1/2', conditional: '9/25' },
      },
      spec,
    );
    expect(badPriorSum.correct).toBe(false);
    expect(badPriorSum.diagnostics[0]).toContain('≠ 1');
  });

  it('grades 1D/2D algorithm and data-structure trace tables accurately', () => {
    const spec: AlgoTraceStepSpec = {
      kind: 'algo-trace',
      structureLabel: 'Bảng băm dò tuyến tính M = 7',
      rowLabels: ['table[i]'],
      colLabels: ['0', '1', '2', '3', '4', '5', '6'],
      cells: [
        { row: 0, col: 0, givenValue: '—' },
        { row: 0, col: 1, givenValue: '15' },
        { row: 0, col: 2, numericExpected: 22, hint: '22 % 7 = 1 bị đụng độ, dò sang ô 2.' },
        { row: 0, col: 3, numericExpected: 8, hint: '8 % 7 = 1, dò sang ô 3.' },
        { row: 0, col: 4, numericExpected: 1, hint: '1 % 7 = 1, dò sang ô 4.' },
      ],
    };

    const fail = gradeAlgoTraceStep({ '0-2': '22', '0-3': '8', '0-4': '7' }, spec);
    expect(fail.correct).toBe(false);
    expect(fail.matchedCount).toBe(2);
    expect(fail.totalExpected).toBe(3);

    const pass = gradeAlgoTraceStep({ '0-2': '22', '0-3': '8', '0-4': '1' }, spec);
    expect(pass.correct).toBe(true);
    expect(pass.matchedCount).toBe(3);
  });

  it('registers all 9 subject-authentic diagram descriptors in the shared registry', () => {
    for (const kind of [
      'fbd',
      'heatmap',
      'curve-2d',
      'balance-flow',
      'mo-diagram',
      'prob-tree',
      'algo-trace',
      'proof-dag',
      'parsons-flow',
    ] as const) {
      expect(getDiagramModule(kind).kind).toBe(kind);
      expect(getDiagramLabel(kind).length).toBeGreaterThan(3);
    }
  });
});
