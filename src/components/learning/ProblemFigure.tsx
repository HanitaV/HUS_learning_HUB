import { useId, type ReactElement } from 'react';
import type {
  PhysicsSchematicFigureSpec,
  PhysicsSchematicScene,
  Plot2dFigureSpec,
  Plot2dPathSpec,
  Plot2dPoint,
  ProblemFigureSpec,
} from '../../domain/problem-figure';
import Markdown from './Markdown';

const SVG_W = 360;
const SVG_H = 220;

const PLOT_PAD_L = 44;
const PLOT_PAD_R = 26;
const PLOT_PAD_T = 24;
const PLOT_PAD_B = 34;
const PLOT_W = SVG_W - PLOT_PAD_L - PLOT_PAD_R;
const PLOT_H = SVG_H - PLOT_PAD_T - PLOT_PAD_B;

type Tone = NonNullable<Plot2dPathSpec['tone']>;

function toneColor(tone: Tone | undefined): string {
  switch (tone) {
    case 'ink':
      return 'var(--hus-ink)';
    case 'warning':
      return 'var(--hus-warning)';
    case 'success':
      return 'var(--hus-success)';
    case 'accent':
    default:
      return 'var(--hus-accent)';
  }
}

interface Point2D {
  readonly x: number;
  readonly y: number;
}

interface CubicSeg {
  readonly p1: Point2D;
  readonly c1: Point2D;
  readonly c2: Point2D;
  readonly p2: Point2D;
}

function buildCubicSegments(pts: readonly Point2D[], closed: boolean): readonly CubicSeg[] {
  const n = pts.length;
  if (n < 2) return [];
  const segCount = closed ? n : n - 1;
  const segs: CubicSeg[] = [];

  for (let i = 0; i < segCount; i += 1) {
    const p0 = closed ? pts[(i - 1 + n) % n]! : pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = closed ? pts[(i + 2) % n]! : pts[Math.min(n - 1, i + 2)]!;
    segs.push({
      p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    });
  }
  return segs;
}

function formatSvgNum(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function buildPathD(pts: readonly Point2D[], smooth: boolean, closed: boolean): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  if (pts.length === 1) return `M ${formatSvgNum(first.x)} ${formatSvgNum(first.y)}`;

  if (!smooth) {
    const body = pts
      .slice(1)
      .map(p => `L ${formatSvgNum(p.x)} ${formatSvgNum(p.y)}`)
      .join(' ');
    return `M ${formatSvgNum(first.x)} ${formatSvgNum(first.y)} ${body}${closed ? ' Z' : ''}`;
  }

  const segs = buildCubicSegments(pts, closed);
  const commands = segs.map(
    s =>
      `C ${formatSvgNum(s.c1.x)} ${formatSvgNum(s.c1.y)} ${formatSvgNum(s.c2.x)} ${formatSvgNum(s.c2.y)} ${formatSvgNum(s.p2.x)} ${formatSvgNum(s.p2.y)}`,
  );
  return `M ${formatSvgNum(first.x)} ${formatSvgNum(first.y)} ${commands.join(' ')}${closed ? ' Z' : ''}`;
}

interface ArrowPlacement {
  readonly x: number;
  readonly y: number;
  readonly deg: number;
}

function computeArrowPlacements(
  pts: readonly Point2D[],
  smooth: boolean,
  closed: boolean,
): readonly ArrowPlacement[] {
  const n = pts.length;
  if (n < 2) return [];

  if (!smooth) {
    const segCount = closed ? n : n - 1;
    const arrows: ArrowPlacement[] = [];
    for (let i = 0; i < segCount; i += 1) {
      const a = pts[i]!;
      const b = pts[(i + 1) % n]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.hypot(dx, dy) < 12) continue;
      arrows.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        deg: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
    return arrows;
  }

  const segs = buildCubicSegments(pts, closed);
  if (segs.length === 0) return [];

  const targetIndices = closed
    ? segs.length >= 4
      ? [1, Math.floor(segs.length / 2) + 1].filter(idx => idx < segs.length)
      : [0]
    : [Math.floor(segs.length / 2)];

  return targetIndices.map(idx => {
    const s = segs[idx]!;
    // Cubic Bezier evaluated at t = 0.5
    const x = (s.p1.x + 3 * s.c1.x + 3 * s.c2.x + s.p2.x) / 8;
    const y = (s.p1.y + 3 * s.c1.y + 3 * s.c2.y + s.p2.y) / 8;
    const dx = 0.75 * (s.c1.x - s.p1.x + 2 * (s.c2.x - s.c1.x) + (s.p2.x - s.c2.x));
    const dy = 0.75 * (s.c1.y - s.p1.y + 2 * (s.c2.y - s.c1.y) + (s.p2.y - s.c2.y));
    return {
      x,
      y,
      deg: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });
}

function computeLabelPosition(pts: readonly Point2D[], closed: boolean): Point2D {
  if (pts.length === 0) return { x: SVG_W / 2, y: SVG_H / 2 };
  if (closed) {
    const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  }
  if (pts.length === 2) {
    const a = pts[0]!;
    const b = pts[1]!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 10 };
  }
  const mid = pts[Math.floor(pts.length / 2)]!;
  return { x: mid.x + 10, y: mid.y - 10 };
}

function Plot2dGraphic({ spec, uid }: { readonly spec: Plot2dFigureSpec; readonly uid: string }) {
  const xMin = spec.xMin ?? 0;
  const yMin = spec.yMin ?? 0;
  const xSpan = Math.max(1e-6, spec.xMax - xMin);
  const ySpan = Math.max(1e-6, spec.yMax - yMin);

  const mapX = (x: number) => PLOT_PAD_L + ((x - xMin) / xSpan) * PLOT_W;
  const mapY = (y: number) => PLOT_PAD_T + PLOT_H - ((y - yMin) / ySpan) * PLOT_H;
  const baselineY = mapY(yMin);

  const gridFractions = [0.25, 0.5, 0.75];

  // Collect deduplicated markers: explicit spec.markers first, then labeled path points.
  const markerMap = new Map<string, Plot2dPoint>();
  for (const pt of spec.markers ?? []) {
    markerMap.set(`${pt.x}:${pt.y}`, pt);
  }
  for (const p of spec.paths) {
    for (const pt of p.points) {
      if (!pt.label) continue;
      const key = `${pt.x}:${pt.y}`;
      if (!markerMap.has(key)) {
        markerMap.set(key, pt);
      }
    }
  }
  const renderedMarkers = [...markerMap.values()];

  return (
    <>
      <defs>
        <marker
          id={`${uid}-axis`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-ink)" />
        </marker>
      </defs>

      {/* Subtle background grid */}
      {gridFractions.map(f => {
        const gx = PLOT_PAD_L + f * PLOT_W;
        const gy = PLOT_PAD_T + f * PLOT_H;
        return (
          <g key={`grid-${f}`}>
            <line
              x1={gx}
              y1={PLOT_PAD_T}
              x2={gx}
              y2={baselineY}
              stroke="var(--hus-border)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
            <line
              x1={PLOT_PAD_L}
              y1={gy}
              x2={PLOT_PAD_L + PLOT_W}
              y2={gy}
              stroke="var(--hus-border)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
          </g>
        );
      })}

      {/* Coordinate axes */}
      <line
        x1={PLOT_PAD_L}
        y1={baselineY}
        x2={PLOT_PAD_L}
        y2={PLOT_PAD_T - 10}
        stroke="var(--hus-ink)"
        strokeWidth="1.6"
        markerEnd={`url(#${uid}-axis)`}
      />
      <line
        x1={PLOT_PAD_L}
        y1={baselineY}
        x2={PLOT_PAD_L + PLOT_W + 10}
        y2={baselineY}
        stroke="var(--hus-ink)"
        strokeWidth="1.6"
        markerEnd={`url(#${uid}-axis)`}
      />
      <text x={PLOT_PAD_L - 10} y={baselineY + 14} textAnchor="end" fill="var(--hus-ink-muted)" fontSize="11">
        O
      </text>
      <text
        x={PLOT_PAD_L - 10}
        y={PLOT_PAD_T - 4}
        textAnchor="end"
        fill="var(--hus-ink)"
        fontSize="13"
        fontWeight="600"
        fontStyle="italic"
      >
        {spec.yLabel}
      </text>
      <text
        x={PLOT_PAD_L + PLOT_W + 10}
        y={baselineY + 16}
        textAnchor="end"
        fill="var(--hus-ink)"
        fontSize="13"
        fontWeight="600"
        fontStyle="italic"
      >
        {spec.xLabel}
      </text>

      {/* Shaded regions first */}
      {spec.paths.map(path => {
        const mapped = path.points.map(pt => ({ x: mapX(pt.x), y: mapY(pt.y) }));
        if (mapped.length < 2) return null;
        const color = toneColor(path.tone);
        const d = buildPathD(mapped, Boolean(path.smooth), Boolean(path.closed));

        if (path.shadeClosed && path.closed) {
          return <path key={`shade-${path.id}`} d={d} fill={color} fillOpacity="0.12" stroke="none" />;
        }
        if (path.shadeUnder) {
          const first = mapped[0]!;
          const last = mapped[mapped.length - 1]!;
          const underD = `${buildPathD(mapped, Boolean(path.smooth), false)} L ${formatSvgNum(last.x)} ${formatSvgNum(baselineY)} L ${formatSvgNum(first.x)} ${formatSvgNum(baselineY)} Z`;
          return <path key={`shade-${path.id}`} d={underD} fill={color} fillOpacity="0.12" stroke="none" />;
        }
        return null;
      })}

      {/* Paths, directional arrows, and path labels */}
      {spec.paths.map(path => {
        const mapped = path.points.map(pt => ({ x: mapX(pt.x), y: mapY(pt.y) }));
        if (mapped.length < 2) return null;
        const color = toneColor(path.tone);
        const smooth = Boolean(path.smooth);
        const closed = Boolean(path.closed);
        const d = buildPathD(mapped, smooth, closed);
        const arrows = path.showArrow ? computeArrowPlacements(mapped, smooth, closed) : [];
        const labelPos = path.label ? computeLabelPosition(mapped, closed) : null;

        return (
          <g key={path.id}>
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={path.dashed ? '5 4' : undefined}
            />
            {arrows.map((arrow, idx) => (
              <polygon
                key={`${path.id}-arr-${idx}`}
                points="5,0 -4,-3.6 -2.2,0 -4,3.6"
                transform={`translate(${formatSvgNum(arrow.x)} ${formatSvgNum(arrow.y)}) rotate(${formatSvgNum(arrow.deg)})`}
                fill={color}
              />
            ))}
            {path.label && labelPos ? (
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                fill={color}
                fontSize="12"
                fontWeight="600"
                paintOrder="stroke"
                stroke="var(--hus-surface)"
                strokeWidth="3.5"
                strokeLinejoin="round"
              >
                {path.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Point markers */}
      {renderedMarkers.map((pt, idx) => {
        const cx = mapX(pt.x);
        const cy = mapY(pt.y);
        const dx = pt.labelOffset?.dx ?? 0;
        const dy = pt.labelOffset?.dy ?? -10;
        return (
          <g key={`mk-${pt.x}-${pt.y}-${idx}`}>
            <circle cx={cx} cy={cy} r="3.6" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
            {pt.label ? (
              <text
                x={cx + dx}
                y={cy + dy}
                textAnchor="middle"
                fill="var(--hus-ink)"
                fontSize="12"
                fontWeight="600"
                paintOrder="stroke"
                stroke="var(--hus-surface)"
                strokeWidth="3"
                strokeLinejoin="round"
              >
                {pt.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function SharedSchematicDefs({ uid }: { readonly uid: string }) {
  return (
    <defs>
      <marker id={`${uid}-vec-ink`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-ink)" />
      </marker>
      <marker
        id={`${uid}-vec-accent`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-accent)" />
      </marker>
      <marker
        id={`${uid}-vec-warning`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-warning)" />
      </marker>
      <marker
        id={`${uid}-vec-success`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-success)" />
      </marker>
      <pattern id={`${uid}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="var(--hus-border-strong)" strokeWidth="1.4" />
      </pattern>
    </defs>
  );
}

function lbl(spec: PhysicsSchematicFigureSpec, key: string, fallback: string): string {
  return spec.labels?.[key] ?? fallback;
}

function SvgLabel({
  x,
  y,
  children,
  fill = 'var(--hus-ink)',
  size = 12,
  anchor = 'middle',
  italic = false,
  bold = true,
}: {
  readonly x: number;
  readonly y: number;
  readonly children: string;
  readonly fill?: string;
  readonly size?: number;
  readonly anchor?: 'start' | 'middle' | 'end';
  readonly italic?: boolean;
  readonly bold?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={fill}
      fontSize={size}
      fontWeight={bold ? '600' : '500'}
      fontStyle={italic ? 'italic' : undefined}
      paintOrder="stroke"
      stroke="var(--hus-surface)"
      strokeWidth="3"
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

function renderProjectileCurvature(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Ground line */}
      <line x1="30" y1="186" x2="334" y2="186" stroke="var(--hus-ink)" strokeWidth="1.8" />
      {/* Parabolic trajectory: peak at (180, 56) */}
      <path
        d="M 52 186 Q 180 -74 308 186"
        fill="none"
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        strokeDasharray="5 4"
      />
      {/* Launch velocity v0 tangent at A */}
      <line
        x1="52"
        y1="186"
        x2="96"
        y2="94"
        stroke="var(--hus-accent)"
        strokeWidth="2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <path d="M 80 186 A 28 28 0 0 0 65 160" fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={88} y={172} size={11.5} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>
      <SvgLabel x={96} y={88} fill="var(--hus-accent)" italic>
        {lbl(spec, 'v0', 'v₀')}
      </SvgLabel>

      {/* Peak B */}
      <circle cx="180" cy="56" r="4" fill="var(--hus-ink)" />
      <line
        x1="180"
        y1="56"
        x2="232"
        y2="56"
        stroke="var(--hus-accent)"
        strokeWidth="1.9"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <line
        x1="180"
        y1="56"
        x2="180"
        y2="100"
        stroke="var(--hus-warning)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <path d="M 152 62 A 44 44 0 0 1 208 62" fill="none" stroke="var(--hus-border-strong)" strokeDasharray="3 3" strokeWidth="1.3" />
      <SvgLabel x={180} y={42}>{lbl(spec, 'peak', 'B')}</SvgLabel>
      <SvgLabel x={236} y={48} fill="var(--hus-accent)" size={11} italic>
        v₀cosα
      </SvgLabel>
      <SvgLabel x={193} y={96} fill="var(--hus-warning)" size={11.5} italic>
        g
      </SvgLabel>
      <SvgLabel x={144} y={78} fill="var(--hus-ink-secondary)" size={11} italic>
        {lbl(spec, 'rb', 'R_B')}
      </SvgLabel>

      {/* Landing point C */}
      <circle cx="52" cy="186" r="3.5" fill="var(--hus-ink)" />
      <SvgLabel x={40} y={182}>A</SvgLabel>

      <circle cx="308" cy="186" r="4" fill="var(--hus-ink)" />
      <line
        x1="308"
        y1="186"
        x2="336"
        y2="128"
        stroke="var(--hus-ink-muted)"
        strokeDasharray="3 3"
        strokeWidth="1.2"
      />
      <line
        x1="308"
        y1="142"
        x2="308"
        y2="186"
        stroke="var(--hus-warning)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <SvgLabel x={300} y={148} fill="var(--hus-warning)" size={11.5} italic>
        g
      </SvgLabel>
      <SvgLabel x={312} y={204}>{lbl(spec, 'land', 'C')}</SvgLabel>
      <SvgLabel x={338} y={124} fill="var(--hus-ink-secondary)" size={11} italic>
        {lbl(spec, 'rc', 'R_C')}
      </SvgLabel>
    </>
  );
}

function renderRoughInclineLaunch(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  // Ramp from (54, 184) to (296, 184) to (296, 56) -> angle ~ 27.9 deg
  const x0 = 54;
  const y0 = 184;
  const x1 = 296;
  const y1 = 56;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // negative
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;

  // Block center at t = 0.36 along slope, offset outward by 12px along normal
  const bx = x0 + dx * 0.36;
  const by = y0 + dy * 0.36;

  return (
    <>
      {/* Ground and wedge */}
      <line x1="30" y1={y0} x2="330" y2={y0} stroke="var(--hus-ink)" strokeWidth="1.6" />
      <polygon
        points={`${x0},${y0} ${x1},${y0} ${x1},${y1}`}
        fill={`url(#${uid}-hatch)`}
        fillOpacity="0.22"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Angle arc */}
      <path d={`M ${x0 + 42} ${y0} A 42 42 0 0 0 ${x0 + 37} ${y0 - 20}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={x0 + 54} y={y0 - 10} size={11.5} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>

      {/* Block on incline */}
      <g transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`}>
        <rect
          x="-18"
          y="-24"
          width="36"
          height="24"
          rx="2"
          fill="var(--hus-surface)"
          stroke="var(--hus-ink)"
          strokeWidth="1.8"
        />
        <text x="0" y="-8" textAnchor="middle" fill="var(--hus-ink)" fontSize="12" fontWeight="600" fontStyle="italic">
          {lbl(spec, 'mass', 'm')}
        </text>
      </g>

      {/* Initial velocity vector v0 up the incline */}
      <line
        x1={(bx + 18 * ux + 12 * uy).toFixed(1)}
        y1={(by + 18 * uy - 12 * ux).toFixed(1)}
        x2={(bx + 76 * ux + 12 * uy).toFixed(1)}
        y2={(by + 76 * uy - 12 * ux).toFixed(1)}
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel
        x={bx + 62 * ux + 24 * uy}
        y={by + 62 * uy - 24 * ux}
        fill="var(--hus-accent)"
        italic
      >
        {lbl(spec, 'v0', 'v₀')}
      </SvgLabel>

      {/* Friction & optional distance label */}
      <SvgLabel x={225} y={114} fill="var(--hus-ink-secondary)" size={11.5} italic>
        {lbl(spec, 'mu', 'μ')}
      </SvgLabel>
      {spec.labels?.distance ? (
        <>
          <line
            x1={(bx - 6 * ux - 20 * uy).toFixed(1)}
            y1={(by - 6 * uy + 20 * ux).toFixed(1)}
            x2={(x1 - 24 * ux - 20 * uy).toFixed(1)}
            y2={(y1 - 24 * uy + 20 * ux).toFixed(1)}
            stroke="var(--hus-ink-muted)"
            strokeDasharray="4 3"
            strokeWidth="1.3"
          />
          <SvgLabel x={212} y={142} fill="var(--hus-ink-secondary)" size={11.5} italic>
            {spec.labels.distance}
          </SvgLabel>
        </>
      ) : null}
    </>
  );
}

function renderInclinePulley(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  // Wedge: (42, 186) -> (242, 186) -> (242, 70) -> 30 deg
  const x0 = 42;
  const y0 = 186;
  const x1 = 242;
  const y1 = 70;
  const px = 250;
  const py = 56;
  const r = 12;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const bx = x0 + dx * 0.44;
  const by = y0 + dy * 0.44;

  return (
    <>
      <line x1="24" y1={y0} x2="328" y2={y0} stroke="var(--hus-ink)" strokeWidth="1.6" />
      <polygon
        points={`${x0},${y0} ${x1},${y0} ${x1},${y1}`}
        fill={`url(#${uid}-hatch)`}
        fillOpacity="0.2"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d={`M ${x0 + 40} ${y0} A 40 40 0 0 0 ${x0 + 35} ${y0 - 20}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={x0 + 54} y={y0 - 9} size={11} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>

      {/* Pulley mount & pulley */}
      <line x1={x1} y1={y1} x2={px} y2={py} stroke="var(--hus-ink)" strokeWidth="2.4" />
      <circle cx={px} cy={py} r={r} fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <circle cx={px} cy={py} r="2.4" fill="var(--hus-ink)" />

      {/* Rope from block A to pulley and down to block B */}
      <line x1="142" y1="115" x2={px - 6} y2={py - 10} stroke="var(--hus-accent)" strokeWidth="1.8" />
      <line x1={px + r} y1={py} x2={px + r} y2="124" stroke="var(--hus-accent)" strokeWidth="1.8" />

      {/* Block A on incline */}
      <g transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`}>
        <rect
          x="-20"
          y="-24"
          width="40"
          height="24"
          rx="2"
          fill="var(--hus-surface)"
          stroke="var(--hus-ink)"
          strokeWidth="1.8"
        />
        <text x="0" y="-8" textAnchor="middle" fill="var(--hus-ink)" fontSize="11.5" fontWeight="600">
          {lbl(spec, 'massA', 'A (m₁)')}
        </text>
      </g>

      {/* Hanging Block B */}
      <rect
        x={px + r - 17}
        y="124"
        width="34"
        height="30"
        rx="2"
        fill="var(--hus-surface)"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
      />
      <SvgLabel x={px + r + 38} y={143} size={11.5}>
        {lbl(spec, 'massB', 'B (m₂)')}
      </SvgLabel>

      <SvgLabel x={198} y={114} fill="var(--hus-ink-secondary)" size={11} italic>
        {lbl(spec, 'mu', 'μ')}
      </SvgLabel>
    </>
  );
}

function renderConicalPendulum(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Ceiling */}
      <line x1="120" y1="24" x2="240" y2="24" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />
      {/* Vertical axis */}
      <line x1="180" y1="24" x2="180" y2="196" stroke="var(--hus-border-strong)" strokeDasharray="5 4" strokeWidth="1.4" />
      {/* Horizontal circular orbit */}
      <ellipse
        cx="180"
        cy="158"
        rx="88"
        ry="24"
        fill="none"
        stroke="var(--hus-accent)"
        strokeDasharray="4 4"
        strokeWidth="1.5"
      />
      {/* Radius line */}
      <line x1="180" y1="158" x2="268" y2="158" stroke="var(--hus-ink-muted)" strokeDasharray="3 3" strokeWidth="1.3" />
      {/* String & bob */}
      <line x1="180" y1="24" x2="268" y2="158" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx="268" cy="158" r="9" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.6" />
      {/* Orbital motion arrow at front of ellipse */}
      <path
        d="M 142 180 Q 180 185 216 180"
        fill="none"
        stroke="var(--hus-accent)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      {/* Angle arc */}
      <path d="M 180 64 A 40 40 0 0 0 202 58" fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={194} y={79} size={12} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>
      <SvgLabel x={166} y={20} size={11.5}>O</SvgLabel>
      <SvgLabel x={235} y={88} italic>
        {lbl(spec, 'length', 'ℓ')}
      </SvgLabel>
      <SvgLabel x={222} y={152} fill="var(--hus-ink-secondary)" size={11.5} italic>
        {lbl(spec, 'radius', 'r')}
      </SvgLabel>
      <SvgLabel x={286} y={162} italic>
        {lbl(spec, 'mass', 'm')}
      </SvgLabel>
    </>
  );
}

function renderSimplePendulum(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      <line x1="125" y1="24" x2="235" y2="24" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />
      {/* Equilibrium vertical line and ghost bob */}
      <line x1="180" y1="24" x2="180" y2="184" stroke="var(--hus-border-strong)" strokeDasharray="5 4" strokeWidth="1.4" />
      <circle
        cx="180"
        cy="170"
        r="8.5"
        fill="var(--hus-surface)"
        stroke="var(--hus-border-strong)"
        strokeDasharray="3 3"
        strokeWidth="1.4"
      />
      {/* Swing arc */}
      <path d="M 142 165 A 146 146 0 0 0 236 159" fill="none" stroke="var(--hus-border-strong)" strokeDasharray="4 4" strokeWidth="1.3" />
      {/* Displaced string & bob */}
      <line x1="180" y1="24" x2="236" y2="159" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx="236" cy="159" r="9.5" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.6" />
      {/* Angle arc */}
      <path d="M 180 68 A 44 44 0 0 0 197 65" fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      {/* Gravity reference */}
      <line
        x1="88"
        y1="74"
        x2="88"
        y2="122"
        stroke="var(--hus-warning)"
        strokeWidth="2"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <SvgLabel x={75} y={102} fill="var(--hus-warning)" italic>
        {lbl(spec, 'g', 'g')}
      </SvgLabel>
      <SvgLabel x={193} y={84} size={11.5} italic>
        {lbl(spec, 'angle', 'θ')}
      </SvgLabel>
      <SvgLabel x={218} y={86} italic>
        {lbl(spec, 'length', 'l')}
      </SvgLabel>
      <SvgLabel x={256} y={163} italic>
        {lbl(spec, 'mass', 'm')}
      </SvgLabel>
    </>
  );
}

function renderBallisticPendulum(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      <line x1="145" y1="22" x2="265" y2="22" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />
      {/* Vertical equilibrium string & sandbag */}
      <line x1="205" y1="22" x2="205" y2="156" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <rect x="187" y="156" width="36" height="32" rx="3" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <SvgLabel x={205} y={176} italic>
        {lbl(spec, 'block', 'M')}
      </SvgLabel>

      {/* Incoming bullet */}
      <rect x="62" y="167" width="16" height="9" rx="4" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      <line
        x1="84"
        y1="171.5"
        x2="138"
        y2="171.5"
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={70} y={157} italic>
        {lbl(spec, 'bullet', 'm')}
      </SvgLabel>
      <SvgLabel x={112} y={161} fill="var(--hus-accent)" italic>
        {lbl(spec, 'v0', 'v')}
      </SvgLabel>

      {/* Swung position (dashed) */}
      <line x1="205" y1="22" x2="285" y2="136" stroke="var(--hus-ink-muted)" strokeDasharray="5 4" strokeWidth="1.6" />
      <g transform="translate(285 136) rotate(-35)">
        <rect
          x="-18"
          y="0"
          width="36"
          height="32"
          rx="3"
          fill="var(--hus-surface)"
          fillOpacity="0.8"
          stroke="var(--hus-ink-muted)"
          strokeDasharray="4 3"
          strokeWidth="1.6"
        />
      </g>
      <path d="M 205 172 A 150 150 0 0 0 293 148" fill="none" stroke="var(--hus-border-strong)" strokeDasharray="3 3" strokeWidth="1.3" />
      <path d="M 205 64 A 42 42 0 0 0 229 56" fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />

      <SvgLabel x={222} y={78} size={11.5} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>
      <SvgLabel x={194} y={96} italic>
        {lbl(spec, 'length', 'ℓ')}
      </SvgLabel>
      <SvgLabel x={305} y={136} fill="var(--hus-ink-secondary)" size={11}>
        M+m
      </SvgLabel>
    </>
  );
}

function renderVerticalLoopTrack(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  const cx = 236;
  const cy = 128;
  const r = 56;
  const bottomY = cy + r; // 184
  // Detachment point at theta = 42 deg clockwise from upward vertical
  const thetaRad = (42 * Math.PI) / 180;
  const dx = cx + r * Math.sin(thetaRad);
  const dy = cy - r * Math.cos(thetaRad);

  return (
    <>
      {/* Baseline */}
      <line x1="24" y1={bottomY} x2="332" y2={bottomY} stroke="var(--hus-ink)" strokeWidth="1.5" />
      {/* Ramp entering bottom of loop */}
      <path
        d={`M 42 48 C 78 130 112 ${bottomY} 236 ${bottomY}`}
        fill="none"
        stroke="var(--hus-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Circular loop */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hus-ink)" strokeWidth="2.2" />

      {/* Release height H / H' */}
      <circle cx="46" cy="56" r="5" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      <line x1="46" y1="56" x2="46" y2={bottomY} stroke="var(--hus-border-strong)" strokeDasharray="4 3" strokeWidth="1.3" />
      <SvgLabel x={32} y={122} fill="var(--hus-ink-secondary)" size={11.5} italic>
        {lbl(spec, 'height', "H, H'")}
      </SvgLabel>

      {/* Loop center, radius R, angle theta, detachment point */}
      <circle cx={cx} cy={cy} r="2.5" fill="var(--hus-ink)" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - r} stroke="var(--hus-border-strong)" strokeDasharray="3 3" strokeWidth="1.3" />
      <line x1={cx} y1={cy} x2={dx} y2={dy} stroke="var(--hus-accent)" strokeWidth="1.7" />
      <path d={`M ${cx} ${cy - 24} A 24 24 0 0 1 ${cx + 16} ${cy - 18}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.3" />
      <circle cx={dx} cy={dy} r="5.5" fill="var(--hus-warning)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      {/* Normal arrow / detachment height h' */}
      <line x1={dx} y1={dy} x2="314" y2={dy} stroke="var(--hus-border-strong)" strokeDasharray="3 3" strokeWidth="1.2" />
      <line
        x1="310"
        y1={bottomY}
        x2="310"
        y2={dy}
        stroke="var(--hus-ink-muted)"
        strokeWidth="1.4"
        markerEnd={`url(#${uid}-vec-ink)`}
      />
      <SvgLabel x={250} y={96} size={11} italic>
        {lbl(spec, 'angle', 'θ')}
      </SvgLabel>
      <SvgLabel x={222} y={154} size={11.5} italic>
        {lbl(spec, 'radius', 'R')}
      </SvgLabel>
      <SvgLabel x={324} y={(bottomY + dy) / 2 + 4} fill="var(--hus-ink-secondary)" size={11.5} italic>
        {lbl(spec, 'detachHeight', "h'")}
      </SvgLabel>
    </>
  );
}

function renderOrthogonalScattering(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  const ox = 148;
  const oy = 114;

  return (
    <>
      {/* Axes */}
      <line x1="36" y1={oy} x2="316" y2={oy} stroke="var(--hus-border-strong)" strokeDasharray="4 4" strokeWidth="1.3" />
      <line x1={ox} y1="196" x2={ox} y2="24" stroke="var(--hus-border-strong)" strokeDasharray="4 4" strokeWidth="1.3" />

      {/* Right angle symbol at O */}
      <polyline points={`${ox + 12},${oy} ${ox + 12},${oy - 12} ${ox},${oy - 12}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.3" />

      {/* Incoming neutron */}
      <circle cx="58" cy={oy} r="6.5" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.5" />
      <line
        x1="68"
        y1={oy}
        x2="132"
        y2={oy}
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={58} y={oy - 14} size={11.5}>
        {lbl(spec, 'projectile', 'n (m)')}
      </SvgLabel>
      <SvgLabel x={100} y={oy - 10} fill="var(--hus-accent)" italic>
        {lbl(spec, 'vIn', 'v')}
      </SvgLabel>

      {/* Target Carbon at O */}
      <circle cx={ox} cy={oy} r="10" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="2" />
      <SvgLabel x={ox - 36} y={oy + 24} size={11}>
        {lbl(spec, 'target', 'C (M = 12m)')}
      </SvgLabel>

      {/* Scattered neutron along +y (90 deg) */}
      <line
        x1={ox}
        y1={oy - 12}
        x2={ox}
        y2="40"
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <circle cx={ox} cy="34" r="5.5" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      <SvgLabel x={ox + 14} y={58} fill="var(--hus-accent)" italic>
        {lbl(spec, 'vOut', 'u')}
      </SvgLabel>

      {/* Recoil carbon into IV quadrant */}
      <line
        x1={ox + 8}
        y1={oy + 8}
        x2="256"
        y2="176"
        stroke="var(--hus-warning)"
        strokeWidth="2.3"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <circle cx="264" cy="181" r="9" fill="var(--hus-warning)" fillOpacity="0.25" stroke="var(--hus-warning)" strokeWidth="1.8" />
      <SvgLabel x={224} y={142} fill="var(--hus-warning)" italic>
        {lbl(spec, 'recoil', 'P')}
      </SvgLabel>
    </>
  );
}

function renderRollingCylinderIncline(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  // Slope rising left to right: (48, 186) -> (302, 186) -> (302, 46)
  const x0 = 48;
  const y0 = 186;
  const x1 = 302;
  const y1 = 46;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Normal pointing up-left: (uy, -ux) -> since uy < 0, wait: slope goes (+dx, -|dy|), so normal up-left is (uy, -ux) = (-0.48, -0.87)
  const nx = uy;
  const ny = -ux;

  const r = 24;
  // Contact point at t = 0.65 up the slope
  const tx = x0 + dx * 0.65;
  const ty = y0 + dy * 0.65;
  const cx = tx + nx * r;
  const cy = ty + ny * r;

  return (
    <>
      <line x1="26" y1={y0} x2="332" y2={y0} stroke="var(--hus-ink)" strokeWidth="1.6" />
      <polygon
        points={`${x0},${y0} ${x1},${y0} ${x1},${y1}`}
        fill={`url(#${uid}-hatch)`}
        fillOpacity="0.2"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d={`M ${x0 + 42} ${y0} A 42 42 0 0 0 ${x0 + 37} ${y0 - 20}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={x0 + 56} y={y0 - 9} size={11} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>

      {/* Solid cylinder */}
      <circle cx={cx} cy={cy} r={r} fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r - 4} fill="var(--hus-accent)" fillOpacity="0.1" stroke="none" />
      <circle cx={cx} cy={cy} r="2.6" fill="var(--hus-ink)" />
      {/* Radius spoke */}
      <line x1={cx} y1={cy} x2={cx + r * 0.72} y2={cy - r * 0.52} stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      {/* Counter-clockwise rolling arrow around cylinder */}
      <path
        d={`M ${cx + 12} ${cy - r - 8} A ${r + 8} ${r + 8} 0 0 0 ${cx - r - 8} ${cy + 4}`}
        fill="none"
        stroke="var(--hus-accent)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      {/* Down-slope motion vector */}
      <line
        x1={(cx - 28 * ux).toFixed(1)}
        y1={(cy - 28 * uy).toFixed(1)}
        x2={(cx - 88 * ux).toFixed(1)}
        y2={(cy - 88 * uy).toFixed(1)}
        stroke="var(--hus-accent)"
        strokeWidth="2.1"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={cx + 2} y={cy - r - 14} size={11.5}>
        {lbl(spec, 'mass', 'm, R')}
      </SvgLabel>
      <SvgLabel x={cx - 64 * ux - 14} y={cy - 64 * uy - 12} fill="var(--hus-accent)" size={11.5} italic>
        {lbl(spec, 'distance', 'S')}
      </SvgLabel>
    </>
  );
}

function renderCoaxialDisksClutch(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Central axis */}
      <line x1="180" y1="22" x2="180" y2="202" stroke="var(--hus-ink-secondary)" strokeWidth="2.4" />

      {/* Lower disk (I2, omega2) */}
      <path d="M 102 150 L 102 162 A 78 20 0 0 0 258 162 L 258 150 Z" fill="var(--hus-border)" stroke="var(--hus-ink)" strokeWidth="1.6" />
      <ellipse cx="180" cy="150" rx="78" ry="20" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <line x1="180" y1="130" x2="180" y2="152" stroke="var(--hus-ink-secondary)" strokeWidth="2" />

      {/* Drop arrows */}
      <line x1="140" y1="100" x2="140" y2="124" stroke="var(--hus-ink-muted)" strokeDasharray="3 3" strokeWidth="1.5" markerEnd={`url(#${uid}-vec-ink)`} />
      <line x1="220" y1="100" x2="220" y2="124" stroke="var(--hus-ink-muted)" strokeDasharray="3 3" strokeWidth="1.5" markerEnd={`url(#${uid}-vec-ink)`} />

      {/* Upper disk (I1, omega1) */}
      <path d="M 114 68 L 114 78 A 66 17 0 0 0 246 78 L 246 68 Z" fill="var(--hus-accent)" fillOpacity="0.18" stroke="var(--hus-ink)" strokeWidth="1.6" />
      <ellipse cx="180" cy="68" rx="66" ry="17" fill="var(--hus-surface)" stroke="var(--hus-accent)" strokeWidth="1.8" />
      <line x1="180" y1="22" x2="180" y2="70" stroke="var(--hus-ink-secondary)" strokeWidth="2.4" />

      {/* Rotation arrows */}
      <path d="M 148 34 A 34 10 0 1 1 212 34" fill="none" stroke="var(--hus-accent)" strokeWidth="1.8" markerEnd={`url(#${uid}-vec-accent)`} />
      <path d="M 136 184 A 46 12 0 0 0 224 184" fill="none" stroke="var(--hus-warning)" strokeWidth="1.8" markerEnd={`url(#${uid}-vec-warning)`} />

      <SvgLabel x={282} y={74} fill="var(--hus-accent)">{lbl(spec, 'top', 'I₁, ω₁')}</SvgLabel>
      <SvgLabel x={288} y={156}>{lbl(spec, 'bottom', 'I₂, ω₂')}</SvgLabel>
      <SvgLabel x={180} y={208} fill="var(--hus-ink-secondary)" size={11}>
        {`→ ${lbl(spec, 'final', 'ω')}`}
      </SvgLabel>
    </>
  );
}

function renderKeplerEllipse(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  const cx = 180;
  const cy = 110;
  const rx = 122;
  const ry = 76;
  const focusX = 85; // ~ 180 - sqrt(122^2 - 76^2) = 180 - 95.4 = 84.6
  const periX = cx - rx; // 58
  const aphX = cx + rx; // 302

  return (
    <>
      {/* Major axis */}
      <line x1={periX - 10} y1={cy} x2={aphX + 10} y2={cy} stroke="var(--hus-border-strong)" strokeDasharray="4 4" strokeWidth="1.3" />
      {/* Ellipse orbit */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="var(--hus-ink)" strokeWidth="1.8" />
      {/* Star at focus F */}
      <circle cx={focusX} cy={cy} r="13" fill="var(--hus-warning)" fillOpacity="0.22" />
      <circle cx={focusX} cy={cy} r="7.5" fill="var(--hus-warning)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      <SvgLabel x={focusX} y={cy - 18} size={11.5}>
        {`${lbl(spec, 'star', 'M')} (${lbl(spec, 'focus', 'F')})`}
      </SvgLabel>

      {/* Planet at perihelion P (fast) */}
      <circle cx={periX} cy={cy} r="5.5" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      <line
        x1={periX}
        y1={cy}
        x2={periX}
        y2={cy - 54}
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={periX - 16} y={cy + 4}>{lbl(spec, 'perihelion', 'P')}</SvgLabel>
      <SvgLabel x={periX - 16} y={cy - 36} fill="var(--hus-accent)" italic>
        {lbl(spec, 'vp', 'v_P')}
      </SvgLabel>

      {/* Planet at aphelion A (slow) */}
      <circle cx={aphX} cy={cy} r="5.5" fill="var(--hus-accent)" stroke="var(--hus-ink)" strokeWidth="1.4" />
      <line
        x1={aphX}
        y1={cy}
        x2={aphX}
        y2={cy + 30}
        stroke="var(--hus-accent)"
        strokeWidth="2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={aphX + 16} y={cy + 4}>{lbl(spec, 'aphelion', 'A')}</SvgLabel>
      <SvgLabel x={aphX + 18} y={cy + 28} fill="var(--hus-accent)" italic>
        {lbl(spec, 'va', 'v_A')}
      </SvgLabel>

      {/* Distances r_min and r_max */}
      <SvgLabel x={(periX + focusX) / 2} y={cy + 18} fill="var(--hus-ink-secondary)" size={10.5} italic>
        {lbl(spec, 'rMin', 'r_min')}
      </SvgLabel>
      <SvgLabel x={(focusX + aphX) / 2 + 12} y={cy + 18} fill="var(--hus-ink-secondary)" size={10.5} italic>
        {lbl(spec, 'rMax', 'r_max')}
      </SvgLabel>
    </>
  );
}

function renderFreeExpansionChamber(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  const gasDots: readonly Point2D[] = [
    { x: 74, y: 74 },
    { x: 98, y: 66 },
    { x: 122, y: 82 },
    { x: 146, y: 68 },
    { x: 82, y: 104 },
    { x: 112, y: 112 },
    { x: 138, y: 102 },
    { x: 76, y: 138 },
    { x: 104, y: 144 },
    { x: 134, y: 134 },
    { x: 152, y: 146 },
  ];

  return (
    <>
      {/* Adiabatic outer shell */}
      <rect
        x="48"
        y="46"
        width="264"
        height="118"
        rx="4"
        fill={`url(#${uid}-hatch)`}
        fillOpacity="0.3"
        stroke="var(--hus-ink)"
        strokeWidth="2"
      />
      {/* Inner chamber */}
      <rect x="58" y="56" width="244" height="98" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.6" />

      {/* Left gas region shading */}
      <rect x="58" y="56" width="112" height="98" fill="var(--hus-accent)" fillOpacity="0.08" />
      {gasDots.map((d, idx) => (
        <circle key={`dot-${idx}`} cx={d.x} cy={d.y} r="3" fill="var(--hus-accent)" />
      ))}

      {/* Removable partition */}
      <line x1="170" y1="54" x2="170" y2="156" stroke="var(--hus-warning)" strokeWidth="3" strokeDasharray="6 3" />
      <line
        x1="170"
        y1="44"
        x2="170"
        y2="20"
        stroke="var(--hus-warning)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-warning)`}
      />

      <SvgLabel x={114} y={96} fill="var(--hus-accent)" size={11.5}>
        {lbl(spec, 'left', 'Khí (V₁)')}
      </SvgLabel>
      <SvgLabel x={236} y={108} fill="var(--hus-ink-muted)" size={11.5}>
        {lbl(spec, 'right', 'Chân không')}
      </SvgLabel>
      <SvgLabel x={180} y={190} fill="var(--hus-ink-secondary)" size={11.5}>
        {lbl(spec, 'total', 'V₂ > V₁')}
      </SvgLabel>
      <SvgLabel x={256} y={34} fill="var(--hus-ink-secondary)" size={10.5}>
        {lbl(spec, 'note', 'Cách nhiệt (Q = 0)')}
      </SvgLabel>
    </>
  );
}

function renderCarnotEngineFlow(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Hot reservoir T1 */}
      <rect
        x="85"
        y="16"
        width="160"
        height="34"
        rx="6"
        fill="var(--hus-warning)"
        fillOpacity="0.14"
        stroke="var(--hus-warning)"
        strokeWidth="1.8"
      />
      <SvgLabel x={165} y={37} fill="var(--hus-ink)" size={11.5}>
        {lbl(spec, 'hot', 'Nguồn nóng T₁')}
      </SvgLabel>

      {/* Heat input arrow Q1 */}
      <line
        x1="165"
        y1="50"
        x2="165"
        y2="78"
        stroke="var(--hus-warning)"
        strokeWidth="2.4"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <SvgLabel x={144} y={69} fill="var(--hus-warning)" italic>
        {lbl(spec, 'q1', 'Q₁')}
      </SvgLabel>

      {/* Engine cycle circle */}
      <circle cx="165" cy="110" r="28" fill="var(--hus-surface)" stroke="var(--hus-accent)" strokeWidth="2" />
      <SvgLabel x={165} y={114} fill="var(--hus-accent)" size={11.5}>
        Carnot
      </SvgLabel>

      {/* Work output arrow A */}
      <line
        x1="193"
        y1="110"
        x2="282"
        y2="110"
        stroke="var(--hus-success)"
        strokeWidth="2.4"
        markerEnd={`url(#${uid}-vec-success)`}
      />
      <SvgLabel x={252} y={98} fill="var(--hus-success)" size={11.5} italic>
        {lbl(spec, 'work', 'A = Q₁ − |Q₂|')}
      </SvgLabel>

      {/* Heat rejection arrow |Q2| */}
      <line
        x1="165"
        y1="138"
        x2="165"
        y2="166"
        stroke="var(--hus-accent)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={142} y={156} fill="var(--hus-accent)" italic>
        {lbl(spec, 'q2', '|Q₂|')}
      </SvgLabel>

      {/* Cold reservoir T2 */}
      <rect
        x="85"
        y="170"
        width="160"
        height="34"
        rx="6"
        fill="var(--hus-accent)"
        fillOpacity="0.12"
        stroke="var(--hus-accent)"
        strokeWidth="1.8"
      />
      <SvgLabel x={165} y={191} fill="var(--hus-ink)" size={11.5}>
        {lbl(spec, 'cold', 'Nguồn lạnh T₂')}
      </SvgLabel>
    </>
  );
}

function renderSelfHoist(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Ceiling and pulley mount */}
      <line x1="110" y1="20" x2="250" y2="20" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="180" y1="20" x2="180" y2="38" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx="180" cy="54" r="16" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <circle cx="180" cy="54" r="2.5" fill="var(--hus-ink)" />

      {/* Left rope branch to platform sling */}
      <line x1="164" y1="54" x2="164" y2="108" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <polygon
        points="164,108 116,184 218,184"
        fill="none"
        stroke="var(--hus-ink)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Suspended platform */}
      <rect x="108" y="184" width="118" height="7" rx="2" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />

      {/* Right rope branch pulled by person */}
      <line x1="196" y1="54" x2="196" y2="150" stroke="var(--hus-accent)" strokeWidth="1.8" />
      {/* Downward pull force F */}
      <line
        x1="196"
        y1="150"
        x2="196"
        y2="177"
        stroke="var(--hus-accent)"
        strokeWidth="2.1"
        markerEnd={`url(#${uid}-vec-accent)`}
      />

      {/* Person standing/sitting on platform */}
      <circle cx="168" cy="134" r="8" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.7" />
      <path
        d="M 168 142 L 168 166 L 156 184 M 168 166 L 180 184 M 168 149 L 195 142"
        fill="none"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <SvgLabel x={136} y={142} size={11.5}>
        {lbl(spec, 'person', 'Người (M)')}
      </SvgLabel>
      <SvgLabel x={210} y={168} fill="var(--hus-accent)" italic>
        {lbl(spec, 'force', 'F')}
      </SvgLabel>
      <SvgLabel x={167} y={206} size={11.5}>
        {lbl(spec, 'platform', 'Sàn treo (m)')}
      </SvgLabel>
    </>
  );
}

function renderMovablePulley(spec: PhysicsSchematicFigureSpec, _uid: string): ReactElement {
  return (
    <>
      {/* Ceiling */}
      <line x1="88" y1="22" x2="272" y2="22" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />

      {/* Fixed pulley at left */}
      <line x1="142" y1="22" x2="142" y2="40" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx="142" cy="56" r="16" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <circle cx="142" cy="56" r="2.4" fill="var(--hus-ink)" />

      {/* Left rope branch to m1 */}
      <line x1="126" y1="56" x2="126" y2="132" stroke="var(--hus-accent)" strokeWidth="1.8" />
      <rect x="110" y="132" width="32" height="26" rx="2" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <SvgLabel x={92} y={149} italic>
        {lbl(spec, 'm1', 'm₁')}
      </SvgLabel>

      {/* Rope branch around movable pulley up to ceiling */}
      <line x1="158" y1="56" x2="158" y2="132" stroke="var(--hus-accent)" strokeWidth="1.8" />
      <line x1="190" y1="132" x2="190" y2="22" stroke="var(--hus-accent)" strokeWidth="1.8" />

      {/* Movable pulley and hanging m2 */}
      <circle cx="174" cy="132" r="16" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <circle cx="174" cy="132" r="2.4" fill="var(--hus-ink)" />
      <line x1="174" y1="132" x2="174" y2="172" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <rect x="158" y="172" width="32" height="26" rx="2" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <SvgLabel x={208} y={189} italic>
        {lbl(spec, 'm2', 'm₂')}
      </SvgLabel>

      <SvgLabel x={205} y={84} fill="var(--hus-accent)" size={11.5} italic>
        {lbl(spec, 'tension', 'T')}
      </SvgLabel>
    </>
  );
}

function renderRingRope(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Ceiling & fixed pulley */}
      <line x1="112" y1="22" x2="248" y2="22" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="180" y1="22" x2="180" y2="40" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx="180" cy="56" r="16" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <circle cx="180" cy="56" r="2.4" fill="var(--hus-ink)" />

      {/* Left rope branch to block A (m1) */}
      <line x1="164" y1="56" x2="164" y2="164" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <rect x="146" y="164" width="36" height="24" rx="2" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <SvgLabel x={118} y={180} size={11.5}>
        {lbl(spec, 'massA', 'A (m₁)')}
      </SvgLabel>

      {/* Right rope branch with sliding ring B (m2) */}
      <line x1="196" y1="56" x2="196" y2="196" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <rect
        x="184"
        y="112"
        width="24"
        height="13"
        rx="4"
        fill="var(--hus-accent)"
        fillOpacity="0.2"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
      />
      {/* Upward friction force & downward slide cue */}
      <line
        x1="214"
        y1="116"
        x2="214"
        y2="88"
        stroke="var(--hus-warning)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <line
        x1="214"
        y1="128"
        x2="214"
        y2="158"
        stroke="var(--hus-accent)"
        strokeWidth="1.8"
        markerEnd={`url(#${uid}-vec-accent)`}
      />

      <SvgLabel x={246} y={122} size={11.5}>
        {lbl(spec, 'massB', 'B (m₂)')}
      </SvgLabel>
      <SvgLabel x={233} y={96} fill="var(--hus-warning)" size={11} italic>
        {lbl(spec, 'friction', 'F_ms')}
      </SvgLabel>
      <SvgLabel x={228} y={154} fill="var(--hus-accent)" size={11} italic>
        {lbl(spec, 'accel', 'a')}
      </SvgLabel>
    </>
  );
}

function renderAcceleratingWedge(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  // Wedge: (116, 62) -> (116, 186) -> (320, 186)
  const xTop = 116;
  const yTop = 62;
  const xRight = 320;
  const yBase = 186;
  const angleDeg = (Math.atan2(yBase - yTop, xRight - xTop) * 180) / Math.PI;

  return (
    <>
      <line x1="28" y1={yBase} x2="338" y2={yBase} stroke="var(--hus-ink)" strokeWidth="1.6" />
      <polygon
        points={`${xTop},${yTop} ${xTop},${yBase} ${xRight},${yBase}`}
        fill={`url(#${uid}-hatch)`}
        fillOpacity="0.22"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Angle arc at bottom-right */}
      <path d={`M ${xRight - 40} ${yBase} A 40 40 0 0 1 ${xRight - 34} ${yBase - 20}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={xRight - 52} y={yBase - 9} size={11.5} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>

      {/* Block m at top of wedge */}
      <g transform={`translate(${xTop + 22} ${yTop + 13}) rotate(${angleDeg.toFixed(1)})`}>
        <rect
          x="-15"
          y="-20"
          width="30"
          height="20"
          rx="2"
          fill="var(--hus-surface)"
          stroke="var(--hus-ink)"
          strokeWidth="1.8"
        />
        <text x="0" y="-6" textAnchor="middle" fill="var(--hus-ink)" fontSize="11.5" fontWeight="600" fontStyle="italic">
          {lbl(spec, 'mass', 'm')}
        </text>
      </g>

      {/* Leftward wedge acceleration a0 */}
      <line
        x1="104"
        y1="132"
        x2="44"
        y2="132"
        stroke="var(--hus-warning)"
        strokeWidth="2.2"
        markerEnd={`url(#${uid}-vec-warning)`}
      />
      <SvgLabel x={72} y={120} fill="var(--hus-warning)" italic>
        {lbl(spec, 'a0', 'a₀')}
      </SvgLabel>

      {/* Slope length S */}
      <SvgLabel x={226} y={114} fill="var(--hus-ink-secondary)" size={11.5} italic>
        {lbl(spec, 'length', 'S')}
      </SvgLabel>
    </>
  );
}

function renderCartScaleIncline(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  // Smooth incline rising left to right: (42, 188) -> (316, 188) -> (316, 56)
  // Slope tan(alpha) = (188 - 56) / (316 - 42) = 132 / 274 ≈ 0.48175
  const x0 = 42;
  const yBase = 188;
  const x1 = 316;
  const y1 = 56;
  const slope = (yBase - y1) / (x1 - x0);
  const yOnSlope = (x: number) => yBase - slope * (x - x0);

  const cxL = 178;
  const cxR = 256;
  const deckY = 74;

  return (
    <>
      <line x1="24" y1={yBase} x2="338" y2={yBase} stroke="var(--hus-ink)" strokeWidth="1.6" />
      <polygon
        points={`${x0},${yBase} ${x1},${yBase} ${x1},${y1}`}
        fill={`url(#${uid}-hatch)`}
        fillOpacity="0.2"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d={`M ${x0 + 44} ${yBase} A 44 44 0 0 0 ${x0 + 40} ${yBase - 19}`} fill="none" stroke="var(--hus-ink-secondary)" strokeWidth="1.4" />
      <SvgLabel x={x0 + 58} y={yBase - 8} size={11.5} italic>
        {lbl(spec, 'angle', 'α')}
      </SvgLabel>

      {/* Cart body with horizontal top deck */}
      <polygon
        points={`${cxL},${yOnSlope(cxL) - 5} ${cxR},${yOnSlope(cxR) - 5} ${cxR},${deckY} ${cxL},${deckY}`}
        fill="var(--hus-surface)"
        stroke="var(--hus-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Cart wheels */}
      <circle cx={cxL + 14} cy={yOnSlope(cxL + 14) - 4} r="5" fill="var(--hus-ink)" />
      <circle cx={cxR - 14} cy={yOnSlope(cxR - 14) - 4} r="5" fill="var(--hus-ink)" />

      {/* Horizontal platform scale */}
      <rect x={cxL + 14} y={deckY - 8} width="50" height="8" rx="1.5" fill="var(--hus-accent)" fillOpacity="0.18" stroke="var(--hus-ink)" strokeWidth="1.6" />

      {/* Person standing on scale */}
      <circle cx={217} cy={26} r="7.5" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.7" />
      <path
        d="M 217 33.5 L 217 54 L 210 66 M 217 54 L 224 66 M 208 43 L 226 43"
        fill="none"
        stroke="var(--hus-ink)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Down-incline motion arrow */}
      <line
        x1="164"
        y1="112"
        x2="112"
        y2={112 + slope * 52}
        stroke="var(--hus-accent)"
        strokeWidth="2.1"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={130} y={108} fill="var(--hus-accent)" italic>
        {lbl(spec, 'motion', 'a')}
      </SvgLabel>
      <SvgLabel x={262} y={40} size={11}>
        {lbl(spec, 'person', 'Người')}
      </SvgLabel>
      <SvgLabel x={274} y={74} fill="var(--hus-ink-secondary)" size={11}>
        {lbl(spec, 'scale', 'Cân')}
      </SvgLabel>
    </>
  );
}

function renderMonkeyPulley(spec: PhysicsSchematicFigureSpec, uid: string): ReactElement {
  return (
    <>
      {/* Ceiling & fixed pulley */}
      <line x1="112" y1="22" x2="248" y2="22" stroke="var(--hus-ink)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="180" y1="22" x2="180" y2="40" stroke="var(--hus-ink)" strokeWidth="2" />
      <circle cx="180" cy="56" r="16" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <circle cx="180" cy="56" r="2.4" fill="var(--hus-ink)" />

      {/* Left counterweight m */}
      <line x1="164" y1="56" x2="164" y2="146" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <rect x="148" y="146" width="32" height="26" rx="2" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.8" />
      <SvgLabel x={132} y={163} italic>
        {lbl(spec, 'mass', 'm')}
      </SvgLabel>

      {/* Right rope & climbing monkey 2m */}
      <line x1="196" y1="56" x2="196" y2="200" stroke="var(--hus-ink)" strokeWidth="1.8" />
      {/* Monkey figure clinging to right side of rope */}
      <circle cx="212" cy="136" r="7.5" fill="var(--hus-surface)" stroke="var(--hus-ink)" strokeWidth="1.7" />
      <path
        d="M 212 143.5 L 213 168 L 204 184 M 213 168 L 222 183 M 212 149 L 196 140 M 212 155 L 196 158 M 213 168 Q 228 170 227 156"
        fill="none"
        stroke="var(--hus-ink)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Upward relative acceleration arrow a' */}
      <line
        x1="244"
        y1="164"
        x2="244"
        y2="112"
        stroke="var(--hus-accent)"
        strokeWidth="2.1"
        markerEnd={`url(#${uid}-vec-accent)`}
      />
      <SvgLabel x={256} y={128} fill="var(--hus-accent)" italic>
        {lbl(spec, 'accel', "a'")}
      </SvgLabel>
      <SvgLabel x={242} y={182} size={11.5}>
        {lbl(spec, 'monkey', 'Khỉ (2m)')}
      </SvgLabel>
    </>
  );
}

const SCENE_RENDERERS: Readonly<
  Record<PhysicsSchematicScene, (spec: PhysicsSchematicFigureSpec, uid: string) => ReactElement>
> = {
  'projectile-curvature': renderProjectileCurvature,
  'rough-incline-launch': renderRoughInclineLaunch,
  'incline-pulley': renderInclinePulley,
  'conical-pendulum': renderConicalPendulum,
  'self-hoist': renderSelfHoist,
  'movable-pulley': renderMovablePulley,
  'ring-rope': renderRingRope,
  'accelerating-wedge': renderAcceleratingWedge,
  'cart-scale-incline': renderCartScaleIncline,
  'monkey-pulley': renderMonkeyPulley,
  'simple-pendulum': renderSimplePendulum,
  'ballistic-pendulum': renderBallisticPendulum,
  'vertical-loop-track': renderVerticalLoopTrack,
  'orthogonal-2d-scattering': renderOrthogonalScattering,
  'rolling-cylinder-incline': renderRollingCylinderIncline,
  'coaxial-disks-clutch': renderCoaxialDisksClutch,
  'kepler-ellipse': renderKeplerEllipse,
  'free-expansion-chamber': renderFreeExpansionChamber,
  'carnot-engine-flow': renderCarnotEngineFlow,
};

function PhysicsSchematicGraphic({ spec, uid }: { readonly spec: PhysicsSchematicFigureSpec; readonly uid: string }) {
  const renderScene = SCENE_RENDERERS[spec.scene];
  return (
    <>
      <SharedSchematicDefs uid={uid} />
      {renderScene(spec, uid)}
    </>
  );
}

export function ProblemFigure({
  figure,
  className,
}: {
  readonly figure: ProblemFigureSpec;
  readonly className?: string | undefined;
}) {
  const uid = useId().replace(/:/g, '');

  return (
    <figure
      data-problem-figure={figure.kind === 'plot-2d' ? 'plot-2d' : figure.scene}
      className={['rounded-[var(--radius-lg)] border border-border bg-surface-subtle/55 p-3.5', className]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        role="img"
        aria-label={figure.alt}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="mx-auto block h-auto w-full max-w-[380px] select-none"
      >
        {figure.kind === 'plot-2d' ? (
          <Plot2dGraphic spec={figure} uid={uid} />
        ) : (
          <PhysicsSchematicGraphic spec={figure} uid={uid} />
        )}
      </svg>
      {figure.caption ? (
        <figcaption className="mt-2 text-center text-xs text-ink-muted">
          <Markdown inline>{figure.caption}</Markdown>
        </figcaption>
      ) : null}
    </figure>
  );
}

export default ProblemFigure;
