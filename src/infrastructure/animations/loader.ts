import type { LessonAnimationSpec } from '../../domain/code-lesson';

const animationModules = import.meta.glob<Readonly<Record<string, LessonAnimationSpec>>>(
  '../../content/animations/*.ts',
  { import: 'default' },
);

/**
 * Lazily loads an interactive animation spec for a lesson, if one is authored
 * under `src/content/animations/<courseId>.ts` (default export: Record<lessonId, LessonAnimationSpec>).
 */
export async function loadLessonAnimation(lessonId: string): Promise<LessonAnimationSpec | undefined> {
  for (const loader of Object.values(animationModules)) {
    const map = await loader();
    if (map && lessonId in map) {
      return map[lessonId];
    }
  }
  return undefined;
}
