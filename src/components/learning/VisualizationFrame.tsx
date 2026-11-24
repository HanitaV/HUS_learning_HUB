import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import { PauseIcon, PlayIcon, RotateCcwIcon } from '../ui/Icons';

export interface VisualizationControls {
  readonly isPlaying?: boolean;
  readonly canPrev?: boolean;
  readonly canNext?: boolean;
  readonly speed?: number;
  readonly onStart?: () => void;
  readonly onPause?: () => void;
  readonly onReset?: () => void;
  readonly onPrevStep?: () => void;
  readonly onNextStep?: () => void;
  readonly onSpeedChange?: (speed: number) => void;
}

export interface VisualizationFrameProps {
  readonly title: string;
  readonly description?: string;
  readonly stepLabel?: string;
  readonly controls?: VisualizationControls;
  readonly fallbackMessage?: string;
  readonly children?: ReactNode;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;

export function VisualizationFrame({
  title,
  description,
  stepLabel,
  controls,
  fallbackMessage = 'Bộ mô phỏng hoặc trực quan hóa chưa sẵn sàng cho nội dung này.',
  children,
}: VisualizationFrameProps) {
  const hasAnyControl = Boolean(
    controls &&
      (controls.onStart ||
        controls.onPause ||
        controls.onReset ||
        controls.onPrevStep ||
        controls.onNextStep ||
        controls.onSpeedChange),
  );

  return (
    <section
      aria-label={title}
      className="hus-card-surface overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface"
    >
      {/* Zone 1: Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
          {description ? <p className="mt-1 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {stepLabel ? (
          <Badge tone="neutral" mono>
            {stepLabel}
          </Badge>
        ) : null}
      </div>

      {/* Zone 2: Visualization Canvas & Explanation */}
      <div className="p-5">
        {children ? (
          children
        ) : (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-subtle p-6 text-center text-sm text-ink-muted">
            {fallbackMessage}
          </p>
        )}
      </div>

      {/* Zone 3: Playback Controls Dock */}
      {hasAnyControl && controls ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-subtle/60 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {controls.onPrevStep ? (
              <button
                type="button"
                onClick={controls.onPrevStep}
                disabled={controls.canPrev === false}
                className="hus-btn hus-btn-secondary text-xs"
              >
                Bước trước
              </button>
            ) : null}

            {controls.isPlaying && controls.onPause ? (
              <button
                type="button"
                onClick={controls.onPause}
                className="hus-btn hus-btn-primary text-xs"
              >
                <PauseIcon width={14} height={14} />
                Tạm dừng
              </button>
            ) : controls.onStart ? (
              <button
                type="button"
                onClick={controls.onStart}
                className="hus-btn hus-btn-primary text-xs"
              >
                <PlayIcon width={14} height={14} />
                Chạy
              </button>
            ) : null}

            {controls.onNextStep ? (
              <button
                type="button"
                onClick={controls.onNextStep}
                disabled={controls.canNext === false}
                className="hus-btn hus-btn-secondary text-xs"
              >
                Bước tiếp
              </button>
            ) : null}

            {controls.onReset ? (
              <button
                type="button"
                onClick={controls.onReset}
                className="hus-btn hus-btn-ghost text-xs"
              >
                <RotateCcwIcon width={14} height={14} />
                Đặt lại
              </button>
            ) : null}
          </div>

          {controls.onSpeedChange ? (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
              <span>Tốc độ</span>
              <select
                value={controls.speed ?? 1}
                onChange={event => controls.onSpeedChange?.(Number(event.target.value))}
                className="min-h-[40px] rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              >
                {SPEED_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option}x
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
