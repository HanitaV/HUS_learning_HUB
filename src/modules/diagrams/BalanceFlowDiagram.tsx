import { useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { BalanceFlowBarSpec, BalanceFlowStepSpec } from '../../domain/semi-essay';
import { gradeBalanceFlowStep, type BalanceFlowGradeResult } from '../../core/learning/balance-flow';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';
import Markdown from '../../components/learning/Markdown';

export default function BalanceFlowDiagram({ spec, onEvaluated }: DiagramRendererProps) {
  const lolSpec = spec as BalanceFlowStepSpec;
  const maxLevel = lolSpec.maxLevel ?? 4;

  const [initialLevels, setInitialLevels] = useState<Readonly<Record<string, number>>>(() =>
    Object.fromEntries(lolSpec.initialBars.map(b => [b.id, 0])),
  );
  const [finalLevels, setFinalLevels] = useState<Readonly<Record<string, number>>>(() =>
    Object.fromEntries(lolSpec.finalBars.map(b => [b.id, 0])),
  );
  const [transferSign, setTransferSign] = useState<'-' | '0' | '+' | ''>('');
  const [grade, setGrade] = useState<BalanceFlowGradeResult | null>(null);

  const adjustBar = (side: 'initial' | 'final', barId: string, delta: number) => {
    setGrade(null);
    const setter = side === 'initial' ? setInitialLevels : setFinalLevels;
    setter(prev => {
      const nextVal = Math.max(0, Math.min(maxLevel, (prev[barId] ?? 0) + delta));
      return { ...prev, [barId]: nextVal };
    });
  };

  const handleCheck = () => {
    const res = gradeBalanceFlowStep({ initialLevels, finalLevels, transferSign }, lolSpec);
    setGrade(res);
    onEvaluated({
      correct: res.correct,
      summary: res.correct
        ? 'Biểu đồ năng lượng LOL chính xác.'
        : 'Biểu đồ năng lượng cần điều chỉnh theo bảo toàn cơ năng.',
    });
  };

  const handleReset = () => {
    setInitialLevels(Object.fromEntries(lolSpec.initialBars.map(b => [b.id, 0])));
    setFinalLevels(Object.fromEntries(lolSpec.finalBars.map(b => [b.id, 0])));
    setTransferSign('');
    setGrade(null);
  };

  const renderBarColumn = (
    side: 'initial' | 'final',
    title: string,
    bars: readonly BalanceFlowBarSpec[],
    levels: Readonly<Record<string, number>>,
  ) => (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-canvas p-3.5">
      <p className="text-center text-xs font-semibold text-ink">{title}</p>
      <div className="flex items-end justify-center gap-4 pt-2">
        {bars.map(bar => {
          const level = levels[bar.id] ?? 0;
          return (
            <div key={bar.id} className="flex flex-col items-center gap-2">
              {/* Bar stack */}
              <div
                aria-label={`${bar.label}: ${level}/${maxLevel} vạch`}
                className="flex h-28 w-12 flex-col-reverse gap-1 rounded-[var(--radius-sm)] border border-border bg-surface p-1"
              >
                {Array.from({ length: maxLevel }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-[2px] transition-colors duration-150 ${
                      idx < level ? 'bg-[var(--hus-accent)]' : 'bg-surface-subtle'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-ink">
                <Markdown inline>{`$${bar.symbolLatex}$`}</Markdown>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-bar={`${side}-${bar.id}-dec`}
                  aria-label={`Giảm ${bar.label}`}
                  onClick={() => adjustBar(side, bar.id, -1)}
                  className="min-h-[36px] min-w-[36px] cursor-pointer rounded border border-border bg-surface font-mono text-sm font-semibold text-ink hover:border-border-strong"
                >
                  −
                </button>
                <span className="w-5 text-center font-mono text-xs tabular-nums text-ink-muted">
                  {level}
                </span>
                <button
                  type="button"
                  data-bar={`${side}-${bar.id}-inc`}
                  aria-label={`Tăng ${bar.label}`}
                  onClick={() => adjustBar(side, bar.id, 1)}
                  className="min-h-[36px] min-w-[36px] cursor-pointer rounded border border-border bg-surface font-mono text-sm font-semibold text-ink hover:border-border-strong"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {lolSpec.note ? <p className="text-sm text-ink-secondary">{lolSpec.note}</p> : null}

      {/* LOL 3-column layout: Initial Bars | System & Work Transfer | Final Bars */}
      <div className="grid gap-3 md:grid-cols-[1fr_minmax(0,180px)_1fr] md:items-stretch">
        {renderBarColumn('initial', lolSpec.initialLabel, lolSpec.initialBars, initialLevels)}

        {/* Center System Circle & External Work Transfer */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hus-starlight)]/45 bg-surface-subtle/70 p-3.5 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[var(--hus-starlight)] bg-surface px-2 text-[11px] font-semibold leading-tight text-ink">
            {lolSpec.systemLabel}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink">
              {lolSpec.transferLabel} (<Markdown inline>{`$${lolSpec.transferSymbolLatex}$`}</Markdown>)
            </p>
            <div role="group" aria-label={`Dấu của ${lolSpec.transferLabel}`} className="flex justify-center gap-1.5">
              {(
                [
                  { id: '-', label: 'Âm (−)' },
                  { id: '0', label: '0' },
                  { id: '+', label: 'Dương (+)' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  data-transfer={opt.id}
                  aria-pressed={transferSign === opt.id}
                  onClick={() => {
                    setGrade(null);
                    setTransferSign(opt.id);
                  }}
                  className={`min-h-[38px] cursor-pointer rounded border px-2 text-xs font-medium ${
                    transferSign === opt.id
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-surface text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {renderBarColumn('final', lolSpec.finalLabel, lolSpec.finalBars, finalLevels)}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra biểu đồ năng lượng
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
                ? 'Chính xác! Biểu đồ năng lượng LOL phản ánh đúng trạng thái đầu, cuối và công lực ma sát.'
                : 'Biểu đồ năng lượng còn điểm chưa khớp:'}
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
