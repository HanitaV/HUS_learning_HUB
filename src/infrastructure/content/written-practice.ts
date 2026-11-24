import type { SemiEssayExercise } from '../../domain/semi-essay';

const writtenBanks = import.meta.glob<readonly SemiEssayExercise[]>(
  '../../content/courses/*/written-practice.ts',
  { eager: true, import: 'default' },
);

const hybridBanks = import.meta.glob<Record<string, unknown>>(
  '../../content/courses/*/semi-essays.ts',
  { eager: true },
);

function extractSemiEssayList(mod: Record<string, unknown>): readonly SemiEssayExercise[] {
  if (Array.isArray(mod.default)) {
    return mod.default as readonly SemiEssayExercise[];
  }
  for (const value of Object.values(mod)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === 'object' &&
      value[0] !== null &&
      (value[0] as { readonly kind?: unknown }).kind === 'semi-essay'
    ) {
      return value as readonly SemiEssayExercise[];
    }
  }
  return [];
}

const combined = [
  ...Object.values(writtenBanks).flat(),
  ...Object.values(hybridBanks).flatMap(extractSemiEssayList),
];

const seenIds = new Set<string>();
export const writtenPractice: readonly SemiEssayExercise[] = combined.filter(exercise => {
  if (seenIds.has(exercise.id)) return false;
  seenIds.add(exercise.id);
  return true;
});
