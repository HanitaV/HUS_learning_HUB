import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type {
  CoachingPromptMode,
  CourseConventionCanon,
  CurriculumChunk,
  CurriculumHorizon,
  CurriculumSearchHit,
  TutorCoachingFeedback,
} from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import type { MathSymbolContext } from '../../domain/math-symbols';
import type {
  AxisProjectionStep,
  ChoiceReasoningStep,
  DiagramStep,
  EquationTransformStep,
  NumericUnitStep,
  SemiEssayExercise,
  SemiEssayStep,
  WrittenReasoningStep,
} from '../../domain/semi-essay';
import {
  buildGroundedEssayContextPacket,
  composeExamReadyEssay,
  searchCurriculumChunks,
  synthesizeFallbackTheoryAnchors,
} from '../../core/learning/curriculum-rag';
import {
  buildSynthesizedEssay,
  emptyWrittenStepDraft,
  evaluateAxisProjectionStep,
  evaluateChoiceReasoningStep,
  evaluateEquationTransformMove,
  evaluateNumericUnitStep,
  evaluateWrittenReasoningReview,
  type AxisProjectionEvaluation,
  type AxisProjectionSelection,
  type ChoiceReasoningEvaluation,
  type EquationTransformMoveEvaluation,
  type NumericUnitEvaluation,
} from '../../core/learning/semi-essay';
import {
  loadStoredTutorFeedback,
  parseExternalTutorFeedback,
  saveStoredTutorFeedback,
} from '../../infrastructure/ai/tutor-feedback-parser';
import {
  detectWebMcpSupport,
  registerEssayWebMcpTools,
} from '../../infrastructure/ai/webmcp-essay-bridge';
import { getDiagramModule } from '../../modules/diagrams/registry';
import { Badge } from '../ui/Badge';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
} from '../ui/Icons';
import Markdown from './Markdown';
import { NotebookLmExportControl } from './NotebookLmExportControl';
import { TheoryReferenceRail } from './TheoryReferenceRail';
import { WrittenReasoningStepView } from './WrittenReasoningStepView';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import { useWrittenDrafts } from '../../app/useWrittenDrafts';
import { renderTextByMathMode } from '../../core/learning/math-shorthand';
import '../../styles/written-practice.css';

export interface SemiEssayStudioProps {
  readonly exercise: SemiEssayExercise;
  readonly courseId?: EntityId | undefined;
  readonly canon?: CourseConventionCanon | undefined;
  readonly horizon?: CurriculumHorizon | undefined;
  readonly curriculumChunks?: readonly CurriculumChunk[] | undefined;
  readonly onSearchCourseCurriculum?:
    | ((query: string, expandCourse: boolean) => Promise<readonly CurriculumSearchHit[]>)
    | undefined;
  readonly lessonTitle: string;
  readonly lessonUrl: string;
  readonly previouslySolved: boolean;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly onCompleteExercise: (outcome: 'graded' | 'self-reviewed') => void;
}

const STEP_KIND_LABEL: Record<SemiEssayStep['kind'], string> = {
  'choice-reasoning': 'Lập luận định tính',
  diagram: 'Biểu đồ tương tác',
  'axis-projection': 'Chiếu trục tọa độ',
  'equation-transform': 'Biến đổi phương trình',
  'numeric-unit': 'Tính toán & kiểm chứng',
  'written-reasoning': 'Tự viết lập luận',
};

export function SemiEssayStudio({
  exercise,
  courseId,
  canon,
  horizon,
  curriculumChunks = [],
  onSearchCourseCurriculum,
  lessonTitle,
  lessonUrl,
  previouslySolved,
  symbolContext,
  onCompleteExercise,
}: SemiEssayStudioProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visitedStepIds, setVisitedStepIds] = useState<readonly string[]>(
    exercise.steps[0] ? [exercise.steps[0].id] : [],
  );
  const [completedStepIds, setCompletedStepIds] = useState<readonly string[]>([]);
  const { preferences: mathPreferences } = useMathSymbolPreferences();
  const { drafts, updateDraft, resetDrafts, error } = useWrittenDrafts(exercise);
  const [resetVersion, setResetVersion] = useState(0);
  const [coachingByStepId, setCoachingByStepId] = useState<
    Readonly<Record<string, TutorCoachingFeedback>>
  >(() => loadStoredTutorFeedback(exercise));
  const [webMcpAvailable, setWebMcpAvailable] = useState<boolean>(
    () => detectWebMcpSupport().available,
  );
  const [essayCopied, setEssayCopied] = useState(false);

  const completedSet = useMemo(() => {
    const completed = new Set(completedStepIds);
    for (const step of exercise.steps) {
      if (
        step.kind === 'written-reasoning' &&
        evaluateWrittenReasoningReview(step, drafts[step.id] ?? emptyWrittenStepDraft()).complete
      ) {
        completed.add(step.id);
      }
    }
    return completed;
  }, [completedStepIds, drafts, exercise.steps]);
  const exerciseFinished = completedSet.size === exercise.steps.length;
  const hasWrittenSteps = exercise.steps.some(step => step.kind === 'written-reasoning');
  const activeStep = exercise.steps[activeIndex] ?? exercise.steps[0];
  const fadeLevel = exercise.fadeLevel ?? 0;

  // Auto-populate TheoryReferenceRail from verified lesson chunks when `exercise.theoryAnchors` is empty
  const resolvedTheory = useMemo(
    () => synthesizeFallbackTheoryAnchors(curriculumChunks, exercise, activeIndex),
    [curriculumChunks, exercise, activeIndex],
  );

  const applyCoachingFeedback = (feedback: TutorCoachingFeedback) => {
    setCoachingByStepId(prev => {
      const next = { ...prev, [feedback.stepId]: feedback };
      saveStoredTutorFeedback(exercise.id, next);
      return next;
    });
  };

  const clearStepCoaching = (stepId: string) => {
    setCoachingByStepId(prev => {
      const copy = { ...prev };
      delete copy[stepId];
      saveStoredTutorFeedback(exercise.id, copy);
      return copy;
    });
  };

  const buildStepPacket = (step: WrittenReasoningStep, stepNumber: number, mode: CoachingPromptMode) => {
    if (!canon) return null;
    return buildGroundedEssayContextPacket({
      mode,
      canon,
      horizon,
      exercise,
      step,
      stepNumber,
      draft: drafts[step.id] ?? emptyWrittenStepDraft(),
      chunks: curriculumChunks,
      effectiveTheoryAnchors: resolvedTheory.anchors,
    });
  };

  // Keep live bindings in a ref so WebMCP tools never tear down on keystrokes
  const liveBridgeRef = useRef({
    exercise,
    activeStep,
    activeIndex,
    canon,
    curriculumChunks,
    onSearchCourseCurriculum,
    buildStepPacket,
    applyCoachingFeedback,
  });
  liveBridgeRef.current = {
    exercise,
    activeStep,
    activeIndex,
    canon,
    curriculumChunks,
    onSearchCourseCurriculum,
    buildStepPacket,
    applyCoachingFeedback,
  };

  useEffect(() => {
    if (!canon) return;
    const registration = registerEssayWebMcpTools({
      getExercise: () => liveBridgeRef.current.exercise,
      getActiveStepId: () => liveBridgeRef.current.activeStep?.id ?? '',
      getContextPacket: mode => {
        const curStep = liveBridgeRef.current.activeStep;
        if (!curStep || curStep.kind !== 'written-reasoning') return null;
        return liveBridgeRef.current.buildStepPacket(
          curStep,
          liveBridgeRef.current.activeIndex + 1,
          mode,
        );
      },
      searchCurriculum: async (query, expandCourse) => {
        if (liveBridgeRef.current.onSearchCourseCurriculum) {
          return liveBridgeRef.current.onSearchCourseCurriculum(query, expandCourse);
        }
        return searchCurriculumChunks(liveBridgeRef.current.curriculumChunks, query, { limit: 4 });
      },
      onReceiveFeedback: feedback => {
        liveBridgeRef.current.applyCoachingFeedback(feedback);
      },
    });
    setWebMcpAvailable(registration.support.available);
    return () => {
      registration.dispose();
    };
  }, [canon, exercise.id]);

  const markStepCompleted = (stepId: string) => {
    const nextCompleted = completedSet.has(stepId)
      ? completedStepIds
      : [...completedStepIds, stepId];
    setCompletedStepIds(nextCompleted);

    if (new Set([...completedSet, stepId]).size === exercise.steps.length && !exerciseFinished) {
      onCompleteExercise(hasWrittenSteps ? 'self-reviewed' : 'graded');
    }
  };

  const handleRestartAll = () => {
    setActiveIndex(0);
    setVisitedStepIds(exercise.steps[0] ? [exercise.steps[0].id] : []);
    setCompletedStepIds([]);
    resetDrafts();
    setCoachingByStepId({});
    saveStoredTutorFeedback(exercise.id, {});
    setResetVersion(v => v + 1);
  };

  const synthesizedSections = useMemo(
    () => buildSynthesizedEssay(exercise, completedSet),
    [exercise, completedSet],
  );

  const composedExamMarkdown = useMemo(
    () =>
      renderTextByMathMode(
        composeExamReadyEssay(exercise, drafts, completedSet),
        mathPreferences.insertMode,
      ),
    [exercise, drafts, completedSet, mathPreferences.insertMode],
  );

  const handleCopyComposedEssay = async () => {
    try {
      await navigator.clipboard.writeText(composedExamMarkdown);
      setEssayCopied(true);
      window.setTimeout(() => setEssayCopied(false), 2500);
    } catch {
      // Ignore clipboard failures silently
    }
  };

  if (!activeStep) return null;

  return (
    <div className="space-y-6">
      {/* Top Studio Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={lessonUrl}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <ArrowLeftIcon width={14} height={14} />
              Về bài học: {lessonTitle}
            </Link>
            {previouslySolved || exerciseFinished ? (
              <Badge tone="success">{hasWrittenSteps ? 'Đã tự đối chiếu' : 'Đã hoàn thành'}</Badge>
            ) : null}
          </div>
          <h1 className="heading-page text-ink">{exercise.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {courseId ? (
            <NotebookLmExportControl
              courseId={courseId}
              courseCode={canon?.academicCode}
              filterChapterId={horizon?.currentChapterId}
              variant="compact"
            />
          ) : null}
          <span className="font-mono text-xs font-medium tabular-nums text-ink-muted">
            Tiến độ: {completedSet.size}/{exercise.steps.length} bước
          </span>
          <button
            type="button"
            onClick={handleRestartAll}
            className="hus-btn hus-btn-secondary text-xs"
          >
            <RotateCcwIcon width={13} height={13} />
            Làm lại toàn bài
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {/* Main 2-Column Parallel Workspace */}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-start">
        <TheoryReferenceRail
          problemPrompt={exercise.prompt}
          given={exercise.given}
          theoryAnchors={resolvedTheory.anchors}
          activeAnchorIds={resolvedTheory.activeAnchorIds}
          activeStepNumber={activeIndex + 1}
          lessonTitle={lessonTitle}
          lessonUrl={lessonUrl}
        />

        {/* Right column: Semi-essay step timeline */}
        <div key={resetVersion} className="min-w-0 space-y-4">
          <ol className="min-w-0 space-y-3" aria-label="Các bước giải tự luận">
            {exercise.steps.map((step, idx) => {
              const isDone = completedSet.has(step.id);
              const isActive = idx === activeIndex;
              const isUnlocked =
                idx === 0 || isDone || completedSet.has(exercise.steps[idx - 1]!.id);

              return (
                <li
                  key={step.id}
                  className={`min-w-0 scroll-mt-24 rounded-[var(--radius-xl)] border transition-colors duration-150 ${
                    isActive
                      ? 'border-accent/60 bg-surface'
                      : isDone
                        ? 'border-border bg-surface/75'
                        : 'border-border bg-surface-subtle/40'
                  }`}
                >
                  {/* Step Header Button */}
                  <button
                    type="button"
                    disabled={!isUnlocked}
                    aria-expanded={isActive}
                    onClick={() => {
                      if (isUnlocked) {
                        setActiveIndex(idx);
                        setVisitedStepIds(prev =>
                          prev.includes(step.id) ? prev : [...prev, step.id],
                        );
                      }
                    }}
                    className={`flex min-h-[52px] w-full flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-left sm:flex-nowrap sm:gap-3 sm:px-5 ${
                      isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-65'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold tabular-nums ${
                          isDone
                            ? 'border-success/40 bg-success-subtle text-success'
                            : isActive
                              ? 'border-accent bg-accent-subtle text-accent-ink'
                              : 'border-border bg-canvas text-ink-muted'
                        }`}
                      >
                        {isDone ? <CheckCircleIcon width={15} height={15} /> : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          Bước {idx + 1}: {step.title}
                        </p>
                        {!isActive && isDone ? (
                          <div className="mt-0.5 truncate text-xs text-ink-secondary">
                            <Markdown inline>{step.summaryTemplate}</Markdown>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={isActive ? 'accent' : isDone ? 'success' : 'neutral'}>
                        {STEP_KIND_LABEL[step.kind]}
                      </Badge>
                    </div>
                  </button>

                  {/* Active Step Workspace */}
                  {visitedStepIds.includes(step.id) ? (
                    <div
                      hidden={!isActive}
                      className="written-practice-reveal space-y-4 border-t border-border px-5 py-4"
                    >
                      <div className="text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                        <Markdown>{step.prompt}</Markdown>
                      </div>

                      {step.kind === 'written-reasoning' ? (
                        <WrittenReasoningStepView
                          step={step}
                          draft={drafts[step.id] ?? emptyWrittenStepDraft()}
                          symbolContext={symbolContext}
                          scaffolds={canon?.reasoningScaffolds}
                          webMcpAvailable={webMcpAvailable}
                          coachingFeedback={coachingByStepId[step.id]}
                          getGroundedPacket={
                            canon
                              ? mode => buildStepPacket(step, idx + 1, mode)!
                              : undefined
                          }
                          onImportFeedbackText={rawText => {
                            const parsed = parseExternalTutorFeedback(
                              rawText,
                              exercise,
                              step.id,
                              'clipboard',
                            );
                            if (!parsed.ok) return { ok: false, error: parsed.error };
                            applyCoachingFeedback(parsed.value);
                            return { ok: true };
                          }}
                          onClearFeedback={() => clearStepCoaching(step.id)}
                          update={changes => updateDraft(step.id, changes)}
                          onReviewed={() => {
                            updateDraft(step.id, { selfReviewed: true });
                            if (
                              new Set([...completedSet, step.id]).size === exercise.steps.length &&
                              !exerciseFinished
                            ) {
                              onCompleteExercise('self-reviewed');
                            }
                          }}
                        />
                      ) : (
                        <StepBody
                          step={step}
                          completed={isDone}
                          fadeLevel={fadeLevel}
                          onSolved={() => markStepCompleted(step.id)}
                        />
                      )}

                      {isDone && idx < exercise.steps.length - 1 ? (
                        <div className="flex justify-end border-t border-border pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              const next = exercise.steps[idx + 1]!;
                              setVisitedStepIds(prev =>
                                prev.includes(next.id) ? prev : [...prev, next.id],
                              );
                              setActiveIndex(idx + 1);
                            }}
                            className="hus-btn hus-btn-primary"
                          >
                            Sang Bước {idx + 2}: {exercise.steps[idx + 1]!.title}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* Synthesized Full Essay Solution once all steps are completed */}
          {exerciseFinished ? (
            <section
              aria-labelledby="synthesized-essay-heading"
              className="rounded-[var(--radius-xl)] border border-success/40 bg-surface p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon width={20} height={20} className="text-success" />
                  <h2
                    id="synthesized-essay-heading"
                    className="font-display text-xl font-medium text-ink"
                  >
                    Bài giải tự luận hoàn chỉnh
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyComposedEssay()}
                    className="hus-btn hus-btn-secondary text-xs"
                  >
                    {essayCopied ? (
                      <CheckIcon width={14} height={14} className="text-success" />
                    ) : (
                      <CopyIcon width={14} height={14} />
                    )}
                    <span>
                      {essayCopied ? 'Đã sao chép bài giải' : 'Sao chép bài trình bày (.md)'}
                    </span>
                  </button>
                  <Badge tone="success">
                    Hoàn thành {exercise.steps.length}/{exercise.steps.length} bước
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-secondary">
                Dưới đây là dàn ý tham khảo từ các bước bạn vừa hoàn thành:
              </p>
              <ol className="mt-4 space-y-3">
                {synthesizedSections.map(sec => (
                  <li
                    key={sec.stepId}
                    className="rounded-[var(--radius-md)] border border-border bg-canvas/70 px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-ink">
                      {sec.stepNumber}. {sec.title}
                    </p>
                    <div className="mt-1 leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                      <Markdown>{sec.summary}</Markdown>
                    </div>
                  </li>
                ))}
              </ol>
              {hasWrittenSteps ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <h3 className="font-semibold text-ink">
                    Bài trình bày tự luận ghép từ bản sửa của bạn
                  </h3>
                  {exercise.steps
                    .filter((step): step is WrittenReasoningStep => step.kind === 'written-reasoning')
                    .map((step, sIdx) => (
                      <div
                        key={step.id}
                        className="rounded-[var(--radius-md)] border border-border bg-canvas/55 px-4 py-3 text-sm leading-relaxed text-ink-secondary"
                      >
                        <p className="mb-1 text-xs font-semibold text-ink">
                          Phần {sIdx + 1}: {step.title}
                        </p>
                        <Markdown>
                          {renderTextByMathMode(
                            drafts[step.id]?.revision || '',
                            mathPreferences.insertMode,
                          )}
                        </Markdown>
                      </div>
                    ))}
                </div>
              ) : null}
              {exercise.explanation ? (
                <div className="mt-4 border-t border-border pt-4 text-sm text-ink-secondary">
                  <Markdown>{exercise.explanation}</Markdown>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepBody({
  step,
  completed,
  fadeLevel,
  onSolved,
}: {
  readonly step: Exclude<SemiEssayStep, { kind: 'written-reasoning' }>;
  readonly completed: boolean;
  readonly fadeLevel: 0 | 1 | 2;
  readonly onSolved: () => void;
}) {
  if (step.kind === 'choice-reasoning') {
    return <ChoiceReasoningStepView step={step} onSolved={onSolved} />;
  }
  if (step.kind === 'diagram') {
    return <DiagramStepView step={step} completed={completed} fadeLevel={fadeLevel} onSolved={onSolved} />;
  }
  if (step.kind === 'axis-projection') {
    return <AxisProjectionStepView step={step} onSolved={onSolved} />;
  }
  if (step.kind === 'equation-transform') {
    return <EquationTransformStepView step={step} onSolved={onSolved} />;
  }
  return <NumericUnitStepView step={step} onSolved={onSolved} />;
}

function ChoiceReasoningStepView({
  step,
  onSolved,
}: {
  readonly step: ChoiceReasoningStep;
  readonly onSolved: () => void;
}) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [evaluation, setEvaluation] = useState<ChoiceReasoningEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);

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

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={selected.length === 0} className="hus-btn hus-btn-primary">
          Kiểm tra lập luận
        </button>
        {step.hint ? (
          <button
            type="button"
            onClick={() => setShowHint(v => !v)}
            className="hus-btn hus-btn-secondary"
          >
            {showHint ? 'Ẩn gợi ý' : 'Xem gợi ý'}
          </button>
        ) : null}
      </div>

      {showHint && step.hint ? (
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
            <span>{evaluation.correct ? 'Lập luận chính xác!' : 'Lập luận chưa khớp bản chất vật lý:'}</span>
          </div>
          {evaluation.rationales.map(item => (
            <div key={item.choiceId} className="pl-6 text-xs leading-relaxed text-ink-secondary">
              <Markdown inline>{item.rationale}</Markdown>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function DiagramStepView({
  step,
  completed,
  fadeLevel,
  onSolved,
}: {
  readonly step: DiagramStep;
  readonly completed: boolean;
  readonly fadeLevel: 0 | 1 | 2;
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
        onEvaluated={res => {
          if (res.correct) onSolved();
        }}
      />
    </Suspense>
  );
}

function AxisProjectionStepView({
  step,
  onSolved,
}: {
  readonly step: AxisProjectionStep;
  readonly onSolved: () => void;
}) {
  const [selections, setSelections] = useState<
    Readonly<Record<string, Readonly<Record<string, AxisProjectionSelection>>>>
  >({});
  const [evaluation, setEvaluation] = useState<AxisProjectionEvaluation | null>(null);

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
        <div key={axis.id} className="space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-canvas/70 p-3.5">
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
                    <div role="group" aria-label={`Dấu chiếu của ${row.forceId} trên ${axis.label}`} className="flex gap-1">
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

          {evaluation?.correct ? (
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
          {!evaluation.correct ? (
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
  onSolved,
}: {
  readonly step: EquationTransformStep;
  readonly onSolved: () => void;
}) {
  const [stageIndex, setStageIndex] = useState(0);
  const [history, setHistory] = useState<
    readonly { readonly label: string; readonly latex: string; readonly canceledLatex?: string }[]
  >([]);
  const [lastFeedback, setLastFeedback] = useState<EquationTransformMoveEvaluation | null>(null);
  const [finished, setFinished] = useState(false);

  const currentStage = step.stages[stageIndex];

  const handleChooseOperation = (operationId: string) => {
    if (!currentStage || finished) return;
    const res = evaluateEquationTransformMove(currentStage, operationId);
    setLastFeedback(res);
    if (res.advance) {
      const op = currentStage.operations.find(o => o.id === operationId);
      setHistory(prev => [
        ...prev,
        {
          label: op?.label ?? '',
          latex: res.resultLatex,
          ...(res.canceledLatex ? { canceledLatex: res.canceledLatex } : {}),
        },
      ]);
      if (stageIndex + 1 >= step.stages.length) {
        setFinished(true);
        onSolved();
      } else {
        setStageIndex(idx => idx + 1);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Initial equations & target */}
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

        {/* Accepted transformation lines */}
        {history.length > 0 ? (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {history.map((line, i) => (
              <div key={i} className="space-y-1 rounded-[var(--radius-sm)] border border-success/30 bg-success-subtle/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-success">Bước biến đổi {i + 1}: {line.label}</span>
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

      {/* Current stage operation palette */}
      {!finished && currentStage ? (
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-ink">
            Thao tác {stageIndex + 1}/{step.stages.length}: <Markdown inline>{currentStage.prompt}</Markdown>
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

      {/* Pedagogical feedback on last move */}
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
          {!lastFeedback.advance && lastFeedback.resultLatex ? (
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
  onSolved,
}: {
  readonly step: NumericUnitStep;
  readonly onSolved: () => void;
}) {
  const [limitChoice, setLimitChoice] = useState<string>('');
  const [limitChecked, setLimitChecked] = useState<boolean>(!step.limitingCheck);
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [evaluation, setEvaluation] = useState<NumericUnitEvaluation | null>(null);

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
      {/* Optional MIT 8.01 Limiting-Case Check */}
      {step.limitingCheck ? (
        <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-[var(--hus-starlight)]/40 bg-surface-subtle/60 p-4">
          <h4 className="text-sm font-semibold text-ink">Kiểm chứng công thức (Trường hợp biên)</h4>
          <p className="text-xs leading-relaxed text-ink-secondary">
            <Markdown inline>{step.limitingCheck.prompt}</Markdown>
          </p>
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
                    setLimitChecked(ch.id === step.limitingCheck?.answerId);
                  }}
                  className="h-4 w-4 accent-[var(--hus-accent)]"
                />
                <span>
                  <Markdown inline>{ch.label}</Markdown>
                </span>
              </label>
            ))}
          </div>
          {selectedLimitObj ? (
            <p
              className={`text-xs ${
                limitCorrect ? 'text-success' : 'text-danger'
              }`}
            >
              <Markdown inline>{selectedLimitObj.rationale}</Markdown>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Numeric & unit fields */}
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
                    setValues(prev => ({ ...prev, [field.id]: e.target.value }));
                  }}
                  placeholder="vd: 0,47"
                  className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3 py-2 font-mono text-sm tabular-nums text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
                <span className="shrink-0 font-mono text-xs text-ink-muted">{field.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={!limitChecked}
          className="hus-btn hus-btn-primary"
        >
          Kiểm tra kết quả số
        </button>

        {!limitChecked ? (
          <p className="text-xs text-ink-muted">Hãy hoàn thành câu kiểm chứng trường hợp biên ở trên trước khi nộp kết quả số.</p>
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
                {evaluation.correct ? 'Chính xác! Bạn đã hoàn thành bước kiểm chứng số liệu.' : 'Kiểm tra lại kết quả:'}
              </span>
            </div>
            <ul className="list-disc space-y-1 pl-6 text-xs text-ink-secondary">
              {evaluation.fields.map(f => (
                <li key={f.fieldId}>{f.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </div>
  );
}
