import { useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { Curve2dStepSpec } from '../../domain/semi-essay';
import { computeTrapezoidArea, gradeCurve2dStep, type Curve2dGradeResult } from '../../core/learning/curve-2d';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';
import Markdown from '../../components/learning/Markdown';

const SVG_W = 420;
const SVG_H = 240;
const PAD_L = 48;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 38;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

export default function Curve2dDiagram({ spec, onEvaluated }: DiagramRendererProps) {
  const curveSpec = spec as Curve2dStepSpec;
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(curveSpec.segments[0]?.id ?? null);
  const [signMatrix, setSignMatrix] = useState<
    Readonly<Record<string, Readonly<Record<string, '+' | '-' | '0' | ''>>>>
  >({});
  const [grade, setGrade] = useState<Curve2dGradeResult | null>(null);

  const mapX = (x: number) => PAD_L + (x / curveSpec.xMax) * PLOT_W;
  const mapY = (y: number) => PAD_T + PLOT_H - (y / curveSpec.yMax) * PLOT_H;
  const baselineY = mapY(0);

  const toggleSegment = (segId: string) => {
    setGrade(null);
    setActiveSegmentId(segId);
    if (curveSpec.mode === 'select-regions') {
      setSelectedIds(prev => (prev.includes(segId) ? prev.filter(id => id !== segId) : [...prev, segId]));
    }
  };

  const setSign = (segId: string, colId: string, sign: '+' | '-' | '0') => {
    setGrade(null);
    setActiveSegmentId(segId);
    setSignMatrix(prev => ({
      ...prev,
      [segId]: {
        ...(prev[segId] ?? {}),
        [colId]: sign,
      },
    }));
  };

  const handleCheck = () => {
    const res = gradeCurve2dStep({ selectedSegmentIds: selectedIds, signMatrix }, curveSpec);
    setGrade(res);
    onEvaluated({
      correct: res.correct,
      summary: res.correct
        ? 'Phân tích đồ thị chính xác.'
        : 'Một số đoạn/dấu trên đồ thị chưa khớp, xem gợi ý bên dưới.',
    });
  };

  const handleReset = () => {
    setSelectedIds([]);
    setSignMatrix({});
    setGrade(null);
  };

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Number((curveSpec.xMax * f).toFixed(1)));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Number((curveSpec.yMax * f).toFixed(1)));

  return (
    <div className="space-y-4">
      {curveSpec.note ? <p className="text-sm text-ink-secondary">{curveSpec.note}</p> : null}

      {/* Interactive 2D Coordinate Graph SVG */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label={`Đồ thị ${curveSpec.yLabel} theo ${curveSpec.xLabel}`}
          className="w-full max-w-[520px] select-none"
        >
          <defs>
            <marker id="curve-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--hus-accent)" />
            </marker>
          </defs>

          {/* Gridlines & ticks */}
          {yTicks.map(val => {
            const y = mapY(val);
            return (
              <g key={`y-${val}`}>
                <line x1={PAD_L} y1={y} x2={SVG_W - PAD_R} y2={y} stroke="var(--hus-border)" strokeDasharray="3 4" />
                <text x={PAD_L - 8} y={y + 4} textAnchor="end" fill="var(--hus-ink-muted)" fontSize="10.5">
                  {val}
                </text>
              </g>
            );
          })}
          {xTicks.map(val => {
            const x = mapX(val);
            return (
              <g key={`x-${val}`}>
                <line x1={x} y1={PAD_T} x2={x} y2={baselineY} stroke="var(--hus-border)" strokeDasharray="3 4" />
                <text x={x} y={baselineY + 15} textAnchor="middle" fill="var(--hus-ink-muted)" fontSize="10.5">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T - 6} x2={PAD_L} y2={baselineY} stroke="var(--hus-ink)" strokeWidth="1.5" />
          <line x1={PAD_L} y1={baselineY} x2={SVG_W - PAD_R + 6} y2={baselineY} stroke="var(--hus-ink)" strokeWidth="1.5" />
          <text x={PAD_L + 4} y={PAD_T - 8} fill="var(--hus-ink)" fontSize="11" fontWeight="600">
            {curveSpec.yLabel} ({curveSpec.yUnit})
          </text>
          <text x={SVG_W - PAD_R} y={SVG_H - 6} textAnchor="end" fill="var(--hus-ink)" fontSize="11" fontWeight="600">
            {curveSpec.xLabel} ({curveSpec.xUnit})
          </text>

          {/* Shaded regions under segments (for v(t) or P(V)) */}
          {curveSpec.segments.map(seg => {
            const p0 = curveSpec.points[seg.fromIndex];
            const p1 = curveSpec.points[seg.toIndex];
            if (!p0 || !p1) return null;
            const x0 = mapX(p0.x);
            const y0 = mapY(p0.y);
            const x1 = mapX(p1.x);
            const y1 = mapY(p1.y);
            const isSelected = selectedIds.includes(seg.id);
            const isActive = activeSegmentId === seg.id;
            const polyPoints = `${x0},${baselineY} ${x0},${y0} ${x1},${y1} ${x1},${baselineY}`;
            const midX = (x0 + x1) / 2;
            const midY = (y0 + y1) / 2;

            return (
              <g key={seg.id} onClick={() => toggleSegment(seg.id)} className="cursor-pointer">
                {curveSpec.shadeUnderCurve ? (
                  <polygon
                    points={polyPoints}
                    fill={isSelected ? 'var(--hus-accent)' : isActive ? 'var(--hus-starlight)' : 'var(--hus-accent)'}
                    fillOpacity={isSelected ? 0.24 : isActive ? 0.14 : 0.06}
                    stroke={isSelected ? 'var(--hus-accent)' : 'none'}
                    strokeWidth="1"
                  />
                ) : null}
                <line
                  x1={x0}
                  y1={y0}
                  x2={x1}
                  y2={y1}
                  stroke={isSelected || isActive ? 'var(--hus-accent)' : 'var(--hus-ink)'}
                  strokeWidth={isSelected || isActive ? '3' : '2.25'}
                  markerMid={curveSpec.mode === 'sign-matrix' ? 'url(#curve-arrow)' : undefined}
                />
                {curveSpec.mode === 'sign-matrix' ? (
                  <line
                    x1={x0}
                    y1={y0}
                    x2={midX}
                    y2={midY}
                    stroke="transparent"
                    markerEnd="url(#curve-arrow)"
                  />
                ) : null}
                {seg.areaLabel ? (
                  <text
                    x={midX}
                    y={Math.min(baselineY - 8, (midY + baselineY) / 2 + 4)}
                    textAnchor="middle"
                    fill={isSelected ? 'var(--hus-accent)' : 'var(--hus-ink-secondary)'}
                    fontSize="10.5"
                    fontWeight="600"
                  >
                    {seg.areaLabel}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* State / vertex points */}
          {curveSpec.points.map((pt, idx) => {
            const cx = mapX(pt.x);
            const cy = mapY(pt.y);
            return (
              <g key={`pt-${idx}`}>
                <circle cx={cx} cy={cy} r="4.5" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="2" />
                {pt.label ? (
                  <text x={cx + 7} y={cy - 7} fill="var(--hus-ink)" fontSize="11.5" fontWeight="700">
                    {pt.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mode 1: Select regions / segments buttons (full keyboard support) */}
      {curveSpec.mode === 'select-regions' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {curveSpec.segments.map(seg => {
            const p0 = curveSpec.points[seg.fromIndex];
            const p1 = curveSpec.points[seg.toIndex];
            const area = p0 && p1 ? computeTrapezoidArea(p0.x, p0.y, p1.x, p1.y) : null;
            const isSelected = selectedIds.includes(seg.id);
            return (
              <button
                key={seg.id}
                type="button"
                data-segment={seg.id}
                aria-pressed={isSelected}
                onClick={() => toggleSegment(seg.id)}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-subtle font-semibold text-accent-ink'
                    : 'border-border bg-surface text-ink hover:border-border-strong'
                }`}
              >
                <span>{seg.label}</span>
                {area !== null ? (
                  <span className="font-mono tabular-nums text-ink-muted">S = {area}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Mode 2: Sign Matrix (e.g. ΔU, A, Q per P-V process) */}
      {curveSpec.mode === 'sign-matrix' && curveSpec.signRows && curveSpec.matrixColumns ? (
        <div className="space-y-2.5">
          {curveSpec.signRows.map(row => (
            <div
              key={row.segmentId}
              onMouseEnter={() => setActiveSegmentId(row.segmentId)}
              className={`space-y-2 rounded-[var(--radius-md)] border p-3 transition-colors ${
                activeSegmentId === row.segmentId
                  ? 'border-accent/60 bg-surface'
                  : 'border-border bg-surface/75'
              }`}
            >
              <p className="text-xs font-semibold text-ink">{row.label}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {curveSpec.matrixColumns?.map(col => {
                  const picked = signMatrix[row.segmentId]?.[col.id] ?? '';
                  return (
                    <div
                      key={col.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-canvas/70 px-2.5 py-1.5"
                    >
                      <span className="text-xs font-medium text-ink">
                        <Markdown inline>{`$${col.labelLatex}$`}</Markdown>
                      </span>
                      <div
                        role="group"
                        aria-label={`Dấu ${col.id} cho ${row.label}`}
                        className="flex gap-1"
                      >
                        {(['+', '-', '0'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            data-sign={`${row.segmentId}-${col.id}-${s}`}
                            aria-pressed={picked === s}
                            onClick={() => setSign(row.segmentId, col.id, s)}
                            className={`min-h-[36px] min-w-[34px] cursor-pointer rounded border font-mono text-xs font-semibold ${
                              picked === s
                                ? 'border-accent bg-accent-subtle text-accent-ink'
                                : 'border-border bg-surface text-ink'
                            }`}
                          >
                            {s === '-' ? '−' : s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra đồ thị
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Làm lại
        </button>
      </div>

      {/* Feedback */}
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
                ? curveSpec.regionRationale ?? 'Chính xác! Phân tích đồ thị và bảng dấu hoàn toàn khớp lý thuyết.'
                : `Đúng ${grade.matchedCount}/${grade.totalExpected} mục tiêu:`}
            </span>
          </div>
          {!grade.correct && grade.diagnostics.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-xs text-ink-secondary">
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
