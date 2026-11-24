import type { Curve2dStepSpec } from '../../domain/semi-essay';

export interface Curve2dAnswer {
  readonly selectedSegmentIds?: readonly string[];
  readonly signMatrix?: Readonly<Record<string, Readonly<Record<string, '+' | '-' | '0' | ''>>>>;
}

export interface Curve2dDiagnostic {
  readonly segmentId: string;
  readonly message: string;
}

export interface Curve2dGradeResult {
  readonly correct: boolean;
  readonly matchedCount: number;
  readonly totalExpected: number;
  readonly diagnostics: readonly Curve2dDiagnostic[];
}

export function computeTrapezoidArea(x0: number, y0: number, x1: number, y1: number): number {
  return ((y0 + y1) / 2) * (x1 - x0);
}

export function gradeCurve2dStep(answer: Curve2dAnswer, spec: Curve2dStepSpec): Curve2dGradeResult {
  const diagnostics: Curve2dDiagnostic[] = [];
  const validSegIds = new Set(spec.segments.map(s => s.id));

  if (spec.mode === 'select-regions') {
    const expected = new Set((spec.expectedSegmentIds ?? []).filter(id => validSegIds.has(id)));
    const selected = new Set((answer.selectedSegmentIds ?? []).filter(id => validSegIds.has(id)));
    let matchedCount = 0;

    for (const id of expected) {
      const seg = spec.segments.find(s => s.id === id);
      if (selected.has(id)) {
        matchedCount++;
      } else {
        diagnostics.push({
          segmentId: id,
          message: `Còn thiếu đoạn/miền "${seg?.label ?? id}" thỏa mãn điều kiện bài toán.`,
        });
      }
    }

    for (const id of selected) {
      if (!expected.has(id)) {
        const seg = spec.segments.find(s => s.id === id);
        diagnostics.push({
          segmentId: id,
          message: `Đoạn "${seg?.label ?? id}" chưa khớp yêu cầu. Hãy kiểm tra lại độ dốc hoặc dấu biến thiên trên đồ thị.`,
        });
      }
    }

    return {
      correct: diagnostics.length === 0 && matchedCount === expected.size,
      matchedCount,
      totalExpected: expected.size,
      diagnostics,
    };
  }

  // sign-matrix mode (e.g., P-V processes with ΔU, Q, A signs)
  const rows = spec.signRows ?? [];
  const cols = spec.matrixColumns ?? [];
  const matrix = answer.signMatrix ?? {};
  let matchedCount = 0;
  let totalExpected = 0;

  for (const row of rows) {
    let rowHasError = false;
    for (const col of cols) {
      const expectedSign = row.expectedSigns[col.id];
      if (!expectedSign) continue;
      totalExpected++;
      const actual = matrix[row.segmentId]?.[col.id];
      if (actual === expectedSign) {
        matchedCount++;
      } else {
        rowHasError = true;
      }
    }
    if (rowHasError) {
      diagnostics.push({
        segmentId: row.segmentId,
        message: `${row.label}: ${row.hint}`,
      });
    }
  }

  return {
    correct: diagnostics.length === 0 && matchedCount === totalExpected,
    matchedCount,
    totalExpected,
    diagnostics,
  };
}
