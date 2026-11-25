import { memo, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { ExerciseFormKind } from '../../domain/chapter-exam';
import type { MathSymbol, MathSymbolContext, MathSymbolInsertMode } from '../../domain/math-symbols';
import type { ClassicExerciseDefinition } from '../../domain/workspace';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import {
  applyShorthandSuggestion,
  detectActiveBackslashQuery,
  filterShorthandSuggestions,
  type ActiveBackslashQuery,
  type MathShorthandEntry,
} from '../../core/learning/math-shorthand';
import { insertMathSymbolAtCursor } from '../../core/learning/math-symbols';
import { Badge } from '../ui/Badge';
import { AlertCircleIcon, CheckCircleIcon, PlayIcon } from '../ui/Icons';
import Markdown from './Markdown';
import { MathSlashAutocomplete } from './MathSlashAutocomplete';
import { MathSymbolToolbar } from './MathSymbolToolbar';
import { ProblemFigure } from './ProblemFigure';
import { RealtimeMathPreview } from './RealtimeMathPreview';

export const EXAM_FORM_LABEL: Readonly<Record<ExerciseFormKind, string>> = {
  'multiple-choice': 'Trắc nghiệm 1 đáp án',
  'multiple-answer': 'Chọn nhiều đáp án',
  'short-answer': 'Trả lời ngắn',
  'semi-essay': 'Tự luận giấy A4',
};

export interface ExamObjectiveQuestionCardProps {
  readonly questionNumber: number;
  readonly totalQuestions: number;
  readonly exercise: ClassicExerciseDefinition;
  readonly lessonTitle?: string | undefined;
  readonly lessonUrl?: string | undefined;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly answer: string | readonly string[] | undefined;
  readonly submitted: boolean;
  readonly correct: boolean;
  readonly onLoadCodeSnippet?: (() => void) | undefined;
  readonly onChangeAnswer: (nextAnswer: string | readonly string[]) => void;
}

export const ExamObjectiveQuestionCard = memo(function ExamObjectiveQuestionCard({
  questionNumber,
  totalQuestions,
  exercise,
  lessonTitle,
  lessonUrl,
  symbolContext,
  answer,
  submitted,
  correct,
  onLoadCodeSnippet,
  onChangeAnswer,
}: ExamObjectiveQuestionCardProps) {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { preferences, setInsertMode } = useMathSymbolPreferences();
  const activeMathMode = preferences.insertMode;
  const [slashState, setSlashState] = useState<{
    readonly activeQuery: ActiveBackslashQuery;
    readonly highlightIndex: number;
  } | null>(null);

  const stringAnswer = typeof answer === 'string' ? answer : '';
  const arrayAnswer = Array.isArray(answer) ? answer : [];

  const slashSuggestions = useMemo(() => {
    if (!slashState) return [];
    return filterShorthandSuggestions(slashState.activeQuery.query, activeMathMode);
  }, [slashState, activeMathMode]);

  const handleInsertSymbol = (symbol: MathSymbol, mode: MathSymbolInsertMode) => {
    if (submitted) return;
    const el = inputRef.current;
    const inserted = insertMathSymbolAtCursor(
      stringAnswer,
      el?.selectionStart ?? stringAnswer.length,
      el?.selectionEnd ?? stringAnswer.length,
      symbol,
      mode,
    );
    onChangeAnswer(inserted.value);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(inserted.selectionStart, inserted.selectionEnd);
      }
    });
  };

  const handleInsertShorthand = (entry: MathShorthandEntry, mode: MathSymbolInsertMode) => {
    if (submitted) return;
    const el = inputRef.current;
    const posStart = el?.selectionStart ?? stringAnswer.length;
    const posEnd = el?.selectionEnd ?? posStart;
    const applied = applyShorthandSuggestion(
      stringAnswer,
      { replaceFrom: posStart, replaceTo: posEnd, query: '' },
      entry,
      mode,
      { wrapLatexWithDollars: true },
    );
    onChangeAnswer(applied.value);
    setSlashState(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(applied.caret, applied.caret);
      }
    });
  };

  const commitInputSlash = (entry: MathShorthandEntry) => {
    if (!slashState || submitted) return;
    const applied = applyShorthandSuggestion(
      stringAnswer,
      slashState.activeQuery,
      entry,
      activeMathMode,
      { wrapLatexWithDollars: true },
    );
    onChangeAnswer(applied.value);
    setSlashState(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(applied.caret, applied.caret);
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!slashState || slashSuggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSlashState(prev =>
        prev
          ? { ...prev, highlightIndex: (prev.highlightIndex + 1) % slashSuggestions.length }
          : null,
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSlashState(prev =>
        prev
          ? {
              ...prev,
              highlightIndex:
                (prev.highlightIndex - 1 + slashSuggestions.length) % slashSuggestions.length,
            }
          : null,
      );
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const picked = slashSuggestions[slashState.highlightIndex] ?? slashSuggestions[0];
      if (picked) {
        event.preventDefault();
        commitInputSlash(picked);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashState(null);
    }
  };

  return (
    <li
      id={`exam-q-${questionNumber}`}
      className="scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" mono>
              Câu {questionNumber}/{totalQuestions}
            </Badge>
            <Badge tone="neutral">{EXAM_FORM_LABEL[exercise.kind]}</Badge>
            {submitted ? (
              <Badge tone={correct ? 'success' : 'danger'}>
                {correct ? 'Chính xác' : 'Chưa đúng'}
              </Badge>
            ) : null}
          </div>
          <h2 className="font-display text-lg font-medium text-ink">{exercise.title}</h2>
        </div>

        {lessonUrl && lessonTitle ? (
          <Link
            to={lessonUrl}
            className="text-xs font-medium text-ink-muted no-underline hover:text-accent hover:underline"
          >
            Thuộc bài: {lessonTitle}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-border bg-canvas/75 px-4 py-3.5 text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
        <Markdown>{exercise.prompt}</Markdown>
        {exercise.figure ? <ProblemFigure figure={exercise.figure} /> : null}
      </div>

      {onLoadCodeSnippet ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-accent/25 bg-accent-subtle/35 px-3.5 py-2">
          <span className="text-xs text-ink-secondary">
            Chạy thử hoặc kiểm chứng đoạn mã của câu hỏi này ngay bên dưới đề thi:
          </span>
          <button
            type="button"
            onClick={onLoadCodeSnippet}
            className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
          >
            <PlayIcon width={13} height={13} className="text-accent" />
            <span>Nạp mẫu code vào khung chạy thử</span>
          </button>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {exercise.kind === 'multiple-choice' || exercise.kind === 'multiple-answer' ? (
          <fieldset disabled={submitted} className="space-y-2 border-0 p-0">
            <legend className="mb-2 text-xs font-medium text-ink-muted">
              {exercise.kind === 'multiple-answer'
                ? 'Chọn tất cả các phương án đúng'
                : 'Chọn một phương án đúng'}
            </legend>
            {exercise.choices.map(choice => {
              const isChecked =
                exercise.kind === 'multiple-answer'
                  ? arrayAnswer.includes(choice.id)
                  : stringAnswer === choice.id;
              const isExpectedAnswer = exercise.answers.includes(choice.id);
              const choiceTone = submitted
                ? isExpectedAnswer
                  ? 'border-success/55 bg-success-subtle text-ink'
                  : isChecked
                    ? 'border-danger/55 bg-danger-subtle text-ink'
                    : 'border-border bg-canvas/50 text-ink-secondary'
                : isChecked
                  ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                  : 'border-border bg-canvas/60 text-ink hover:border-border-strong';

              return (
                <label
                  key={choice.id}
                  className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm transition-colors ${choiceTone}`}
                >
                  <input
                    type={exercise.kind === 'multiple-answer' ? 'checkbox' : 'radio'}
                    name={fieldId}
                    value={choice.id}
                    checked={isChecked}
                    onChange={e => {
                      if (exercise.kind === 'multiple-answer') {
                        onChangeAnswer(
                          e.target.checked
                            ? [...arrayAnswer, choice.id]
                            : arrayAnswer.filter(id => id !== choice.id),
                        );
                      } else {
                        onChangeAnswer(e.target.value);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                  />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    <Markdown inline>{choice.label}</Markdown>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="space-y-2">
            <label htmlFor={fieldId} className="block text-xs font-medium text-ink-muted">
              Điền đáp án cho Câu {questionNumber}
            </label>
            <input
              ref={inputRef}
              id={fieldId}
              type="text"
              readOnly={submitted}
              value={stringAnswer}
              placeholder="Nhập kết quả hoặc biểu thức (gõ \ để chèn nhanh ký hiệu)…"
              onChange={e => {
                const val = e.target.value;
                const caret = e.target.selectionStart;
                onChangeAnswer(val);
                const q = detectActiveBackslashQuery(val, caret);
                setSlashState(q ? { activeQuery: q, highlightIndex: 0 } : null);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setSlashState(null)}
              className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
            {!submitted && slashState && slashSuggestions.length > 0 ? (
              <MathSlashAutocomplete
                id={`${fieldId}-slash`}
                query={slashState.activeQuery.query}
                suggestions={slashSuggestions}
                highlightedIndex={slashState.highlightIndex}
                mode={activeMathMode}
                onChangeMode={setInsertMode}
                onSelect={commitInputSlash}
                onClose={() => setSlashState(null)}
              />
            ) : null}
            {stringAnswer.trim().length > 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-border bg-canvas/70 px-3 py-1.5 text-xs text-ink">
                <span className="mr-2 text-ink-muted">Xem trước:</span>
                <RealtimeMathPreview value={stringAnswer} mode={activeMathMode} inline />
              </div>
            ) : null}
            {!submitted ? (
              <MathSymbolToolbar
                variant="compact"
                allowLatexMode
                context={symbolContext}
                onInsert={handleInsertSymbol}
                onInsertShorthandEntry={handleInsertShorthand}
                label={`Bảng ký hiệu cho Câu ${questionNumber}`}
              />
            ) : null}
          </div>
        )}

        {submitted ? (
          <div
            role="status"
            className={`space-y-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
              correct
                ? 'border-success/40 bg-success-subtle text-ink'
                : 'border-danger/40 bg-danger-subtle text-ink'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {correct ? (
                <CheckCircleIcon width={16} height={16} className="shrink-0 text-success" />
              ) : (
                <AlertCircleIcon width={16} height={16} className="shrink-0 text-danger" />
              )}
              <span>
                {correct
                  ? 'Đáp án chính xác!'
                  : exercise.kind === 'short-answer'
                    ? `Đáp án chuẩn: ${exercise.answers.join(' hoặc ')}`
                    : 'Lựa chọn chưa chính xác.'}
              </span>
            </div>
            {exercise.explanation ? (
              <div className="text-xs leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                <Markdown>{exercise.explanation}</Markdown>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
});
