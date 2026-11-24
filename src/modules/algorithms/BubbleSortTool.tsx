import { useEffect, useState, type KeyboardEvent } from 'react';
import { bubbleSortSteps } from '../../core/learning/replay';
import { VisualizationFrame } from '../../components/learning/VisualizationFrame';

const INITIAL_VALUES = [5, 1, 4, 2, 3] as const;
const steps = bubbleSortSteps(INITIAL_VALUES);
const MAX_VALUE = Math.max(...INITIAL_VALUES);

export default function BubbleSortTool() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setIndex(i => {
          if (i >= steps.length - 1) return i;
          return i + 1;
        }),
      1000 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  useEffect(() => {
    if (index === steps.length - 1) setPlaying(false);
  }, [index]);

  const step = steps[index];
  if (!step) return null;

  const comparedSet = new Set(step.compared ?? []);
  const sortedFrom = step.sortedFrom ?? step.values.length;
  const progressPct = Math.round((index / Math.max(1, steps.length - 1)) * 100);

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPlaying(false);
      setIndex(i => Math.min(steps.length - 1, i + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPlaying(false);
      setIndex(i => Math.max(0, i - 1));
    } else if (event.key === ' ') {
      event.preventDefault();
      if (playing) {
        setPlaying(false);
      } else {
        if (index === steps.length - 1) setIndex(0);
        setPlaying(true);
      }
    }
  };

  return (
    <VisualizationFrame
      title="Sắp xếp nổi bọt"
      description="Ví dụ thuật toán độc lập; không phải bài giảng MAT3504 đã chuyển đổi."
      stepLabel={`Bước ${index + 1}/${steps.length}`}
      controls={{
        isPlaying: playing,
        canPrev: index > 0,
        canNext: index < steps.length - 1,
        speed,
        onStart: () => {
          if (index === steps.length - 1) setIndex(0);
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
          setIndex(i => Math.min(steps.length - 1, i + 1));
        },
        onSpeedChange: setSpeed,
      }}
    >
      {/* Legend — communicates state with border style + text, not color alone */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[2px] border border-border-strong bg-surface-subtle" />
          Chưa sắp xếp
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[2px] border-2 border-accent bg-accent-subtle" />
          Đang so sánh
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[2px] border-2 border-dashed border-warning bg-warning-subtle" />
          Vừa đổi chỗ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[2px] border border-success bg-success-subtle" />
          Đúng vị trí
        </span>
      </div>

      {/* Bar chart stage — keyboard focusable for ArrowLeft / ArrowRight / Space stepping */}
      <div
        tabIndex={0}
        onKeyDown={handleStageKeyDown}
        aria-label="Khu vực mô phỏng sắp xếp nổi bọt. Dùng phím mũi tên trái, phải để chuyển bước hoặc phím Space để chạy/tạm dừng."
        className="rounded-[var(--radius-md)] border border-border bg-canvas px-4 pb-4 pt-6 focus-visible:border-accent"
      >
        <ol
          aria-label="Dãy số"
          className="flex min-h-[144px] flex-wrap items-end justify-center gap-3 sm:gap-4"
        >
          {step.values.map((value, i) => {
            const isCompared = comparedSet.has(i);
            const isSwapped = isCompared && step.swapped === true;
            const isSorted = i >= sortedFrom;
            const heightPx = Math.max(44, Math.round((value / MAX_VALUE) * 124));

            let barStyle = 'border border-border-strong bg-surface text-ink';
            let stateLabel = 'chưa sắp xếp';
            if (isSwapped) {
              barStyle =
                'border-2 border-dashed border-warning bg-warning-subtle text-warning font-semibold';
              stateLabel = 'vừa đổi chỗ';
            } else if (isCompared) {
              barStyle =
                'border-2 border-accent bg-accent-subtle text-accent-ink font-semibold';
              stateLabel = 'đang so sánh';
            } else if (isSorted) {
              barStyle =
                'border border-success/50 bg-success-subtle text-success font-medium';
              stateLabel = 'đã đúng vị trí';
            }

            return (
              <li key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex w-11 items-center justify-center rounded-[var(--radius-sm)] font-mono text-sm tabular-nums transition-[height,background-color,border-color] duration-200 ease-[var(--hus-ease)] sm:w-12 ${barStyle}`}
                  style={{ height: `${heightPx}px` }}
                  aria-label={`Phần tử vị trí ${i}: giá trị ${value}, ${stateLabel}`}
                >
                  {value}
                </div>
                <span className="font-mono text-xs tabular-nums text-ink-muted">[{i}]</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step progress & synchronized explanation */}
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
          {step.explanation}
        </p>
      </div>
    </VisualizationFrame>
  );
}
