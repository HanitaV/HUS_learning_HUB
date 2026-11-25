import type { TutorAssessmentVerdict } from './curriculum-tutor';
import type { EntityId } from './learning';
import type { ExerciseDefinition } from './workspace';

export type ChapterExamLengthPreset = 'short' | 'standard' | 'comprehensive';

export type ExamAnswerMode = 'written-all' | 'mixed';

export type ExamQuestionSourceFilter = 'all-db' | 'essay-only';

export type ExerciseFormKind = ExerciseDefinition['kind'];

export interface ChapterExamPoolSummary {
  readonly totalExercises: number;
  readonly lessonCount: number;
  readonly distinctForms: readonly ExerciseFormKind[];
  readonly countsByForm: Readonly<Record<ExerciseFormKind, number>>;
  readonly minSelectableCount: number;
  readonly maxSelectableCount: number;
  readonly recommendedCountByPreset: Readonly<Record<ChapterExamLengthPreset, number>>;
}

export interface ChapterExamItem {
  readonly questionNumber: number;
  readonly exercise: ExerciseDefinition;
  readonly originalKind?: ExerciseFormKind | undefined;
  readonly referenceChoices?: readonly { readonly id: string; readonly label: string }[] | undefined;
  readonly choicesEmbeddedInPrompt?: boolean | undefined;
}

export interface ChapterExamPaper {
  readonly preset: ChapterExamLengthPreset;
  readonly targetCount: number;
  readonly seed: number;
  readonly items: readonly ChapterExamItem[];
  readonly summary: ChapterExamPoolSummary;
}

export interface ChapterExamDraft {
  readonly objectiveAnswers: Readonly<Record<string, string | readonly string[]>>;
  readonly writtenResponses: Readonly<Record<string, string>>;
  readonly checkedRubricIds: Readonly<Record<string, readonly string[]>>;
  readonly completedInteractiveStepIds?: Readonly<Record<string, readonly string[]>> | undefined;
}

export interface ChapterExamObjectiveResult {
  readonly exerciseId: string;
  readonly lessonId: EntityId;
  readonly answered: boolean;
  readonly correct: boolean;
}

export interface ChapterExamWrittenStepStatus {
  readonly stepId: string;
  readonly drafted: boolean;
  readonly selfReviewed: boolean;
  readonly verdict?: TutorAssessmentVerdict | undefined;
  readonly scoreOn10?: number | undefined;
}

export interface ChapterExamWrittenResult {
  readonly exerciseId: string;
  readonly lessonId: EntityId;
  readonly drafted: boolean;
  readonly selfReviewed: boolean;
  readonly verdict?: TutorAssessmentVerdict | undefined;
  readonly scoreOn10?: number | undefined;
  readonly stepStatuses: readonly ChapterExamWrittenStepStatus[];
}

export interface ChapterExamEvaluation {
  readonly objectiveTotal: number;
  readonly objectiveAnswered: number;
  readonly objectiveCorrect: number;
  readonly objectiveByExerciseId: Readonly<Record<string, ChapterExamObjectiveResult>>;
  readonly writtenTotal: number;
  readonly writtenDrafted: number;
  readonly writtenSelfReviewed: number;
  readonly gradedWrittenCount: number;
  readonly writtenByExerciseId: Readonly<Record<string, ChapterExamWrittenResult>>;
  readonly paperScoreOn10: number | null;
  readonly paperPassed: boolean;
  readonly lessonsToReview: readonly EntityId[];
}
