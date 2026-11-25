import type { SemiEssayExercise } from '../../domain/semi-essay';

const PROGRESS_KEY_PREFIX = 'hus-learning-hub:semi-essay-steps:v1';

export function loadCompletedSemiEssaySteps(exercise: SemiEssayExercise): readonly string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${PROGRESS_KEY_PREFIX}:${exercise.id}`);
    if (!raw || raw.length > 4000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validStepIds = new Set(exercise.steps.map(s => s.id));
    return parsed.filter(
      (id): id is string => typeof id === 'string' && validStepIds.has(id),
    );
  } catch {
    return [];
  }
}

export function saveCompletedSemiEssaySteps(
  exerciseId: string,
  completedStepIds: readonly string[],
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${PROGRESS_KEY_PREFIX}:${exerciseId}`,
      JSON.stringify([...new Set(completedStepIds)]),
    );
  } catch {
    // Ignore storage quota / privacy mode failures
  }
}
