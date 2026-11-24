import { useMemo, useState } from 'react';
import katex from 'katex';
import type {
  MathSymbol,
  MathSymbolCategoryId,
  MathSymbolContext,
  MathSymbolInsertMode,
  MathSymbolScope,
} from '../../domain/math-symbols';
import {
  filterShorthandSuggestions,
  getDisplayTriggerForMode,
  MATH_SHORTHAND_CATEGORIES,
  type MathShorthandCategory,
  type MathShorthandEntry,
} from '../../core/learning/math-shorthand';
import { resolveVisibleSymbols } from '../../core/learning/math-symbols';
import { mathSymbolCatalog } from '../../content/math-symbols';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import { RotateCcwIcon } from '../ui/Icons';
import 'katex/dist/katex.min.css';

const katexButtonCache = new Map<string, string>();

function renderButtonLatex(latex: string): string {
  const cached = katexButtonCache.get(latex);
  if (cached !== undefined) return cached;
  const html = katex.renderToString(latex, {
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    output: 'html',
    displayMode: false,
  });
  katexButtonCache.set(latex, html);
  return html;
}

function SymbolButtonVisual({ symbol }: { readonly symbol: MathSymbol }) {
  if (!symbol.buttonLatex) {
    return <span aria-hidden="true">{symbol.glyph}</span>;
  }
  return (
    <span
      aria-hidden="true"
      className="hus-math-key inline-flex items-center justify-center leading-none"
      dangerouslySetInnerHTML={{ __html: renderButtonLatex(symbol.buttonLatex) }}
    />
  );
}

export interface MathSymbolToolbarProps {
  readonly context?: MathSymbolContext | undefined;
  readonly onInsert: (symbol: MathSymbol, mode: MathSymbolInsertMode) => void;
  /** Optional handler to insert a shorthand table row directly at the active cursor. */
  readonly onInsertShorthandEntry?:
    | ((entry: MathShorthandEntry, mode: MathSymbolInsertMode) => void)
    | undefined;
  /** Compact mode starts collapsed behind a "∑ Ký hiệu" toggle (ideal for short-answer inputs). */
  readonly variant?: 'compact' | 'expanded';
  /** Whether to show the Unicode / Mathlib \ / LaTeX mode switch. */
  readonly allowLatexMode?: boolean;
  /** Optional custom aria-label for the toolbar. */
  readonly label?: string;
}

export function MathSymbolToolbar({
  context,
  onInsert,
  onInsertShorthandEntry,
  variant = 'expanded',
  allowLatexMode = variant === 'expanded',
  label = 'Bảng chèn ký hiệu toán học',
}: MathSymbolToolbarProps) {
  const { preferences, setDefaultScope, setInsertMode, toggleSymbol, resetScope } =
    useMathSymbolPreferences();
  const [open, setOpen] = useState(variant === 'expanded');
  const [customizing, setCustomizing] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSearch, setGuideSearch] = useState('');
  const [guideCategory, setGuideCategory] = useState<MathShorthandCategory | 'all'>('all');
  const [activeCategory, setActiveCategory] = useState<MathSymbolCategoryId | 'all'>('all');

  const effectiveInsertMode: MathSymbolInsertMode = allowLatexMode
    ? preferences.insertMode
    : 'unicode';

  const resolved = useMemo(
    () =>
      resolveVisibleSymbols(
        mathSymbolCatalog,
        context,
        preferences.defaultScope,
        preferences,
      ),
    [context, preferences],
  );

  const hasChapterScope = Boolean(context?.chapterId);
  const hasCourseScope = Boolean(context?.courseId || context?.subjectId);
  const customizableScope: 'chapter' | 'course' | null =
    resolved.effectiveScope === 'chapter' && context?.chapterId
      ? 'chapter'
      : resolved.effectiveScope === 'course' && context?.courseId
        ? 'course'
        : hasChapterScope
          ? 'chapter'
          : context?.courseId
            ? 'course'
            : null;

  const activeIdSet = useMemo(
    () => new Set(resolved.symbols.map(s => s.id)),
    [resolved.symbols],
  );

  const displaySymbols = useMemo(() => {
    if (resolved.effectiveScope !== 'all' || activeCategory === 'all') {
      return resolved.symbols;
    }
    return resolved.symbols.filter(s => s.category === activeCategory);
  }, [resolved.effectiveScope, resolved.symbols, activeCategory]);

  const customizerSymbols = useMemo(() => {
    if (activeCategory === 'all') return mathSymbolCatalog.symbols;
    return mathSymbolCatalog.symbols.filter(s => s.category === activeCategory);
  }, [activeCategory]);

  const guideEntries = useMemo(() => {
    const cleaned = guideSearch.trim().replace(/^\\/, '');
    const matched = filterShorthandSuggestions(cleaned, effectiveInsertMode);
    if (guideCategory === 'all') return matched;
    return matched.filter(e => e.category === guideCategory);
  }, [guideSearch, effectiveInsertMode, guideCategory]);

  const handleScopeChange = (nextScope: MathSymbolScope) => {
    setDefaultScope(nextScope);
    if (nextScope === 'all') {
      setCustomizing(false);
    }
  };

  const handleInsertFromGuideRow = (entry: MathShorthandEntry) => {
    if (onInsertShorthandEntry) {
      onInsertShorthandEntry(entry, effectiveInsertMode);
      return;
    }
    const syntheticSymbol: MathSymbol = {
      id: entry.id,
      glyph: entry.unicodeInsert,
      unicodeInsert: entry.unicodeInsert,
      unicodeCursorOffset: entry.unicodeCursorOffset,
      latexInsert: entry.latexInsert,
      latexCursorOffset: entry.latexCursorOffset,
      label: entry.label,
      category: 'basic',
    };
    onInsert(syntheticSymbol, effectiveInsertMode);
  };

  if (variant === 'compact' && !open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
        >
          <span aria-hidden="true" className="font-mono text-sm leading-none text-accent">
            ∑
          </span>
          <span>Chèn ký hiệu toán</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={label}
      className="hus-panel-enter space-y-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-2.5 sm:p-3"
    >
      {/* Top control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Phạm vi ký hiệu">
          {hasChapterScope ? (
            <button
              type="button"
              onClick={() => handleScopeChange('chapter')}
              aria-pressed={resolved.effectiveScope === 'chapter'}
              className={`min-h-[30px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                resolved.effectiveScope === 'chapter'
                  ? 'border-accent bg-accent-subtle text-accent-ink'
                  : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
              }`}
            >
              Theo chương
            </button>
          ) : null}

          {hasCourseScope ? (
            <button
              type="button"
              onClick={() => handleScopeChange('course')}
              aria-pressed={resolved.effectiveScope === 'course'}
              className={`min-h-[30px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                resolved.effectiveScope === 'course'
                  ? 'border-accent bg-accent-subtle text-accent-ink'
                  : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
              }`}
            >
              Theo môn
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => handleScopeChange('all')}
            aria-pressed={resolved.effectiveScope === 'all'}
            className={`min-h-[30px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              resolved.effectiveScope === 'all'
                ? 'border-accent bg-accent-subtle text-accent-ink'
                : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
            }`}
          >
            Tất cả
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {allowLatexMode ? (
            <div
              role="group"
              aria-label="Định dạng chèn ký hiệu"
              className="inline-flex rounded-[var(--radius-sm)] border border-border bg-surface p-0.5"
            >
              <button
                type="button"
                onClick={() => setInsertMode('unicode')}
                aria-pressed={effectiveInsertMode === 'unicode'}
                className={`min-h-[26px] rounded-[calc(var(--radius-sm)-2px)] px-2 text-[11px] font-medium transition-colors ${
                  effectiveInsertMode === 'unicode'
                    ? 'bg-accent-subtle text-accent-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Ký hiệu
              </button>
              <button
                type="button"
                onClick={() => setInsertMode('mathlib')}
                aria-pressed={effectiveInsertMode === 'mathlib'}
                title="Chế độ gõ kiểu ngôn ngữ lập trình: \\{1/n}, \\{n^(n)}, \\sigma{n^(n)}"
                className={`min-h-[26px] rounded-[calc(var(--radius-sm)-2px)] px-2 font-mono text-[11px] font-medium transition-colors ${
                  effectiveInsertMode === 'mathlib'
                    ? 'bg-accent-subtle text-accent-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Mathlib \
              </button>
              <button
                type="button"
                onClick={() => setInsertMode('latex')}
                aria-pressed={effectiveInsertMode === 'latex'}
                className={`min-h-[26px] rounded-[calc(var(--radius-sm)-2px)] px-2 font-mono text-[11px] font-medium transition-colors ${
                  effectiveInsertMode === 'latex'
                    ? 'bg-accent-subtle text-accent-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                LaTeX
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setGuideOpen(v => !v);
              setCustomizing(false);
            }}
            aria-expanded={guideOpen}
            className={`min-h-[30px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              guideOpen
                ? 'border-accent bg-accent-subtle text-accent-ink'
                : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
            }`}
          >
            {guideOpen ? 'Đóng bảng gõ' : 'Bảng gõ & Hướng dẫn'}
          </button>

          {customizableScope ? (
            <button
              type="button"
              onClick={() => {
                if (resolved.effectiveScope === 'all') {
                  setDefaultScope(customizableScope);
                }
                setGuideOpen(false);
                setCustomizing(v => !v);
              }}
              aria-expanded={customizing}
              className={`min-h-[30px] rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                customizing || resolved.isCustomized
                  ? 'border-accent/60 bg-accent-subtle/80 text-accent-ink'
                  : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
              }`}
            >
              {customizing ? 'Xong tinh giản' : 'Tinh giản'}
              {resolved.isCustomized && !customizing ? ' •' : ''}
            </button>
          ) : null}

          {variant === 'compact' ? (
            <button
              type="button"
              onClick={() => {
                setCustomizing(false);
                setGuideOpen(false);
                setOpen(false);
              }}
              aria-label="Thu gọn bảng ký hiệu toán học"
              className="min-h-[30px] rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              Ẩn
            </button>
          ) : null}
        </div>
      </div>

      {/* Mode orientation micro-hint */}
      <p className="text-[11px] leading-relaxed text-ink-muted">
        {effectiveInsertMode === 'mathlib' ? (
          <>
            Đang chọn <strong className="font-semibold text-ink">Mathlib \</strong>: gõ{' '}
            <code className="font-mono text-ink">\{'{1/n}'}</code> (1 chia n),{' '}
            <code className="font-mono text-ink">\{'{n^(n)}'}</code> (n mũ n),{' '}
            <code className="font-mono text-ink">\sigma{'{n^(n)}'}</code>, hoặc gõ{' '}
            <code className="font-mono text-ink">\</code> để mở danh sách A → Z.
          </>
        ) : effectiveInsertMode === 'latex' ? (
          <>
            Đang chọn <strong className="font-semibold text-ink">LaTeX chuẩn</strong>: dùng{' '}
            <code className="font-mono text-ink">$...$</code> (vd{' '}
            <code className="font-mono text-ink">$\frac{'{1}{n}'}$</code>,{' '}
            <code className="font-mono text-ink">$n^{'{n}'}$</code>) hoặc gõ{' '}
            <code className="font-mono text-ink">\</code> để tìm lệnh LaTeX từ A → Z.
          </>
        ) : (
          <>
            Đang chọn <strong className="font-semibold text-ink">Ký hiệu Unicode</strong>: bấm nút
            hoặc gõ <code className="font-mono text-ink">\</code> trong ô nhập để tra cứu ký tự từ A
            → Z (đổi sang <strong className="font-medium text-ink">Mathlib \</strong> hoặc{' '}
            <strong className="font-medium text-ink">LaTeX</strong> để vẽ phân số 2 tầng).
          </>
        )}
      </p>

      {/* Interactive Typing Guide & A -> Z Symbol Table */}
      {guideOpen ? (
        <div
          data-math-guide-panel="true"
          className="written-practice-reveal space-y-3 rounded-[var(--radius-md)] border border-accent/35 bg-surface p-3"
        >
          <div className="space-y-1.5 border-b border-border pb-2.5 text-xs">
            <p className="font-semibold text-ink">
              Hướng dẫn gõ nhanh (
              {effectiveInsertMode === 'latex'
                ? 'Chế độ LaTeX chuẩn'
                : effectiveInsertMode === 'mathlib'
                  ? 'Chế độ Mathlib \\ kiểu lập trình'
                  : 'Mẹo: chuyển sang Mathlib \\ hoặc LaTeX để hiển thị công thức 2 tầng'}
              )
            </p>
            {effectiveInsertMode === 'latex' ? (
              <ul className="grid grid-cols-1 gap-1.5 text-[11px] text-ink-secondary sm:grid-cols-2">
                <li>
                  • Phân số: <code className="font-mono text-ink">$\frac{'{1}{n}'}$</code> →{' '}
                  <span dangerouslySetInnerHTML={{ __html: renderButtonLatex('\\frac{1}{n}') }} />
                </li>
                <li>
                  • Lũy thừa &amp; chỉ số:{' '}
                  <code className="font-mono text-ink">$n^{'{n}'}$, $a_{'{n+1}'}$</code> →{' '}
                  <span dangerouslySetInnerHTML={{ __html: renderButtonLatex('n^{n}, a_{n+1}') }} />
                </li>
                <li>
                  • Ký hiệu hàm: <code className="font-mono text-ink">$\sigma{'{n^{n}}'}$</code> →{' '}
                  <span dangerouslySetInnerHTML={{ __html: renderButtonLatex('\\sigma{n^{n}}') }} />
                </li>
                <li>
                  • Gõ tắt khi đang viết: gõ <code className="font-mono text-ink">\si</code> sẽ lọc
                  ngay <code className="font-mono text-ink">\sigma</code>,{' '}
                  <code className="font-mono text-ink">\sin</code>…
                </li>
              </ul>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 text-[11px] text-ink-secondary sm:grid-cols-2">
                <li>
                  • Phân số tự động: <code className="font-mono text-ink">\{'{1/n}'}</code> hoặc{' '}
                  <code className="font-mono text-ink">\{'{(x+1)/(n+1)}'}</code> →{' '}
                  <span
                    dangerouslySetInnerHTML={{
                      __html: renderButtonLatex('\\frac{1}{n}, \\frac{x+1}{n+1}'),
                    }}
                  />
                </li>
                <li>
                  • Số mũ &amp; chỉ số: <code className="font-mono text-ink">\{'{n^(n)}'}</code>,{' '}
                  <code className="font-mono text-ink">\{'{a_(n+1)}'}</code> →{' '}
                  <span dangerouslySetInnerHTML={{ __html: renderButtonLatex('n^{n}, a_{n+1}') }} />
                </li>
                <li>
                  • Lệnh kèm biểu thức:{' '}
                  <code className="font-mono text-ink">\sigma{'{n^(n)}'}</code>,{' '}
                  <code className="font-mono text-ink">\sin{'{x/2}'}</code> →{' '}
                  <span
                    dangerouslySetInnerHTML={{
                      __html: renderButtonLatex('\\sigma{n^{n}}, \\sin(x/2)'),
                    }}
                  />
                </li>
                <li>
                  • Tổng &amp; tích phân có cận:{' '}
                  <code className="font-mono text-ink">\sum{'{i=1..n}{1/i}'}</code> →{' '}
                  <span
                    dangerouslySetInnerHTML={{ __html: renderButtonLatex('\\sum_{i=1}^{n} 1/i') }}
                  />
                </li>
              </ul>
            )}
          </div>

          {/* Search & Category filter for the A-Z Table */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={guideSearch}
              onChange={e => setGuideSearch(e.target.value)}
              placeholder="Tìm lệnh A → Z (vd: \si, \sin, phân số, tích phân, xích ma…)"
              aria-label="Tìm kiếm trong bảng gõ ký tự toán học"
              className="min-h-[34px] min-w-[12rem] flex-1 rounded-[var(--radius-sm)] border border-border bg-canvas px-2.5 py-1 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1" role="group" aria-label="Lọc nhóm bảng gõ">
            <button
              type="button"
              aria-pressed={guideCategory === 'all'}
              onClick={() => setGuideCategory('all')}
              className={`min-h-[24px] rounded-full border px-2 py-0.5 text-[11px] ${
                guideCategory === 'all'
                  ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                  : 'border-border bg-canvas text-ink-muted hover:text-ink'
              }`}
            >
              Tất cả (A → Z)
            </button>
            {MATH_SHORTHAND_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                aria-pressed={guideCategory === cat.id}
                onClick={() => setGuideCategory(cat.id)}
                className={`min-h-[24px] rounded-full border px-2 py-0.5 text-[11px] ${
                  guideCategory === cat.id
                    ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                    : 'border-border bg-canvas text-ink-muted hover:text-ink'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="max-h-56 overflow-y-auto rounded-[var(--radius-sm)] border border-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-surface-subtle text-[11px] text-ink-muted">
                <tr>
                  <th className="border-b border-border px-2.5 py-1.5 font-semibold">Lệnh gõ</th>
                  <th className="border-b border-border px-2.5 py-1.5 font-semibold">Ví dụ</th>
                  <th className="border-b border-border px-2.5 py-1.5 font-semibold">Hiển thị</th>
                  <th className="border-b border-border px-2.5 py-1.5 font-semibold">Ý nghĩa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {guideEntries.map(entry => {
                  const trig = getDisplayTriggerForMode(entry, effectiveInsertMode);
                  const ex =
                    effectiveInsertMode === 'latex' ? entry.latexExample : entry.mathlibExample;
                  return (
                    <tr
                      key={entry.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleInsertFromGuideRow(entry)}
                      title="Bấm để chèn vào vị trí con trỏ"
                      className="cursor-pointer bg-surface transition-colors hover:bg-accent-subtle/50"
                    >
                      <td className="px-2.5 py-1.5 font-mono font-semibold text-accent-ink">
                        {trig}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px] text-ink-secondary">
                        {ex}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span
                          className="hus-math-key"
                          dangerouslySetInnerHTML={{
                            __html: renderButtonLatex(entry.previewLatex),
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-ink-secondary">{entry.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Category tabs when browsing "Tất cả" or customizing */}
      {resolved.effectiveScope === 'all' || customizing ? (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Nhóm ký hiệu toán học"
        >
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            aria-pressed={activeCategory === 'all'}
            className={`min-h-[26px] rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
              activeCategory === 'all'
                ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                : 'border-border bg-surface text-ink-muted hover:text-ink'
            }`}
          >
            Tất cả nhóm
          </button>
          {mathSymbolCatalog.categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              aria-pressed={activeCategory === cat.id}
              className={`min-h-[26px] rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                activeCategory === cat.id
                  ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                  : 'border-border bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Main insertion buttons OR streamlining customizer */}
      {customizing && customizableScope ? (
        <div className="space-y-2 rounded-[var(--radius-sm)] border border-accent/30 bg-surface p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-secondary">
            <span>
              Chọn ký hiệu hiển thị cho{' '}
              <strong className="font-semibold text-ink">
                {customizableScope === 'chapter'
                  ? context?.chapterLabel || 'chương này'
                  : context?.courseLabel || 'môn này'}
              </strong>{' '}
              ({resolved.symbols.length} đang bật)
            </span>
            {resolved.isCustomized ? (
              <button
                type="button"
                onClick={() => resetScope(context, customizableScope)}
                className="inline-flex min-h-[26px] items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary hover:border-border-strong hover:text-ink"
              >
                <RotateCcwIcon width={11} height={11} />
                Khôi phục mặc định
              </button>
            ) : null}
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Bật hoặc tắt ký hiệu hiển thị"
          >
            {customizerSymbols.map(sym => {
              const selected = activeIdSet.has(sym.id);
              const disableRemove = selected && resolved.symbols.length <= 1;
              return (
                <button
                  key={sym.id}
                  type="button"
                  disabled={disableRemove}
                  aria-pressed={selected}
                  aria-label={`${sym.label} (${sym.glyph})`}
                  title={sym.label}
                  onClick={() => toggleSymbol(context, customizableScope, sym.id)}
                  className={`inline-flex min-h-[36px] min-w-[38px] items-center justify-center rounded-[var(--radius-sm)] border px-2 py-1 font-mono text-xs transition-colors ${
                    selected
                      ? 'border-accent bg-accent-subtle font-semibold text-accent-ink'
                      : 'border-border bg-canvas/60 text-ink-muted hover:border-border-strong hover:text-ink'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <SymbolButtonVisual symbol={sym} />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div role="toolbar" aria-label={label} className="flex flex-wrap gap-1.5">
          {displaySymbols.map(sym => (
            <button
              key={sym.id}
              type="button"
              title={`${sym.label}${
                effectiveInsertMode === 'latex' ? ` (${sym.latexInsert.trim()})` : ''
              }`}
              aria-label={`Chèn ${sym.label}`}
              onMouseDown={event => {
                event.preventDefault();
              }}
              onClick={() => onInsert(sym, effectiveInsertMode)}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1 font-mono text-sm text-ink transition-colors hover:border-accent hover:bg-accent-subtle/60 hover:text-accent-ink active:scale-[0.97]"
            >
              <SymbolButtonVisual symbol={sym} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
