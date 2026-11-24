import type { ExerciseDefinition } from '../../domain/workspace';
import { normalizeVietnamese } from '../courses/search';
import { normalizeMathTextForEvaluation } from './math-symbols';

export function evaluateAnswer(exercise: ExerciseDefinition, answer: string | readonly string[]): boolean {
  if (exercise.kind === 'semi-essay') {
    return false;
  }
  if (exercise.kind === 'short-answer') {
    if (typeof answer !== 'string') return false;
    const normalizedInput = normalizeVietnamese(answer).trim();
    const mathInput = normalizeVietnamese(normalizeMathTextForEvaluation(answer)).trim();
    return exercise.answers.some(value => {
      const normalizedTarget = normalizeVietnamese(value).trim();
      if (normalizedTarget === normalizedInput) return true;
      const mathTarget = normalizeVietnamese(normalizeMathTextForEvaluation(value)).trim();
      return mathTarget === mathInput;
    });
  }
  const selected = typeof answer === 'string' ? [answer] : answer;
  return selected.length === exercise.answers.length && new Set(selected).size === selected.length &&
    selected.every(id => exercise.choices.some(choice => choice.id === id) && exercise.answers.includes(id));
}
