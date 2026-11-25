import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type {
  MathSymbol,
  MathSymbolContext,
  MathSymbolInsertMode,
} from '../../domain/math-symbols';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import {
  applyShorthandSuggestion,
  detectActiveBackslashQuery,
  filterShorthandSuggestions,
  type ActiveBackslashQuery,
  type MathShorthandEntry,
} from '../../core/learning/math-shorthand';
import { insertMathSymbolAtCursor } from '../../core/learning/math-symbols';
import { MathSlashAutocomplete } from './MathSlashAutocomplete';
import { MathSymbolToolbar } from './MathSymbolToolbar';
import { RealtimeMathPreview } from './RealtimeMathPreview';
import '../../styles/written-practice.css';

export interface RuledA4SheetProps {
  readonly id: string;
  readonly label: string;
  readonly sheetTag?: string | undefined;
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
  readonly placeholder?: string | undefined;
  readonly minRows?: number | undefined;
  readonly maxLength?: number | undefined;
  readonly readOnly?: boolean | undefined;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly toolbarLabel?: string | undefined;
  readonly previewKey?: string | undefined;
  /** Start with the full symbol keyboard collapsed to reduce clutter on multi-question exam pages. */
  readonly defaultToolbarOpen?: boolean | undefined;
}

export const RuledA4Sheet = memo(function RuledA4Sheet({
  id,
  label,
  sheetTag = 'Giấy A4',
  value,
  onChange,
  placeholder = 'Trình bày từng dòng trên giấy A4 (gõ \\ để chèn nhanh như \\lim, \\frac, \\sum, hoặc gõ trực tiếp x^2, (a)/(b), <=, => để hiện công thức thời gian thực)…',
  minRows = 6,
  maxLength = 20000,
  readOnly = false,
  symbolContext,
  toolbarLabel = 'Bảng chèn ký hiệu toán học',
  previewKey,
  defaultToolbarOpen = true,
}: RuledA4SheetProps) {
  const { preferences, setInsertMode } = useMathSymbolPreferences();
  const activeMathMode = preferences.insertMode;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [toolbarVisible, setToolbarVisible] = useState(defaultToolbarOpen);
  const [previewOverride, setPreviewOverride] = useState<boolean | null>(null);
  const [slashState, setSlashState] = useState<{
    readonly activeQuery: ActiveBackslashQuery;
    readonly highlightIndex: number;
  } | null>(null);

  const hasContent = value.trim().length > 0;
  // Realtime KaTeX preview turns on automatically as soon as the student writes on the A4 sheet
  const showPreview = previewOverride ?? hasContent;

  const slashSuggestions = useMemo(() => {
    if (!slashState) return [];
    return filterShorthandSuggestions(slashState.activeQuery.query, activeMathMode);
  }, [slashState, activeMathMode]);

  const lineCount = useMemo(() => {
    if (!value) return 1;
    let count = 1;
    for (let i = 0; i < value.length; i += 1) {
      if (value.charCodeAt(i) === 10) count += 1;
    }
    return count;
  }, [value]);

  const computedRows = Math.max(minRows, Math.min(16, lineCount + 1));

  const focusAndPlaceCaret = useCallback((start: number, end: number = start) => {
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
      }
    });
  }, []);

  const handleInsertSymbol = useCallback(
    (symbol: MathSymbol, mode: MathSymbolInsertMode) => {
      if (readOnly) return;
      const curVal = valueRef.current;
      const el = textareaRef.current;
      const inserted = insertMathSymbolAtCursor(
        curVal,
        el?.selectionStart ?? curVal.length,
        el?.selectionEnd ?? curVal.length,
        symbol,
        mode,
        { wrapLatexWithDollars: true },
      );
      onChangeRef.current(inserted.value);
      focusAndPlaceCaret(inserted.selectionStart, inserted.selectionEnd);
    },
    [readOnly, focusAndPlaceCaret],
  );

  const handleInsertShorthandEntry = useCallback(
    (entry: MathShorthandEntry, mode: MathSymbolInsertMode) => {
      if (readOnly) return;
      const curVal = valueRef.current;
      const el = textareaRef.current;
      const posStart = el?.selectionStart ?? curVal.length;
      const posEnd = el?.selectionEnd ?? posStart;
      const applied = applyShorthandSuggestion(
        curVal,
        { replaceFrom: posStart, replaceTo: posEnd, query: '' },
        entry,
        mode,
        { wrapLatexWithDollars: true },
      );
      onChangeRef.current(applied.value);
      setSlashState(null);
      focusAndPlaceCaret(applied.caret);
    },
    [readOnly, focusAndPlaceCaret],
  );

  const commitSlashSuggestion = useCallback(
    (entry: MathShorthandEntry) => {
      if (!slashState || readOnly) return;
      const applied = applyShorthandSuggestion(
        valueRef.current,
        slashState.activeQuery,
        entry,
        activeMathMode,
        { wrapLatexWithDollars: true },
      );
      onChangeRef.current(applied.value);
      setSlashState(null);
      focusAndPlaceCaret(applied.caret);
    },
    [slashState, readOnly, activeMathMode, focusAndPlaceCaret],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
        commitSlashSuggestion(picked);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashState(null);
    }
  };

  return (
    <div data-a4-ruled-sheet="true" className="space-y-2">
      <div className="hus-a4-sheet">
        {/* Compact A4 Header */}
        <div className="hus-a4-header flex flex-wrap items-center justify-between gap-2 px-3.5 py-1.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={id} className="text-xs font-semibold text-ink sm:text-sm">
              {label}
            </label>
            <span className="rounded-[var(--radius-sm)] border border-border bg-surface/80 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
              {sheetTag}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              aria-live="off"
              className="hidden font-mono text-[11px] tabular-nums text-ink-muted sm:inline"
            >
              {lineCount} dòng · {value.length} ký tự
            </span>

            {!readOnly ? (
              <button
                type="button"
                onClick={() => setToolbarVisible(v => !v)}
                aria-pressed={toolbarVisible}
                className={`min-h-[26px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  toolbarVisible
                    ? 'border-accent/50 bg-accent-subtle text-accent-ink'
                    : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
                }`}
              >
                {toolbarVisible ? 'Ẩn phím ∑' : '∑ Phím ký hiệu'}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setPreviewOverride(!showPreview)}
              aria-pressed={showPreview}
              className={`min-h-[26px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                showPreview
                  ? 'border-accent/50 bg-accent-subtle text-accent-ink'
                  : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
              }`}
            >
              {showPreview ? 'Ẩn LaTeX trực tiếp' : 'Xem LaTeX trực tiếp'}
            </button>
          </div>
        </div>

        {/* Integrated Special-Character & Formula Keyboard Dock */}
        {!readOnly && toolbarVisible ? (
          <div className="hus-a4-toolbar-dock">
            <MathSymbolToolbar
              variant="expanded"
              allowLatexMode
              flush
              context={symbolContext}
              onInsert={handleInsertSymbol}
              onInsertShorthandEntry={handleInsertShorthandEntry}
              label={toolbarLabel}
            />
          </div>
        ) : null}

        {/* Ruled Horizontal A4 Writing Surface */}
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          rows={computedRows}
          maxLength={maxLength}
          onChange={event => {
            const val = event.target.value;
            const caret = event.target.selectionStart;
            onChange(val);
            const q = val.includes('\\') ? detectActiveBackslashQuery(val, caret) : null;
            setSlashState(prev => {
              if (!q) return prev === null ? null : null;
              return { activeQuery: q, highlightIndex: 0 };
            });
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setSlashState(null)}
          className="hus-a4-textarea"
        />

        {/* Realtime Line-Cached KaTeX Printout Band on the A4 Sheet */}
        {showPreview ? (
          <div
            data-math-live-preview={previewKey ?? id}
            className="hus-a4-preview px-4 py-2.5 text-sm leading-relaxed text-ink"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-medium text-ink-muted">
                Bản in LaTeX thời gian thực:
              </span>
            </div>
            {hasContent ? (
              <RealtimeMathPreview value={value} mode={activeMathMode} />
            ) : (
              <p className="!my-0 text-xs text-ink-muted">
                Gõ biểu thức hoặc lệnh <code className="font-mono">\lim</code>,{' '}
                <code className="font-mono">\frac</code>, <code className="font-mono">x^2</code> để
                hiển thị công thức toán trực tiếp tại đây.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Backslash (\) A -> Z Special Character & Formula Autocomplete */}
      {!readOnly && slashState && slashSuggestions.length > 0 ? (
        <MathSlashAutocomplete
          id={`${id}-slash`}
          query={slashState.activeQuery.query}
          suggestions={slashSuggestions}
          highlightedIndex={slashState.highlightIndex}
          mode={activeMathMode}
          onChangeMode={setInsertMode}
          onSelect={commitSlashSuggestion}
          onClose={() => setSlashState(null)}
        />
      ) : null}
    </div>
  );
});
