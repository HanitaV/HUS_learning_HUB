import type { BalanceFlowStepSpec } from '../../domain/semi-essay';

export interface BalanceFlowAnswer {
  readonly initialLevels: Readonly<Record<string, number>>;
  readonly finalLevels: Readonly<Record<string, number>>;
  readonly transferSign: '-' | '0' | '+' | '';
}

export interface BalanceFlowDiagnostic {
  readonly kind: 'initial-bar' | 'final-bar' | 'transfer' | 'conservation';
  readonly message: string;
}

export interface BalanceFlowGradeResult {
  readonly correct: boolean;
  readonly initialSum: number;
  readonly finalSum: number;
  readonly diagnostics: readonly BalanceFlowDiagnostic[];
}

export function gradeBalanceFlowStep(
  answer: BalanceFlowAnswer,
  spec: BalanceFlowStepSpec,
): BalanceFlowGradeResult {
  const diagnostics: BalanceFlowDiagnostic[] = [];
  let initialSum = 0;
  let finalSum = 0;

  for (const bar of spec.initialBars) {
    const level = Math.max(0, Math.round(answer.initialLevels[bar.id] ?? 0));
    initialSum += level;
    if (bar.expectedState === 'zero' && level > 0) {
      diagnostics.push({ kind: 'initial-bar', message: `Trạng thái đầu (${bar.label}): ${bar.hint}` });
    } else if (bar.expectedState === 'positive' && level === 0) {
      diagnostics.push({ kind: 'initial-bar', message: `Trạng thái đầu (${bar.label}): ${bar.hint}` });
    }
  }

  for (const bar of spec.finalBars) {
    const level = Math.max(0, Math.round(answer.finalLevels[bar.id] ?? 0));
    finalSum += level;
    if (bar.expectedState === 'zero' && level > 0) {
      diagnostics.push({ kind: 'final-bar', message: `Trạng thái cuối (${bar.label}): ${bar.hint}` });
    } else if (bar.expectedState === 'positive' && level === 0) {
      diagnostics.push({ kind: 'final-bar', message: `Trạng thái cuối (${bar.label}): ${bar.hint}` });
    }
  }

  if (answer.transferSign !== spec.expectedTransferSign) {
    diagnostics.push({
      kind: 'transfer',
      message: `${spec.transferLabel}: ${spec.transferHint}`,
    });
  }

  if (spec.requireConservation !== false && diagnostics.length === 0) {
    const delta = finalSum - initialSum;
    if (spec.expectedTransferSign === '0' && delta !== 0) {
      diagnostics.push({
        kind: 'conservation',
        message: `Hệ bảo toàn cơ năng (không có công ngoại lực ròng): tổng số vạch năng lượng đầu (${initialSum}) phải bằng tổng số vạch năng lượng cuối (${finalSum}).`,
      });
    } else if (spec.expectedTransferSign === '-' && delta >= 0) {
      diagnostics.push({
        kind: 'conservation',
        message: `Công ngoại lực/ma sát âm làm giảm cơ năng hệ: tổng số vạch cuối (${finalSum}) phải nhỏ hơn tổng số vạch đầu (${initialSum}).`,
      });
    } else if (spec.expectedTransferSign === '+' && delta <= 0) {
      diagnostics.push({
        kind: 'conservation',
        message: `Công ngoại lực dương bổ sung năng lượng cho hệ: tổng số vạch cuối (${finalSum}) phải lớn hơn tổng số vạch đầu (${initialSum}).`,
      });
    }
  }

  return {
    correct: diagnostics.length === 0,
    initialSum,
    finalSum,
    diagnostics,
  };
}
