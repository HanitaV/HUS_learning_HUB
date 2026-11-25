import { useEffect, useMemo, useRef, useState } from 'react';
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
  SemiEssayExercise,
  WrittenReasoningStep,
} from '../../domain/semi-essay';
import {
  buildGroundedEssayContextPacket,
  composeExamReadyEssay,
  searchCurriculumChunks,
  synthesizeFallbackTheoryAnchors,
} from '../../core/learning/curriculum-rag';
import {
  didExercisePassViaTutor,
  syncCriteriaFromCoachingFeedback,
} from '../../core/learning/webmcp-essay-adapters';
import {
  buildSynthesizedEssay,
  emptyWrittenStepDraft,
  evaluateWrittenReasoningReview,
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
import {
  clearInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import {
  loadCompletedSemiEssaySteps,
  saveCompletedSemiEssaySteps,
} from '../../infrastructure/practice/semi-essay-step-progress';
import { Badge } from '../ui/Badge';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
} from '../ui/Icons';
import Markdown from './Markdown';
import { NotebookLmExportControl } from './NotebookLmExportControl';
import { RealtimeMathPreview } from './RealtimeMathPreview';
import {
  SemiEssayInteractiveStepBody,
  STEP_KIND_LABEL,
} from './SemiEssayInteractiveSteps';
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
  readonly onRecordTutorAttempt?: ((passed: boolean, at: string) => void) | undefined;
}

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
  onRecordTutorAttempt,
}: SemiEssayStudioProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visitedStepIds, setVisitedStepIds] = useState<readonly string[]>(
    exercise.steps[0] ? [exercise.steps[0].id] : [],
  );
  const [completedStepIds, setCompletedStepIds] = useState<readonly string[]>(() =>
    loadCompletedSemiEssaySteps(exercise),
  );
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

  const resolvedTheory = useMemo(
    () => synthesizeFallbackTheoryAnchors(curriculumChunks, exercise, activeIndex),
    [curriculumChunks, exercise, activeIndex],
  );

  const applyCoachingFeedback = (feedback: TutorCoachingFeedback) => {
    const nextPreview = { ...coachingByStepId, [feedback.stepId]: feedback };
    const passVerdict = didExercisePassViaTutor(exercise, nextPreview);
    if (passVerdict === false) {
      onRecordTutorAttempt?.(false, feedback.receivedAt);
    } else if (passVerdict === true) {
      const nonWrittenAllDone = exercise.steps
        .filter(s => s.kind !== 'written-reasoning')
        .every(s => completedSet.has(s.id));
      if (nonWrittenAllDone) {
        onRecordTutorAttempt?.(true, feedback.receivedAt);
      }
    }
    setCoachingByStepId(prev => {
      const next = { ...prev, [feedback.stepId]: feedback };
      saveStoredTutorFeedback(exercise.id, next);
      return next;
    });
    const currentDraft = drafts[feedback.stepId] ?? emptyWrittenStepDraft();
    const syncedCriteria = syncCriteriaFromCoachingFeedback(
      currentDraft.reviewedCriterionIds,
      feedback,
    );
    if (
      syncedCriteria.length !== currentDraft.reviewedCriterionIds.length ||
      !syncedCriteria.every((id, idx) => id === currentDraft.reviewedCriterionIds[idx])
    ) {
      updateDraft(feedback.stepId, { reviewedCriterionIds: syncedCriteria });
    }
  };

  const clearStepCoaching = (stepId: string) => {
    setCoachingByStepId(prev => {
      const copy = { ...prev };
      delete copy[stepId];
      saveStoredTutorFeedback(exercise.id, copy);
      return copy;
    });
  };

  const buildStepPacket = (
    step: WrittenReasoningStep,
    stepNumber: number,
    mode: CoachingPromptMode,
  ) => {
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
    saveCompletedSemiEssaySteps(exercise.id, nextCompleted);

    if (new Set([...completedSet, stepId]).size === exercise.steps.length && !exerciseFinished) {
      onCompleteExercise(hasWrittenSteps ? 'self-reviewed' : 'graded');
    }
  };

  const handleRestartAll = () => {
    setActiveIndex(0);
    setVisitedStepIds(exercise.steps[0] ? [exercise.steps[0].id] : []);
    setCompletedStepIds([]);
    saveCompletedSemiEssaySteps(exercise.id, []);
    resetDrafts();
    for (const step of exercise.steps) {
      if (step.kind !== 'written-reasoning') {
        clearInteractiveStepDraft(`${exercise.id}:${step.id}`);
      }
    }
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

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-start">
        <TheoryReferenceRail
          problemPrompt={exercise.prompt}
          figure={exercise.figure}
          given={exercise.given}
          theoryAnchors={resolvedTheory.anchors}
          activeAnchorIds={resolvedTheory.activeAnchorIds}
          activeStepNumber={activeIndex + 1}
          lessonTitle={lessonTitle}
          lessonUrl={lessonUrl}
        />

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
                        <SemiEssayInteractiveStepBody
                          step={step}
                          completed={isDone}
                          fadeLevel={fadeLevel}
                          draftKey={`${exercise.id}:${step.id}`}
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
                        <RealtimeMathPreview
                          value={drafts[step.id]?.revision || ''}
                          mode={mathPreferences.insertMode}
                        />
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
