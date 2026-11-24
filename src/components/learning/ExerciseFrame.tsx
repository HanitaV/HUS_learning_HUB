import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { MathSymbol, MathSymbolContext, MathSymbolInsertMode } from '../../domain/math-symbols';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import {
  applyShorthandSuggestion,
  detectActiveBackslashQuery,
  filterShorthandSuggestions,
  renderTextByMathMode,
  shouldAutoShowMathPreview,
  type ActiveBackslashQuery,
  type MathShorthandEntry,
} from '../../core/learning/math-shorthand';
import { insertMathSymbolAtCursor } from '../../core/learning/math-symbols';
import { Badge } from '../ui/Badge';
import { AlertCircleIcon, CheckCircleIcon, PlayIcon, RotateCcwIcon } from '../ui/Icons';
import Markdown from './Markdown';
import { MathSlashAutocomplete } from './MathSlashAutocomplete';
import { MathSymbolToolbar } from './MathSymbolToolbar';

export type ExercisePresentationKind =
  | 'multiple-choice'
  | 'multiple-answer'
  | 'numerical'
  | 'short-answer'
  | 'guided-steps';

export interface ExerciseChoice {
  readonly id: string;
  readonly label: ReactNode;
}

export interface ExerciseFeedback {
  readonly status: 'correct' | 'incorrect' | 'partial' | 'info';
  readonly message: string;
}

export interface ExerciseFrameProps {
  readonly title: string;
  readonly kind: ExercisePresentationKind;
  readonly prompt: ReactNode;
  readonly choices?: readonly ExerciseChoice[];
  readonly unit?: string;
  readonly hints?: readonly string[];
  readonly solution?: ReactNode;
  readonly feedback?: ExerciseFeedback | null;
  readonly completed?: boolean;
  readonly attemptSummary?: string | undefined;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly onLoadCodeSnippet?: (() => void) | undefined;
  readonly loadCodeLabel?: string | undefined;
  readonly onReset?: () => void;
  /** Answer evaluation must live in core logic; UI only dispatches the student's response. */
  readonly onSubmit?: (answer: string | readonly string[]) => void;
}

const KIND_LABEL: Record<ExercisePresentationKind, string> = {
  'multiple-choice': 'Trắc nghiệm',
  'multiple-answer': 'Chọn nhiều đáp án',
  numerical: 'Tính toán số',
  'short-answer': 'Trả lời ngắn',
  'guided-steps': 'Giải theo từng bước',
};

const FEEDBACK_CLASSES: Record<ExerciseFeedback['status'], string> = {
  correct: 'border-success/35 bg-success-subtle text-success',
  incorrect: 'border-danger/35 bg-danger-subtle text-danger',
  partial: 'border-warning/35 bg-warning-subtle text-warning',
  info: 'border-accent/25 bg-accent-subtle text-accent-ink',
};

export function ExerciseFrame({
  title,
  kind,
  prompt,
  choices = [],
  unit,
  hints = [],
  solution,
  feedback = null,
  completed = false,
  attemptSummary,
  symbolContext,
  onLoadCodeSnippet,
  loadCodeLabel,
  onReset,
  onSubmit,
}: ExerciseFrameProps) {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { preferences, setInsertMode } = useMathSymbolPreferences();
  const activeMathMode = preferences.insertMode;
  const [answer, setAnswer] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [slashState, setSlashState] = useState<{
    readonly activeQuery: ActiveBackslashQuery;
    readonly highlightIndex: number;
  } | null>(null);

  const slashSuggestions = useMemo(() => {
    if (!slashState) return [];
    return filterShorthandSuggestions(slashState.activeQuery.query, activeMathMode);
  }, [slashState, activeMathMode]);

  const handleInsertShorthand = (entry: MathShorthandEntry, mode: MathSymbolInsertMode) => {
    if (feedback) onReset?.();
    const el = inputRef.current;
    const posStart = el?.selectionStart ?? answer.length;
    const posEnd = el?.selectionEnd ?? posStart;
    const applied = applyShorthandSuggestion(
      answer,
      { replaceFrom: posStart, replaceTo: posEnd, query: '' },
      entry,
      mode,
      { wrapLatexWithDollars: true },
    );
    setAnswer(applied.value);
    setSlashState(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(applied.caret, applied.caret);
      }
    });
  };

  const commitInputSlashSuggestion = (entry: MathShorthandEntry) => {
    if (!slashState) return;
    if (feedback) onReset?.();
    const applied = applyShorthandSuggestion(
      answer,
      slashState.activeQuery,
      entry,
      activeMathMode,
      { wrapLatexWithDollars: true },
    );
    setAnswer(applied.value);
    setSlashState(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(applied.caret, applied.caret);
      }
    });
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
        commitInputSlashSuggestion(picked);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashState(null);
    }
  };

  const handleInsertSymbol = (symbol: MathSymbol, mode: MathSymbolInsertMode) => {
    if (feedback) onReset?.();
    const el = inputRef.current;
    const inserted = insertMathSymbolAtCursor(
      answer,
      el?.selectionStart ?? answer.length,
      el?.selectionEnd ?? answer.length,
      symbol,
      mode,
    );
    setAnswer(inserted.value);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(inserted.selectionStart, inserted.selectionEnd);
      }
    });
  };

  const hasAnswer = kind === 'multiple-answer' ? selected.length > 0 : answer.trim().length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!onSubmit || !hasAnswer) return;
    if (kind === 'multiple-answer') {
      onSubmit(selected);
    } else {
      onSubmit(answer.trim());
    }
  };

  const handleRetry = () => {
    setAnswer('');
    setSelected([]);
    setShowSolution(false);
    onReset?.();
  };

  return (
    <section
      aria-label={title}
      className="rounded-[var(--radius-xl)] border border-border bg-canvas/80 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="!my-0 font-display text-lg font-medium text-ink">{title}</h3>
          <Badge tone="neutral">{KIND_LABEL[kind]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {attemptSummary ? (
            <span className="text-xs text-ink-muted tabular-nums">{attemptSummary}</span>
          ) : null}
          {completed ? <Badge tone="success">Đã hoàn thành</Badge> : null}
        </div>
      </div>

      {/* Question area */}
      <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
        {prompt}
      </div>

      {onLoadCodeSnippet ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-accent/25 bg-accent-subtle/35 px-3.5 py-2">
          <span className="text-xs text-ink-secondary">
            Kiểm chứng trực tiếp đoạn mã của câu hỏi này ngay bên dưới mà không cần chuyển tab:
          </span>
          <button
            type="button"
            onClick={onLoadCodeSnippet}
            className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
          >
            <PlayIcon width={13} height={13} className="text-accent" />
            <span>{loadCodeLabel ?? 'Nạp mẫu code vào khung chạy thử'}</span>
          </button>
        </div>
      ) : null}

      {/* Answer area */}
      {onSubmit ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {(kind === 'multiple-choice' || kind === 'multiple-answer') && choices.length > 0 ? (
            <fieldset className="space-y-2 border-0 p-0">
              <legend className="mb-2 text-xs font-medium text-ink-muted">
                {kind === 'multiple-answer' ? 'Chọn tất cả đáp án đúng' : 'Chọn một đáp án'}
              </legend>
              {choices.map(choice => {
                const isChecked =
                  kind === 'multiple-answer'
                    ? selected.includes(choice.id)
                    : answer === choice.id;
                return (
                  <label
                    key={choice.id}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm transition-colors duration-200 ${
                      isChecked
                        ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                        : 'border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-subtle/50'
                    }`}
                  >
                    <input
                      type={kind === 'multiple-answer' ? 'checkbox' : 'radio'}
                      name={fieldId}
                      value={choice.id}
                      checked={isChecked}
                      onChange={event => {
                        if (feedback) onReset?.();
                        if (kind === 'multiple-answer') {
                          setSelected(prev =>
                            event.target.checked
                              ? [...prev, choice.id]
                              : prev.filter(id => id !== choice.id),
                          );
                        } else {
                          setAnswer(event.target.value);
                        }
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                    />
                    <span className="min-w-0 flex-1 leading-relaxed">{choice.label}</span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div className="space-y-2">
              <label htmlFor={fieldId} className="block text-xs font-medium text-ink-muted">
                Câu trả lời của bạn
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={inputRef}
                  id={fieldId}
                  type="text"
                  inputMode={kind === 'numerical' ? 'decimal' : 'text'}
                  value={answer}
                  onChange={event => {
                    if (feedback) onReset?.();
                    const val = event.target.value;
                    const caret = event.target.selectionStart;
                    setAnswer(val);
                    const q =
                      kind === 'numerical' ? null : detectActiveBackslashQuery(val, caret);
                    setSlashState(q ? { activeQuery: q, highlightIndex: 0 } : null);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onBlur={() => setSlashState(null)}
                  placeholder={
                    kind === 'numerical' ? 'Nhập giá trị số…' : 'Nhập câu trả lời của bạn…'
                  }
                  className="min-h-[44px] min-w-[12rem] flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
                {unit ? (
                  <span className="font-mono text-xs text-ink-muted" aria-label={`Đơn vị ${unit}`}>
                    {unit}
                  </span>
                ) : null}
              </div>
              {slashState && slashSuggestions.length > 0 ? (
                <MathSlashAutocomplete
                  id={`${fieldId}-slash`}
                  query={slashState.activeQuery.query}
                  suggestions={slashSuggestions}
                  highlightedIndex={slashState.highlightIndex}
                  mode={activeMathMode}
                  onChangeMode={setInsertMode}
                  onSelect={commitInputSlashSuggestion}
                  onClose={() => setSlashState(null)}
                />
              ) : null}
              {kind !== 'numerical' && shouldAutoShowMathPreview(answer, activeMathMode) ? (
                <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-1.5 text-xs text-ink">
                  <span className="mr-2 text-ink-muted">Xem trước:</span>
                  <Markdown inline>{renderTextByMathMode(answer, activeMathMode)}</Markdown>
                </div>
              ) : null}
              <MathSymbolToolbar
                variant="compact"
                allowLatexMode
                context={symbolContext}
                onInsert={handleInsertSymbol}
                onInsertShorthandEntry={handleInsertShorthand}
                label={`Bảng ký hiệu toán học cho câu hỏi ${title}`}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={!hasAnswer} className="hus-btn hus-btn-primary">
              Kiểm tra đáp án
            </button>

            {feedback ? (
              <button type="button" onClick={handleRetry} className="hus-btn hus-btn-secondary">
                <RotateCcwIcon width={14} height={14} />
                Làm lại
              </button>
            ) : null}

            {hints.length > 0 && revealedHints < hints.length ? (
              <button
                type="button"
                onClick={() => setRevealedHints(count => Math.min(hints.length, count + 1))}
                className="hus-btn hus-btn-secondary"
              >
                Xem gợi ý ({revealedHints}/{hints.length})
              </button>
            ) : null}

            {solution ? (
              <button
                type="button"
                onClick={() => setShowSolution(open => !open)}
                aria-expanded={showSolution}
                className="hus-btn hus-btn-secondary"
              >
                {showSolution ? 'Ẩn lời giải' : 'Xem lời giải'}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2.5 text-xs text-ink-muted">
          Bộ chấm bài tự động cho dạng bài tập này chưa được kết nối với tầng xử lý cốt lõi.
        </p>
      )}

      {/* Feedback banner */}
      {feedback ? (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-start gap-2.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${FEEDBACK_CLASSES[feedback.status]}`}
        >
          {feedback.status === 'correct' ? (
            <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {revealedHints > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="!my-0 text-xs font-semibold text-ink-muted">Gợi ý</p>
          <ol className="!my-1 list-decimal space-y-1.5 pl-5 text-sm text-ink-secondary">
            {hints.slice(0, revealedHints).map((hint, index) => (
              <li key={index} className="[&_.katex-display]:overflow-x-auto">
                <Markdown inline>{hint}</Markdown>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {showSolution && solution ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="!my-0 text-xs font-semibold text-ink-muted">Giải thích &amp; lời giải</p>
          <div className="mt-2 text-sm leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
            {solution}
          </div>
        </div>
      ) : null}
    </section>
  );
}
