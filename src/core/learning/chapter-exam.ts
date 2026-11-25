import type {
  ChapterExamDraft,
  ChapterExamEvaluation,
  ChapterExamLengthPreset,
  ChapterExamObjectiveResult,
  ChapterExamPaper,
  ChapterExamPoolSummary,
  ChapterExamWrittenResult,
  ExamAnswerMode,
  ExerciseFormKind,
} from '../../domain/chapter-exam';
import type {
  CourseConventionCanon,
  TutorCoachingFeedback,
} from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import type { WrittenReasoningStep } from '../../domain/semi-essay';
import type { ExerciseDefinition } from '../../domain/workspace';
import { evaluateAnswer } from './exercises';
import {
  adaptClassicExerciseToSemiEssay,
  doesClassicPromptRequireStatements,
  TUTOR_M1_PASS_SCORE,
} from './webmcp-essay-adapters';

/** Priority order when guaranteeing at least 1 question per available form: written A4 first. */
const SELECTION_FORM_PRIORITY: readonly ExerciseFormKind[] = [
  'semi-essay',
  'short-answer',
  'multiple-answer',
  'multiple-choice',
];

/** Exam paper display order: objective questions first, written A4 essay problems last. */
const PAPER_DISPLAY_FORM_ORDER: Readonly<Record<ExerciseFormKind, number>> = {
  'multiple-choice': 0,
  'multiple-answer': 1,
  'short-answer': 2,
  'semi-essay': 3,
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function summarizeChapterExamPool(
  exercises: readonly ExerciseDefinition[],
  lessonOrder: readonly EntityId[],
): ChapterExamPoolSummary {
  const countsByForm: Record<ExerciseFormKind, number> = {
    'multiple-choice': 0,
    'multiple-answer': 0,
    'short-answer': 0,
    'semi-essay': 0,
  };

  const lessonsWithExercises = new Set<string>();
  for (const ex of exercises) {
    countsByForm[ex.kind] += 1;
    lessonsWithExercises.add(ex.lessonId);
  }

  const distinctForms = SELECTION_FORM_PRIORITY.filter(kind => countsByForm[kind] > 0);
  const totalExercises = exercises.length;
  const lessonCount =
    lessonOrder.length > 0
      ? lessonOrder.filter(id => lessonsWithExercises.has(id)).length || lessonOrder.length
      : lessonsWithExercises.size;

  if (totalExercises === 0) {
    return {
      totalExercises: 0,
      lessonCount: 0,
      distinctForms: [],
      countsByForm,
      minSelectableCount: 0,
      maxSelectableCount: 0,
      recommendedCountByPreset: { short: 0, standard: 0, comprehensive: 0 },
    };
  }

  const minSelectableCount = Math.min(3, totalExercises);
  const maxSelectableCount = Math.min(10, totalExercises);
  const clamp = (n: number) => Math.max(minSelectableCount, Math.min(maxSelectableCount, n));

  const formCount = distinctForms.length;
  const shortTarget = clamp(Math.max(3, Math.min(4, formCount)));
  const standardTarget = clamp(
    Math.max(formCount + 2, Math.min(7, Math.ceil(lessonCount * 0.8) + Math.max(1, formCount - 1))),
  );
  const comprehensiveTarget = clamp(
    Math.max(8, Math.min(10, formCount * 2 + Math.min(2, Math.floor(lessonCount / 2)))),
  );

  return {
    totalExercises,
    lessonCount,
    distinctForms,
    countsByForm,
    minSelectableCount,
    maxSelectableCount,
    recommendedCountByPreset: {
      short: shortTarget,
      standard: Math.max(shortTarget, standardTarget),
      comprehensive: Math.max(standardTarget, comprehensiveTarget),
    },
  };
}

export interface BuildChapterExamPaperOptions {
  readonly exercises: readonly ExerciseDefinition[];
  readonly lessonOrder: readonly EntityId[];
  readonly preset: ChapterExamLengthPreset;
  readonly customCount?: number | undefined;
  readonly seed?: number | undefined;
  readonly answerMode?: ExamAnswerMode | undefined;
  readonly canon?: CourseConventionCanon | undefined;
  readonly pinnedExerciseIds?: readonly EntityId[] | undefined;
}

export function buildChapterExamPaper({
  exercises,
  lessonOrder,
  preset,
  customCount,
  seed = 1,
  answerMode = 'mixed',
  canon,
  pinnedExerciseIds,
}: BuildChapterExamPaperOptions): ChapterExamPaper {
  const summary = summarizeChapterExamPool(exercises, lessonOrder);
  if (summary.totalExercises === 0) {
    return {
      preset,
      targetCount: 0,
      seed,
      items: [],
      summary,
    };
  }

  let selected: ExerciseDefinition[] = [];
  if (pinnedExerciseIds && pinnedExerciseIds.length > 0) {
    const pinnedSet = new Set(pinnedExerciseIds);
    selected = exercises.filter(ex => pinnedSet.has(ex.id));
  }

  if (selected.length === 0) {
    const rawTarget =
      customCount !== undefined
        ? Math.round(customCount)
        : summary.recommendedCountByPreset[preset];
    const targetCount = Math.max(
      summary.minSelectableCount,
      Math.min(summary.maxSelectableCount, rawTarget),
    );

    const rng = mulberry32(seed);
    const shuffledPool = deterministicShuffle(exercises, rng);

    const selectedIds = new Set<string>();
    const lessonPickCounts = new Map<string, number>();

    const recordPick = (ex: ExerciseDefinition) => {
      selected.push(ex);
      selectedIds.add(ex.id);
      lessonPickCounts.set(ex.lessonId, (lessonPickCounts.get(ex.lessonId) ?? 0) + 1);
    };

    const pickBestCandidate = (
      candidates: readonly ExerciseDefinition[],
    ): ExerciseDefinition | undefined => {
      let best: ExerciseDefinition | undefined;
      let bestLessonCount = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        if (selectedIds.has(candidate.id)) continue;
        const count = lessonPickCounts.get(candidate.lessonId) ?? 0;
        if (count < bestLessonCount) {
          best = candidate;
          bestLessonCount = count;
          if (count === 0) break;
        }
      }
      return best;
    };

    // Pass 1: Guarantee at least 1 exercise from every distinct form (written A4 semi-essay first)
    for (const kind of summary.distinctForms) {
      if (selected.length >= targetCount) break;
      const candidates = shuffledPool.filter(ex => ex.kind === kind);
      const chosen = pickBestCandidate(candidates);
      if (chosen) recordPick(chosen);
    }

    // Pass 2: Spread across chapter lessons in order, rotating through forms for balance
    let formCursor = 0;
    while (selected.length < targetCount) {
      let addedInRound = false;
      for (let i = 0; i < summary.distinctForms.length && selected.length < targetCount; i += 1) {
        const kind =
          summary.distinctForms[(formCursor + i) % summary.distinctForms.length]!;
        const chosen = pickBestCandidate(shuffledPool.filter(ex => ex.kind === kind));
        if (chosen) {
          recordPick(chosen);
          formCursor = (formCursor + i + 1) % summary.distinctForms.length;
          addedInRound = true;
          break;
        }
      }
      if (!addedInRound) {
        const fallback = pickBestCandidate(shuffledPool);
        if (!fallback) break;
        recordPick(fallback);
      }
    }
  }

  const lessonRank = new Map(lessonOrder.map((id, index) => [id, index]));
  const ordered = [...selected].sort((a, b) => {
    const formDiff = PAPER_DISPLAY_FORM_ORDER[a.kind] - PAPER_DISPLAY_FORM_ORDER[b.kind];
    if (formDiff !== 0) return formDiff;
    const rankA = lessonRank.get(a.lessonId) ?? Number.MAX_SAFE_INTEGER;
    const rankB = lessonRank.get(b.lessonId) ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

  return {
    preset,
    targetCount: ordered.length,
    seed,
    items: ordered.map((exercise, idx) => {
      if (answerMode === 'written-all' && exercise.kind !== 'semi-essay') {
        const embedded = doesClassicPromptRequireStatements(exercise);
        return {
          questionNumber: idx + 1,
          originalKind: exercise.kind,
          ...(exercise.kind !== 'short-answer'
            ? {
                referenceChoices: exercise.choices,
                choicesEmbeddedInPrompt: embedded,
              }
            : {}),
          exercise: adaptClassicExerciseToSemiEssay(exercise, { canon }),
        };
      }
      return {
        questionNumber: idx + 1,
        originalKind: exercise.kind,
        exercise,
      };
    }),
    summary,
  };
}

export function extractWrittenStepsForExam(
  exercise: Extract<ExerciseDefinition, { readonly kind: 'semi-essay' }>,
): readonly WrittenReasoningStep[] {
  const written = exercise.steps.filter(
    (step): step is WrittenReasoningStep => step.kind === 'written-reasoning',
  );
  if (written.length > 0) return written;
  // Fallback synthetic written step if an older semi-essay has no written-reasoning steps
  return [
    {
      id: `${exercise.id}-exam-written`,
      kind: 'written-reasoning',
      title: exercise.title,
      prompt: exercise.prompt,
      theoryAnchorIds: [],
      modelAnswer:
        exercise.explanation ??
        exercise.steps.map(s => s.summaryTemplate).join('\n\n'),
      rubric: exercise.steps.map(s => ({
        id: s.id,
        prompt: s.title,
      })),
      summaryTemplate: exercise.title,
    },
  ];
}

export function evaluateChapterExam(
  paper: ChapterExamPaper,
  draft: ChapterExamDraft,
  lessonOrder: readonly EntityId[] = [],
  coachingByStepId: Readonly<Record<string, TutorCoachingFeedback>> = {},
): ChapterExamEvaluation {
  const objectiveByExerciseId: Record<string, ChapterExamObjectiveResult> = {};
  const writtenByExerciseId: Record<string, ChapterExamWrittenResult> = {};
  const reviewLessonSet = new Set<string>();

  let objectiveTotal = 0;
  let objectiveAnswered = 0;
  let objectiveCorrect = 0;
  let writtenTotal = 0;
  let writtenDrafted = 0;
  let writtenSelfReviewed = 0;
  let gradedWrittenCount = 0;
  let accumulatedQuestionScores = 0;

  for (const { exercise } of paper.items) {
    if (exercise.kind === 'semi-essay') {
      writtenTotal += 1;
      const steps = extractWrittenStepsForExam(exercise);
      const stepStatuses = steps.map(step => {
        const text = (draft.writtenResponses[step.id] ?? '').trim();
        const checked = draft.checkedRubricIds[step.id] ?? [];
        const fb = coachingByStepId[step.id];
        const drafted = text.length > 0;
        const rubricAllChecked =
          step.rubric.length === 0 ||
          step.rubric.every(criterion => checked.includes(criterion.id));
        const selfReviewed =
          drafted &&
          (fb?.verdict === 'pass' || (fb?.verdict === undefined && rubricAllChecked));
        const stepVerdict = fb?.verdict ?? (selfReviewed ? 'pass' : undefined);
        const stepScoreOn10 =
          typeof fb?.score === 'number'
            ? fb.score
            : selfReviewed && fb !== undefined
              ? 10
              : undefined;
        return {
          stepId: step.id,
          drafted,
          selfReviewed,
          ...(stepVerdict !== undefined ? { verdict: stepVerdict } : {}),
          ...(stepScoreOn10 !== undefined ? { scoreOn10: stepScoreOn10 } : {}),
        };
      });
      const allDrafted = stepStatuses.every(s => s.drafted);
      const allReviewed = stepStatuses.every(s => s.selfReviewed);
      const anyNotPass = stepStatuses.some(s => s.verdict === 'not-pass');
      const allScored =
        stepStatuses.length > 0 && stepStatuses.every(s => typeof s.scoreOn10 === 'number');
      const questionVerdict = allReviewed ? 'pass' : anyNotPass ? 'not-pass' : undefined;
      const questionScoreOn10 = allScored
        ? Math.round(
            (stepStatuses.reduce((sum, s) => sum + (s.scoreOn10 ?? 0), 0) / stepStatuses.length) *
              100,
          ) / 100
        : undefined;

      if (allDrafted) writtenDrafted += 1;
      if (allReviewed) writtenSelfReviewed += 1;
      else reviewLessonSet.add(exercise.lessonId);

      if (questionVerdict !== undefined || questionScoreOn10 !== undefined) {
        gradedWrittenCount += 1;
      }
      accumulatedQuestionScores += questionScoreOn10 ?? (allReviewed ? 10 : 0);

      writtenByExerciseId[exercise.id] = {
        exerciseId: exercise.id,
        lessonId: exercise.lessonId,
        drafted: allDrafted,
        selfReviewed: allReviewed,
        ...(questionVerdict !== undefined ? { verdict: questionVerdict } : {}),
        ...(questionScoreOn10 !== undefined ? { scoreOn10: questionScoreOn10 } : {}),
        stepStatuses,
      };
    } else {
      objectiveTotal += 1;
      const rawAnswer = draft.objectiveAnswers[exercise.id];
      const answered =
        typeof rawAnswer === 'string'
          ? rawAnswer.trim().length > 0
          : Array.isArray(rawAnswer)
            ? rawAnswer.length > 0
            : false;
      if (answered) objectiveAnswered += 1;
      const correct = answered && rawAnswer !== undefined ? evaluateAnswer(exercise, rawAnswer) : false;
      if (correct) {
        objectiveCorrect += 1;
        accumulatedQuestionScores += 10;
      } else {
        reviewLessonSet.add(exercise.lessonId);
      }

      objectiveByExerciseId[exercise.id] = {
        exerciseId: exercise.id,
        lessonId: exercise.lessonId,
        answered,
        correct,
      };
    }
  }

  const orderedReviewLessons =
    lessonOrder.length > 0
      ? [
          ...lessonOrder.filter(id => reviewLessonSet.has(id)),
          ...[...reviewLessonSet].filter(id => !lessonOrder.includes(id)),
        ]
      : [...reviewLessonSet];

  const hasAnyEvaluationSignal = gradedWrittenCount > 0 || objectiveAnswered > 0;
  const paperScoreOn10 =
    paper.items.length > 0 && hasAnyEvaluationSignal
      ? Math.round((accumulatedQuestionScores / paper.items.length) * 100) / 100
      : null;
  const paperPassed = paperScoreOn10 !== null && paperScoreOn10 >= TUTOR_M1_PASS_SCORE;

  return {
    objectiveTotal,
    objectiveAnswered,
    objectiveCorrect,
    objectiveByExerciseId,
    writtenTotal,
    writtenDrafted,
    writtenSelfReviewed,
    gradedWrittenCount,
    writtenByExerciseId,
    paperScoreOn10,
    paperPassed,
    lessonsToReview: orderedReviewLessons,
  };
}
