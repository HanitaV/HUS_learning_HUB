import katex from 'katex';
import type { MathSymbolInsertMode } from '../../domain/math-symbols';
import {
  getDisplayTriggerForMode,
  type MathShorthandEntry,
} from '../../core/learning/math-shorthand';
import 'katex/dist/katex.min.css';

const popupKatexCache = new Map<string, string>();

export function renderInlineKatexPreview(latex: string): string {
  const cached = popupKatexCache.get(latex);
  if (cached !== undefined) return cached;
  const html = katex.renderToString(latex, {
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    output: 'html',
    displayMode: false,
  });
  popupKatexCache.set(latex, html);
  return html;
}

export interface MathSlashAutocompleteProps {
  readonly id: string;
  readonly query: string;
  readonly suggestions: readonly MathShorthandEntry[];
  readonly highlightedIndex: number;
  readonly mode: MathSymbolInsertMode;
  readonly onChangeMode: (mode: MathSymbolInsertMode) => void;
  readonly onSelect: (entry: MathShorthandEntry) => void;
  readonly onClose: () => void;
}

const MODE_LABELS: Readonly<Record<MathSymbolInsertMode, string>> = {
  unicode: 'Ký hiệu',
  mathlib: 'Mathlib \\',
  latex: 'LaTeX',
};

export function MathSlashAutocomplete({
  id,
  query,
  suggestions,
  highlightedIndex,
  mode,
  onChangeMode,
  onSelect,
  onClose,
}: MathSlashAutocompleteProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      id={id}
      data-math-slash-popup="true"
      className="written-practice-reveal overflow-hidden rounded-[var(--radius-md)] border border-accent/45 bg-surface shadow-sm"
    >
      {/* Popup header: active query + 1-click mode switch + keyboard legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-subtle/80 px-3 py-1.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-accent-ink">
            {query ? `Tìm gần nhất: \\${query}` : 'Danh sách ký tự \\ (A → Z)'}
          </span>
          <span className="text-ink-muted">({suggestions.length} mục)</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Đổi chế độ chèn nhanh"
            className="inline-flex rounded-[var(--radius-sm)] border border-border bg-surface p-0.5"
          >
            {(['unicode', 'mathlib', 'latex'] as const).map(m => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onMouseDown={e => e.preventDefault()}
                onClick={() => onChangeMode(m)}
                className={`min-h-[22px] rounded-[calc(var(--radius-sm)-2px)] px-1.5 text-[10px] font-medium transition-colors ${
                  mode === m
                    ? 'bg-accent-subtle text-accent-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <span className="hidden text-ink-muted sm:inline">↑↓ chọn · Enter/Tab chèn · Esc đóng</span>
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={onClose}
            aria-label="Đóng bảng gợi ý gõ ký tự"
            className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-canvas hover:text-ink"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable A -> Z / Nearest-match options */}
      <ul
        role="listbox"
        aria-label="Gợi ý ký tự toán học theo dấu gạch chéo ngược"
        className="max-h-52 divide-y divide-border/60 overflow-y-auto"
      >
        {suggestions.map((entry, idx) => {
          const active = idx === highlightedIndex;
          const displayTrigger = getDisplayTriggerForMode(entry, mode);
          return (
            <li
              key={entry.id}
              id={`${id}-opt-${idx}`}
              role="option"
              aria-selected={active}
              onMouseDown={e => {
                // Keep focus & selection inside the input/textarea
                e.preventDefault();
              }}
              onClick={() => onSelect(entry)}
              className={`flex min-h-[38px] cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-xs transition-colors ${
                active
                  ? 'bg-accent-subtle/80 text-accent-ink'
                  : 'bg-surface text-ink hover:bg-surface-subtle'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <code className="min-w-[4.5rem] shrink-0 rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">
                  {displayTrigger}
                </code>
                <span className="truncate text-ink-secondary">{entry.label}</span>
              </div>
              <span
                aria-hidden="true"
                className="hus-math-key shrink-0 rounded bg-canvas/70 px-2 py-0.5 text-ink"
                dangerouslySetInnerHTML={{ __html: renderInlineKatexPreview(entry.previewLatex) }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
