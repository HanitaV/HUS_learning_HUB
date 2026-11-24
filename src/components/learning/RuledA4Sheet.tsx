import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
  renderTextByMathMode,
  shouldAutoShowMathPreview,
  type ActiveBackslashQuery,
  type MathShorthandEntry,
} from '../../core/learning/math-shorthand';
import { insertMathSymbolAtCursor } from '../../core/learning/math-symbols';
import Markdown from './Markdown';
import { MathSlashAutocomplete } from './MathSlashAutocomplete';
import { MathSymbolToolbar } from './MathSymbolToolbar';
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
}

export function RuledA4Sheet({
  id,
  label,
  sheetTag = 'Giấy A4 kẻ ngang',
  value,
  onChange,
  placeholder = 'Trình bày lập luận từng dòng trên giấy A4 (gõ \\ để chèn nhanh ký tự đặc biệt & công thức)…',
  minRows = 6,
  maxLength = 20000,
  readOnly = false,
  symbolContext,
  toolbarLabel = 'Bảng chèn ký hiệu toán học',
  previewKey,
}: RuledA4SheetProps) {
  const { preferences, setInsertMode } = useMathSymbolPreferences();
  const activeMathMode = preferences.insertMode;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [previewOverride, setPreviewOverride] = useState<boolean | null>(null);
  const [slashState, setSlashState] = useState<{
    readonly activeQuery: ActiveBackslashQuery;
    readonly highlightIndex: number;
  } | null>(null);

  const showPreview =
    previewOverride ?? shouldAutoShowMathPreview(value, activeMathMode);

  const slashSuggestions = useMemo(() => {
    if (!slashState) return [];
    return filterShorthandSuggestions(slashState.activeQuery.query, activeMathMode);
  }, [slashState, activeMathMode]);

  const lineCount = useMemo(() => {
    if (!value) return 1;
    return value.split('\n').length;
  }, [value]);

  const computedRows = Math.max(minRows, Math.min(16, lineCount + 1));

  const focusAndPlaceCaret = (start: number, end: number = start) => {
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);
      }
    });
  };

  const handleInsertSymbol = (symbol: MathSymbol, mode: MathSymbolInsertMode) => {
    if (readOnly) return;
    const el = textareaRef.current;
    const inserted = insertMathSymbolAtCursor(
      value,
      el?.selectionStart ?? value.length,
      el?.selectionEnd ?? value.length,
      symbol,
      mode,
      { wrapLatexWithDollars: true },
    );
    onChange(inserted.value);
    focusAndPlaceCaret(inserted.selectionStart, inserted.selectionEnd);
  };

  const handleInsertShorthandEntry = (entry: MathShorthandEntry, mode: MathSymbolInsertMode) => {
    if (readOnly) return;
    const el = textareaRef.current;
    const posStart = el?.selectionStart ?? value.length;
    const posEnd = el?.selectionEnd ?? posStart;
    const applied = applyShorthandSuggestion(
      value,
      { replaceFrom: posStart, replaceTo: posEnd, query: '' },
      entry,
      mode,
      { wrapLatexWithDollars: true },
    );
    onChange(applied.value);
    setSlashState(null);
    focusAndPlaceCaret(applied.caret);
  };

  const commitSlashSuggestion = (entry: MathShorthandEntry) => {
    if (!slashState || readOnly) return;
    const applied = applyShorthandSuggestion(
      value,
      slashState.activeQuery,
      entry,
      activeMathMode,
      { wrapLatexWithDollars: true },
    );
    onChange(applied.value);
    setSlashState(null);
    focusAndPlaceCaret(applied.caret);
  };

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
        {/* Top A4 Exam / Notebook Folio Header */}
        <div className="hus-a4-header flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={id} className="text-sm font-semibold text-ink">
              {label}
            </label>
            <span className="rounded-[var(--radius-sm)] border border-border bg-surface/80 px-2 py-0.5 font-mono text-[11px] font-medium text-ink-secondary">
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
                className="min-h-[28px] rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
              >
                {toolbarVisible ? 'Ẩn bộ gõ ký tự' : '∑ Bộ gõ ký tự đặc biệt'}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setPreviewOverride(!showPreview)}
              aria-pressed={showPreview}
              className="min-h-[28px] rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
            >
              {showPreview ? 'Ẩn xem trước' : 'Xem trước công thức'}
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
            const q = detectActiveBackslashQuery(val, caret);
            setSlashState(q ? { activeQuery: q, highlightIndex: 0 } : null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setSlashState(null)}
          className="hus-a4-textarea"
        />

        {/* Typeset Formula & Prose Printout Band on the A4 Sheet */}
        {showPreview ? (
          <div
            data-math-live-preview={previewKey ?? id}
            className="hus-a4-preview px-4 py-3 text-sm leading-relaxed text-ink"
          >
            <p className="!mb-1.5 !mt-0 font-mono text-[11px] font-medium text-ink-muted">
              Bản hiển thị ký hiệu &amp; công thức trên giấy:
            </p>
            {value.trim() ? (
              <div className="[&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                <Markdown>{renderTextByMathMode(value, activeMathMode)}</Markdown>
              </div>
            ) : (
              <p className="!my-0 text-xs text-ink-muted">
                Nhập nội dung, bấm phím ký tự đặc biệt phía trên hoặc gõ lệnh <code className="font-mono">\</code> để xem bản hiển thị công thức trực tiếp.
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
}
