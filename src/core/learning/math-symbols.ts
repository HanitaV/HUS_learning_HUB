import type { EntityId } from '../../domain/learning';
import type {
  MathSymbol,
  MathSymbolCatalogConfig,
  MathSymbolContext,
  MathSymbolInsertMode,
  MathSymbolPreferences,
  MathSymbolScope,
} from '../../domain/math-symbols';

export interface ResolvedMathSymbols {
  readonly effectiveScope: MathSymbolScope;
  readonly symbols: readonly MathSymbol[];
  readonly defaultSymbolIds: readonly EntityId[];
  readonly isCustomized: boolean;
}

export interface CursorInsertionResult {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export function createDefaultMathSymbolPreferences(): MathSymbolPreferences {
  return {
    schemaVersion: 1,
    defaultScope: 'chapter',
    insertMode: 'unicode',
    byCourse: {},
    byChapter: {},
  };
}

function dedupeValidSymbols(
  ids: readonly EntityId[],
  symbolById: ReadonlyMap<EntityId, MathSymbol>,
): readonly MathSymbol[] {
  const seen = new Set<EntityId>();
  const result: MathSymbol[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const sym = symbolById.get(id);
    if (!sym) continue;
    seen.add(id);
    result.push(sym);
  }
  return result;
}

/**
 * Resolves the curriculum-default symbol IDs for a given scope + context,
 * falling back cleanly from chapter -> course -> subject -> global fallback.
 */
export function resolveDefaultSymbolIds(
  catalog: MathSymbolCatalogConfig,
  context: MathSymbolContext | undefined,
  scope: MathSymbolScope,
): readonly EntityId[] {
  if (scope === 'all') {
    return catalog.symbols.map(s => s.id);
  }

  const chapterId = context?.chapterId;
  const courseId = context?.courseId;
  const subjectId = context?.subjectId;

  if (scope === 'chapter' && chapterId && catalog.byChapter[chapterId]?.length) {
    return catalog.byChapter[chapterId]!;
  }
  if (courseId && catalog.byCourse[courseId]?.length) {
    return catalog.byCourse[courseId]!;
  }
  if (subjectId && catalog.bySubject[subjectId]?.length) {
    return catalog.bySubject[subjectId]!;
  }
  return catalog.fallbackIds;
}

/**
 * Resolves the active visible math symbols for a context, scope, and learner customizations.
 * If `scope === 'chapter'` is requested without a `chapterId`, degrades smoothly to `'course'`.
 */
export function resolveVisibleSymbols(
  catalog: MathSymbolCatalogConfig,
  context: MathSymbolContext | undefined,
  requestedScope: MathSymbolScope,
  preferences?: MathSymbolPreferences,
): ResolvedMathSymbols {
  const symbolById = new Map<EntityId, MathSymbol>(catalog.symbols.map(s => [s.id, s]));

  let effectiveScope: MathSymbolScope = requestedScope;
  if (effectiveScope === 'chapter' && !context?.chapterId) {
    effectiveScope = context?.courseId || context?.subjectId ? 'course' : 'all';
  } else if (effectiveScope === 'course' && !context?.courseId && !context?.subjectId) {
    effectiveScope = 'all';
  }

  const defaultSymbolIds = resolveDefaultSymbolIds(catalog, context, effectiveScope);

  if (effectiveScope === 'all') {
    return {
      effectiveScope: 'all',
      symbols: catalog.symbols,
      defaultSymbolIds,
      isCustomized: false,
    };
  }

  let customIds: readonly EntityId[] | undefined;
  if (effectiveScope === 'chapter' && context?.chapterId) {
    customIds = preferences?.byChapter[context.chapterId];
  } else if (effectiveScope === 'course' && context?.courseId) {
    customIds = preferences?.byCourse[context.courseId];
  }

  const activeIds = customIds && customIds.length > 0 ? customIds : defaultSymbolIds;
  const symbols = dedupeValidSymbols(activeIds, symbolById);

  return {
    effectiveScope,
    symbols: symbols.length > 0 ? symbols : dedupeValidSymbols(catalog.fallbackIds, symbolById),
    defaultSymbolIds,
    isCustomized: Boolean(customIds && customIds.length > 0),
  };
}

/**
 * Toggles a single symbol inside the learner's streamlined set for either the current chapter or course.
 * Prevents emptying the set completely (at least 1 symbol remains).
 */
export function toggleSymbolForScope(
  preferences: MathSymbolPreferences,
  catalog: MathSymbolCatalogConfig,
  context: MathSymbolContext | undefined,
  scope: 'chapter' | 'course',
  symbolId: EntityId,
): MathSymbolPreferences {
  const scopeKey = scope === 'chapter' ? context?.chapterId : context?.courseId;
  if (!scopeKey) return preferences;

  const currentMap = scope === 'chapter' ? preferences.byChapter : preferences.byCourse;
  const baseline = currentMap[scopeKey] ?? resolveDefaultSymbolIds(catalog, context, scope);
  const exists = baseline.includes(symbolId);

  if (exists && baseline.length <= 1) {
    return preferences;
  }

  const nextIds = exists
    ? baseline.filter(id => id !== symbolId)
    : [...baseline, symbolId];

  if (scope === 'chapter') {
    return {
      ...preferences,
      byChapter: {
        ...preferences.byChapter,
        [scopeKey]: nextIds,
      },
    };
  }

  return {
    ...preferences,
    byCourse: {
      ...preferences.byCourse,
      [scopeKey]: nextIds,
    },
  };
}

/**
 * Restores the curriculum default symbol set for the given chapter or course.
 */
export function resetScopeSymbols(
  preferences: MathSymbolPreferences,
  context: MathSymbolContext | undefined,
  scope: 'chapter' | 'course',
): MathSymbolPreferences {
  const scopeKey = scope === 'chapter' ? context?.chapterId : context?.courseId;
  if (!scopeKey) return preferences;

  if (scope === 'chapter') {
    if (!(scopeKey in preferences.byChapter)) return preferences;
    const nextByChapter = { ...preferences.byChapter };
    delete nextByChapter[scopeKey];
    return { ...preferences, byChapter: nextByChapter };
  }

  if (!(scopeKey in preferences.byCourse)) return preferences;
  const nextByCourse = { ...preferences.byCourse };
  delete nextByCourse[scopeKey];
  return { ...preferences, byCourse: nextByCourse };
}

export interface CursorInsertionOptions {
  /**
   * When inserting LaTeX into a Markdown/KaTeX textarea, automatically wrap with `$...$`
   * if the caret is not already inside an open `$...$` math span.
   */
  readonly wrapLatexWithDollars?: boolean;
}

function isInsideInlineLatexMath(textBeforeCursor: string): boolean {
  let dollarCount = 0;
  for (let i = 0; i < textBeforeCursor.length; i++) {
    const ch = textBeforeCursor[i];
    if (ch === '\\') {
      i++; // skip escaped character
      continue;
    }
    if (ch === '$') {
      dollarCount++;
    }
  }
  return dollarCount % 2 === 1;
}

function resolveMathlibToolbarSnippet(symbol: MathSymbol): {
  readonly snippet: string;
  readonly offset: number;
} {
  if (symbol.mathlibInsert !== undefined) {
    return {
      snippet: symbol.mathlibInsert,
      offset: symbol.mathlibCursorOffset ?? 0,
    };
  }
  const trimmedLatex = symbol.latexInsert.trim();
  if (/^\\[a-zA-Z]+(?:\{\})?$/.test(trimmedLatex)) {
    const hasBraces = trimmedLatex.endsWith('{}');
    return {
      snippet: hasBraces ? trimmedLatex : `${trimmedLatex} `,
      offset: hasBraces ? -1 : 0,
    };
  }
  return {
    snippet: symbol.unicodeInsert ?? symbol.glyph,
    offset: symbol.unicodeCursorOffset ?? 0,
  };
}

/**
 * Inserts a symbol's Unicode, Mathlib `\`, or LaTeX text at the current cursor / selection range
 * and returns the updated string plus the next caret position.
 */
export function insertMathSymbolAtCursor(
  currentValue: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  symbol: MathSymbol,
  mode: MathSymbolInsertMode,
  options?: CursorInsertionOptions,
): CursorInsertionResult {
  const safeStart = Math.max(0, Math.min(selectionStart ?? currentValue.length, currentValue.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd ?? safeStart, currentValue.length));

  const before = currentValue.slice(0, safeStart);
  const selectedText = currentValue.slice(safeStart, safeEnd);
  const after = currentValue.slice(safeEnd);

  const mathlibSpec = mode === 'mathlib' ? resolveMathlibToolbarSnippet(symbol) : null;

  let snippet =
    mode === 'latex'
      ? symbol.latexInsert
      : mathlibSpec
        ? mathlibSpec.snippet
        : (symbol.unicodeInsert ?? symbol.glyph);
  let offset =
    mode === 'latex'
      ? (symbol.latexCursorOffset ?? 0)
      : mathlibSpec
        ? mathlibSpec.offset
        : (symbol.unicodeCursorOffset ?? 0);

  if (selectedText.length > 0) {
    if (mode === 'mathlib' && snippet === '\\{/}') {
      snippet = `\\{${selectedText}/}`;
      offset = -1;
    } else if (mode === 'mathlib' && (snippet === '\\{^()}' || snippet === '\\{_()}')) {
      const op = snippet.includes('^') ? '^' : '_';
      snippet = `\\{${selectedText}${op}()}`;
      offset = -2;
    } else if ((mode === 'latex' || mode === 'mathlib') && snippet.includes('{}')) {
      const slotIdx = snippet.indexOf('{}');
      snippet = `${snippet.slice(0, slotIdx + 1)}${selectedText}${snippet.slice(slotIdx + 1)}`;
      const nextSlot = snippet.indexOf('{}', slotIdx + selectedText.length + 2);
      offset = nextSlot >= 0 ? nextSlot + 1 - snippet.length : 0;
    } else if (mode === 'unicode' && snippet.includes('()')) {
      const slotIdx = snippet.indexOf('()');
      snippet = `${snippet.slice(0, slotIdx + 1)}${selectedText}${snippet.slice(slotIdx + 1)}`;
      const nextSlot = snippet.indexOf('()', slotIdx + selectedText.length + 2);
      offset = nextSlot >= 0 ? nextSlot + 1 - snippet.length : 0;
    }
  }

  const shouldWrapDollars =
    mode === 'latex' &&
    Boolean(options?.wrapLatexWithDollars) &&
    !isInsideInlineLatexMath(before);

  const finalSnippet = shouldWrapDollars ? `$${snippet}$` : snippet;
  const finalOffset = shouldWrapDollars ? offset - 1 : offset;

  const nextValue = `${before}${finalSnippet}${after}`;
  const rawCaret = safeStart + finalSnippet.length + finalOffset;
  const nextCaret = Math.max(safeStart, Math.min(rawCaret, nextValue.length));

  return {
    value: nextValue,
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  };
}

/**
 * Normalizes common Unicode math glyphs to their ASCII short-answer equivalents
 * so students inserting `−`, `×`, `÷`, `≤`, `≥`, `≠`, `²`, `³`, `π`, `∞`, `√`
 * still match plain-text short-answer keys seamlessly.
 */
export function normalizeMathTextForEvaluation(input: string): string {
  return input
    // Unwrap programming-style `\{...}` blocks for plain short-answer key matching
    .replace(/\\\{([^{}]+)\}/g, '$1')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\(?:infty|inf)\b/g, 'inf')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\^\(([a-zA-Z0-9+-]+)\)/g, '^$1')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/·/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/³\+/g, '^3+')
    .replace(/³⁻/g, '^3-')
    .replace(/²\+/g, '^2+')
    .replace(/²⁺/g, '^2+')
    .replace(/²⁻/g, '^2-')
    .replace(/⁺/g, '^+')
    .replace(/⁻/g, '^-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/ⁿ/g, '^n')
    .replace(/⁻¹/g, '^-1')
    .replace(/₂/g, '_2')
    .replace(/π/g, 'pi')
    .replace(/∞/g, 'inf')
    .replace(/√/g, 'sqrt')
    .replace(/\s+/g, ' ')
    .trim();
}
