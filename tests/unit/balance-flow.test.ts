import { describe, expect, it } from 'vitest';
import type { BalanceFlowStepSpec } from '../../src/domain/semi-essay';
import { gradeBalanceFlowStep } from '../../src/core/learning/balance-flow';

const lolSpec: BalanceFlowStepSpec = {
  kind: 'balance-flow',
  systemLabel: 'Hệ: Vật + Trái Đất (mặt dốc ngoài hệ)',
  initialLabel: 'Chân dốc (lúc ném)',
  finalLabel: 'Điểm dừng cao nhất',
  maxLevel: 4,
  initialBars: [
    { id: 'K1', label: 'Động năng đầu', symbolLatex: 'K_1', expectedState: 'positive', hint: 'Lúc ném vật có vận tốc v0 > 0 nên K1 > 0.' },
    { id: 'U1', label: 'Thế năng đầu', symbolLatex: 'U_1', expectedState: 'zero', hint: 'Chọn mốc thế năng tại chân dốc nên U1 = 0.' },
  ],
  finalBars: [
    { id: 'K2', label: 'Động năng cuối', symbolLatex: 'K_2', expectedState: 'zero', hint: 'Tại điểm dừng cao nhất v = 0 nên K2 = 0.' },
    { id: 'U2', label: 'Thế năng cuối', symbolLatex: 'U_2', expectedState: 'positive', hint: 'Vật lên cao nên thế năng trọng trường U2 > 0.' },
  ],
  transferLabel: 'Công lực ma sát',
  transferSymbolLatex: 'A_{ms}',
  expectedTransferSign: '-',
  transferHint: 'Ma sát ngược chiều chuyển động lên dốc nên sinh công âm.',
  requireConservation: true,
};

describe('BalanceFlow (LOL Energy Bar Chart) core grader', () => {
  it('passes when qualitative states and conservation inequality match', () => {
    const res = gradeBalanceFlowStep(
      { initialLevels: { K1: 4, U1: 0 }, finalLevels: { K2: 0, U2: 3 }, transferSign: '-' },
      lolSpec,
    );
    expect(res.correct).toBe(true);
    expect(res.initialSum).toBe(4);
    expect(res.finalSum).toBe(3);
  });

  it('catches conservation violation when negative work does not reduce total mechanical energy', () => {
    const res = gradeBalanceFlowStep(
      { initialLevels: { K1: 3, U1: 0 }, finalLevels: { K2: 0, U2: 4 }, transferSign: '-' },
      lolSpec,
    );
    expect(res.correct).toBe(false);
    expect(res.diagnostics[0]?.kind).toBe('conservation');
  });

  it('catches wrong bar states and wrong work sign', () => {
    const res = gradeBalanceFlowStep(
      { initialLevels: { K1: 0, U1: 2 }, finalLevels: { K2: 1, U2: 2 }, transferSign: '+' },
      lolSpec,
    );
    expect(res.correct).toBe(false);
    expect(res.diagnostics.some(d => d.kind === 'initial-bar')).toBe(true);
    expect(res.diagnostics.some(d => d.kind === 'final-bar')).toBe(true);
    expect(res.diagnostics.some(d => d.kind === 'transfer')).toBe(true);
  });
});
