import { useMemo, useState } from 'react';
import type { CodeLanguage } from '../../domain/code-lab';
import type {
  CoachingPromptMode,
  CourseConventionCanon,
  GroundedEssayContextPacket,
  TutorCoachingFeedback,
} from '../../domain/curriculum-tutor';
import type { MathSymbolContext } from '../../domain/math-symbols';
import type { SemiEssayExercise, WrittenReasoningStep } from '../../domain/semi-essay';
import type { ExerciseDefinition } from '../../domain/workspace';
import { extractSingleExerciseSnippet } from '../../core/code-lab/playground';
import { evaluateAnswer } from '../../core/learning/exercises';
import {
  adaptClassicExerciseToSemiEssay,
  deriveStepCoachingState,
  formatScoreVi,
  syncCriteriaFromCoachingFeedback,
} from '../../core/learning/webmcp-essay-adapters';
import { parseExternalTutorFeedback } from '../../infrastructure/ai/tutor-feedback-parser';
import { progressStore } from '../../infrastructure/progress/store';
import { useLearningProgress } from '../../app/useLearningProgress';
import { Badge } from '../ui/Badge';
import { EssayWebMcpCoachPanel } from './EssayWebMcpCoachPanel';
import { ExerciseFrame } from './ExerciseFrame';
import Markdown from './Markdown';
import { ProblemFigure } from './ProblemFigure';
import { RuledA4Sheet } from './RuledA4Sheet';

export interface InlineLessonEssayPacketOptions {
  readonly stepNumber?: number | undefined;
  readonly revisionText?: string | undefined;
  readonly modelRevealed?: boolean | undefined;
}

export interface InlineLessonA4Bridge {
  readonly canon: CourseConventionCanon;
  readonly webMcpAvailable: boolean;
  readonly activeStepId: string;
  readonly coachingByStepId: Readonly<Record<string, TutorCoachingFeedback>>;
  readonly coachedSnapshotByStepId?: Readonly<Record<string, string>> | undefined;
  readonly onActivateExerciseStep: (
    exercise: SemiEssayExercise,
    step: WrittenReasoningStep,
    draftText: string,
    options?: InlineLessonEssayPacketOptions,
  ) => void;
  readonly onSyncDraftText: (
    stepId: string,
    draftText: string,
    options?: InlineLessonEssayPacketOptions,
  ) => void;
  readonly onBuildPacket: (
    exercise: SemiEssayExercise,
    step: WrittenReasoningStep,
    draftText: string,
    checkedCriterionIds: readonly string[],
    mode: CoachingPromptMode,
    options?: InlineLessonEssayPacketOptions,
  ) => GroundedEssayContextPacket;
  readonly onApplyFeedback: (
    exercise: SemiEssayExercise,
    feedback: TutorCoachingFeedback,
    draftSnapshot: string,
  ) => void;
  readonly onClearFeedback: (exercise: SemiEssayExercise, stepId: string) => void;
}

export default function ExerciseSession({
  exercise,
  symbolContext,
  onTryCodeSnippet,
  onFocusExercise,
  inlineA4Bridge,
}: {
  readonly exercise: ExerciseDefinition;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly onTryCodeSnippet?:
    | ((snippet: {
        readonly label: string;
        readonly language: CodeLanguage;
        readonly code: string;
      }) => void)
    | undefined;
  readonly onFocusExercise?: ((exercise: ExerciseDefinition) => void) | undefined;
  readonly inlineA4Bridge?: InlineLessonA4Bridge | undefined;
}) {
  const { progress } = useLearningProgress();
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [solveMode, setSolveMode] = useState<'quick' | 'written-a4'>('quick');
  const [a4Draft, setA4Draft] = useState('');
  const [checkedRubricIds, setCheckedRubricIds] = useState<readonly string[]>([]);
  const [coachedSnapshot, setCoachedSnapshot] = useState<string | undefined>(undefined);
  const [showReference, setShowReference] = useState(false);

  const detectedSnippet = useMemo(() => {
    if (!onTryCodeSnippet || exercise.kind === 'semi-essay') return null;
    return extractSingleExerciseSnippet(exercise.prompt, exercise.title);
  }, [exercise, onTryCodeSnippet]);

  const adaptedEssay = useMemo(() => {
    if (exercise.kind === 'semi-essay') return null;
    return adaptClassicExerciseToSemiEssay(exercise, { canon: inlineA4Bridge?.canon });
  }, [exercise, inlineA4Bridge?.canon]);

  if (exercise.kind === 'semi-essay') {
    return null;
  }

  const pastAttempts = progress.attempts.filter(attempt => attempt.exerciseId === exercise.id);
  const solvedPreviously = pastAttempts.some(attempt => attempt.correct);
  const attemptSummary =
    pastAttempts.length > 0 ? `Đã thử ${pastAttempts.length} lần` : undefined;

  const writtenStep =
    adaptedEssay?.steps[0]?.kind === 'written-reasoning' ? adaptedEssay.steps[0] : null;
  const stepCoaching = writtenStep ? inlineA4Bridge?.coachingByStepId[writtenStep.id] : undefined;
  const effectiveCoachedSnapshot =
    (writtenStep ? inlineA4Bridge?.coachedSnapshotByStepId?.[writtenStep.id] : undefined) ??
    coachedSnapshot;

  const lifecycle = writtenStep
    ? deriveStepCoachingState({
        draftText: a4Draft,
        rubric: writtenStep.rubric,
        feedback: stepCoaching,
        coachedDraftSnapshot: effectiveCoachedSnapshot,
      })
    : undefined;

  const handleSwitchMode = (nextMode: 'quick' | 'written-a4') => {
    setSolveMode(nextMode);
    onFocusExercise?.(exercise);
    if (nextMode === 'written-a4' && adaptedEssay && writtenStep && inlineA4Bridge) {
      inlineA4Bridge.onActivateExerciseStep(adaptedEssay, writtenStep, a4Draft);
    }
  };

  if (solveMode === 'written-a4' && adaptedEssay && writtenStep && inlineA4Bridge) {
    const completedViaA4 = lifecycle?.state === 'verified' || solvedPreviously;

    return (
      <section
        aria-label={exercise.title}
        data-inline-lesson-a4={exercise.id}
        onFocusCapture={() => {
          onFocusExercise?.(exercise);
          inlineA4Bridge.onActivateExerciseStep(adaptedEssay, writtenStep, a4Draft);
        }}
        className="space-y-4 rounded-[var(--radius-xl)] border border-accent/35 bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="!my-0 font-display text-lg font-medium text-ink">{exercise.title}</h3>
            <Badge tone="accent">Tự luận giấy A4</Badge>
            {stepCoaching?.verdict === 'pass' ? (
              <Badge tone="success" mono>
                PASS
                {typeof stepCoaching.score === 'number'
                  ? ` · ${formatScoreVi(stepCoaching.score)}/10`
                  : ''}
              </Badge>
            ) : stepCoaching?.verdict === 'not-pass' ? (
              <Badge tone="danger" mono>
                CHƯA PASS
                {typeof stepCoaching.score === 'number'
                  ? ` · ${formatScoreVi(stepCoaching.score)}/10`
                  : ''}
              </Badge>
            ) : completedViaA4 ? (
              <Badge tone="success">Đã hoàn thành</Badge>
            ) : null}
          </div>

          <div
            role="group"
            aria-label={`Chế độ làm bài ${exercise.title}`}
            className="inline-flex rounded-[var(--radius-md)] border border-border bg-canvas p-0.5 text-xs"
          >
            <button
              type="button"
              aria-pressed={false}
              onClick={() => handleSwitchMode('quick')}
              className="min-h-[28px] rounded-[calc(var(--radius-md)-2px)] px-2.5 py-0.5 font-medium text-ink-secondary hover:text-ink"
            >
              Trắc nghiệm nhanh
            </button>
            <button
              type="button"
              aria-pressed={true}
              onClick={() => handleSwitchMode('written-a4')}
              className="min-h-[28px] rounded-[calc(var(--radius-md)-2px)] bg-accent-subtle px-2.5 py-0.5 font-semibold text-accent-ink"
            >
              Tự luận giấy A4
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-subtle/55 px-4 py-3.5 text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
          <Markdown>{adaptedEssay.prompt}</Markdown>
          {exercise.figure ? <ProblemFigure figure={exercise.figure} /> : null}
        </div>

        <RuledA4Sheet
          id={`lesson-a4-${writtenStep.id}`}
          label="Bài trình bày tự luận của bạn"
          sheetTag="Giấy A4 · Tự luyện"
          value={a4Draft}
          symbolContext={symbolContext}
          defaultToolbarOpen={false}
          toolbarLabel={`Bảng ký hiệu toán học cho ${exercise.title}`}
          onChange={val => {
            setA4Draft(val);
            inlineA4Bridge.onSyncDraftText(writtenStep.id, val);
          }}
        />

        <EssayWebMcpCoachPanel
          stepId={writtenStep.id}
          rubric={writtenStep.rubric}
          hasDraft={Boolean(a4Draft.trim())}
          modelRevealed={showReference}
          webMcpAvailable={inlineA4Bridge.webMcpAvailable}
          variant="exam-sheet"
          lifecycleState={lifecycle?.state}
          scaffolds={inlineA4Bridge.canon.reasoningScaffolds}
          onInsertScaffold={scaffold => {
            const cur = a4Draft.trim();
            const nextVal = cur ? `${a4Draft.trimEnd()}\n\n${scaffold.template}` : scaffold.template;
            setA4Draft(nextVal);
            inlineA4Bridge.onSyncDraftText(writtenStep.id, nextVal);
          }}
          emphasizePresentationCheck
          isActiveTarget={inlineA4Bridge.activeStepId === writtenStep.id}
          onActivateTarget={() =>
            inlineA4Bridge.onActivateExerciseStep(adaptedEssay, writtenStep, a4Draft)
          }
          coachingFeedback={stepCoaching}
          getGroundedPacket={mode =>
            inlineA4Bridge.onBuildPacket(adaptedEssay, writtenStep, a4Draft, checkedRubricIds, mode)
          }
          onImportFeedbackText={rawText => {
            const parsed = parseExternalTutorFeedback(rawText, adaptedEssay, writtenStep.id, 'clipboard');
            if (!parsed.ok) return { ok: false, error: parsed.error };
            setCoachedSnapshot(a4Draft);
            const synced = syncCriteriaFromCoachingFeedback(checkedRubricIds, parsed.value);
            setCheckedRubricIds(synced);
            inlineA4Bridge.onApplyFeedback(adaptedEssay, parsed.value, a4Draft);
            return { ok: true };
          }}
          onClearFeedback={() => inlineA4Bridge.onClearFeedback(adaptedEssay, writtenStep.id)}
        />

        {Boolean(a4Draft.trim()) && exercise.explanation ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={showReference}
              onClick={() => setShowReference(v => !v)}
              className="hus-btn hus-btn-secondary min-h-[32px] px-3 py-1 text-xs"
            >
              {showReference ? 'Ẩn hướng dẫn đối chiếu' : 'Xem hướng dẫn đối chiếu sau khi viết nháp'}
            </button>
          </div>
        ) : null}

        {showReference && exercise.explanation ? (
          <div className="written-practice-reveal rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-4 text-sm text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
            <Markdown>{writtenStep.modelAnswer}</Markdown>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div onFocusCapture={() => onFocusExercise?.(exercise)} className="space-y-1.5">
      {inlineA4Bridge ? (
        <div className="flex justify-end">
          <div
            role="group"
            aria-label={`Chế độ làm bài ${exercise.title}`}
            className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5 text-xs"
          >
            <button
              type="button"
              aria-pressed={true}
              onClick={() => handleSwitchMode('quick')}
              className="min-h-[26px] rounded-[calc(var(--radius-md)-2px)] bg-accent-subtle px-2.5 py-0.5 font-semibold text-accent-ink"
            >
              Trắc nghiệm nhanh
            </button>
            <button
              type="button"
              aria-pressed={false}
              onClick={() => handleSwitchMode('written-a4')}
              className="min-h-[26px] rounded-[calc(var(--radius-md)-2px)] px-2.5 py-0.5 font-medium text-ink-secondary hover:text-ink"
            >
              Tự luận giấy A4
            </button>
          </div>
        </div>
      ) : null}

      <ExerciseFrame
        title={exercise.title}
        kind={exercise.kind}
        prompt={<Markdown>{exercise.prompt}</Markdown>}
        figure={exercise.figure}
        choices={
          exercise.kind === 'short-answer'
            ? []
            : exercise.choices.map(c => ({ id: c.id, label: <Markdown inline>{c.label}</Markdown> }))
        }
        hints={exercise.hints ?? []}
        completed={correct === true || solvedPreviously}
        attemptSummary={attemptSummary}
        symbolContext={symbolContext}
        onLoadCodeSnippet={
          detectedSnippet && onTryCodeSnippet
            ? () => onTryCodeSnippet(detectedSnippet)
            : undefined
        }
        feedback={
          correct === null
            ? null
            : {
                status: correct ? 'correct' : 'incorrect',
                message: correct
                  ? 'Chính xác. Bạn có thể xem giải thích, làm lại hoặc chuyển sang Tự luận giấy A4 để rèn trình bày.'
                  : 'Chưa đúng. Hãy kiểm tra lại lập luận hoặc chuyển sang Tự luận giấy A4 để nhờ trợ giảng Socratic gợi mở.',
              }
        }
        solution={
          (correct !== null || solvedPreviously) && exercise.explanation ? (
            <Markdown>{exercise.explanation}</Markdown>
          ) : null
        }
        onReset={() => setCorrect(null)}
        onSubmit={answer => {
          const result = evaluateAnswer(exercise, answer);
          setCorrect(result);
          progressStore.dispatch({
            type: 'attempt',
            exerciseId: exercise.id,
            correct: result,
            at: new Date().toISOString(),
          });
        }}
      />
    </div>
  );
}
