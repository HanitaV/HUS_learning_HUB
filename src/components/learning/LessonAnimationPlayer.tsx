import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import type {
  ArrayCellTone,
  ArrayOpsFrame,
  GraphTreeEdge,
  GraphTreeFrame,
  GraphTreeNode,
  LessonAnimationFrame,
  LessonAnimationSpec,
  LinearDsFrame,
  LinearDsNode,
  OopFlowArrow,
  OopFlowBox,
  OopFlowFrame,
} from '../../domain/code-lesson';
import { Badge } from '../ui/Badge';
import { VisualizationFrame } from './VisualizationFrame';

export interface LessonAnimationPlayerProps {
  readonly spec: LessonAnimationSpec;
}

const ARRAY_TONE_CLASSES: Record<ArrayCellTone, string> = {
  default: 'border border-border-strong bg-surface text-ink',
  active: 'border-2 border-accent bg-accent-subtle text-accent-ink font-semibold',
  compare: 'border-2 border-warning bg-warning-subtle text-warning font-semibold',
  swap: 'border-2 border-dashed border-warning bg-warning-subtle text-warning font-semibold -translate-y-1',
  done: 'border border-success/60 bg-success-subtle text-success font-medium',
  muted: 'border border-border bg-surface-subtle text-ink-muted opacity-70',
};

const ARRAY_TONE_LABELS: Record<ArrayCellTone, string> = {
  default: 'mặc định',
  active: 'đang xử lý',
  compare: 'đang so sánh',
  swap: 'đổi chỗ',
  done: 'hoàn tất',
  muted: 'bỏ qua',
};

type LinearTone = NonNullable<LinearDsNode['tone']>;

const LINEAR_TONE_CLASSES: Record<LinearTone, string> = {
  default: 'border border-border-strong bg-surface text-ink',
  active: 'border-2 border-accent bg-accent-subtle text-accent-ink font-semibold',
  new: 'border-2 border-success bg-success-subtle text-success font-semibold',
  removed: 'border-2 border-dashed border-warning bg-warning-subtle text-warning opacity-80',
  done: 'border border-success/60 bg-success-subtle text-success font-medium',
};

type GraphNodeTone = NonNullable<GraphTreeNode['tone']>;
type GraphEdgeTone = NonNullable<GraphTreeEdge['tone']>;

const GRAPH_NODE_STYLES: Record<
  GraphNodeTone,
  { readonly fill: string; readonly stroke: string; readonly strokeWidth: number; readonly text: string; readonly dashed?: string }
> = {
  default: {
    fill: 'var(--hus-surface)',
    stroke: 'var(--hus-border-strong)',
    strokeWidth: 1.75,
    text: 'var(--hus-ink)',
  },
  current: {
    fill: 'var(--hus-accent-subtle)',
    stroke: 'var(--hus-accent)',
    strokeWidth: 2.5,
    text: 'var(--hus-accent-ink)',
  },
  frontier: {
    fill: 'var(--hus-warning-subtle)',
    stroke: 'var(--hus-warning)',
    strokeWidth: 2,
    text: 'var(--hus-warning)',
    dashed: '4 2',
  },
  visited: {
    fill: 'var(--hus-surface-subtle)',
    stroke: 'var(--hus-border-strong)',
    strokeWidth: 1.5,
    text: 'var(--hus-ink-secondary)',
  },
  path: {
    fill: 'var(--hus-success-subtle)',
    stroke: 'var(--hus-success)',
    strokeWidth: 2.5,
    text: 'var(--hus-success)',
  },
};

const GRAPH_EDGE_STYLES: Record<
  GraphEdgeTone,
  { readonly stroke: string; readonly strokeWidth: number; readonly dashed?: string; readonly opacity?: number }
> = {
  default: {
    stroke: 'var(--hus-border-strong)',
    strokeWidth: 1.75,
  },
  active: {
    stroke: 'var(--hus-accent)',
    strokeWidth: 2.5,
  },
  path: {
    stroke: 'var(--hus-success)',
    strokeWidth: 2.75,
  },
  muted: {
    stroke: 'var(--hus-border)',
    strokeWidth: 1.25,
    dashed: '4 4',
    opacity: 0.65,
  },
};

type OopBoxTone = NonNullable<OopFlowBox['tone']>;
type OopArrowTone = NonNullable<OopFlowArrow['tone']>;

const OOP_BOX_STYLES: Record<
  OopBoxTone,
  { readonly fill: string; readonly stroke: string; readonly strokeWidth: number; readonly titleColor: string }
> = {
  default: {
    fill: 'var(--hus-surface)',
    stroke: 'var(--hus-border-strong)',
    strokeWidth: 1.5,
    titleColor: 'var(--hus-ink)',
  },
  active: {
    fill: 'var(--hus-accent-subtle)',
    stroke: 'var(--hus-accent)',
    strokeWidth: 2,
    titleColor: 'var(--hus-accent-ink)',
  },
  highlight: {
    fill: 'var(--hus-accent-subtle)',
    stroke: 'var(--hus-accent)',
    strokeWidth: 2,
    titleColor: 'var(--hus-accent-ink)',
  },
  done: {
    fill: 'var(--hus-success-subtle)',
    stroke: 'var(--hus-success)',
    strokeWidth: 1.75,
    titleColor: 'var(--hus-success)',
  },
  warning: {
    fill: 'var(--hus-warning-subtle)',
    stroke: 'var(--hus-warning)',
    strokeWidth: 2,
    titleColor: 'var(--hus-warning)',
  },
};

const OOP_ARROW_COLORS: Record<OopArrowTone, string> = {
  default: 'var(--hus-border-strong)',
  active: 'var(--hus-accent)',
  warning: 'var(--hus-warning)',
};

const TRANSITION_CLS =
  'transition-[transform,opacity,background-color,border-color] duration-200 motion-reduce:transition-none';

function ArrayOpsStage({ frame }: { readonly frame: ArrayOpsFrame }) {
  const isBars = frame.displayMode === 'bars';
  const numericValues = frame.items.map(item => {
    if (typeof item.value === 'number' && Number.isFinite(item.value)) return Math.max(0, item.value);
    const parsed = Number(item.label);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  });
  const maxVal = Math.max(1, ...numericValues);

  return (
    <div className="space-y-4">
      <ol
        aria-label="Mảng phần tử minh họa"
        className={`flex flex-wrap justify-center gap-2.5 sm:gap-3.5 ${
          isBars ? 'min-h-[168px] items-end pt-2' : 'min-h-[104px] items-center py-2'
        }`}
      >
        {frame.items.map((item, idx) => {
          const tone: ArrayCellTone = item.tone ?? 'default';
          const numVal = numericValues[idx] ?? 0;
          const heightPx = Math.max(36, Math.round((numVal / maxVal) * 112));

          return (
            <li key={`${idx}-${item.label}`} className="flex flex-col items-center gap-1.5">
              <div className="flex h-5 items-center justify-center">
                {item.pointer ? (
                  <span className="rounded-[var(--radius-sm)] border border-accent/35 bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-accent-ink">
                    {item.pointer}
                  </span>
                ) : null}
              </div>

              <div
                className={`flex items-center justify-center rounded-[var(--radius-sm)] font-mono text-sm tabular-nums ${TRANSITION_CLS} ${ARRAY_TONE_CLASSES[tone]} ${
                  isBars ? 'w-11 sm:w-12' : 'h-12 min-w-[3rem] px-2.5'
                }`}
                style={isBars ? { height: `${heightPx}px` } : undefined}
                aria-label={`Vị trí ${idx}: ${item.label}, trạng thái ${ARRAY_TONE_LABELS[tone]}${
                  item.pointer ? `, con trỏ ${item.pointer}` : ''
                }`}
              >
                {item.label}
              </div>

              <span className="font-mono text-xs tabular-nums text-ink-muted">[{idx}]</span>
            </li>
          );
        })}
      </ol>

      {frame.auxiliaryLabel || (frame.auxiliaryValues && frame.auxiliaryValues.length > 0) ? (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/70 pt-3 text-xs">
          {frame.auxiliaryLabel ? (
            <span className="font-medium text-ink-secondary">{frame.auxiliaryLabel}:</span>
          ) : null}
          {frame.auxiliaryValues?.map((val, idx) => (
            <span
              key={`${idx}-${val}`}
              className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-0.5 font-mono text-xs text-ink"
            >
              {val}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LinearDsNodeCard({
  node,
  badgeText,
  indexLabel,
}: {
  readonly node: LinearDsNode;
  readonly badgeText?: string | undefined;
  readonly indexLabel?: string | undefined;
}) {
  const tone: LinearTone = node.tone ?? 'default';
  const topPointer = node.pointer ?? badgeText;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex min-h-[20px] items-center justify-center gap-1">
        {topPointer ? (
          <span className="rounded-[var(--radius-sm)] border border-accent/35 bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-accent-ink">
            {topPointer}
          </span>
        ) : null}
        {node.pointer && badgeText && node.pointer !== badgeText ? (
          <span className="rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] leading-none text-ink-secondary">
            {badgeText}
          </span>
        ) : null}
      </div>

      <div
        className={`flex min-h-[44px] min-w-[60px] flex-col items-center justify-center rounded-[var(--radius-md)] px-3 py-1.5 text-center ${TRANSITION_CLS} ${LINEAR_TONE_CLASSES[tone]}`}
      >
        <span className="font-mono text-sm font-medium">{node.label}</span>
        {node.sublabel ? (
          <span className="mt-0.5 font-mono text-[11px] text-ink-muted">{node.sublabel}</span>
        ) : null}
      </div>

      {indexLabel ? (
        <span className="font-mono text-[11px] tabular-nums text-ink-muted">{indexLabel}</span>
      ) : null}
    </div>
  );
}

function LinearDsStage({ frame }: { readonly frame: LinearDsFrame }) {
  const isEmpty = frame.nodes.length === 0;

  return (
    <div className="space-y-4">
      {frame.operationBadge ? (
        <div className="flex items-center justify-between gap-2">
          <Badge tone="accent" mono>
            {frame.operationBadge}
          </Badge>
          {frame.layout === 'array-list' ? (
            <span className="font-mono text-xs text-ink-muted">
              size = {frame.nodes.length}
            </span>
          ) : null}
        </div>
      ) : frame.layout === 'array-list' ? (
        <div className="flex justify-end">
          <span className="font-mono text-xs text-ink-muted">size = {frame.nodes.length}</span>
        </div>
      ) : null}

      {frame.layout === 'stack' ? (
        <div className="flex flex-col items-center py-2">
          {isEmpty ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-border px-6 py-4 font-mono text-xs text-ink-muted">
              Stack rỗng (TOP = null)
            </div>
          ) : (
            <ol
              aria-label="Ngăn xếp Stack"
              className="flex w-full max-w-[220px] flex-col items-stretch gap-2 rounded-b-[var(--radius-md)] border-x-2 border-b-2 border-border-strong bg-surface/50 px-3 pb-3 pt-2"
            >
              {frame.nodes.map((node, idx) => {
                const tone: LinearTone = node.tone ?? 'default';
                const isTop = idx === 0;
                return (
                  <li key={node.id} className="flex items-center gap-2">
                    <div
                      className={`flex flex-1 items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 ${TRANSITION_CLS} ${LINEAR_TONE_CLASSES[tone]}`}
                    >
                      <span className="font-mono text-sm font-medium">{node.label}</span>
                      {node.sublabel ? (
                        <span className="font-mono text-[11px] text-ink-muted">{node.sublabel}</span>
                      ) : null}
                    </div>
                    <div className="w-14 shrink-0 text-left">
                      {isTop || node.pointer ? (
                        <span className="inline-block rounded-[var(--radius-sm)] border border-accent/35 bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">
                          {node.pointer ?? 'TOP'}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}

      {frame.layout === 'queue' ? (
        <div className="overflow-x-auto py-2">
          {isEmpty ? (
            <div className="mx-auto max-w-xs rounded-[var(--radius-md)] border border-dashed border-border px-6 py-4 text-center font-mono text-xs text-ink-muted">
              Queue rỗng (Front = Rear = null)
            </div>
          ) : (
            <ol
              aria-label="Hàng đợi Queue"
              className="flex min-w-max items-center justify-center gap-2 px-2"
            >
              {frame.nodes.map((node, idx) => {
                const isFront = idx === 0;
                const isRear = idx === frame.nodes.length - 1;
                const badge =
                  isFront && isRear ? 'Front / Rear' : isFront ? 'Front' : isRear ? 'Rear' : undefined;
                return (
                  <li key={node.id} className="flex items-center gap-2">
                    <LinearDsNodeCard node={node} badgeText={badge} />
                    {idx < frame.nodes.length - 1 ? (
                      <span aria-hidden="true" className="mt-4 font-mono text-sm text-ink-muted">
                        ←
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}

      {frame.layout === 'linked-list' ? (
        <div className="overflow-x-auto py-2">
          <ol
            aria-label="Danh sách liên kết"
            className="flex min-w-max items-center justify-center gap-2 px-2"
          >
            {frame.nodes.map((node, idx) => (
              <li key={node.id} className="flex items-center gap-2">
                <LinearDsNodeCard node={node} badgeText={idx === 0 ? 'head' : undefined} />
                <span aria-hidden="true" className="mt-4 font-mono text-base text-accent">
                  →
                </span>
              </li>
            ))}
            <li className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-border px-2.5 py-1.5 font-mono text-xs text-ink-muted">
              null
            </li>
          </ol>
        </div>
      ) : null}

      {frame.layout === 'array-list' ? (
        <div className="overflow-x-auto py-2">
          {isEmpty ? (
            <div className="mx-auto max-w-xs rounded-[var(--radius-md)] border border-dashed border-border px-6 py-4 text-center font-mono text-xs text-ink-muted">
              Danh sách rỗng (size = 0)
            </div>
          ) : (
            <ol
              aria-label="ArrayList theo chỉ số"
              className="flex min-w-max items-end justify-center gap-2 px-2"
            >
              {frame.nodes.map((node, idx) => (
                <li key={node.id}>
                  <LinearDsNodeCard node={node} indexLabel={`[${idx}]`} />
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      {frame.auxiliaryText ? (
        <p className="border-t border-border/70 pt-3 text-center font-mono text-xs text-ink-secondary">
          {frame.auxiliaryText}
        </p>
      ) : null}
    </div>
  );
}

function GraphTreeStage({ frame }: { readonly frame: GraphTreeFrame }) {
  const uid = useId().replace(/:/g, '');
  const nodeMap = new Map<string, GraphTreeNode>();
  for (const node of frame.nodes) {
    nodeMap.set(node.id, node);
  }

  const NODE_RADIUS = 20;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 540 260"
        role="img"
        aria-label={`${frame.stepLabel}: ${frame.caption}`}
        className="mx-auto block h-auto w-full max-w-[540px]"
      >
        <defs>
          {(['default', 'active', 'path', 'muted'] as const).map(tone => (
            <marker
              key={tone}
              id={`${uid}-arrow-${tone}`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={GRAPH_EDGE_STYLES[tone].stroke} />
            </marker>
          ))}
        </defs>

        {frame.edges.map((edge, idx) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;

          const tone: GraphEdgeTone = edge.tone ?? 'default';
          const style = GRAPH_EDGE_STYLES[tone];
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1) return null;

          const ux = dx / dist;
          const uy = dy / dist;
          const x1 = fromNode.x + ux * NODE_RADIUS;
          const y1 = fromNode.y + uy * NODE_RADIUS;
          const endOffset = edge.directed ? NODE_RADIUS + 4 : NODE_RADIUS;
          const x2 = toNode.x - ux * endOffset;
          const y2 = toNode.y - uy * endOffset;

          const mx = (fromNode.x + toNode.x) / 2;
          const my = (fromNode.y + toNode.y) / 2;

          return (
            <g key={`${edge.from}-${edge.to}-${idx}`} opacity={style.opacity ?? 1}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.dashed}
                markerEnd={edge.directed ? `url(#${uid}-arrow-${tone})` : undefined}
              />
              {edge.label ? (
                <g transform={`translate(${mx}, ${my})`}>
                  <rect
                    x={-12}
                    y={-9}
                    width={24}
                    height={18}
                    rx={4}
                    fill="var(--hus-surface)"
                    stroke="var(--hus-border)"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={3.5}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    fontWeight={600}
                    fill="var(--hus-ink-secondary)"
                  >
                    {edge.label}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {frame.nodes.map(node => {
          const tone: GraphNodeTone = node.tone ?? 'default';
          const style = GRAPH_NODE_STYLES[tone];
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={NODE_RADIUS}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.dashed}
              />
              <text
                x={0}
                y={4.5}
                textAnchor="middle"
                fontSize={13}
                fontFamily="var(--font-mono)"
                fontWeight={600}
                fill={style.text}
              >
                {node.label}
              </text>
              {node.sublabel ? (
                <text
                  x={0}
                  y={NODE_RADIUS + 14}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontFamily="var(--font-mono)"
                  fill="var(--hus-ink-muted)"
                >
                  {node.sublabel}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {frame.frontierLabel || (frame.frontierItems && frame.frontierItems.length > 0) ? (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/70 pt-3 text-xs">
          {frame.frontierLabel ? (
            <span className="font-medium text-ink-secondary">{frame.frontierLabel}:</span>
          ) : null}
          {frame.frontierItems && frame.frontierItems.length > 0 ? (
            frame.frontierItems.map((item, idx) => (
              <span
                key={`${idx}-${item}`}
                className="rounded-[var(--radius-sm)] border border-warning/35 bg-warning-subtle px-2 py-0.5 font-mono text-xs text-warning"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="font-mono text-xs text-ink-muted">(rỗng)</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface BoxGeometry {
  readonly box: OopFlowBox;
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
}

function computeRayIntersection(
  source: BoxGeometry,
  target: BoxGeometry,
  padding = 0,
): { readonly x: number; readonly y: number } {
  const dx = target.cx - source.cx;
  const dy = target.cy - source.cy;
  if (dx === 0 && dy === 0) return { x: source.cx, y: source.cy };

  const hw = source.width / 2 + padding;
  const hh = source.height / 2 + padding;
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);

  return {
    x: source.cx + dx * scale,
    y: source.cy + dy * scale,
  };
}

function OopFlowStage({ frame }: { readonly frame: OopFlowFrame }) {
  const uid = useId().replace(/:/g, '');
  const boxMap = new Map<string, BoxGeometry>();

  const geometries: BoxGeometry[] = frame.boxes.map(box => {
    const width = box.width ?? 148;
    const visibleLines = box.lines.slice(0, 3);
    const headerHeight = box.stereotype ? 38 : 26;
    const height = Math.max(58, headerHeight + 12 + visibleLines.length * 16);
    const geom: BoxGeometry = {
      box,
      width,
      height,
      cx: box.x + width / 2,
      cy: box.y + height / 2,
    };
    boxMap.set(box.id, geom);
    return geom;
  });

  return (
    <div className="space-y-3">
      {frame.badge ? (
        <div className="flex justify-start">
          <Badge tone="accent" mono>
            {frame.badge}
          </Badge>
        </div>
      ) : null}

      <svg
        viewBox="0 0 560 280"
        role="img"
        aria-label={`${frame.stepLabel}: ${frame.caption}`}
        className="mx-auto block h-auto w-full max-w-[560px]"
      >
        <defs>
          {(['default', 'active', 'warning'] as const).map(tone => (
            <marker
              key={tone}
              id={`${uid}-oop-arrow-${tone}`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={OOP_ARROW_COLORS[tone]} />
            </marker>
          ))}
        </defs>

        {frame.arrows.map((arrow, idx) => {
          const fromGeom = boxMap.get(arrow.from);
          const toGeom = boxMap.get(arrow.to);
          if (!fromGeom || !toGeom) return null;

          const tone: OopArrowTone = arrow.tone ?? 'default';
          const color = OOP_ARROW_COLORS[tone];
          const start = computeRayIntersection(fromGeom, toGeom, 2);
          const end = computeRayIntersection(toGeom, fromGeom, 5);
          const mx = (start.x + end.x) / 2;
          const my = (start.y + end.y) / 2;
          const labelWidth = arrow.label ? Math.max(36, arrow.label.length * 6.4 + 14) : 0;

          return (
            <g key={`${arrow.from}-${arrow.to}-${idx}`}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={color}
                strokeWidth={tone === 'default' ? 1.5 : 2}
                strokeDasharray={arrow.style === 'dashed' ? '5 4' : undefined}
                markerEnd={`url(#${uid}-oop-arrow-${tone})`}
              />
              {arrow.label ? (
                <g transform={`translate(${mx}, ${my})`}>
                  <rect
                    x={-labelWidth / 2}
                    y={-9.5}
                    width={labelWidth}
                    height={19}
                    rx={4}
                    fill="var(--hus-surface)"
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={3.5}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    fontWeight={500}
                    fill="var(--hus-ink-secondary)"
                  >
                    {arrow.label}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {geometries.map(({ box, width, height }) => {
          const tone: OopBoxTone = box.tone ?? 'default';
          const style = OOP_BOX_STYLES[tone];
          const visibleLines = box.lines.slice(0, 3);
          const titleY = box.stereotype ? box.y + 29 : box.y + 19;
          const dividerY = box.stereotype ? box.y + 38 : box.y + 27;
          const linesStartY = dividerY + 15;
          const clipId = `${uid}-clip-${box.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

          return (
            <g key={box.id}>
              <clipPath id={clipId}>
                <rect x={box.x + 4} y={box.y + 2} width={Math.max(10, width - 8)} height={height - 4} />
              </clipPath>
              <rect
                x={box.x}
                y={box.y}
                width={width}
                height={height}
                rx={10}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
              />
              <g clipPath={`url(#${clipId})`}>
                {box.stereotype ? (
                  <text
                    x={box.x + width / 2}
                    y={box.y + 14}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontFamily="var(--font-mono)"
                    fill="var(--hus-ink-muted)"
                  >
                    {box.stereotype}
                  </text>
                ) : null}
                <text
                  x={box.x + width / 2}
                  y={titleY}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={style.titleColor}
                >
                  {box.title}
                </text>
                <line
                  x1={box.x + 1}
                  y1={dividerY}
                  x2={box.x + width - 1}
                  y2={dividerY}
                  stroke={style.stroke}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                />
                {visibleLines.map((line, lineIdx) => (
                  <text
                    key={`${box.id}-line-${lineIdx}`}
                    x={box.x + 10}
                    y={linesStartY + lineIdx * 16}
                    fontSize={10.5}
                    fontFamily="var(--font-mono)"
                    fill="var(--hus-ink-secondary)"
                  >
                    {line}
                  </text>
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function renderAnimationFrame(frame: LessonAnimationFrame) {
  switch (frame.kind) {
    case 'array-ops':
      return <ArrayOpsStage frame={frame} />;
    case 'linear-ds':
      return <LinearDsStage frame={frame} />;
    case 'graph-tree':
      return <GraphTreeStage frame={frame} />;
    case 'oop-flow':
      return <OopFlowStage frame={frame} />;
  }
}

function LessonAnimationPlayerInner({ spec }: LessonAnimationPlayerProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const frames = spec.frames;

  useEffect(() => {
    if (!playing || frames.length <= 1) return;
    const timer = window.setInterval(
      () =>
        setIndex(i => {
          if (i >= frames.length - 1) return i;
          return i + 1;
        }),
      1000 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed, frames.length]);

  useEffect(() => {
    if (frames.length > 0 && index >= frames.length - 1) {
      setPlaying(false);
    }
  }, [index, frames.length]);

  const safeIndex = frames.length === 0 ? 0 : Math.min(index, frames.length - 1);
  const frame = frames[safeIndex];

  if (!frame) {
    return (
      <VisualizationFrame
        title={spec.title}
        description={spec.subtitle}
        fallbackMessage="Chưa có khung hình mô phỏng cho bài học này."
      />
    );
  }

  const progressPct =
    frames.length <= 1 ? 100 : Math.round((safeIndex / Math.max(1, frames.length - 1)) * 100);

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPlaying(false);
      setIndex(i => Math.min(frames.length - 1, i + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaying(false);
      setIndex(i => Math.max(0, i - 1));
    } else if (event.key === ' ') {
      event.preventDefault();
      if (playing) {
        setPlaying(false);
      } else {
        if (safeIndex >= frames.length - 1) setIndex(0);
        setPlaying(true);
      }
    }
  };

  return (
    <VisualizationFrame
      title={spec.title}
      description={spec.subtitle}
      stepLabel={frame.stepLabel}
      controls={{
        isPlaying: playing,
        canPrev: safeIndex > 0,
        canNext: safeIndex < frames.length - 1,
        speed,
        onStart: () => {
          if (safeIndex >= frames.length - 1) setIndex(0);
          setPlaying(true);
        },
        onPause: () => setPlaying(false),
        onReset: () => {
          setPlaying(false);
          setIndex(0);
        },
        onPrevStep: () => {
          setPlaying(false);
          setIndex(i => Math.max(0, i - 1));
        },
        onNextStep: () => {
          setPlaying(false);
          setIndex(i => Math.min(frames.length - 1, i + 1));
        },
        onSpeedChange: setSpeed,
      }}
    >
      <div
        tabIndex={0}
        onKeyDown={handleStageKeyDown}
        aria-label={`Khu vực mô phỏng ${spec.title}. Dùng phím mũi tên trái, phải để chuyển bước hoặc phím Space để chạy/tạm dừng.`}
        className="rounded-[var(--radius-md)] border border-border bg-canvas px-4 py-5 focus-visible:border-accent"
      >
        {renderAnimationFrame(frame)}
      </div>

      <div className="mt-4 space-y-3">
        <progress
          aria-label="Tiến độ mô phỏng"
          className="hus-progress"
          max={100}
          value={progressPct}
        />
        <p
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 px-4 py-3 text-sm text-ink-secondary"
        >
          <span className="font-semibold text-ink">{frame.stepLabel}:</span> {frame.caption}
        </p>
      </div>
    </VisualizationFrame>
  );
}

export function LessonAnimationPlayer({ spec }: LessonAnimationPlayerProps) {
  return <LessonAnimationPlayerInner key={spec.id} spec={spec} />;
}

export default LessonAnimationPlayer;
