import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import type {
  AxisProjectionStep,
  ChoiceReasoningStep,
  DiagramStep,
  EquationTransformStep,
  NumericUnitStep,
  SemiEssayStep,
} from '../../domain/semi-essay';
import {
  evaluateAxisProjectionStep,
  evaluateChoiceReasoningStep,
  evaluateEquationTransformMove,
  evaluateNumericUnitStep,
  type AxisProjectionEvaluation,
  type AxisProjectionSelection,
  type ChoiceReasoningEvaluation,
  type EquationTransformMoveEvaluation,
  type NumericUnitEvaluation,
} from '../../core/learning/semi-essay';
import {
  isPlainObject,
  isStringArray,
  isStringRecord,
  useInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import { getDiagramModule } from '../../modules/diagrams/registry';
import { AlertCircleIcon, CheckCircleIcon } from '../ui/Icons';
import Markdown from './Markdown';

export type ExamInteractiveMode = 'none' | 'exam-active' | 'exam-submitted';

export const STEP_KIND_LABEL: Record<SemiEssayStep['kind'], string> = {
  'choice-reasoning': 'Lập luận định tính',
  diagram: 'Biểu đồ tương tác',
  'axis-projection': 'Chiếu trục tọa độ',
  'equation-transform': 'Biến đổi phương trình',
  'numeric-unit': 'Tính toán & kiểm chứng',
  'written-reasoning': 'Tự viết lập luận',
};

function validateAxisSelections(
  raw: unknown,
): Readonly<Record<string, Readonly<Record<string, AxisProjectionSelection>>>> | null {
  if (!isPlainObject(raw)) return null;
  const axesEntries = Object.entries(raw);
  if (axesEntries.length > 20) return null;
  const out: Record<string, Readonly<Record<string, AxisProjectionSelection>>> = {};
  for (const [axisId, axisVal] of axesEntries) {
    if (axisId.length > 80 || !isPlainObject(axisVal)) return null;
    const rowEntries = Object.entries(axisVal);
    if (rowEntries.length > 30) return null;
    const axisOut: Record<string, AxisProjectionSelection> = {};
    for (const [forceId, cellVal] of rowEntries) {
      if (forceId.length > 80 || !isPlainObject(cellVal)) return null;
      const sign = cellVal.sign;
      const component = cellVal.component;
      if (
        (sign === '' || sign === '+' || sign === '-' || sign === '0') &&
        typeof component === 'string' &&
        component.length <= 80
      ) {
        axisOut[forceId] = { sign, component };
      } else {
        return null;
      }
    }
    out[axisId] = axisOut;
  }
  return out;
}

interface EquationTransformDraft {
  readonly stageIndex: number;
  readonly history: readonly {
    readonly label: string;
    readonly latex: string;
    readonly canceledLatex?: string;
  }[];
  readonly finished: boolean;
}

function validateEquationTransformDraft(raw: unknown): EquationTransformDraft | null {
  if (!isPlainObject(raw)) return null;
  if (
    typeof raw.stageIndex !== 'number' ||
    !Number.isInteger(raw.stageIndex) ||
    raw.stageIndex < 0 ||
    raw.stageIndex > 50 ||
    typeof raw.finished !== 'boolean' ||
    !Array.isArray(raw.history) ||
    raw.history.length > 50
  ) {
    return null;
  }
  const history: {
    readonly label: string;
    readonly latex: string;
    readonly canceledLatex?: string;
  }[] = [];
  for (const item of raw.history) {
    if (
      !isPlainObject(item) ||
      typeof item.label !== 'string' ||
      item.label.length > 300 ||
      typeof item.latex !== 'string' ||
      item.latex.length > 600 ||
      (item.canceledLatex !== undefined &&
        (typeof item.canceledLatex !== 'string' || item.canceledLatex.length > 300))
    ) {
      return null;
    }
    history.push({
      label: item.label,
      latex: item.latex,
      ...(typeof item.canceledLatex === 'string' ? { canceledLatex: item.canceledLatex } : {}),
    });
  }
  return {
    stageIndex: raw.stageIndex,
    history,
    finished: raw.finished,
  };
}

interface NumericUnitDraft {
  readonly limitChoice: string;
  readonly values: Readonly<Record<string, string>>;
}

function validateNumericUnitDraft(raw: unknown): NumericUnitDraft | null {
  if (!isPlainObject(raw)) return null;
  if (
    typeof raw.limitChoice !== 'string' ||
    raw.limitChoice.length > 120 ||
    !isStringRecord(raw.values, 30)
  ) {
    return null;
  }
  return {
    limitChoice: raw.limitChoice,
    values: raw.values,
  };
}

export function SemiEssayInteractiveStepBody({
  step,
  completed,
  fadeLevel,
  examMode = 'none',
  draftKey,
  onSolved,
}: {
  readonly step: Exclude<SemiEssayStep, { readonly kind: 'written-reasoning' }>;
  readonly completed: boolean;
  readonly fadeLevel: 0 | 1 | 2;
  readonly examMode?: ExamInteractiveMode | undefined;
  readonly draftKey?: string | undefined;
  readonly onSolved: () => void;
}) {
  if (step.kind === 'choice-reasoning') {
    return (
      <ChoiceReasoningStepView
        step={step}
        examMode={examMode}
        draftKey={draftKey}
        onSolved={onSolved}
      />
    );
  }
  if (step.kind === 'diagram') {
    return (
      <DiagramStepView
        step={step}
        completed={completed}
        fadeLevel={fadeLevel}
        examMode={examMode}
        draftKey={draftKey}
        onSolved={onSolved}
      />
    );
  }
  if (step.kind === 'axis-projection') {
    return (
      <AxisProjectionStepView
        step={step}
        examMode={examMode}
        draftKey={draftKey}
        onSolved={onSolved}
      />
    );
  }
  if (step.kind === 'equation-transform') {
    return (
      <EquationTransformStepView
        step={step}
        examMode={examMode}
        draftKey={draftKey}
        onSolved={onSolved}
      />
    );
  }
  return (
    <NumericUnitStepView
      step={step}
      examMode={examMode}
      draftKey={draftKey}
      onSolved={onSolved}
    />
  );
}

function ChoiceReasoningStepView({
  step,
  examMode,
  draftKey,
  onSolved,
}: {
  readonly step: ChoiceReasoningStep;
  readonly examMode: ExamInteractiveMode;
  readonly draftKey?: string | undefined;
  readonly onSolved: () => void;
}) {
  const [selected, setSelected] = useInteractiveStepDraft<readonly string[]>(
    draftKey,
    () => [],
    raw => (isStringArray(raw) ? raw : null),
  );
  const [evaluation, setEvaluation] = useState<ChoiceReasoningEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const isExamSurface = examMode !== 'none';
  const hideSpoilers = examMode === 'exam-active';

  const toggle = (id: string) => {
    setEvaluation(null);
    if (step.multiSelect) {
      setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) return;
    const res = evaluateChoiceReasoningStep(step, selected);
    setEvaluation(res);
    if (res.correct) onSolved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isExamSurface ? (
        <div
          role={step.multiSelect ? 'group' : 'radiogroup'}
          aria-label={step.title}
          className="space-y-2"
        >
          {step.choices.map(choice => {
            const isChecked = selected.includes(choice.id);
            return (
              <button
                key={choice.id}
                type="button"
                role={step.multiSelect ? undefined : 'radio'}
                aria-checked={step.multiSelect ? undefined : isChecked}
                aria-pressed={step.multiSelect ? isChecked : undefined}
                onClick={() => toggle(choice.id)}
                className={`flex min-h-[44px] w-full cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  isChecked
                    ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                    : 'border-border bg-canvas/60 text-ink hover:border-border-strong'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border ${
                    step.multiSelect ? 'rounded-[3px]' : 'rounded-full'
                  } ${
                    isChecked
                      ? 'border-accent bg-accent-solid text-white'
                      : 'border-border-strong bg-surface'
                  }`}
                >
                  {isChecked ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed">
                  <Markdown inline>{choice.label}</Markdown>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <fieldset className="space-y-2 border-0 p-0">
          <legend className="sr-only">{step.title}</legend>
          {step.choices.map(choice => {
            const isChecked = selected.includes(choice.id);
            return (
              <label
                key={choice.id}
                className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm transition-colors ${
                  isChecked
                    ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                    : 'border-border bg-canvas/60 text-ink hover:border-border-strong'
                }`}
              >
                <input
                  type={step.multiSelect ? 'checkbox' : 'radio'}
                  name={step.id}
                  checked={isChecked}
                  onChange={() => toggle(choice.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                />
                <span className="min-w-0 flex-1 leading-relaxed">
                  <Markdown inline>{choice.label}</Markdown>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={selected.length === 0} className="hus-btn hus-btn-primary">
          Kiểm tra lập luận
        </button>
        {step.hint && !hideSpoilers ? (
          <button
            type="button"
            onClick={() => setShowHint(v => !v)}
            className="hus-btn hus-btn-secondary"
          >
            {showHint ? 'Ẩn gợi ý' : 'Xem gợi ý'}
          </button>
        ) : null}
      </div>

      {showHint && step.hint && !hideSpoilers ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface-subtle px-3.5 py-2.5 text-xs text-ink-secondary">
          <Markdown inline>{step.hint}</Markdown>
        </p>
      ) : null}

      {evaluation ? (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-1.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            evaluation.correct
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-danger/35 bg-danger-subtle text-ink'
          }`}
        >
          <div className="flex items-start gap-2 font-medium">
            {evaluation.correct ? (
              <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-danger" />
            )}
            <span>
              {evaluation.correct
                ? 'Lập luận chính xác!'
                : hideSpoilers
                  ? 'Lập luận chưa khớp — hãy kiểm tra lại điều kiện áp dụng.'
                  : 'Lập luận chưa khớp bản chất vật lý:'}
            </span>
          </div>
          {!hideSpoilers
            ? evaluation.rationales.map(item => (
                <div key={item.choiceId} className="pl-6 text-xs leading-relaxed text-ink-secondary">
                  <Markdown inline>{item.rationale}</Markdown>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </form>
  );
}

function DiagramStepView({
  step,
  completed,
  fadeLevel,
  examMode,
  draftKey,
  onSolved,
}: {
  readonly step: DiagramStep;
  readonly completed: boolean;
  readonly fadeLevel: 0 | 1 | 2;
  readonly examMode: ExamInteractiveMode;
  readonly draftKey?: string | undefined;
  readonly onSolved: () => void;
}) {
  const LazyDiagram = useMemo(() => lazy(getDiagramModule(step.diagramKind).load), [step.diagramKind]);

  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Đang tải biểu đồ tương tác"
          className="h-64 animate-pulse rounded-[var(--radius-lg)] border border-border bg-surface-subtle"
        />
      }
    >
      <LazyDiagram
        spec={step.spec}
        completed={completed}
        fadeLevel={fadeLevel}
        hideSolutionOverlay={examMode === 'exam-active'}
        draftKey={draftKey}
        onEvaluated={res => {
          if (res.correct) onSolved();
        }}
      />
    </Suspense>
  );
}

function AxisProjectionStepView({
  step,
  examMode,
  draftKey,
  onSolved,
}: {
  readonly step: AxisProjectionStep;
  readonly examMode: ExamInteractiveMode;
  readonly draftKey?: string | undefined;
  readonly onSolved: () => void;
}) {
  const [selections, setSelections] = useInteractiveStepDraft<
    Readonly<Record<string, Readonly<Record<string, AxisProjectionSelection>>>>
  >(draftKey, () => ({}), validateAxisSelections);
  const [evaluation, setEvaluation] = useState<AxisProjectionEvaluation | null>(null);
  const hideSpoilers = examMode === 'exam-active';

  const setCell = (axisId: string, forceId: string, patch: Partial<AxisProjectionSelection>) => {
    setEvaluation(null);
    setSelections(prev => {
      const axisPrev = prev[axisId] ?? {};
      const rowPrev = axisPrev[forceId] ?? { sign: '', component: '' };
      return {
        ...prev,
        [axisId]: {
          ...axisPrev,
          [forceId]: { ...rowPrev, ...patch },
        },
      };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const res = evaluateAxisProjectionStep(step, selections);
    setEvaluation(res);
    if (res.correct) onSolved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step.contextNote ? <p className="text-xs text-ink-muted">{step.contextNote}</p> : null}

      {step.axes.map(axis => (
        <div
          key={axis.id}
          className="space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-canvas/70 p-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <h4 className="text-sm font-semibold text-ink">{axis.label}</h4>
            <span className="text-xs text-ink-muted">
              Vế phải: <Markdown inline>{`$${axis.rhsLatex}$`}</Markdown>
            </span>
          </div>

          <div className="space-y-2">
            {axis.rows.map(row => {
              const current = selections[axis.id]?.[row.forceId] ?? { sign: '', component: '' };
              return (
                <div
                  key={row.forceId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="min-w-[3.5rem] font-medium text-ink">
                    <Markdown inline>{`$${row.forceLatex}$`}</Markdown>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      role="group"
                      aria-label={`Dấu chiếu của ${row.forceId} trên ${axis.label}`}
                      className="flex gap-1"
                    >
                      {(['+', '-', '0'] as const).map(sign => (
                        <button
                          key={sign}
                          type="button"
                          aria-pressed={current.sign === sign}
                          onClick={() =>
                            setCell(axis.id, row.forceId, {
                              sign,
                              ...(sign === '0' ? { component: '0' } : {}),
                            })
                          }
                          className={`min-h-[38px] min-w-[38px] cursor-pointer rounded border font-mono text-xs font-semibold ${
                            current.sign === sign
                              ? 'border-accent bg-accent-subtle text-accent-ink'
                              : 'border-border bg-canvas text-ink'
                          }`}
                        >
                          {sign === '-' ? '−' : sign}
                        </button>
                      ))}
                    </div>

                    {current.sign !== '0' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {row.componentOptions.map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            data-opt={opt.id}
                            aria-pressed={current.component === opt.id}
                            onClick={() => setCell(axis.id, row.forceId, { component: opt.id })}
                            className={`min-h-[38px] cursor-pointer rounded border px-2.5 text-xs ${
                              current.component === opt.id
                                ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                                : 'border-border bg-canvas text-ink'
                            }`}
                          >
                            <Markdown inline>{`$${opt.latex}$`}</Markdown>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted">Vuông góc trục (hình chiếu = 0)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {evaluation?.correct && !hideSpoilers ? (
            <div className="rounded-[var(--radius-sm)] border border-success/35 bg-success-subtle px-3 py-2 text-xs text-success">
              Phương trình thu được: <Markdown inline>{`$${axis.resultingEquationLatex}$`}</Markdown>
            </div>
          ) : null}
        </div>
      ))}

      <button type="submit" className="hus-btn hus-btn-primary">
        Kiểm tra phép chiếu trục
      </button>

      {evaluation ? (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-1.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            evaluation.correct
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-warning/35 bg-warning-subtle text-ink'
          }`}
        >
          <div className="flex items-start gap-2 font-medium">
            {evaluation.correct ? (
              <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
            )}
            <span>
              {evaluation.correct
                ? 'Chiếu trục chính xác! Hệ phương trình đại số đã sẵn sàng để biến đổi.'
                : 'Một số thành phần chiếu chưa đúng:'}
            </span>
          </div>
          {!evaluation.correct && !hideSpoilers ? (
            <ul className="list-disc space-y-1 pl-6 text-xs text-ink-secondary">
              {evaluation.errors.map((err, i) => (
                <li key={i}>
                  <strong className="text-ink">{err.axisLabel}:</strong>{' '}
                  <Markdown inline>{err.hint}</Markdown>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function EquationTransformStepView({
  step,
  examMode,
  draftKey,
  onSolved,
}: {
  readonly step: EquationTransformStep;
  readonly examMode: ExamInteractiveMode;
  readonly draftKey?: string | undefined;
  readonly onSolved: () => void;
}) {
  const [transformDraft, setTransformDraft] = useInteractiveStepDraft<EquationTransformDraft>(
    draftKey,
    () => ({ stageIndex: 0, history: [], finished: false }),
    validateEquationTransformDraft,
  );
  const { stageIndex, history, finished } = transformDraft;
  const [lastFeedback, setLastFeedback] = useState<EquationTransformMoveEvaluation | null>(null);
  const hideSpoilers = examMode === 'exam-active';

  const currentStage = step.stages[stageIndex];

  const handleChooseOperation = (operationId: string) => {
    if (!currentStage || finished) return;
    const res = evaluateEquationTransformMove(currentStage, operationId);
    setLastFeedback(res);
    if (res.advance) {
      const op = currentStage.operations.find(o => o.id === operationId);
      const nextFinished = stageIndex + 1 >= step.stages.length;
      setTransformDraft(prev => ({
        stageIndex: nextFinished ? prev.stageIndex : prev.stageIndex + 1,
        finished: nextFinished,
        history: [
          ...prev.history,
          {
            label: op?.label ?? '',
            latex: res.resultLatex,
            ...(res.canceledLatex ? { canceledLatex: res.canceledLatex } : {}),
          },
        ],
      }));
      if (nextFinished) {
        onSolved();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-canvas/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-xs text-ink-muted">
          <span className="font-semibold text-ink">Hệ phương trình xuất phát</span>
          <span>
            Mục tiêu: <Markdown inline>{`$${step.goalLatex}$`}</Markdown>
          </span>
        </div>
        <div className="space-y-1.5">
          {step.initialEquations.map(eq => (
            <div key={eq.label} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-mono text-xs font-semibold text-ink-muted">{eq.label}</span>
              <Markdown inline>{`$${eq.latex}$`}</Markdown>
            </div>
          ))}
        </div>

        {history.length > 0 ? (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {history.map((line, i) => (
              <div
                key={i}
                className="space-y-1 rounded-[var(--radius-sm)] border border-success/30 bg-success-subtle/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-success">
                    Bước biến đổi {i + 1}: {line.label}
                  </span>
                  {line.canceledLatex ? (
                    <span className="rounded bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-muted line-through">
                      <Markdown inline>{`$${line.canceledLatex}$`}</Markdown>
                    </span>
                  ) : null}
                </div>
                <div className="text-ink">
                  <Markdown inline>{`$$${line.latex}$$`}</Markdown>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!finished && currentStage ? (
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-ink">
            Thao tác {stageIndex + 1}/{step.stages.length}:{' '}
            <Markdown inline>{currentStage.prompt}</Markdown>
          </p>
          <div className="grid gap-2">
            {currentStage.operations.map(op => (
              <button
                key={op.id}
                type="button"
                onClick={() => handleChooseOperation(op.id)}
                className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2.5 text-left text-sm text-ink transition-colors hover:border-accent hover:bg-accent-subtle/60"
              >
                <span className="font-medium">
                  <Markdown inline>{op.label}</Markdown>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {lastFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            lastFeedback.advance
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-warning/35 bg-warning-subtle text-ink'
          }`}
        >
          <div className="flex items-start gap-2 font-medium">
            {lastFeedback.advance ? (
              <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
            )}
            <span>
              <Markdown inline>{lastFeedback.feedback}</Markdown>
            </span>
          </div>
          {!lastFeedback.advance && lastFeedback.resultLatex && !hideSpoilers ? (
            <div className="rounded-[var(--radius-sm)] border border-border bg-canvas/80 px-3 py-2 text-xs text-ink-secondary">
              Kết quả phép thử này: <Markdown inline>{`$${lastFeedback.resultLatex}$`}</Markdown>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NumericUnitStepView({
  step,
  examMode,
  draftKey,
  onSolved,
}: {
  readonly step: NumericUnitStep;
  readonly examMode: ExamInteractiveMode;
  readonly draftKey?: string | undefined;
  readonly onSolved: () => void;
}) {
  const [numericDraft, setNumericDraft] = useInteractiveStepDraft<NumericUnitDraft>(
    draftKey,
    () => ({ limitChoice: '', values: {} }),
    validateNumericUnitDraft,
  );
  const { limitChoice, values } = numericDraft;
  const [evaluation, setEvaluation] = useState<NumericUnitEvaluation | null>(null);
  const isExamSurface = examMode !== 'none';
  const hideSpoilers = examMode === 'exam-active';
  const limitChecked =
    !step.limitingCheck ||
    (limitChoice !== '' && (hideSpoilers || limitChoice === step.limitingCheck.answerId));

  const setLimitChoice = (choiceId: string) => {
    setNumericDraft(prev => ({ ...prev, limitChoice: choiceId }));
  };

  const selectedLimitObj = step.limitingCheck?.choices.find(c => c.id === limitChoice);
  const limitCorrect = step.limitingCheck ? limitChoice === step.limitingCheck.answerId : true;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const res = evaluateNumericUnitStep(step, values);
    setEvaluation(res);
    if (res.correct && limitCorrect) {
      onSolved();
    }
  };

  return (
    <div className="space-y-4">
      {step.limitingCheck ? (
        <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-[var(--hus-starlight)]/40 bg-surface-subtle/60 p-4">
          <h4 className="text-sm font-semibold text-ink">Kiểm chứng công thức (Trường hợp biên)</h4>
          <p className="text-xs leading-relaxed text-ink-secondary">
            <Markdown inline>{step.limitingCheck.prompt}</Markdown>
          </p>
          {isExamSurface ? (
            <div
              role="radiogroup"
              aria-label="Kiểm chứng trường hợp biên"
              className="space-y-1.5"
            >
              {step.limitingCheck.choices.map(ch => {
                const isSelected = limitChoice === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setLimitChoice(ch.id);
                    }}
                    className={`flex min-h-[42px] w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2 text-left text-xs ${
                      isSelected
                        ? 'border-accent bg-surface font-medium text-accent-ink'
                        : 'border-border bg-surface/70 text-ink'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-accent bg-accent-solid text-white'
                          : 'border-border-strong bg-surface'
                      }`}
                    >
                      {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                    </span>
                    <span>
                      <Markdown inline>{ch.label}</Markdown>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              {step.limitingCheck.choices.map(ch => (
                <label
                  key={ch.id}
                  className={`flex min-h-[42px] cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2 text-xs ${
                    limitChoice === ch.id
                      ? 'border-accent bg-surface font-medium text-accent-ink'
                      : 'border-border bg-surface/70 text-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${step.id}-limit`}
                    checked={limitChoice === ch.id}
                    onChange={() => {
                      setLimitChoice(ch.id);
                    }}
                    className="h-4 w-4 accent-[var(--hus-accent)]"
                  />
                  <span>
                    <Markdown inline>{ch.label}</Markdown>
                  </span>
                </label>
              ))}
            </div>
          )}
          {selectedLimitObj && !hideSpoilers ? (
            <p className={`text-xs ${limitCorrect ? 'text-success' : 'text-danger'}`}>
              <Markdown inline>{selectedLimitObj.rationale}</Markdown>
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {step.fields.map(field => (
            <div key={field.id} className="space-y-1.5">
              <label htmlFor={`${step.id}-${field.id}`} className="block text-xs font-medium text-ink">
                {field.label} (<Markdown inline>{`$${field.symbolLatex}$`}</Markdown>)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${step.id}-${field.id}`}
                  type="text"
                  inputMode="decimal"
                  value={values[field.id] ?? ''}
                  onChange={e => {
                    setEvaluation(null);
                    const nextVal = e.target.value;
                    setNumericDraft(prev => ({
                      ...prev,
                      values: { ...prev.values, [field.id]: nextVal },
                    }));
                  }}
                  placeholder="vd: 0,47"
                  className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3 py-2 font-mono text-sm tabular-nums text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
                <span className="shrink-0 font-mono text-xs text-ink-muted">{field.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <button type="submit" disabled={!limitChecked} className="hus-btn hus-btn-primary">
          Kiểm tra kết quả số
        </button>

        {!limitChecked ? (
          <p className="text-xs text-ink-muted">
            Hãy hoàn thành câu kiểm chứng trường hợp biên ở trên trước khi nộp kết quả số.
          </p>
        ) : null}

        {evaluation ? (
          <div
            role="status"
            aria-live="polite"
            className={`space-y-1.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
              evaluation.correct
                ? 'border-success/35 bg-success-subtle text-success'
                : 'border-warning/35 bg-warning-subtle text-ink'
            }`}
          >
            <div className="flex items-start gap-2 font-medium">
              {evaluation.correct ? (
                <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
              ) : (
                <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
              )}
              <span>
                {evaluation.correct
                  ? 'Chính xác! Bạn đã hoàn thành bước kiểm chứng số liệu.'
                  : 'Kiểm tra lại kết quả:'}
              </span>
            </div>
            {!hideSpoilers ? (
              <ul className="list-disc space-y-1 pl-6 text-xs text-ink-secondary">
                {evaluation.fields.map(f => (
                  <li key={f.fieldId}>{f.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
