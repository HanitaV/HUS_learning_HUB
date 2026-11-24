import { describe, expect, it } from 'vitest';
import type { HeatmapStepSpec } from '../../src/domain/semi-essay';
import { gradeHeatmapStep, mapHeatColor } from '../../src/core/learning/heatmap';

const selectSpec: HeatmapStepSpec = {
  kind: 'heatmap',
  mode: 'select-cells',
  rows: 3,
  cols: 4,
  values: [
    [100, 70, 40, 20],
    [100, 65, 35, 20],
    [100, 70, 40, 20],
  ],
  unit: '°C',
  xLabel: 'x',
  yLabel: 'y',
  expectedCells: ['0-0', '1-0', '2-0'],
};

const flowSpec: HeatmapStepSpec = {
  kind: 'heatmap',
  mode: 'place-flow',
  rows: 2,
  cols: 3,
  values: [
    [90, 60, 30],
    [90, 60, 30],
  ],
  unit: '°C',
  xLabel: 'x',
  yLabel: 'y',
  flowPoints: [
    {
      id: 'p1',
      row: 0,
      col: 1,
      label: 'M',
      expectedAngle: 0,
      toleranceDeg: 25,
      hint: 'Nhiệt truyền từ vùng nóng (trái) sang vùng lạnh (phải).',
    },
  ],
};

describe('Heatmap core color mapping & grading', () => {
  it('maps heat values safely even when min === max', () => {
    const flat = mapHeatColor(50, 50, 50);
    expect(flat.bg).toMatch(/^rgb\(/);
    const hot = mapHeatColor(100, 0, 100);
    const cold = mapHeatColor(0, 0, 100);
    expect(hot.bg).not.toBe(cold.bg);
  });

  it('grades select-cells accurately and ignores out-of-bounds keys safely', () => {
    expect(gradeHeatmapStep({ selectedCells: ['0-0', '1-0', '2-0'] }, selectSpec).correct).toBe(true);
    const withOob = gradeHeatmapStep({ selectedCells: ['0-0', '1-0', '2-0', '99-99', 'bad'] }, selectSpec);
    expect(withOob.correct).toBe(true);
    const wrong = gradeHeatmapStep({ selectedCells: ['0-0', '0-3'] }, selectSpec);
    expect(wrong.correct).toBe(false);
    expect(wrong.diagnostics.some(d => d.kind === 'missing')).toBe(true);
    expect(wrong.diagnostics.some(d => d.kind === 'extra')).toBe(true);
  });

  it('grades place-flow with angle wrap-around and gives hint on wrong direction', () => {
    expect(gradeHeatmapStep({ flowAngles: { p1: 350 } }, flowSpec).correct).toBe(true);
    const wrong = gradeHeatmapStep({ flowAngles: { p1: 180 } }, flowSpec);
    expect(wrong.correct).toBe(false);
    expect(wrong.diagnostics[0]?.message).toContain('vùng nóng');
  });
});
