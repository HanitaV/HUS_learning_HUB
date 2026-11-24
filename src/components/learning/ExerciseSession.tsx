import { useMemo, useState } from 'react';
import type { CodeLanguage } from '../../domain/code-lab';
import type { MathSymbolContext } from '../../domain/math-symbols';
import type { ExerciseDefinition } from '../../domain/workspace';
import { extractSingleExerciseSnippet } from '../../core/code-lab/playground';
import { evaluateAnswer } from '../../core/learning/exercises';
import { progressStore } from '../../infrastructure/progress/store';
import { useLearningProgress } from '../../app/useLearningProgress';
import { ExerciseFrame } from './ExerciseFrame';
import Markdown from './Markdown';

export default function ExerciseSession({
  exercise,
  symbolContext,
  onTryCodeSnippet,
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
}) {
  const { progress } = useLearningProgress();
  const [correct, setCorrect] = useState<boolean | null>(null);

  const detectedSnippet = useMemo(() => {
    if (!onTryCodeSnippet || exercise.kind === 'semi-essay') return null;
    return extractSingleExerciseSnippet(exercise.prompt, exercise.title);
  }, [exercise, onTryCodeSnippet]);

  if (exercise.kind === 'semi-essay') {
    return null;
  }

  const pastAttempts = progress.attempts.filter(attempt => attempt.exerciseId === exercise.id);
  const solvedPreviously = pastAttempts.some(attempt => attempt.correct);
  const attemptSummary =
    pastAttempts.length > 0 ? `Đã thử ${pastAttempts.length} lần` : undefined;

  return (
    <ExerciseFrame
      title={exercise.title}
      kind={exercise.kind}
      prompt={<Markdown>{exercise.prompt}</Markdown>}
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
                ? 'Chính xác. Bạn có thể xem giải thích hoặc làm lại để ôn tập.'
                : 'Chưa đúng. Hãy kiểm tra lại lập luận và thử lại.',
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
  );
}
