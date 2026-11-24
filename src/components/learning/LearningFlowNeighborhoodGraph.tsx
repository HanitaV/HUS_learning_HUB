import { useId } from 'react';
import { Link } from 'react-router';
import type { NeighborhoodFlowGraph, NeighborhoodFlowNode } from '../../core/learning/goal-pathway';
import { Badge } from '../ui/Badge';

export interface LearningFlowNeighborhoodGraphProps {
  readonly flow: NeighborhoodFlowGraph;
  readonly onSelectGoalId?: ((goalId: string) => void) | undefined;
  readonly ariaLabel?: string | undefined;
}

function getConnectorYPositions(count: number): readonly number[] {
  if (count <= 1) return [55];
  if (count === 2) return [22, 88];
  if (count === 3) return [22, 55, 88];
  return Array.from({ length: count }, (_, index) => 18 + (74 * index) / (count - 1));
}

function FlowNodeCard({
  node,
  side,
  onSelectGoalId,
}: {
  readonly node: NeighborhoodFlowNode;
  readonly side: 'before' | 'after';
  readonly onSelectGoalId?: ((goalId: string) => void) | undefined;
}) {
  const toneClasses = node.completed
    ? 'border-success/35 bg-success-subtle/40 hover:border-success/60 hover:bg-success-subtle/65'
    : side === 'before'
      ? 'border-starlight/40 bg-surface-subtle hover:border-starlight/75 hover:bg-surface-hover'
      : 'border-accent/30 bg-surface-subtle hover:border-accent/65 hover:bg-surface-hover';

  const statusLabel = node.completed
    ? side === 'before'
      ? '✓ Đã nắm'
      : '✓ Đã xong'
    : node.relationLabel;

  const statusTone = node.completed
    ? 'text-success'
    : side === 'before'
      ? 'text-warning'
      : 'text-accent-ink';

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-mono text-[11px] font-medium text-ink-muted">{node.codeLabel}</span>
        <span className={`text-[11px] font-medium ${statusTone}`}>{statusLabel}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-ink group-hover:text-accent-ink">
        {node.title}
      </p>
    </>
  );

  const sharedClassName = `group block w-full min-w-0 rounded-[var(--radius-lg)] border p-3 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${toneClasses}`;

  if (onSelectGoalId) {
    return (
      <button
        type="button"
        onClick={() => onSelectGoalId(node.goalId)}
        className={sharedClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={node.to} className={`${sharedClassName} !no-underline`}>
      {content}
    </Link>
  );
}

export function LearningFlowNeighborhoodGraph({
  flow,
  onSelectGoalId,
  ariaLabel,
}: LearningFlowNeighborhoodGraphProps) {
  const rawId = useId();
  const safeId = rawId.replace(/:/g, '');
  const beforeMarkerId = `flow-arrow-before-${safeId}`;
  const afterMarkerId = `flow-arrow-after-${safeId}`;

  const beforeYs = getConnectorYPositions(flow.beforeNodes.length);
  const afterYs = getConnectorYPositions(flow.afterNodes.length);

  return (
    <section
      aria-label={ariaLabel ?? 'Sơ đồ cần học trước và học tiếp theo'}
      data-flow-graph={flow.scope}
      className="rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_52px_minmax(0,1.1fr)_52px_minmax(0,1fr)] lg:items-center lg:gap-0">
        {/* Left Column: Cần học trước */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-starlight" />
            <span>Cần học trước</span>
          </div>
          {flow.beforeNodes.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-success/45 bg-success-subtle/50 p-3 text-xs leading-relaxed text-success">
              ✓ Điểm khởi đầu nền tảng — Bạn có thể bắt đầu học ngay mà không cần kiến thức trước!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {flow.beforeNodes.map(node => (
                <FlowNodeCard
                  key={node.id}
                  node={node}
                  side="before"
                  onSelectGoalId={onSelectGoalId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Connector 1: Cần học trước -> Đang chọn */}
        <div className="flex items-center justify-center">
          <div className="hidden lg:flex lg:items-center lg:justify-center">
            <svg
              width="52"
              height="110"
              viewBox="0 0 52 110"
              fill="none"
              aria-hidden="true"
              className="shrink-0 overflow-visible"
            >
              <defs>
                <marker
                  id={beforeMarkerId}
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M0 0.5 L6.5 3.5 L0 6.5 Z" fill="var(--hus-starlight)" />
                </marker>
              </defs>
              {beforeYs.map(y => (
                <g key={y}>
                  <circle cx="3" cy={y} r="2.5" fill="var(--hus-starlight)" />
                  <path
                    d={`M 4 ${y} C 24 ${y}, 28 55, 48 55`}
                    stroke="var(--hus-starlight)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    markerEnd={`url(#${beforeMarkerId})`}
                  />
                </g>
              ))}
            </svg>
          </div>
          <span className="flex justify-center py-0.5 font-mono text-xs text-warning lg:hidden">
            ↓ Mở đường dẫn tới
          </span>
        </div>

        {/* Center Column: Đang chọn / Đang học */}
        <div className="min-w-0 rounded-[var(--radius-lg)] border-2 border-accent bg-accent-subtle/35 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" mono>
              {flow.center.codeLabel}
            </Badge>
            {flow.center.completed ? (
              <Badge tone="success">Đã hoàn thành</Badge>
            ) : (
              <Badge tone="warning">★ Đích đang xem</Badge>
            )}
          </div>
          <p className="mt-2 font-display text-base font-semibold leading-snug text-ink">
            {flow.center.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{flow.center.subtitle}</p>
        </div>

        {/* Connector 2: Đang chọn -> Tiếp theo học gì */}
        <div className="flex items-center justify-center">
          <div className="hidden lg:flex lg:items-center lg:justify-center">
            <svg
              width="52"
              height="110"
              viewBox="0 0 52 110"
              fill="none"
              aria-hidden="true"
              className="shrink-0 overflow-visible"
            >
              <defs>
                <marker
                  id={afterMarkerId}
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M0 0.5 L6.5 3.5 L0 6.5 Z" fill="var(--hus-accent)" />
                </marker>
              </defs>
              <circle cx="3" cy="55" r="2.5" fill="var(--hus-accent)" />
              {afterYs.map(y => (
                <path
                  key={y}
                  d={`M 4 55 C 24 55, 28 ${y}, 48 ${y}`}
                  stroke="var(--hus-accent)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  markerEnd={`url(#${afterMarkerId})`}
                />
              ))}
            </svg>
          </div>
          <span className="flex justify-center py-0.5 font-mono text-xs text-accent lg:hidden">
            ↓ Học xong mở tiếp
          </span>
        </div>

        {/* Right Column: Tiếp theo học gì */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>Tiếp theo học gì</span>
          </div>
          {flow.afterNodes.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface-subtle/60 p-3 text-xs leading-relaxed text-ink-secondary">
              ★ Chặng đích cuối môn — Hoàn thành phần này là bạn khép lại trọn vẹn mạch học phần!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {flow.afterNodes.map(node => (
                <FlowNodeCard
                  key={node.id}
                  node={node}
                  side="after"
                  onSelectGoalId={onSelectGoalId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
