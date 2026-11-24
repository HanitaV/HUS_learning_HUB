import type { SemiEssayExercise } from '../../domain/semi-essay';
import type { LearningContent } from '../../domain/workspace';
import type { Course } from '../../domain/learning';
import { courseLessons } from './content';

export function courseWrittenPractice(content: LearningContent, course: Course, practice: readonly SemiEssayExercise[]): readonly SemiEssayExercise[] {
  return courseLessons(content, course).flatMap(lesson => lesson.exerciseIds.flatMap(id =>
    practice.filter(exercise => exercise.id === id && exercise.lessonId === lesson.id),
  ));
}

/** Attach an authored practice batch without changing its underlying lesson content. */
export function withWrittenPractice(
  content: LearningContent,
  practice: readonly SemiEssayExercise[],
): LearningContent {
  const ids = new Set(content.exercises.map(exercise => exercise.id));
  for (const exercise of practice) {
    if (ids.has(exercise.id)) throw new Error(`Duplicate practice: ${exercise.id}`);
    if (!content.lessons.some(lesson => lesson.id === exercise.lessonId)) {
      throw new Error(`Unknown practice lesson: ${exercise.lessonId}`);
    }
    ids.add(exercise.id);
  }
  return {
    ...content,
    lessons: content.lessons.map(lesson => ({
      ...lesson,
      exerciseIds: [...lesson.exerciseIds, ...practice.filter(exercise => exercise.lessonId === lesson.id).map(exercise => exercise.id)],
    })),
    exercises: [...content.exercises, ...practice],
  };
}
