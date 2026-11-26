import { useEffect, useMemo, useState } from 'react';
import type { CodeLanguage } from '../../domain/code-lab';
import type { CurriculumChunk } from '../../domain/curriculum-tutor';
import type { MathSymbolContext } from '../../domain/math-symbols';
import type { SemiEssayExercise, WrittenReasoningStep } from '../../domain/semi-essay';
import type { ExerciseDefinition } from '../../domain/workspace';
import { extractSingleExerciseSnippet } from '../../core/code-lab/playground';
import {
  composeExamReadyEssay,
  synthesizeFallbackTheoryAnchors,
} from '../../core/learning/curriculum-rag';
import { renderTextByMathMode } from '../../core/learning/math-shorthand';
import {
  buildSynthesizedEssay,
  emptyWrittenStepDraft,
  evaluateWrittenReasoningReview,
} from '../../core/learning/semi-essay';
import {
  didExercisePassViaTutor,
  syncCriteriaFromCoachingFeedback,
} from '../../core/learning/webmcp-essay-adapters';
import { parseExternalTutorFeedback } from '../../infrastructure/ai/tutor-feedback-parser';
import {
  clearInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import {
  loadCompletedSemiEssaySteps,
  saveCompletedSemiEssaySteps,
} from '../../infrastructure/practice/semi-essay-step-progress';
import { progressStore } from '../../infrastructure/progress/store';
import { getDiagramLabel } from '../../modules/diagrams/registry';
import { useLearningProgress } from '../../app/useLearningProgress';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import { useWrittenDrafts } from '../../app/useWrittenDrafts';
import { Badge } from '../ui/Badge';
import {
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  PlayIcon,
  RotateCcwIcon,
} from '../ui/Icons';
import type { InlineLessonA4Bridge } from './ExerciseSession';
import Markdown from './Markdown';
import { ProblemFigure } from './ProblemFigure';
import { RealtimeMathPreview } from './RealtimeMathPreview';
import {
  SemiEssayInteractiveStepBody,
  STEP_KIND_LABEL,
} from './SemiEssayInteractiveSteps';
import { WrittenReasoningStepView } from './WrittenReasoningStepView';
import '../../styles/written-practice.css';

export interface InlineSemiEssayExerciseCardProps {
  readonly exercise: SemiEssayExercise;
  readonly curriculumChunks?: readonly CurriculumChunk[] | undefined;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly inlineA4Bridge?: InlineLessonA4Bridge | undefined;
  readonly onFocusExercise?: ((exercise: ExerciseDefinition) => void) | undefined;
  readonly onTryCodeSnippet?:
    | ((snippet: {
        readonly label: string;
        readonly language: CodeLanguage;
        readonly code: string;
      }) => void)
    | undefined;
}

export function InlineSemiEssayExerciseCard({
  exercise,
  curriculumChunks = [],
  symbolContext,
  inlineA4Bridge,
  onFocusExercise,
  onTryCodeSnippet,
}: InlineSemiEssayExerciseCardProps) {
  const { progress } = useLearningProgress();
  const { preferences: mathPreferences } = useMathSymbolPreferences();
  const { drafts, updateDraft, resetDrafts, error } = useWrittenDrafts(exercise);

  const [activeIndex, setActiveIndex] = useState(0);
  const [visitedStepIds, setVisitedStepIds] = useState<readonly string[]>(
    exercise.steps[0] ? [exercise.steps[0].id] : [],
  );
  const [completedStepIds, setCompletedStepIds] = useState<readonly string[]>(() =>
    loadCompletedSemiEssaySteps(exercise),
  );
  const [resetVersion, setResetVersion] = useState(0);
  const [essayCopied, setEssayCopied] = useState(false);

  const previouslySolved = progress.attempts.some(
    attempt => attempt.exerciseId === exercise.id && attempt.correct,
  );
  const fadeLevel = exercise.fadeLevel ?? 0;
  const hasWrittenSteps = exercise.steps.some(step => step.kind === 'written-reasoning');

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

  const resolvedTheory = useMemo(
    () => synthesizeFallbackTheoryAnchors(curriculumChunks, exercise, activeIndex),
    [curriculumChunks, exercise, activeIndex],
  );

  const diagramKinds = useMemo(
    () => [
      ...new Set(
        exercise.steps
          .filter(s => s.kind === 'diagram')
          .map(s => getDiagramLabel(s.diagramKind)),
      ),
    ],
    [exercise.steps],
  );

  const detectedSnippet = useMemo(() => {
    if (!onTryCodeSnippet) return null;
    const combinedPrompt = [
      exercise.prompt,
      ...exercise.steps.map(s => s.prompt),
    ].join('\n\n');
    return extractSingleExerciseSnippet(combinedPrompt, exercise.title);
  }, [exercise, onTryCodeSnippet]);

  // Sync incoming WebMCP coaching feedback into useWrittenDrafts rubric state
  useEffect(() => {
    if (!inlineA4Bridge) return;
    for (const step of exercise.steps) {
      if (step.kind !== 'written-reasoning') continue;
      const fb = inlineA4Bridge.coachingByStepId[step.id];
      if (!fb) continue;
      const currentDraft = drafts[step.id] ?? emptyWrittenStepDraft();
      const synced = syncCriteriaFromCoachingFeedback(currentDraft.reviewedCriterionIds, fb);
      if (
        synced.length !== currentDraft.reviewedCriterionIds.length ||
        !synced.every((id, idx) => id === currentDraft.reviewedCriterionIds[idx])
      ) {
        updateDraft(step.id, { reviewedCriterionIds: synced });
      }
    }
  }, [inlineA4Bridge, inlineA4Bridge?.coachingByStepId, drafts, exercise.steps, updateDraft]);

  // Keep draft/revision/modelRevealed synchronized to LessonPage's WebMCP bridge
  useEffect(() => {
    if (!inlineA4Bridge) return;
    exercise.steps.forEach((step, idx) => {
      if (step.kind !== 'written-reasoning') return;
      const d = drafts[step.id] ?? emptyWrittenStepDraft();
      inlineA4Bridge.onSyncDraftText(step.id, d.response, {
        stepNumber: idx + 1,
        revisionText: d.revision,
        modelRevealed: d.modelRevealed,
      });
    });
  }, [drafts, exercise.steps, inlineA4Bridge]);

  const markStepCompleted = (stepId: string) => {
    const nextCompleted = completedSet.has(stepId)
      ? completedStepIds
      : [...completedStepIds, stepId];
    setCompletedStepIds(nextCompleted);
    saveCompletedSemiEssaySteps(exercise.id, nextCompleted);

    const nextAllDone = new Set([...completedSet, stepId]).size === exercise.steps.length;
    if (nextAllDone && !exerciseFinished && !hasWrittenSteps) {
      progressStore.dispatch({
        type: 'attempt',
        exerciseId: exercise.id,
        correct: true,
        at: new Date().toISOString(),
      });
    } else if (inlineA4Bridge) {
      const passVerdict = didExercisePassViaTutor(exercise, inlineA4Bridge.coachingByStepId);
      const nonWrittenAllDone = exercise.steps
        .filter(s => s.kind !== 'written-reasoning')
        .every(s => s.id === stepId || completedSet.has(s.id));
      if (passVerdict === true && nonWrittenAllDone) {
        progressStore.dispatch({
          type: 'attempt',
          exerciseId: exercise.id,
          correct: true,
          at: new Date().toISOString(),
        });
      }
    }
  };

  const handleRestartAll = () => {
    setActiveIndex(0);
    setVisitedStepIds(exercise.steps[0] ? [exercise.steps[0].id] : []);
    setCompletedStepIds([]);
    saveCompletedSemiEssaySteps(exercise.id, []);
    resetDrafts();
    for (const step of exercise.steps) {
      if (step.kind === 'written-reasoning') {
        inlineA4Bridge?.onClearFeedback(exercise, step.id);
      } else {
        clearInteractiveStepDraft(`${exercise.id}:${step.id}`);
      }
    }
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
      // Ignore clipboard restrictions silently
    }
  };

  return (
    <section
      id={`lesson-exercise-${exercise.id}`}
      data-inline-semi-essay={exercise.id}
      aria-label={exercise.title}
      onFocusCapture={() => onFocusExercise?.(exercise)}
      className="scroll-mt-24 space-y-5 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              {diagramKinds.length > 0
                ? `Tự luận kết hợp biểu đồ (${exercise.steps.length} bước)`
                : `Tự luận (${exercise.steps.length} bước)`}
            </Badge>
            {diagramKinds.map(label => (
              <Badge key={label} tone="neutral">
                {label}
              </Badge>
            ))}
            {previouslySolved || exerciseFinished ? (
              <Badge tone="success">
                {hasWrittenSteps ? 'Đã tự đối chiếu' : 'Đã hoàn thành'}
              </Badge>
            ) : null}
          </div>
          <h3 className="!my-0 font-display text-lg font-medium text-ink">{exercise.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium tabular-nums text-ink-muted">
            Tiến độ: {completedSet.size}/{exercise.steps.length} bước
          </span>
          <button
            type="button"
            onClick={handleRestartAll}
            className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
          >
            <RotateCcwIcon width={13} height={13} />
            <span>Làm lại toàn bài</span>
          </button>
        </div>
      </div>

      {error ? (
        <p role="status" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* Problem statement + Figure + Given quantities */}
      <div className="space-y-3.5 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/55 p-4 text-sm leading-relaxed text-ink">
        <div className="[&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
          <Markdown>{exercise.prompt}</Markdown>
        </div>

        {exercise.figure ? <ProblemFigure figure={exercise.figure} /> : null}

        {exercise.given.length > 0 ? (
          <div className="border-t border-border pt-3">
            <p className="!my-0 mb-2 text-xs font-semibold text-ink-muted">Dữ kiện đã cho</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {exercise.given.map((item, idx) => (
                <span
                  key={idx}
                  className="rounded-[var(--radius-sm)] border border-border bg-canvas px-2.5 py-1 text-ink-secondary"
                >
                  <Markdown inline>{`$${item.symbolLatex}$`}</Markdown> ({item.label}):{' '}
                  <strong className="font-mono font-semibold tabular-nums text-ink">
                    {item.value}
                    {item.unit ? ` ${item.unit}` : ''}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {resolvedTheory.anchors.length > 0 ? (
          <details className="rounded-[var(--radius-md)] border border-border bg-canvas/75 px-3.5 py-2.5">
            <summary className="cursor-pointer select-none text-xs font-semibold text-ink">
              Công thức &amp; lý thuyết gắn với Bước {activeIndex + 1} ({resolvedTheory.anchors.length} mục)
            </summary>
            <ul className="!mb-0 !mt-3 !list-none space-y-2.5 !pl-0">
              {resolvedTheory.anchors.map(anchor => (
                <li
                  key={anchor.id}
                  className="rounded-[var(--radius-sm)] border border-border bg-surface p-3 text-xs"
                >
                  <p className="!my-0 font-semibold text-ink">{anchor.title}</p>
                  {anchor.formula ? (
                    <div className="mt-1.5 overflow-x-auto">
                      <Markdown inline>{`$$${anchor.formula}$$`}</Markdown>
                    </div>
                  ) : null}
                  <div className="mt-1.5 text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                    <Markdown>{anchor.summary}</Markdown>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {detectedSnippet && onTryCodeSnippet ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-accent/25 bg-accent-subtle/35 px-3.5 py-2">
          <span className="text-xs text-ink-secondary">
            Chạy thử đoạn mã của bài tập này ngay bên dưới trang bài học:
          </span>
          <button
            type="button"
            onClick={() => onTryCodeSnippet(detectedSnippet)}
            className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
          >
            <PlayIcon width={13} height={13} className="text-accent" />
            <span>Nạp mẫu code vào khung chạy thử</span>
          </button>
        </div>
      ) : null}

      {/* Multi-step inline timeline (all steps unlocked on LessonPage) */}
      <div key={resetVersion} className="min-w-0 space-y-4">
        <ol className="min-w-0 !list-none space-y-3 !pl-0" aria-label={`Các bước giải ${exercise.title}`}>
          {exercise.steps.map((step, idx) => {
            const isDone = completedSet.has(step.id);
            const isActive = idx === activeIndex;

            return (
              <li
                key={step.id}
                className={`min-w-0 rounded-[var(--radius-xl)] border transition-colors duration-150 ${
                  isActive
                    ? 'border-accent/60 bg-canvas/55'
                    : isDone
                      ? 'border-border bg-surface/75'
                      : 'border-border bg-surface-subtle/35'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => {
                    setActiveIndex(idx);
                    setVisitedStepIds(prev =>
                      prev.includes(step.id) ? prev : [...prev, step.id],
                    );
                    if (step.kind === 'written-reasoning' && inlineA4Bridge) {
                      const d = drafts[step.id] ?? emptyWrittenStepDraft();
                      inlineA4Bridge.onActivateExerciseStep(exercise, step, d.response, {
                        stepNumber: idx + 1,
                        revisionText: d.revision,
                        modelRevealed: d.modelRevealed,
                      });
                    }
                  }}
                  className="flex min-h-[50px] w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-left sm:flex-nowrap sm:gap-3 sm:px-5"
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
                      <p className="!my-0 truncate text-sm font-semibold text-ink">
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
                    onFocusCapture={() => {
                      if (step.kind === 'written-reasoning' && inlineA4Bridge) {
                        const d = drafts[step.id] ?? emptyWrittenStepDraft();
                        inlineA4Bridge.onActivateExerciseStep(exercise, step, d.response, {
                          stepNumber: idx + 1,
                          revisionText: d.revision,
                          modelRevealed: d.modelRevealed,
                        });
                      }
                    }}
                    className="written-practice-reveal space-y-4 border-t border-border px-4 py-4 sm:px-5"
                  >
                    <div className="text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                      <Markdown>{step.prompt}</Markdown>
                    </div>

                    {step.kind === 'written-reasoning' ? (
                      <WrittenReasoningStepView
                        step={step}
                        draft={drafts[step.id] ?? emptyWrittenStepDraft()}
                        symbolContext={symbolContext}
                        scaffolds={inlineA4Bridge?.canon.reasoningScaffolds}
                        webMcpAvailable={inlineA4Bridge?.webMcpAvailable ?? false}
                        coachingFeedback={inlineA4Bridge?.coachingByStepId[step.id]}
                        coachingHistory={inlineA4Bridge?.coachingHistoryByStepId?.[step.id]}
                        getGroundedPacket={
                          inlineA4Bridge
                            ? mode => {
                                const d = drafts[step.id] ?? emptyWrittenStepDraft();
                                return inlineA4Bridge.onBuildPacket(
                                  exercise,
                                  step,
                                  d.response,
                                  d.reviewedCriterionIds,
                                  mode,
                                  {
                                    stepNumber: idx + 1,
                                    revisionText: d.revision,
                                    modelRevealed: d.modelRevealed,
                                  },
                                );
                              }
                            : undefined
                        }
                        onImportFeedbackText={
                          inlineA4Bridge
                            ? rawText => {
                                const parsed = parseExternalTutorFeedback(
                                  rawText,
                                  exercise,
                                  step.id,
                                  'clipboard',
                                );
                                if (!parsed.ok) return { ok: false, error: parsed.error };
                                const d = drafts[step.id] ?? emptyWrittenStepDraft();
                                const synced = syncCriteriaFromCoachingFeedback(
                                  d.reviewedCriterionIds,
                                  parsed.value,
                                );
                                updateDraft(step.id, { reviewedCriterionIds: synced });
                                inlineA4Bridge.onApplyFeedback(
                                  exercise,
                                  parsed.value,
                                  d.response,
                                );
                                return { ok: true };
                              }
                            : undefined
                        }
                        onClearFeedback={
                          inlineA4Bridge
                            ? () => inlineA4Bridge.onClearFeedback(exercise, step.id)
                            : undefined
                        }
                        update={changes => updateDraft(step.id, changes)}
                        onReviewed={() => {
                          updateDraft(step.id, { selfReviewed: true });
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
            aria-labelledby={`synthesized-${exercise.id}`}
            className="rounded-[var(--radius-xl)] border border-success/40 bg-canvas/60 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon width={20} height={20} className="text-success" />
                <h4
                  id={`synthesized-${exercise.id}`}
                  className="!my-0 font-display text-lg font-medium text-ink"
                >
                  Bài giải tự luận hoàn chỉnh
                </h4>
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

            <ol className="!mb-0 mt-4 !list-none space-y-2.5 !pl-0">
              {synthesizedSections.map(sec => (
                <li
                  key={sec.stepId}
                  className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2.5 text-sm"
                >
                  <p className="!my-0 font-semibold text-ink">
                    {sec.stepNumber}. {sec.title}
                  </p>
                  <div className="mt-1 leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                    <Markdown>{sec.summary}</Markdown>
                  </div>
                </li>
              ))}
            </ol>

            {hasWrittenSteps ? (
              <div className="mt-4 space-y-2.5 border-t border-border pt-4">
                <p className="!my-0 text-xs font-semibold text-ink">
                  Bài trình bày tự luận ghép từ bản sửa của bạn
                </p>
                {exercise.steps
                  .filter((step): step is WrittenReasoningStep => step.kind === 'written-reasoning')
                  .map((step, sIdx) => (
                    <div
                      key={step.id}
                      className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink-secondary"
                    >
                      <p className="!my-0 mb-1 text-xs font-semibold text-ink">
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
    </section>
  );
}
