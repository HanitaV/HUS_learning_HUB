import type { Chapter, Lesson, Resource, Topic } from './learning';
import type { ProblemFigureSpec } from './problem-figure';
import type { SemiEssayExercise } from './semi-essay';

export type ClassicExerciseDefinition = {
  readonly id: string;
  readonly lessonId: string;
  readonly title: string;
  readonly prompt: string;
  readonly figure?: ProblemFigureSpec | undefined;
  readonly hints?: readonly string[];
  readonly explanation?: string;
  readonly provenance?: import('./learning').Provenance;
} & (
  | { readonly kind: 'multiple-choice' | 'multiple-answer'; readonly choices: readonly { readonly id: string; readonly label: string }[]; readonly answers: readonly string[] }
  | { readonly kind: 'short-answer'; readonly answers: readonly string[] }
);

export type ExerciseDefinition = ClassicExerciseDefinition | SemiEssayExercise;

export interface LearningContent {
  readonly chapters: readonly Chapter[];
  readonly topics: readonly Topic[];
  readonly lessons: readonly Lesson[];
  readonly exercises: readonly ExerciseDefinition[];
  readonly resources: readonly Resource[];
}

export interface ProgressState {
  readonly schemaVersion: 1;
  readonly completedLessonIds: readonly string[];
  readonly bookmarkedResourceIds: readonly string[];
  readonly recentTopics: readonly { readonly topicId: string; readonly lessonId: string; readonly courseId: string; readonly at: string }[];
  readonly attempts: readonly { readonly exerciseId: string; readonly correct: boolean; readonly at: string }[];
}

export type ProgressAction =
  | { readonly type: 'complete'; readonly lessonId: string; readonly completed: boolean }
  | { readonly type: 'bookmark'; readonly resourceId: string }
  | ({ readonly type: 'visit' } & ProgressState['recentTopics'][number])
  | ({ readonly type: 'attempt' } & ProgressState['attempts'][number]);
