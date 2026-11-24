import { useEffect, useRef, useState } from 'react';
import type { CodeWalkthrough } from '../../domain/code-lesson';
import { Badge } from '../ui/Badge';
import { CheckIcon, CopyIcon, PauseIcon, PlayIcon } from '../ui/Icons';

export interface CodeWalkthroughPlayerProps {
  readonly walkthrough: CodeWalkthrough;
}

const TRANSITION_CLS =
  'transition-[background-color,border-color,opacity,color] duration-200 motion-reduce:transition-none';

function CodeWalkthroughPlayerInner({ walkthrough }: CodeWalkthroughPlayerProps) {
  const steps = walkthrough.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoPlaying || showFull || steps.length <= 1) return;
    const timer = window.setInterval(() => {
      setStepIndex(prev => {
        if (prev >= steps.length - 1) return prev;
        return prev + 1;
      });
    }, 2400);
    return () => window.clearInterval(timer);
  }, [autoPlaying, showFull, steps.length]);

  useEffect(() => {
    if (steps.length > 0 && stepIndex >= steps.length - 1) {
      setAutoPlaying(false);
    }
  }, [stepIndex, steps.length]);

  const safeIndex = steps.length === 0 ? 0 : Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[safeIndex];
  const displayedCode = showFull || !currentStep ? walkthrough.fullCode : currentStep.code;
  const codeLines = displayedCode.split('\n');
  const highlightSet = new Set(
    showFull || !currentStep ? [] : currentStep.highlightLines,
  );
  const languageLabel = walkthrough.language.trim().toUpperCase() || 'CODE';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedCode);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Clipboard may be blocked in non-secure contexts; fail silently without throwing.
    }
  };

  const handleSelectStep = (idx: number) => {
    setAutoPlaying(false);
    setShowFull(false);
    setStepIndex(idx);
  };

  const handleToggleFull = () => {
    setAutoPlaying(false);
    setShowFull(prev => !prev);
  };

  const handlePrev = () => {
    setAutoPlaying(false);
    setShowFull(false);
    setStepIndex(i => Math.max(0, i - 1));
  };

  const handleNext = () => {
    setAutoPlaying(false);
    setShowFull(false);
    setStepIndex(i => Math.min(steps.length - 1, i + 1));
  };

  const handleToggleAutoPlay = () => {
    if (autoPlaying) {
      setAutoPlaying(false);
      return;
    }
    setShowFull(false);
    if (safeIndex >= steps.length - 1) {
      setStepIndex(0);
    }
    setAutoPlaying(true);
  };

  return (
    <section
      aria-label={walkthrough.title}
      className="hus-card-surface overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-medium text-ink sm:text-lg">
            {walkthrough.title}
          </h3>
          <Badge tone="accent" mono>
            {languageLabel}
          </Badge>
          {steps.length > 0 ? (
            <Badge tone="neutral" mono>
              {showFull ? `Toàn bộ (${codeLines.length} dòng)` : `Bước ${safeIndex + 1}/${steps.length}`}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {steps.length > 0 ? (
            <button
              type="button"
              onClick={handleToggleFull}
              className="hus-btn hus-btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
            >
              {showFull ? 'Thu gọn từng bước' : 'Xem toàn bộ'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            aria-label={copied ? 'Đã sao chép mã nguồn' : 'Sao chép mã nguồn'}
            className="hus-btn hus-btn-ghost min-h-[36px] px-2.5 py-1.5 text-xs"
          >
            {copied ? <CheckIcon width={14} height={14} className="text-success" /> : <CopyIcon width={14} height={14} />}
            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-4 sm:p-5">
        {/* Step pills */}
        {steps.length > 0 ? (
          <nav aria-label="Các bước xây dựng mã nguồn" className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, idx) => {
              const isSelected = !showFull && idx === safeIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectStep(idx)}
                  className={`min-h-[34px] rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium ${TRANSITION_CLS} ${
                    isSelected
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-surface-subtle/60 text-ink-secondary hover:border-border-strong hover:text-ink'
                  }`}
                >
                  Bước {idx + 1}
                </button>
              );
            })}
          </nav>
        ) : null}

        {/* Step explanation banner */}
        {!showFull && currentStep ? (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-[var(--radius-md)] border border-accent/35 bg-accent-subtle/40 px-4 py-3 ${TRANSITION_CLS}`}
          >
            <p className="text-sm font-semibold text-ink">{currentStep.title}</p>
            <p className="mt-1 text-sm text-ink-secondary">{currentStep.explanation}</p>
            {currentStep.note ? (
              <p className="mt-1.5 font-mono text-xs text-accent-ink">{currentStep.note}</p>
            ) : null}
          </div>
        ) : null}

        {/* Scrollable code panel */}
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-canvas">
          <pre className="m-0 py-3 font-mono text-xs leading-relaxed sm:text-[13px]">
            <code>
              {codeLines.map((lineText, idx) => {
                const lineNumber = idx + 1;
                const isHighlighted = highlightSet.has(lineNumber);

                return (
                  <div
                    key={lineNumber}
                    className={`flex min-w-max items-baseline pr-4 ${TRANSITION_CLS} ${
                      isHighlighted
                        ? 'border-l-2 border-accent bg-accent-subtle/50 text-ink'
                        : 'border-l-2 border-transparent text-ink-secondary'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex w-10 shrink-0 select-none items-center justify-end gap-1 pr-3 text-right text-[11px] tabular-nums text-ink-muted"
                    >
                      <span>{lineNumber}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`inline-block w-4 shrink-0 select-none text-center font-semibold ${
                        isHighlighted ? 'text-accent' : 'text-transparent'
                      }`}
                    >
                      +
                    </span>
                    <span className="whitespace-pre">{lineText.length > 0 ? lineText : ' '}</span>
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
      </div>

      {/* Bottom controls */}
      {steps.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-subtle/60 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!showFull && safeIndex <= 0}
            className="hus-btn hus-btn-secondary text-xs"
          >
            Bước trước
          </button>

          <button
            type="button"
            onClick={handleToggleAutoPlay}
            disabled={steps.length <= 1}
            className="hus-btn hus-btn-primary text-xs"
          >
            {autoPlaying ? (
              <>
                <PauseIcon width={14} height={14} />
                Tạm dừng
              </>
            ) : (
              <>
                <PlayIcon width={14} height={14} />
                Tự chạy
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!showFull && safeIndex >= steps.length - 1}
            className="hus-btn hus-btn-secondary text-xs"
          >
            Bước tiếp theo
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function CodeWalkthroughPlayer({ walkthrough }: CodeWalkthroughPlayerProps) {
  return <CodeWalkthroughPlayerInner key={walkthrough.id} walkthrough={walkthrough} />;
}

export default CodeWalkthroughPlayer;
