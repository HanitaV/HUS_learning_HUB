import type { EntityId } from './learning';
import type { ExerciseDefinition } from './workspace';

export type ChapterExamLengthPreset = 'short' | 'standard' | 'comprehensive';

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
}

export interface ChapterExamWrittenResult {
  readonly exerciseId: string;
  readonly lessonId: EntityId;
  readonly drafted: boolean;
  readonly selfReviewed: boolean;
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
  readonly writtenByExerciseId: Readonly<Record<string, ChapterExamWrittenResult>>;
  readonly lessonsToReview: readonly EntityId[];
}
