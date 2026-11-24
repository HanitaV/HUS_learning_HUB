import type { HeatmapStepSpec, HeatmapThermalTrend } from '../../domain/semi-essay';
import { shortestAngleDiff } from './fbd';

export interface HeatColorStop {
  readonly bg: string;
  readonly ink: 'light' | 'dark';
}

export interface HeatmapAnswer {
  readonly selectedCells?: readonly string[];
  readonly flowAngles?: Readonly<Record<string, number>>;
  readonly paintedTrends?: Readonly<Record<string, HeatmapThermalTrend>>;
}

export interface HeatmapDiagnostic {
  readonly kind: 'missing' | 'extra' | 'wrong-direction' | 'wrong-state';
  readonly message: string;
}

export interface HeatmapGradeResult {
  readonly correct: boolean;
  readonly matchedCount: number;
  readonly totalExpected: number;
  readonly diagnostics: readonly HeatmapDiagnostic[];
}

/**
 * Perceptually ordered, colorblind-friendly cool-to-warm stops (non-rainbow).
 * Deep observatory blue -> slate cyan -> soft alabaster -> warm amber -> deep vermilion.
 */
const COLOR_STOPS: readonly (readonly [number, number, number])[] = [
  [24, 58, 117],
  [44, 114, 178],
  [124, 179, 224],
  [236, 240, 245],
  [244, 198, 122],
  [224, 122, 62],
  [168, 42, 34],
];

export function mapHeatColor(value: number, min: number, max: number): HeatColorStop {
  const t = max <= min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const scaled = t * (COLOR_STOPS.length - 1);
  const idx = Math.min(COLOR_STOPS.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  const c0 = COLOR_STOPS[idx]!;
  const c1 = COLOR_STOPS[idx + 1]!;
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    ink: luminance > 0.58 ? 'dark' : 'light',
  };
}

export function isValidCellKey(key: string, rows: number, cols: number): boolean {
  const match = /^(\d+)-(\d+)$/.exec(key);
  if (!match) return false;
  const r = Number(match[1]);
  const c = Number(match[2]);
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < rows && c >= 0 && c < cols;
}

export function formatCellLabel(key: string, spec: HeatmapStepSpec): string {
  const [rStr, cStr] = key.split('-');
  const r = Number(rStr);
  const c = Number(cStr);
  const rowLabel = spec.rowLabels?.[r] ?? `Hàng ${r + 1}`;
  const colLabel = spec.colLabels?.[c] ?? `Cột ${c + 1}`;
  return `(${rowLabel}, ${colLabel})`;
}

export function gradeHeatmapStep(answer: HeatmapAnswer, spec: HeatmapStepSpec): HeatmapGradeResult {
  const diagnostics: HeatmapDiagnostic[] = [];

  if (spec.mode === 'select-cells') {
    const expected = new Set((spec.expectedCells ?? []).filter(k => isValidCellKey(k, spec.rows, spec.cols)));
    const selected = new Set((answer.selectedCells ?? []).filter(k => isValidCellKey(k, spec.rows, spec.cols)));
    let matchedCount = 0;

    for (const key of expected) {
      if (selected.has(key)) {
        matchedCount++;
      } else {
        diagnostics.push({
          kind: 'missing',
          message: `Còn thiếu ô ${formatCellLabel(key, spec)} thỏa điều kiện bài toán.`,
        });
      }
    }
    for (const key of selected) {
      if (!expected.has(key)) {
        diagnostics.push({
          kind: 'extra',
          message: `Ô ${formatCellLabel(key, spec)} chưa đúng với vùng cần tìm. Hãy so sánh lại chênh lệch nhiệt độ giữa các ô lân cận.`,
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

  if (spec.mode === 'place-flow') {
    const points = spec.flowPoints ?? [];
    const flowAngles = answer.flowAngles ?? {};
    let matchedCount = 0;

    for (const point of points) {
      const drawn = flowAngles[point.id];
      const tol = point.toleranceDeg ?? 25;
      if (drawn === undefined || Number.isNaN(drawn)) {
        diagnostics.push({
          kind: 'missing',
          message: `Chưa chọn hướng dòng nhiệt tại điểm ${point.label}.`,
        });
      } else if (shortestAngleDiff(drawn, point.expectedAngle) <= tol) {
        matchedCount++;
      } else {
        diagnostics.push({
          kind: 'wrong-direction',
          message: `Tại ${point.label}: ${point.hint}`,
        });
      }
    }

    return {
      correct: diagnostics.length === 0 && matchedCount === points.length,
      matchedCount,
      totalExpected: points.length,
      diagnostics,
    };
  }

  const expectedTrends = spec.expectedTrends ?? {};
  const paintedTrends = answer.paintedTrends ?? {};
  const keys = Object.keys(expectedTrends).filter(k => isValidCellKey(k, spec.rows, spec.cols));
  let matchedCount = 0;

  for (const key of keys) {
    const expectedTrend = expectedTrends[key];
    const actualTrend = paintedTrends[key];
    if (!actualTrend) {
      diagnostics.push({
        kind: 'missing',
        message: `Chưa dự đoán xu hướng nhiệt độ tại ô ${formatCellLabel(key, spec)}.`,
      });
    } else if (actualTrend === expectedTrend) {
      matchedCount++;
    } else {
      diagnostics.push({
        kind: 'wrong-state',
        message: `Dự đoán tại ô ${formatCellLabel(key, spec)} chưa khớp quy luật truyền nhiệt.`,
      });
    }
  }

  return {
    correct: diagnostics.length === 0 && matchedCount === keys.length,
    matchedCount,
    totalExpected: keys.length,
    diagnostics,
  };
}
