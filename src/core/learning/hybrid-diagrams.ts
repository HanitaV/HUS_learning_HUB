import type { AlgoTraceStepSpec, ProbTreeStepSpec } from '../../domain/semi-essay';

/**
 * Parses localized decimal numbers ("0,36", "0.36", "1.8e-5"), percentages ("36%"),
 * or exact rational fractions ("1/3", "9/25", "64/225").
 */
export function parseFractionOrDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return null;

  if (cleaned.endsWith('%')) {
    const base = parseFractionOrDecimal(cleaned.slice(0, -1));
    return base === null ? null : base / 100;
  }

  const slashIdx = cleaned.indexOf('/');
  if (slashIdx > 0 && cleaned.indexOf('/', slashIdx + 1) === -1) {
    const numStr = cleaned.slice(0, slashIdx).replace(',', '.');
    const denStr = cleaned.slice(slashIdx + 1).replace(',', '.');
    if (
      /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(numStr) &&
      /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(denStr)
    ) {
      const num = Number(numStr);
      const den = Number(denStr);
      if (Number.isFinite(num) && Number.isFinite(den) && Math.abs(den) > 1e-12) {
        return num / den;
      }
    }
    return null;
  }

  const normalized = cleaned.replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    return null;
  }
  const val = Number(normalized);
  return Number.isFinite(val) ? val : null;
}

export interface ProbTreeBranchInput {
  readonly prior: string;
  readonly conditional: string;
}

export interface ProbTreeGradeResult {
  readonly correct: boolean;
  readonly priorSum: number | null;
  readonly totalProbability: number;
  readonly diagnostics: readonly string[];
}

export function gradeProbTreeStep(
  inputs: Readonly<Record<string, ProbTreeBranchInput>>,
  spec: ProbTreeStepSpec,
): ProbTreeGradeResult {
  const diagnostics: string[] = [];
  let priorSum = 0;
  let allPriorsValid = true;
  let totalProbability = 0;

  for (const branch of spec.branches) {
    const entry = inputs[branch.id] ?? { prior: '', conditional: '' };
    const pVal = parseFractionOrDecimal(entry.prior);
    const cVal = parseFractionOrDecimal(entry.conditional);
    const pTol = branch.priorTolerance ?? 0.006;
    const cTol = branch.conditionalTolerance ?? 0.006;

    if (pVal === null || pVal < 0 || pVal > 1) {
      allPriorsValid = false;
      diagnostics.push(
        `${branch.label}: hãy nhập xác suất nhánh P(${branch.symbolLatex}) hợp lệ trong [0, 1] (ví dụ phân số 1/3 hoặc số thập phân).`,
      );
    } else {
      priorSum += pVal;
      if (Math.abs(pVal - branch.expectedPrior) > pTol) {
        diagnostics.push(`${branch.label} — P(${branch.symbolLatex}): ${branch.hint}`);
      }
    }

    if (cVal === null || cVal < 0 || cVal > 1) {
      diagnostics.push(
        `${branch.label}: hãy nhập xác suất có điều kiện P(${spec.eventSymbolLatex} | ${branch.symbolLatex}) hợp lệ trong [0, 1].`,
      );
    } else {
      if (pVal !== null) {
        totalProbability += pVal * cVal;
      }
      if (Math.abs(cVal - branch.expectedConditional) > cTol) {
        diagnostics.push(
          `${branch.label} — P(${spec.eventSymbolLatex} | ${branch.symbolLatex}): ${branch.hint}`,
        );
      }
    }
  }

  if (allPriorsValid && Math.abs(priorSum - 1) > 0.015) {
    diagnostics.unshift(
      `Tổng xác suất hệ đầy đủ hiện bằng ${priorSum.toFixed(3)} ≠ 1. Mọi hệ đầy đủ xung khắc đôi một phải có ∑ P(Hᵢ) = 1.`,
    );
  }

  return {
    correct: diagnostics.length === 0,
    priorSum: allPriorsValid ? priorSum : null,
    totalProbability,
    diagnostics,
  };
}

export interface AlgoTraceGradeResult {
  readonly correct: boolean;
  readonly matchedCount: number;
  readonly totalExpected: number;
  readonly diagnostics: readonly { readonly cellKey: string; readonly message: string }[];
}

function normalizeTraceToken(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function gradeAlgoTraceStep(
  values: Readonly<Record<string, string>>,
  spec: AlgoTraceStepSpec,
): AlgoTraceGradeResult {
  const interactiveCells = spec.cells.filter(
    cell => (cell.expectedAnswers && cell.expectedAnswers.length > 0) || cell.numericExpected !== undefined,
  );
  const diagnostics: { readonly cellKey: string; readonly message: string }[] = [];
  let matchedCount = 0;

  for (const cell of interactiveCells) {
    const key = `${cell.row}-${cell.col}`;
    const raw = values[key] ?? '';
    const rowLabel = spec.rowLabels[cell.row] ?? `Hàng ${cell.row}`;
    const colLabel = spec.colLabels[cell.col] ?? `Cột ${cell.col}`;
    let ok = false;

    if (cell.numericExpected !== undefined) {
      const parsed = parseFractionOrDecimal(raw);
      const tol = cell.numericTolerance ?? 0.001;
      if (parsed !== null && Math.abs(parsed - cell.numericExpected) <= tol) {
        ok = true;
      }
    }

    if (!ok && cell.expectedAnswers && cell.expectedAnswers.length > 0) {
      const normalizedActual = normalizeTraceToken(raw);
      if (
        normalizedActual.length > 0 &&
        cell.expectedAnswers.some(ans => normalizeTraceToken(ans) === normalizedActual)
      ) {
        ok = true;
      }
    }

    if (ok) {
      matchedCount += 1;
    } else {
      diagnostics.push({
        cellKey: key,
        message: `[${rowLabel} · ${colLabel}]: ${
          raw.trim().length === 0
            ? 'Ô này còn để trống.'
            : cell.hint ?? 'Giá trị truy vết tại ô này chưa khớp với quy tắc cập nhật.'
        }`,
      });
    }
  }

  return {
    correct: diagnostics.length === 0 && matchedCount === interactiveCells.length,
    matchedCount,
    totalExpected: interactiveCells.length,
    diagnostics,
  };
}
