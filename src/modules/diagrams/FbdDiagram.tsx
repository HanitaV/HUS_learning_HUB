import { useRef, useState, type PointerEvent } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { FbdBodySpec, FbdForceDef, FbdStepSpec } from '../../domain/semi-essay';
import {
  gradeFbdStep,
  normalizeAngle,
  snapAngle,
  type FbdDrawnArrow,
  type FbdStepGradeResult,
} from '../../core/learning/fbd';
import {
  isPlainObject,
  useInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

const SVG_SIZE = 280;
const CENTER = SVG_SIZE / 2;
const ARROW_LEN = 88;
const LABEL_LEN = 108;
const RIGID_BODY_RADIUS = 44;

function polarToSvg(
  angleDeg: number,
  radius: number,
  origin: { readonly x: number; readonly y: number } = { x: CENTER, y: CENTER },
): { readonly x: number; readonly y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + radius * Math.cos(rad),
    y: origin.y - radius * Math.sin(rad),
  };
}

function clampSvgLabel(pt: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  return {
    x: Math.min(Math.max(pt.x, 18), SVG_SIZE - 18),
    y: Math.min(Math.max(pt.y, 18), SVG_SIZE - 18),
  };
}

function resolveArrowOrigin(
  body: FbdBodySpec,
  forceType: string,
  explicitOffset?: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const isExtended = Boolean(body.extendedMode || body.pivot);
  if (!isExtended) return { x: CENTER, y: CENTER };
  const offset = explicitOffset ?? body.expected.find(e => e.type === forceType)?.applicationOffset;
  if (!offset) return { x: CENTER, y: CENTER };
  return { x: CENTER + offset.x, y: CENTER + offset.y };
}

function computeLeverArm(
  pivot: { readonly x: number; readonly y: number },
  origin: { readonly x: number; readonly y: number },
  angleDeg: number,
): {
  readonly hx: number;
  readonly hy: number;
  readonly ux: number;
  readonly uy: number;
  readonly t: number;
  readonly distance: number;
} {
  const rad = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const t = (pivot.x - origin.x) * ux + (pivot.y - origin.y) * uy;
  const hx = origin.x + t * ux;
  const hy = origin.y + t * uy;
  return {
    hx,
    hy,
    ux,
    uy,
    t,
    distance: Math.hypot(pivot.x - hx, pivot.y - hy),
  };
}

function forceShortText(def: FbdForceDef | undefined, fallback: string): string {
  if (!def) return fallback;
  return `${def.label}${def.subscript ?? ''}`;
}

function bodyMagnets(body: FbdBodySpec): readonly number[] {
  const base = [0, 90, 180, 270];
  if (body.surfaceAngle !== undefined) {
    const s = normalizeAngle(body.surfaceAngle);
    return [...base, s, normalizeAngle(s + 90), normalizeAngle(s + 180), normalizeAngle(s + 270)];
  }
  if (body.ropeAngle !== undefined) {
    const r = normalizeAngle(body.ropeAngle);
    return [...base, r, normalizeAngle(r + 180)];
  }
  return base;
}

function validateFbdDraft(
  raw: unknown,
  bodies: readonly FbdBodySpec[],
): Readonly<Record<string, readonly FbdDrawnArrow[]>> | null {
  if (!isPlainObject(raw)) return null;
  const out: Record<string, readonly FbdDrawnArrow[]> = {};
  for (const body of bodies) {
    const arr = raw[body.id];
    if (!Array.isArray(arr) || arr.length > 24) {
      out[body.id] = [];
      continue;
    }
    const validArrows: FbdDrawnArrow[] = [];
    for (const item of arr) {
      if (
        isPlainObject(item) &&
        typeof item.id === 'string' &&
        item.id.length <= 40 &&
        typeof item.type === 'string' &&
        item.type.length <= 40 &&
        typeof item.angle === 'number' &&
        Number.isFinite(item.angle)
      ) {
        validArrows.push({
          id: item.id,
          type: item.type,
          angle: normalizeAngle(item.angle),
        });
      }
    }
    out[body.id] = validArrows;
  }
  return out;
}

export default function FbdDiagram({
  spec,
  completed,
  hideSolutionOverlay = false,
  draftKey,
  onEvaluated,
}: DiagramRendererProps) {
  const fbdSpec = spec as FbdStepSpec;
  const [activeBodyId, setActiveBodyId] = useState(fbdSpec.bodies[0]?.id ?? '');
  const [drawnByBody, setDrawnByBody, resetDrawnByBody] = useInteractiveStepDraft<
    Readonly<Record<string, readonly FbdDrawnArrow[]>>
  >(
    draftKey,
    () => Object.fromEntries(fbdSpec.bodies.map(b => [b.id, []])),
    raw => validateFbdDraft(raw, fbdSpec.bodies),
  );
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [grade, setGrade] = useState<FbdStepGradeResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const nextIdRef = useRef(1);
  let maxPersistedSuffix = 0;
  for (const arrows of Object.values(drawnByBody)) {
    for (const arrow of arrows) {
      const match = /^arr-(\d+)$/.exec(arrow.id);
      if (match) {
        maxPersistedSuffix = Math.max(maxPersistedSuffix, Number(match[1]));
      }
    }
  }
  if (nextIdRef.current <= maxPersistedSuffix) {
    nextIdRef.current = maxPersistedSuffix + 1;
  }
  const draggingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activeBody = fbdSpec.bodies.find(b => b.id === activeBodyId) ?? fbdSpec.bodies[0];
  if (!activeBody) return null;

  const currentArrows = drawnByBody[activeBody.id] ?? [];
  const selectedArrow = currentArrows.find(a => a.id === selectedArrowId) ?? null;
  const magnets = bodyMagnets(activeBody);

  const updateBodyArrows = (bodyId: string, updater: (prev: readonly FbdDrawnArrow[]) => readonly FbdDrawnArrow[]) => {
    setDrawnByBody(prev => ({
      ...prev,
      [bodyId]: updater(prev[bodyId] ?? []),
    }));
    setGrade(null);
  };

  const addForce = (forceType: string) => {
    const id = `arr-${nextIdRef.current++}`;
    const defaultAngle = forceType === 'P' ? 270 : 90;
    updateBodyArrows(activeBody.id, prev => [...prev, { id, type: forceType, angle: defaultAngle }]);
    setSelectedArrowId(id);
  };

  const rotateArrow = (arrowId: string, delta: number) => {
    updateBodyArrows(activeBody.id, prev =>
      prev.map(a => (a.id === arrowId ? { ...a, angle: normalizeAngle(a.angle + delta) } : a)),
    );
  };

  const removeArrow = (arrowId: string) => {
    updateBodyArrows(activeBody.id, prev => prev.filter(a => a.id !== arrowId));
    if (selectedArrowId === arrowId) setSelectedArrowId(null);
  };

  const setAngleFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!selectedArrowId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const arrow = currentArrows.find(a => a.id === selectedArrowId);
    const origin = arrow ? resolveArrowOrigin(activeBody, arrow.type) : { x: CENTER, y: CENTER };
    const x = ((event.clientX - rect.left) / rect.width) * SVG_SIZE - origin.x;
    const y = origin.y - ((event.clientY - rect.top) / rect.height) * SVG_SIZE;
    if (Math.hypot(x, y) < 8) return;
    const rawDeg = (Math.atan2(y, x) * 180) / Math.PI;
    const snapped = snapAngle(rawDeg, 5, magnets);
    updateBodyArrows(activeBody.id, prev =>
      prev.map(a => (a.id === selectedArrowId ? { ...a, angle: snapped } : a)),
    );
  };

  const handleCheck = () => {
    const result = gradeFbdStep(drawnByBody, fbdSpec);
    setGrade(result);
    setAttempts(count => count + 1);
    onEvaluated({
      correct: result.correct,
      summary: result.correct
        ? 'Sơ đồ lực chính xác cho tất cả các vật.'
        : 'Sơ đồ lực còn điểm chưa khớp, xem chẩn đoán bên dưới.',
    });
  };

  const handleReset = () => {
    resetDrawnByBody();
    nextIdRef.current = 1;
    setSelectedArrowId(null);
    setGrade(null);
    setShowOverlay(false);
  };

  const surfaceRad = activeBody.surfaceAngle !== undefined ? (activeBody.surfaceAngle * Math.PI) / 180 : null;
  const ropeTip = activeBody.ropeAngle !== undefined ? polarToSvg(activeBody.ropeAngle, 122) : null;
  const isExtended = Boolean(activeBody.extendedMode || activeBody.pivot);
  const pivotSpec = activeBody.pivot;
  const pivotSvg = isExtended
    ? { x: CENTER + (pivotSpec?.x ?? 0), y: CENTER + (pivotSpec?.y ?? 0), label: pivotSpec?.label ?? 'O' }
    : null;
  const selectedOrigin = selectedArrow ? resolveArrowOrigin(activeBody, selectedArrow.type) : null;
  const selectedLeverArm =
    pivotSvg && selectedArrow && selectedOrigin
      ? computeLeverArm(pivotSvg, selectedOrigin, selectedArrow.angle)
      : null;

  return (
    <div className="space-y-4">
      {fbdSpec.note ? (
        <p className="text-sm text-ink-secondary">{fbdSpec.note}</p>
      ) : null}

      {/* Body selector tabs when multiple bodies exist */}
      {fbdSpec.bodies.length > 1 ? (
        <div role="tablist" aria-label="Chọn vật để vẽ sơ đồ lực" className="flex flex-wrap gap-2">
          {fbdSpec.bodies.map(body => {
            const isActive = body.id === activeBody.id;
            const count = (drawnByBody[body.id] ?? []).length;
            const bodyGrade = grade?.bodies.find(b => b.bodyId === body.id);
            return (
              <button
                key={body.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveBodyId(body.id);
                  setSelectedArrowId(null);
                }}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'border-accent bg-accent-subtle text-accent-ink'
                    : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
                }`}
              >
                <span>{body.label}</span>
                <span className="font-mono text-xs tabular-nums text-ink-muted">({count})</span>
                {bodyGrade?.correct ? <CheckCircleIcon width={14} height={14} className="text-success" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,300px)_1fr] md:items-start">
        {/* Interactive SVG Canvas */}
        <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            role="img"
            aria-label={`Sơ đồ lực của ${activeBody.label}`}
            onPointerDown={event => {
              if (!selectedArrowId) return;
              draggingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              setAngleFromPointer(event);
            }}
            onPointerMove={event => {
              if (draggingRef.current) setAngleFromPointer(event);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
            }}
            className={`aspect-square w-full max-w-[280px] touch-none select-none ${
              selectedArrowId ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <defs>
              <marker id="fbd-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--hus-accent)" />
              </marker>
              <marker id="fbd-arrow-idle" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--hus-ink)" />
              </marker>
              <marker id="fbd-arrow-expected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--hus-success)" />
              </marker>
            </defs>

            {/* Reference faint crosshair & angle ring */}
            <circle cx={CENTER} cy={CENTER} r={ARROW_LEN} fill="none" stroke="var(--hus-border)" strokeDasharray="3 4" />
            <line x1={18} y1={CENTER} x2={SVG_SIZE - 18} y2={CENTER} stroke="var(--hus-border)" strokeWidth="1" />
            <line x1={CENTER} y1={18} x2={CENTER} y2={SVG_SIZE - 18} stroke="var(--hus-border)" strokeWidth="1" />

            {/* Optional inclined surface line */}
            {surfaceRad !== null ? (
              <g>
                <line
                  x1={CENTER - 120 * Math.cos(surfaceRad)}
                  y1={CENTER + 120 * Math.sin(surfaceRad)}
                  x2={CENTER + 120 * Math.cos(surfaceRad)}
                  y2={CENTER - 120 * Math.sin(surfaceRad)}
                  stroke="var(--hus-border-strong)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text x={SVG_SIZE - 14} y={SVG_SIZE - 12} textAnchor="end" fill="var(--hus-ink-muted)" fontSize="11">
                  Dốc {activeBody.surfaceAngle}°
                </text>
              </g>
            ) : null}

            {/* Optional rope guideline */}
            {ropeTip ? (
              <line
                x1={CENTER}
                y1={CENTER}
                x2={ropeTip.x}
                y2={ropeTip.y}
                stroke="var(--hus-border-strong)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            ) : null}

            {/* Rigid-body outline when extended torque mode or pivot is active */}
            {isExtended ? (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RIGID_BODY_RADIUS}
                fill="var(--hus-surface)"
                fillOpacity="0.55"
                stroke="var(--hus-border-strong)"
                strokeWidth="1.75"
              />
            ) : null}

            {/* Compare overlay (expected arrows in dashed green) */}
            {showOverlay && !hideSolutionOverlay
              ? activeBody.expected.map((exp, idx) => {
                  const origin = resolveArrowOrigin(activeBody, exp.type, exp.applicationOffset);
                  const tip = polarToSvg(exp.angle, ARROW_LEN + 6, origin);
                  const lbl = clampSvgLabel(polarToSvg(exp.angle, LABEL_LEN + 8, origin));
                  const def = fbdSpec.forceCatalog[exp.type];
                  return (
                    <g key={`exp-${idx}`} opacity="0.85">
                      <line
                        x1={origin.x}
                        y1={origin.y}
                        x2={tip.x}
                        y2={tip.y}
                        stroke="var(--hus-success)"
                        strokeWidth="2"
                        strokeDasharray="5 3"
                        markerEnd="url(#fbd-arrow-expected)"
                      />
                      <text x={lbl.x} y={lbl.y + 4} textAnchor="middle" fill="var(--hus-success)" fontSize="12" fontWeight="600">
                        {forceShortText(def, exp.type)}
                      </text>
                    </g>
                  );
                })
              : null}

            {/* Subtle dashed lever-arm indicator from pivot to selected force line of action */}
            {pivotSvg && selectedOrigin && selectedLeverArm && selectedLeverArm.distance > 3 ? (
              <g opacity="0.85">
                {selectedLeverArm.t < 0 ? (
                  <line
                    x1={selectedOrigin.x}
                    y1={selectedOrigin.y}
                    x2={selectedLeverArm.hx}
                    y2={selectedLeverArm.hy}
                    stroke="var(--hus-border-strong)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                  />
                ) : selectedLeverArm.t > ARROW_LEN ? (
                  <line
                    x1={selectedOrigin.x + ARROW_LEN * selectedLeverArm.ux}
                    y1={selectedOrigin.y + ARROW_LEN * selectedLeverArm.uy}
                    x2={selectedLeverArm.hx}
                    y2={selectedLeverArm.hy}
                    stroke="var(--hus-border-strong)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                  />
                ) : null}
                <line
                  x1={pivotSvg.x}
                  y1={pivotSvg.y}
                  x2={selectedLeverArm.hx}
                  y2={selectedLeverArm.hy}
                  stroke="var(--hus-accent)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <circle cx={selectedLeverArm.hx} cy={selectedLeverArm.hy} r="2.5" fill="var(--hus-accent)" />
                <text
                  x={(pivotSvg.x + selectedLeverArm.hx) / 2 + 6}
                  y={(pivotSvg.y + selectedLeverArm.hy) / 2 - 4}
                  fill="var(--hus-accent)"
                  fontSize="10.5"
                  fontWeight="600"
                >
                  d
                </text>
              </g>
            ) : null}

            {/* Student-drawn force arrows */}
            {currentArrows.map(arrow => {
              const isSelected = arrow.id === selectedArrowId;
              const origin = resolveArrowOrigin(activeBody, arrow.type);
              const tip = polarToSvg(arrow.angle, ARROW_LEN, origin);
              const lbl = clampSvgLabel(polarToSvg(arrow.angle, LABEL_LEN, origin));
              const def = fbdSpec.forceCatalog[arrow.type];
              return (
                <g
                  key={arrow.id}
                  onPointerDown={event => {
                    event.stopPropagation();
                    setSelectedArrowId(arrow.id);
                    draggingRef.current = true;
                    svgRef.current?.setPointerCapture(event.pointerId);
                  }}
                  className="cursor-pointer"
                >
                  <line
                    x1={origin.x}
                    y1={origin.y}
                    x2={tip.x}
                    y2={tip.y}
                    stroke={isSelected ? 'var(--hus-accent)' : 'var(--hus-ink)'}
                    strokeWidth={isSelected ? '3' : '2.25'}
                    markerEnd={isSelected ? 'url(#fbd-arrow-active)' : 'url(#fbd-arrow-idle)'}
                  />
                  {isSelected ? (
                    <circle cx={tip.x} cy={tip.y} r="6" fill="var(--hus-accent)" fillOpacity="0.22" stroke="var(--hus-accent)" strokeWidth="1.5" />
                  ) : null}
                  <text
                    x={lbl.x}
                    y={lbl.y + 4}
                    textAnchor="middle"
                    fill={isSelected ? 'var(--hus-accent)' : 'var(--hus-ink)'}
                    fontSize="13"
                    fontWeight="600"
                  >
                    {def?.label ?? arrow.type}
                    {def?.subscript ? (
                      <tspan fontSize="9.5" dy="3">
                        {def.subscript}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            })}

            {/* Center mass dot */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={isExtended ? 5 : 7}
              fill="var(--hus-surface)"
              stroke="var(--hus-ink)"
              strokeWidth="2"
            />

            {/* Pivot point marker (O) for rigid-body torque mode */}
            {pivotSvg ? (
              <g>
                <circle cx={pivotSvg.x} cy={pivotSvg.y} r="5.5" fill="var(--hus-surface)" stroke="var(--hus-accent)" strokeWidth="2" />
                <circle cx={pivotSvg.x} cy={pivotSvg.y} r="2" fill="var(--hus-accent)" />
                <text
                  x={Math.min(pivotSvg.x + 8, SVG_SIZE - 16)}
                  y={Math.max(pivotSvg.y - 7, 16)}
                  fill="var(--hus-accent)"
                  fontSize="11.5"
                  fontWeight="700"
                >
                  {pivotSvg.label}
                </text>
              </g>
            ) : null}
          </svg>
          <p className="mt-2 text-center text-xs text-ink-muted">
            Chọn lực ở bảng bên cạnh, rồi kéo trên hình hoặc dùng nút xoay để chỉnh hướng (nấc 5°).
          </p>
          {isExtended && activeBody.leverArmHint ? (
            <p className="mt-1 text-center text-xs text-accent-ink">{activeBody.leverArmHint}</p>
          ) : null}
        </div>

        {/* Palette & Keyboard Controls */}
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Thêm lực tác dụng lên {activeBody.label}</p>
            <div role="group" aria-label={`Bảng lực cho ${activeBody.label}`} className="flex flex-wrap gap-2">
              {activeBody.palette.map(forceId => {
                const def = fbdSpec.forceCatalog[forceId];
                return (
                  <button
                    key={forceId}
                    type="button"
                    onClick={() => addForce(forceId)}
                    title={def?.name ?? forceId}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:border-accent hover:bg-accent-subtle hover:text-accent-ink"
                  >
                    <span className="font-mono font-semibold">
                      {def?.label ?? forceId}
                      {def?.subscript ? <sub className="text-[10px]">{def.subscript}</sub> : null}
                    </span>
                    <span className="text-xs text-ink-muted">{def?.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of placed arrows with keyboard angle adjustments */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-ink-muted">
              Các lực đã đặt trên {activeBody.label} ({currentArrows.length})
            </p>
            {currentArrows.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-subtle/50 px-3.5 py-3 text-xs text-ink-muted">
                Chưa có lực nào trên {activeBody.label}. Bấm một lực ở trên để thêm vào sơ đồ.
              </p>
            ) : (
              <ul className="space-y-2">
                {currentArrows.map(arrow => {
                  const def = fbdSpec.forceCatalog[arrow.type];
                  const isSelected = arrow.id === selectedArrow?.id;
                  return (
                    <li
                      key={arrow.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors ${
                        isSelected ? 'border-accent bg-accent-subtle/60' : 'border-border bg-surface'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedArrowId(arrow.id)}
                        className="flex min-h-[36px] cursor-pointer items-center gap-2 text-left font-medium text-ink"
                      >
                        <span className="font-mono font-semibold text-accent-ink">
                          {forceShortText(def, arrow.type)}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-ink-muted">{arrow.angle}°</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Xoay ${forceShortText(def, arrow.type)} trừ 15 độ`}
                          onClick={() => {
                            setSelectedArrowId(arrow.id);
                            rotateArrow(arrow.id, -15);
                          }}
                          className="min-h-[36px] min-w-[36px] cursor-pointer rounded border border-border bg-canvas px-2 font-mono text-xs text-ink hover:border-border-strong"
                        >
                          −15°
                        </button>
                        <button
                          type="button"
                          aria-label={`Xoay ${forceShortText(def, arrow.type)} trừ 5 độ`}
                          onClick={() => {
                            setSelectedArrowId(arrow.id);
                            rotateArrow(arrow.id, -5);
                          }}
                          className="min-h-[36px] min-w-[36px] cursor-pointer rounded border border-border bg-canvas px-2 font-mono text-xs text-ink hover:border-border-strong"
                        >
                          −5°
                        </button>
                        <button
                          type="button"
                          aria-label={`Xoay ${forceShortText(def, arrow.type)} cộng 5 độ`}
                          onClick={() => {
                            setSelectedArrowId(arrow.id);
                            rotateArrow(arrow.id, 5);
                          }}
                          className="min-h-[36px] min-w-[36px] cursor-pointer rounded border border-border bg-canvas px-2 font-mono text-xs text-ink hover:border-border-strong"
                        >
                          +5°
                        </button>
                        <button
                          type="button"
                          aria-label={`Xoay ${forceShortText(def, arrow.type)} cộng 15 độ`}
                          onClick={() => {
                            setSelectedArrowId(arrow.id);
                            rotateArrow(arrow.id, 15);
                          }}
                          className="min-h-[36px] min-w-[36px] cursor-pointer rounded border border-border bg-canvas px-2 font-mono text-xs text-ink hover:border-border-strong"
                        >
                          +15°
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa lực ${forceShortText(def, arrow.type)}`}
                          onClick={() => removeArrow(arrow.id)}
                          className="min-h-[36px] cursor-pointer rounded border border-border bg-canvas px-2.5 text-xs text-danger hover:border-danger/50"
                        >
                          Xóa
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra sơ đồ lực
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Vẽ lại
        </button>
        {!hideSolutionOverlay && (attempts >= 2 || completed) ? (
          <button
            type="button"
            onClick={() => setShowOverlay(open => !open)}
            aria-pressed={showOverlay}
            className="hus-btn hus-btn-secondary"
          >
            {showOverlay ? 'Ẩn sơ đồ chuẩn' : 'So sánh sơ đồ chuẩn'}
          </button>
        ) : null}
      </div>

      {/* Diagnostic feedback */}
      {grade ? (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
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
                ? 'Sơ đồ lực chính xác cho tất cả các vật. Bạn có thể chuyển sang bước chiếu trục.'
                : 'Chẩn đoán sơ đồ lực:'}
            </span>
          </div>
          {!grade.correct ? (
            <div className="space-y-2 pl-6 text-xs leading-relaxed text-ink-secondary">
              {grade.bodies.map(bodyRes => (
                <div key={bodyRes.bodyId} className="space-y-1">
                  <p className="font-semibold text-ink">
                    {bodyRes.bodyLabel} ({bodyRes.matchedCount}/{bodyRes.expectedCount} lực đúng)
                  </p>
                  {bodyRes.issues.length === 0 ? (
                    <p className="text-success">Đủ và đúng hướng tất cả các lực.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-4">
                      {bodyRes.issues.map((issue, i) => (
                        <li key={i}>{issue.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
