import { useEffect, useMemo, useState } from 'react';
import {
  buildExpectedMoFillSequence,
  computeMoMetrics,
  cycleMoSlotCount,
  EMPTY_MO_COUNTS,
  getMoLevelsInOrder,
  type MoLevelId,
  type MoOrdering,
  type MoSlotCounts,
  type MoSlotId,
} from '../../core/chemistry/essay-engine';
import { Badge } from '../../components/ui/Badge';
import { RotateCcwIcon } from '../../components/ui/Icons';
export interface MoProblemConfig {
  readonly kind?: 'mo-diagram' | undefined;
  readonly speciesLabel: string;
  readonly atomLeft: string;
  readonly atomRight: string;
  readonly expectedOrdering: MoOrdering;
  readonly expectedTotalElectrons: number;
  readonly expectedBondOrder: number;
  readonly expectedMagnetism: 'paramagnetic' | 'diamagnetic';
  readonly note?: string | undefined;
}

export interface MoDiagramCanvasProps {
  readonly config: MoProblemConfig;
  readonly ordering: MoOrdering;
  readonly counts: MoSlotCounts;
  readonly highlightSlotIds?: readonly MoSlotId[];
  readonly shakeSlotIds?: readonly MoSlotId[];
  readonly onOrderingChange: (ordering: MoOrdering) => void;
  readonly onCountsChange: (counts: MoSlotCounts) => void;
}

/** Row vertical positions inside the 420x366 SVG coordinate space (row 0 = bottom, row 5 = top). */
const ROW_Y: readonly number[] = [318, 266, 212, 160, 106, 54];

function OrbitalPhasePreview({ levelId }: { readonly levelId: MoLevelId }) {
  const isBonding = levelId === 's2s' || levelId === 's2p' || levelId === 'p2p';
  return (
    <svg
      viewBox="0 0 132 66"
      className="h-16 w-[132px] shrink-0 rounded-[var(--radius-sm)] border border-border bg-canvas/80"
      aria-hidden="true"
    >
      {/* Internuclear axis */}
      <line
        x1="12"
        y1="36"
        x2="120"
        y2="36"
        stroke="var(--hus-border-strong)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {levelId === 's2s' ? (
        <>
          <ellipse cx="66" cy="36" rx="40" ry="16" fill="var(--hus-accent)" fillOpacity="0.22" stroke="var(--hus-accent)" strokeWidth="1.5" />
          <circle cx="46" cy="36" r="2.8" fill="var(--hus-ink)" />
          <circle cx="86" cy="36" r="2.8" fill="var(--hus-ink)" />
        </>
      ) : null}
      {levelId === 's2s_star' ? (
        <>
          <ellipse cx="38" cy="36" rx="18" ry="15" fill="var(--hus-accent)" fillOpacity="0.2" stroke="var(--hus-accent)" strokeWidth="1.5" />
          <ellipse cx="94" cy="36" rx="18" ry="15" fill="var(--hus-starlight)" fillOpacity="0.22" stroke="var(--hus-starlight)" strokeWidth="1.5" />
          <line x1="66" y1="15" x2="66" y2="57" stroke="var(--hus-danger)" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx="42" cy="36" r="2.8" fill="var(--hus-ink)" />
          <circle cx="90" cy="36" r="2.8" fill="var(--hus-ink)" />
        </>
      ) : null}
      {levelId === 's2p' ? (
        <>
          <ellipse cx="26" cy="36" rx="10" ry="9" fill="var(--hus-starlight)" fillOpacity="0.18" stroke="var(--hus-starlight)" strokeWidth="1.3" />
          <ellipse cx="66" cy="36" rx="26" ry="13" fill="var(--hus-accent)" fillOpacity="0.25" stroke="var(--hus-accent)" strokeWidth="1.5" />
          <ellipse cx="106" cy="36" rx="10" ry="9" fill="var(--hus-starlight)" fillOpacity="0.18" stroke="var(--hus-starlight)" strokeWidth="1.3" />
          <circle cx="44" cy="36" r="2.8" fill="var(--hus-ink)" />
          <circle cx="88" cy="36" r="2.8" fill="var(--hus-ink)" />
        </>
      ) : null}
      {levelId === 's2p_star' ? (
        <>
          <ellipse cx="26" cy="36" rx="12" ry="11" fill="var(--hus-accent)" fillOpacity="0.2" stroke="var(--hus-accent)" strokeWidth="1.4" />
          <ellipse cx="52" cy="36" rx="9" ry="8" fill="var(--hus-starlight)" fillOpacity="0.22" stroke="var(--hus-starlight)" strokeWidth="1.3" />
          <ellipse cx="80" cy="36" rx="9" ry="8" fill="var(--hus-accent)" fillOpacity="0.2" stroke="var(--hus-accent)" strokeWidth="1.3" />
          <ellipse cx="106" cy="36" rx="12" ry="11" fill="var(--hus-starlight)" fillOpacity="0.22" stroke="var(--hus-starlight)" strokeWidth="1.4" />
          <line x1="66" y1="14" x2="66" y2="58" stroke="var(--hus-danger)" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx="40" cy="36" r="2.6" fill="var(--hus-ink)" />
          <circle cx="92" cy="36" r="2.6" fill="var(--hus-ink)" />
        </>
      ) : null}
      {levelId === 'p2p' ? (
        <>
          <path d="M 38 30 C 48 14, 84 14, 94 30 Z" fill="var(--hus-accent)" fillOpacity="0.24" stroke="var(--hus-accent)" strokeWidth="1.5" />
          <path d="M 38 42 C 48 58, 84 58, 94 42 Z" fill="var(--hus-starlight)" fillOpacity="0.2" stroke="var(--hus-starlight)" strokeWidth="1.5" />
          <circle cx="46" cy="36" r="2.8" fill="var(--hus-ink)" />
          <circle cx="86" cy="36" r="2.8" fill="var(--hus-ink)" />
        </>
      ) : null}
      {levelId === 'p2p_star' ? (
        <>
          <ellipse cx="44" cy="24" rx="12" ry="9" fill="var(--hus-accent)" fillOpacity="0.22" stroke="var(--hus-accent)" strokeWidth="1.4" />
          <ellipse cx="44" cy="48" rx="12" ry="9" fill="var(--hus-starlight)" fillOpacity="0.22" stroke="var(--hus-starlight)" strokeWidth="1.4" />
          <ellipse cx="88" cy="24" rx="12" ry="9" fill="var(--hus-starlight)" fillOpacity="0.22" stroke="var(--hus-starlight)" strokeWidth="1.4" />
          <ellipse cx="88" cy="48" rx="12" ry="9" fill="var(--hus-accent)" fillOpacity="0.22" stroke="var(--hus-accent)" strokeWidth="1.4" />
          <line x1="66" y1="14" x2="66" y2="58" stroke="var(--hus-danger)" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx="44" cy="36" r="2.6" fill="var(--hus-ink)" />
          <circle cx="88" cy="36" r="2.6" fill="var(--hus-ink)" />
        </>
      ) : null}
      <text
        x="6"
        y="11"
        fontSize="8"
        fontWeight="600"
        fill={isBonding ? 'var(--hus-accent)' : 'var(--hus-starlight)'}
      >
        {isBonding ? 'Cùng pha' : 'Ngược pha'}
      </text>
    </svg>
  );
}

export function MoDiagramCanvas({
  config,
  ordering,
  counts,
  highlightSlotIds = [],
  shakeSlotIds = [],
  onOrderingChange,
  onCountsChange,
}: MoDiagramCanvasProps) {
  const [inspectedLevelId, setInspectedLevelId] = useState<MoLevelId>('p2p_star');
  const [boScanActive, setBoScanActive] = useState(false);

  // Guided animation state
  const [guidePlaying, setGuidePlaying] = useState(false);
  const [guideStepIdx, setGuideStepIdx] = useState<number>(-1);

  const levels = useMemo(() => getMoLevelsInOrder(ordering), [ordering]);
  const metrics = useMemo(() => computeMoMetrics(counts, ordering), [counts, ordering]);

  const guideSequence = useMemo(
    () => buildExpectedMoFillSequence(config.expectedOrdering, config.expectedTotalElectrons),
    [config.expectedOrdering, config.expectedTotalElectrons],
  );

  // Reset guide when problem changes
  useEffect(() => {
    setGuidePlaying(false);
    setGuideStepIdx(-1);
    setBoScanActive(false);
  }, [config.speciesLabel, config.expectedTotalElectrons]);

  // Auto-advance guided animation playback
  useEffect(() => {
    if (!guidePlaying) return;
    if (guideStepIdx >= guideSequence.length - 1) {
      setGuidePlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const nextIdx = guideStepIdx + 1;
      const step = guideSequence[nextIdx];
      if (!step) return;
      if (ordering !== config.expectedOrdering) {
        onOrderingChange(config.expectedOrdering);
      }
      setGuideStepIdx(nextIdx);
      setInspectedLevelId(step.levelId);
      onCountsChange(step.countsAfter);
    }, 680);
    return () => window.clearTimeout(timer);
  }, [
    guidePlaying,
    guideStepIdx,
    guideSequence,
    ordering,
    config.expectedOrdering,
    onOrderingChange,
    onCountsChange,
  ]);

  const activeGuideStep = guideStepIdx >= 0 ? guideSequence[guideStepIdx] : null;

  const startGuidedAnimation = () => {
    setBoScanActive(false);
    if (ordering !== config.expectedOrdering) {
      onOrderingChange(config.expectedOrdering);
    }
    if (guideStepIdx >= guideSequence.length - 1 || guideStepIdx < 0) {
      onCountsChange(EMPTY_MO_COUNTS);
      setGuideStepIdx(-1);
    }
    setGuidePlaying(true);
  };

  const stepGuidedOnce = () => {
    setGuidePlaying(false);
    setBoScanActive(false);
    if (ordering !== config.expectedOrdering) {
      onOrderingChange(config.expectedOrdering);
    }
    const nextIdx = guideStepIdx + 1;
    if (nextIdx >= guideSequence.length) {
      onCountsChange(EMPTY_MO_COUNTS);
      setGuideStepIdx(-1);
      return;
    }
    const step = guideSequence[nextIdx];
    if (step) {
      setGuideStepIdx(nextIdx);
      setInspectedLevelId(step.levelId);
      onCountsChange(step.countsAfter);
    }
  };

  const handleSlotClick = (slotId: MoSlotId, levelId: MoLevelId) => {
    setGuidePlaying(false);
    setGuideStepIdx(-1);
    setInspectedLevelId(levelId);
    const nextCount = cycleMoSlotCount(counts[slotId]);
    onCountsChange({
      ...counts,
      [slotId]: nextCount,
    });
  };

  const handleReset = () => {
    setGuidePlaying(false);
    setGuideStepIdx(-1);
    setBoScanActive(false);
    onCountsChange(EMPTY_MO_COUNTS);
  };

  const inspectedLevel = levels.find(l => l.id === inspectedLevelId) ?? levels[0];
  const s2pY = ROW_Y[ordering === 'type-1' ? 2 : 3] ?? 198;
  const p2pY = ROW_Y[ordering === 'type-1' ? 3 : 2] ?? 144;

  return (
    <div className="space-y-3.5">
      {/* Top toolbar: Ordering toggle (Type I / Type II) + Guided Animation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-subtle p-0.5"
          role="group"
          aria-label="Chọn thứ tự mức năng lượng MO"
        >
          <button
            type="button"
            onClick={() => {
              setGuidePlaying(false);
              onOrderingChange('type-1');
            }}
            aria-pressed={ordering === 'type-1'}
            className={`min-h-[34px] rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
              ordering === 'type-1'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Loại I (σ2p &lt; π2p)
          </button>
          <button
            type="button"
            onClick={() => {
              setGuidePlaying(false);
              onOrderingChange('type-2');
            }}
            aria-pressed={ordering === 'type-2'}
            className={`min-h-[34px] rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
              ordering === 'type-2'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Loại II (π2p &lt; σ2p)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={guidePlaying ? () => setGuidePlaying(false) : startGuidedAnimation}
            className="hus-btn hus-btn-primary min-h-[34px] px-3 py-1 text-xs"
          >
            {guidePlaying ? 'Tạm dừng' : 'Xem hướng dẫn động'}
          </button>
          <button
            type="button"
            onClick={stepGuidedOnce}
            className="hus-btn hus-btn-secondary min-h-[34px] px-2.5 py-1 text-xs"
            title="Điền từng electron một để quan sát quy tắc"
          >
            +1 bước
          </button>
          <button
            type="button"
            onClick={() => setBoScanActive(v => !v)}
            aria-pressed={boScanActive}
            className={`hus-btn min-h-[34px] px-2.5 py-1 text-xs ${
              boScanActive
                ? 'border border-accent bg-accent-subtle text-accent-ink'
                : 'hus-btn-secondary'
            }`}
          >
            Quét BO
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Xóa tất cả electron trên giản đồ MO"
            className="hus-btn hus-btn-ghost min-h-[34px] px-2 py-1 text-xs"
          >
            <RotateCcwIcon width={13} height={13} />
          </button>
        </div>
      </div>

      {/* Live guided rule caption during animation */}
      {activeGuideStep ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-accent/30 bg-accent-subtle/75 px-3 py-2 text-xs text-ink"
        >
          <Badge tone={activeGuideStep.rule === 'hund' ? 'warning' : 'accent'}>
            {activeGuideStep.rule === 'aufbau'
              ? 'Aufbau'
              : activeGuideStep.rule === 'hund'
                ? 'Quy tắc Hund'
                : 'Pauli'}
          </Badge>
          <span className="leading-relaxed">
            <strong className="font-mono tabular-nums">
              [{activeGuideStep.stepIndex}/{guideSequence.length}]
            </strong>{' '}
            {activeGuideStep.explanation}
          </span>
        </div>
      ) : null}

      {/* Interactive AO–MO–AO SVG Diagram */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-canvas/90 p-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-ink-muted">
          <span>Nhấn trực tiếp vào từng ô orbital để thêm ↑ / ↑↓ / xóa</span>
          <span className="font-mono tabular-nums text-ink-secondary">
            {ordering === 'type-1' ? 'Loại I: σ2p < π2p' : 'Loại II: π2p < σ2p'}
          </span>
        </div>
        <svg
          viewBox="0 0 420 366"
          className="mx-auto h-auto max-h-[395px] w-full select-none"
          role="img"
          aria-label={`Giản đồ MO hóa trị của ${config.speciesLabel}`}
        >
          {/* Vertical Energy Axis */}
          <defs>
            <marker
              id="mo-energy-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 10 L 5 0 L 10 10 z" fill="var(--hus-ink-muted)" />
            </marker>
          </defs>
          <line
            x1="22"
            y1="334"
            x2="22"
            y2="20"
            stroke="var(--hus-ink-muted)"
            strokeWidth="1.3"
            markerEnd="url(#mo-energy-arrow)"
          />
          <text x="10" y="16" fontSize="11" fontWeight="600" fill="var(--hus-ink-muted)">
            E
          </text>

          {/* Column Headers */}
          <text x="76" y="18" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--hus-ink-secondary)">
            AO: {config.atomLeft}
          </text>
          <text x="216" y="18" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--hus-accent)">
            MO: {config.speciesLabel}
          </text>
          <text x="364" y="18" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--hus-ink-secondary)">
            AO: {config.atomRight}
          </text>

          {/* Static AO reference bars (2s and 2p) on Left & Right */}
          {/* AO 2s */}
          <line x1="50" y1="282" x2="86" y2="282" stroke="var(--hus-border-strong)" strokeWidth="2.2" strokeLinecap="round" />
          <text x="68" y="297" textAnchor="middle" fontSize="10" fill="var(--hus-ink-muted)">
            2s
          </text>
          <line x1="346" y1="282" x2="382" y2="282" stroke="var(--hus-border-strong)" strokeWidth="2.2" strokeLinecap="round" />
          <text x="364" y="297" textAnchor="middle" fontSize="10" fill="var(--hus-ink-muted)">
            2s
          </text>

          {/* AO 2p (3 bars) */}
          {[0, 1, 2].map(i => (
            <g key={i}>
              <line
                x1={38 + i * 22}
                y1="118"
                x2={54 + i * 22}
                y2="118"
                stroke="var(--hus-border-strong)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line
                x1={334 + i * 22}
                y1="118"
                x2={350 + i * 22}
                y2="118"
                stroke="var(--hus-border-strong)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          ))}
          <text x="68" y="133" textAnchor="middle" fontSize="10" fill="var(--hus-ink-muted)">
            2p
          </text>
          <text x="364" y="133" textAnchor="middle" fontSize="10" fill="var(--hus-ink-muted)">
            2p
          </text>

          {/* Dynamic correlation dashed lines from AO 2s & 2p to MO levels */}
          <g stroke="var(--hus-border-strong)" strokeWidth="1" strokeDasharray="3 3" opacity="0.72">
            {/* 2s to s2s & s2s* */}
            <line x1="86" y1="282" x2="184" y2={ROW_Y[0]} />
            <line x1="86" y1="282" x2="184" y2={ROW_Y[1]} />
            <line x1="346" y1="282" x2="248" y2={ROW_Y[0]} />
            <line x1="346" y1="282" x2="248" y2={ROW_Y[1]} />

            {/* 2p to s2p, p2p, p2p*, s2p* (dynamically tracks Type I / Type II swap!) */}
            <line x1="100" y1="118" x2="184" y2={s2pY} className="hus-mo-corr-line" />
            <line x1="100" y1="118" x2="152" y2={p2pY} className="hus-mo-corr-line" />
            <line x1="100" y1="118" x2="152" y2={ROW_Y[4]} />
            <line x1="100" y1="118" x2="184" y2={ROW_Y[5]} />

            <line x1="332" y1="118" x2="248" y2={s2pY} className="hus-mo-corr-line" />
            <line x1="332" y1="118" x2="280" y2={p2pY} className="hus-mo-corr-line" />
            <line x1="332" y1="118" x2="280" y2={ROW_Y[4]} />
            <line x1="332" y1="118" x2="248" y2={ROW_Y[5]} />
          </g>

          {/* MO Energy Levels with smooth FLIP translateY transitions */}
          {levels.map(level => {
            const y = ROW_Y[level.energyRow] ?? 180;
            const isDegenerate = level.slots.length === 2;
            const isInspected = inspectedLevelId === level.id;
            const isHundStepHere =
              activeGuideStep?.levelId === level.id && activeGuideStep.rule === 'hund';

            const scanStroke = boScanActive
              ? level.bonding
                ? 'var(--hus-accent)'
                : 'var(--hus-starlight)'
              : isInspected
                ? 'var(--hus-accent)'
                : 'var(--hus-ink)';

            return (
              <g
                key={level.id}
                className="hus-mo-level-group"
                style={{ transform: `translate3d(0, ${y}px, 0)` }}
                onMouseEnter={() => setInspectedLevelId(level.id)}
              >
                {/* Hund horizontal bridge glow between degenerate pair */}
                {isDegenerate && isHundStepHere ? (
                  <line
                    x1="184"
                    y1="0"
                    x2="248"
                    y2="0"
                    stroke="var(--hus-starlight)"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                    className="hus-mo-hund-bridge"
                  />
                ) : null}

                {/* Level label on right of center column */}
                <text
                  x={isDegenerate ? 286 : 254}
                  y="4"
                  fontSize="11"
                  fontWeight={isInspected || boScanActive ? '700' : '500'}
                  fill={
                    boScanActive
                      ? level.bonding
                        ? 'var(--hus-accent)'
                        : 'var(--hus-starlight)'
                      : isInspected
                        ? 'var(--hus-accent)'
                        : 'var(--hus-ink-secondary)'
                  }
                >
                  {level.label}
                </text>

                {/* Interactive Orbital Slots */}
                {level.slots.map((slotId, slotIdx) => {
                  const cx = isDegenerate ? (slotIdx === 0 ? 182 : 250) : 216;
                  const count = counts[slotId];
                  const isHighlighted = highlightSlotIds.includes(slotId);
                  const isShaking = shakeSlotIds.includes(slotId);
                  const isJustFilled = activeGuideStep?.slotId === slotId;
                  const isUnpairedScan = boScanActive && count === 1;

                  return (
                    <g
                      key={slotId}
                      transform={`translate(${cx}, 0)`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Orbital ${level.label}${isDegenerate ? ` số ${slotIdx + 1}` : ''}, hiện có ${count} electron. Nhấn để thêm hoặc xóa electron.`}
                      onClick={() => handleSlotClick(slotId, level.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSlotClick(slotId, level.id);
                        }
                      }}
                      onFocus={() => setInspectedLevelId(level.id)}
                      className={`cursor-pointer focus:outline-none ${isShaking ? 'hus-mo-shake' : ''}`}
                    >
                      {/* Clear clickable orbital slot pill (obvious affordance on mouse & touch) */}
                      <rect
                        x="-26"
                        y="-24"
                        width="52"
                        height="30"
                        rx="7"
                        fill={
                          isHighlighted
                            ? 'var(--hus-starlight)'
                            : isJustFilled
                              ? 'var(--hus-accent)'
                              : count > 0
                                ? 'var(--hus-accent)'
                                : 'var(--hus-surface)'
                        }
                        fillOpacity={
                          isHighlighted ? 0.18 : isJustFilled ? 0.16 : count > 0 ? 0.06 : 0.72
                        }
                        stroke={
                          isHighlighted
                            ? 'var(--hus-starlight)'
                            : isJustFilled
                              ? 'var(--hus-accent)'
                              : count > 0
                                ? 'var(--hus-border-strong)'
                                : 'var(--hus-border)'
                        }
                        strokeWidth={isHighlighted || isJustFilled ? 1.6 : 1}
                        strokeDasharray={count === 0 && !isHighlighted ? '3 2' : undefined}
                        className={isHighlighted ? 'hus-mo-hint-pulse' : ''}
                      />

                      {/* Orbital bar */}
                      <line
                        x1="-22"
                        y1="0"
                        x2="22"
                        y2="0"
                        stroke={scanStroke}
                        strokeWidth={isInspected || boScanActive ? 2.8 : 2.2}
                        strokeLinecap="round"
                      />

                      {/* Unpaired electron ring during BO & Magnetism scan */}
                      {isUnpairedScan ? (
                        <circle
                          cx="0"
                          cy="-10"
                          r="13"
                          fill="none"
                          stroke="var(--hus-starlight)"
                          strokeWidth="1.6"
                          strokeDasharray="3 2"
                          className="hus-mo-hint-pulse"
                        />
                      ) : null}

                      {/* Electron 1: Spin Up ↑ */}
                      {count >= 1 ? (
                        <g
                          className="hus-mo-electron-in"
                          transform={count === 2 ? 'translate(-6, 0)' : 'translate(0, 0)'}
                        >
                          <line
                            x1="0"
                            y1="-2"
                            x2="0"
                            y2="-19"
                            stroke="var(--hus-accent)"
                            strokeWidth="2.1"
                            strokeLinecap="round"
                          />
                          <polyline
                            points="-4,-14 0,-20 4,-14"
                            fill="none"
                            stroke="var(--hus-accent)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      ) : null}

                      {/* Electron 2: Spin Down ↓ */}
                      {count === 2 ? (
                        <g className="hus-mo-electron-in" transform="translate(6, 0)">
                          <line
                            x1="0"
                            y1="-19"
                            x2="0"
                            y2="-2"
                            stroke="var(--hus-starlight)"
                            strokeWidth="2.1"
                            strokeLinecap="round"
                          />
                          <polyline
                            points="-4,-7 0,-1 4,-7"
                            fill="none"
                            stroke="var(--hus-starlight)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live telemetry bar: Electron count, BO, Magnetism */}
      <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-md)] border border-border bg-surface-subtle/70 px-3 py-2 text-xs">
        <div>
          <span className="text-ink-muted">Đã điền</span>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
            {metrics.totalElectrons}/{config.expectedTotalElectrons} e
          </p>
        </div>
        <div>
          <span className="text-ink-muted">Bậc liên kết (BO)</span>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-accent">
            {metrics.bondOrder.toString().replace('.', ',')}
          </p>
        </div>
        <div>
          <span className="text-ink-muted">Từ tính</span>
          <p className="mt-0.5 font-medium text-ink">
            {metrics.totalElectrons === 0
              ? '—'
              : metrics.magnetism === 'paramagnetic'
                ? `Thuận từ (${metrics.unpairedElectrons} e)`
                : 'Nghịch từ'}
          </p>
        </div>
      </div>

      {/* Dual-Coding Orbital Phase Shape Card (OpenStax / LibreTexts best practice) */}
      {inspectedLevel ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5">
          <OrbitalPhasePreview levelId={inspectedLevel.id} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono font-semibold text-ink">{inspectedLevel.label}</span>
              <Badge tone={inspectedLevel.bonding ? 'accent' : 'warning'}>
                {inspectedLevel.subLabel}
              </Badge>
            </div>
            <p className="mt-1 leading-relaxed text-ink-secondary">
              {inspectedLevel.phaseSummary}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
