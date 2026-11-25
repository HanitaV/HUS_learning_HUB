import { useMemo, useState, type KeyboardEvent } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { HeatmapStepSpec, HeatmapThermalTrend } from '../../domain/semi-essay';
import { gradeHeatmapStep, mapHeatColor, type HeatmapGradeResult } from '../../core/learning/heatmap';
import {
  isPlainObject,
  isStringArray,
  useInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

const FLOW_DIRECTIONS: readonly { readonly angle: number; readonly label: string; readonly symbol: string }[] = [
  { angle: 0, label: 'Sang phải (→)', symbol: '→' },
  { angle: 45, label: 'Lên phải (↗)', symbol: '↗' },
  { angle: 90, label: 'Lên trên (↑)', symbol: '↑' },
  { angle: 135, label: 'Lên trái (↖)', symbol: '↖' },
  { angle: 180, label: 'Sang trái (←)', symbol: '←' },
  { angle: 225, label: 'Xuống trái (↙)', symbol: '↙' },
  { angle: 270, label: 'Xuống dưới (↓)', symbol: '↓' },
  { angle: 315, label: 'Xuống phải (↘)', symbol: '↘' },
];

const TREND_ORDER: readonly HeatmapThermalTrend[] = ['warming', 'steady', 'cooling'];
const TREND_LABEL: Record<HeatmapThermalTrend, string> = {
  warming: 'Nóng lên',
  steady: 'Giữ nguyên',
  cooling: 'Lạnh đi',
};

interface HeatmapPersistedDraft {
  readonly selectedCells: readonly string[];
  readonly flowAngles: Readonly<Record<string, number>>;
  readonly paintedTrends: Readonly<Record<string, HeatmapThermalTrend>>;
}

export default function HeatmapDiagram({ spec, draftKey, onEvaluated }: DiagramRendererProps) {
  const heatSpec = spec as HeatmapStepSpec;
  const [showNumbers, setShowNumbers] = useState(true);
  const [persisted, setPersisted, resetPersisted] = useInteractiveStepDraft<HeatmapPersistedDraft>(
    draftKey,
    () => ({ selectedCells: [], flowAngles: {}, paintedTrends: {} }),
    raw => {
      if (!isPlainObject(raw)) return null;
      if (!isStringArray(raw.selectedCells, 200)) return null;
      if (!isPlainObject(raw.flowAngles) || !isPlainObject(raw.paintedTrends)) return null;
      const flowAngles: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw.flowAngles)) {
        if (k.length > 80 || typeof v !== 'number' || !Number.isFinite(v)) return null;
        flowAngles[k] = v;
      }
      const paintedTrends: Record<string, HeatmapThermalTrend> = {};
      for (const [k, v] of Object.entries(raw.paintedTrends)) {
        if (k.length > 80 || (v !== 'warming' && v !== 'steady' && v !== 'cooling')) return null;
        paintedTrends[k] = v;
      }
      return { selectedCells: raw.selectedCells, flowAngles, paintedTrends };
    },
  );
  const { selectedCells, flowAngles, paintedTrends } = persisted;
  const setSelectedCells = (updater: (prev: readonly string[]) => readonly string[]) =>
    setPersisted(prev => ({ ...prev, selectedCells: updater(prev.selectedCells) }));
  const setFlowAngles = (
    updater:
      | Readonly<Record<string, number>>
      | ((prev: Readonly<Record<string, number>>) => Readonly<Record<string, number>>),
  ) =>
    setPersisted(prev => ({
      ...prev,
      flowAngles: typeof updater === 'function' ? updater(prev.flowAngles) : updater,
    }));
  const setPaintedTrends = (
    updater: (
      prev: Readonly<Record<string, HeatmapThermalTrend>>,
    ) => Readonly<Record<string, HeatmapThermalTrend>>,
  ) => setPersisted(prev => ({ ...prev, paintedTrends: updater(prev.paintedTrends) }));
  const [activeFlowPointId, setActiveFlowPointId] = useState<string>(heatSpec.flowPoints?.[0]?.id ?? '');
  const [focusCoord, setFocusCoord] = useState<{ readonly r: number; readonly c: number }>({ r: 0, c: 0 });
  const [grade, setGrade] = useState<HeatmapGradeResult | null>(null);

  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of heatSpec.values) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return {
      minVal: Number.isFinite(min) ? min : 0,
      maxVal: Number.isFinite(max) ? max : 100,
    };
  }, [heatSpec.values]);

  const flowPointByCell = useMemo(() => {
    const map = new Map<string, NonNullable<HeatmapStepSpec['flowPoints']>[number]>();
    for (const pt of heatSpec.flowPoints ?? []) {
      map.set(`${pt.row}-${pt.col}`, pt);
    }
    return map;
  }, [heatSpec.flowPoints]);

  const toggleCell = (r: number, c: number) => {
    const key = `${r}-${c}`;
    setGrade(null);
    if (heatSpec.mode === 'select-cells') {
      setSelectedCells(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));
    } else if (heatSpec.mode === 'place-flow') {
      const point = flowPointByCell.get(key);
      if (point) setActiveFlowPointId(point.id);
    } else if (heatSpec.mode === 'paint-state') {
      setPaintedTrends(prev => {
        const current = prev[key];
        const nextIdx = current ? (TREND_ORDER.indexOf(current) + 1) % TREND_ORDER.length : 0;
        return { ...prev, [key]: TREND_ORDER[nextIdx]! };
      });
    }
  };

  const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
    let nextR = r;
    let nextC = c;
    if (event.key === 'ArrowUp') nextR = Math.max(0, r - 1);
    else if (event.key === 'ArrowDown') nextR = Math.min(heatSpec.rows - 1, r + 1);
    else if (event.key === 'ArrowLeft') nextC = Math.max(0, c - 1);
    else if (event.key === 'ArrowRight') nextC = Math.min(heatSpec.cols - 1, c + 1);
    else return;

    event.preventDefault();
    setFocusCoord({ r: nextR, c: nextC });
    const target = event.currentTarget.closest('[role="grid"]')?.querySelector<HTMLButtonElement>(
      `[data-cell="${nextR}-${nextC}"]`,
    );
    target?.focus();
  };

  const handleCheck = () => {
    const result = gradeHeatmapStep({ selectedCells, flowAngles, paintedTrends }, heatSpec);
    setGrade(result);
    onEvaluated({
      correct: result.correct,
      summary: result.correct
        ? 'Phân tích bản đồ nhiệt chính xác.'
        : 'Phân tích bản đồ nhiệt chưa khớp hoàn toàn, xem gợi ý bên dưới.',
    });
  };

  const handleReset = () => {
    resetPersisted();
    setGrade(null);
  };

  const activePoint = heatSpec.flowPoints?.find(p => p.id === activeFlowPointId) ?? heatSpec.flowPoints?.[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heatSpec.note ? <p className="text-sm text-ink-secondary">{heatSpec.note}</p> : <span />}
        <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={e => setShowNumbers(e.target.checked)}
            className="h-4 w-4 accent-[var(--hus-accent)]"
          />
          Hiện giá trị ({heatSpec.unit})
        </label>
      </div>

      {/* Heatmap grid container */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-canvas p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          <span>Trục dọc: {heatSpec.yLabel}</span>
          <span>Trục ngang: {heatSpec.xLabel}</span>
        </div>

        <div
          role="grid"
          aria-label="Bản đồ nhiệt tương tác"
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${heatSpec.cols}, minmax(0, 1fr))` }}
        >
          {heatSpec.values.map((rowVals, r) =>
            rowVals.map((val, c) => {
              const key = `${r}-${c}`;
              const color = mapHeatColor(val, minVal, maxVal);
              const isSelected = selectedCells.includes(key);
              const flowPoint = flowPointByCell.get(key);
              const flowAngle = flowPoint ? flowAngles[flowPoint.id] : undefined;
              const trend = paintedTrends[key];
              const isFocus = focusCoord.r === r && focusCoord.c === c;
              const rowName = heatSpec.rowLabels?.[r] ?? `H${r + 1}`;
              const colName = heatSpec.colLabels?.[c] ?? `C${c + 1}`;
              const flowDirMeta = FLOW_DIRECTIONS.find(d => d.angle === flowAngle);

              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  data-cell={key}
                  tabIndex={isFocus ? 0 : -1}
                  aria-pressed={heatSpec.mode === 'select-cells' ? isSelected : undefined}
                  aria-label={`${rowName}, ${colName}: ${val} ${heatSpec.unit}${flowPoint ? `, điểm ${flowPoint.label}` : ''}${isSelected ? ', đã chọn' : ''}`}
                  onClick={() => {
                    setFocusCoord({ r, c });
                    toggleCell(r, c);
                  }}
                  onKeyDown={e => handleGridKeyDown(e, r, c)}
                  style={{
                    backgroundColor: color.bg,
                    color: color.ink === 'dark' ? '#0e1726' : '#f8fafc',
                  }}
                  className={`relative flex min-h-[48px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-sm)] border-2 px-1 py-1.5 font-mono text-xs font-semibold tabular-nums transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hus-accent)] ${
                    isSelected || (flowPoint && flowPoint.id === activePoint?.id)
                      ? 'border-ink ring-2 ring-[var(--hus-accent)]'
                      : 'border-transparent hover:border-ink/40'
                  }`}
                >
                  {flowPoint ? (
                    <span className="rounded bg-canvas/85 px-1.5 py-0.5 text-[11px] font-bold text-ink">
                      {flowPoint.label} {flowDirMeta ? flowDirMeta.symbol : '?'}
                    </span>
                  ) : null}
                  {showNumbers ? (
                    <span className={flowPoint ? 'mt-0.5 text-[10px]' : ''}>
                      {val}
                      {heatSpec.unit}
                    </span>
                  ) : null}
                  {trend ? (
                    <span className="mt-0.5 rounded bg-canvas/85 px-1 text-[10px] font-medium text-ink">
                      {TREND_LABEL[trend]}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {/* Accessible Colorbar Legend */}
        <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
          <span className="font-mono tabular-nums">
            {minVal} {heatSpec.unit}
          </span>
          <div
            aria-hidden="true"
            className="h-2.5 flex-1 rounded-full border border-border"
            style={{
              background:
                'linear-gradient(90deg, rgb(24,58,117) 0%, rgb(44,114,178) 20%, rgb(124,179,224) 38%, rgb(236,240,245) 55%, rgb(244,198,122) 72%, rgb(224,122,62) 86%, rgb(168,42,34) 100%)',
            }}
          />
          <span className="font-mono tabular-nums">
            {maxVal} {heatSpec.unit}
          </span>
        </div>
      </div>

      {/* Direction picker for place-flow mode */}
      {heatSpec.mode === 'place-flow' && activePoint ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink">
              Chọn hướng vectơ dòng nhiệt tại điểm {activePoint.label}
            </p>
            {(heatSpec.flowPoints?.length ?? 0) > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {heatSpec.flowPoints?.map(pt => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setActiveFlowPointId(pt.id)}
                    className={`min-h-[34px] cursor-pointer rounded-full border px-2.5 text-xs font-medium ${
                      pt.id === activePoint.id
                        ? 'border-accent bg-accent-subtle text-accent-ink'
                        : 'border-border bg-canvas text-ink-secondary'
                    }`}
                  >
                    Điểm {pt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FLOW_DIRECTIONS.map(dir => {
              const isPicked = flowAngles[activePoint.id] === dir.angle;
              return (
                <button
                  key={dir.angle}
                  type="button"
                  onClick={() => {
                    setGrade(null);
                    setFlowAngles(prev => ({ ...prev, [activePoint.id]: dir.angle }));
                  }}
                  className={`min-h-[44px] scroll-mt-28 cursor-pointer rounded-[var(--radius-md)] border px-2.5 py-2 text-xs font-medium transition-colors ${
                    isPicked
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-canvas text-ink hover:border-border-strong'
                  }`}
                >
                  {dir.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra bản đồ nhiệt
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Làm lại
        </button>
      </div>

      {/* Diagnostic banner */}
      {grade ? (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-1.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            grade.correct
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-warning/35 bg-warning-subtle text-ink'
          }`}
        >
          <div className="flex items-start gap-2 font-medium">
            {grade.correct ? (
              <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
            )}
            <span>
              {grade.correct
                ? heatSpec.cellRationale ?? 'Chính xác! Phân tích trường nhiệt độ và chiều truyền nhiệt hoàn toàn khớp lý thuyết.'
                : `Đúng ${grade.matchedCount}/${grade.totalExpected} mục tiêu:`}
            </span>
          </div>
          {!grade.correct && grade.diagnostics.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-xs leading-relaxed text-ink-secondary">
              {grade.diagnostics.map((d, i) => (
                <li key={i}>{d.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
