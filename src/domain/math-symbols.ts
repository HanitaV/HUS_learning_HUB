import type { EntityId } from './learning';

export type MathSymbolCategoryId =
  | 'structures'
  | 'basic'
  | 'calculus'
  | 'probability'
  | 'physics'
  | 'chemistry'
  | 'cs-logic'
  | 'greek';

export interface MathSymbolCategory {
  readonly id: MathSymbolCategoryId;
  readonly label: string;
}

export interface MathSymbol {
  readonly id: EntityId;
  /** Unicode text shown as fallback glyph and inserted in 'unicode' mode unless unicodeInsert is set. */
  readonly glyph: string;
  /** Optional KaTeX expression rendered inside the toolbar button for crisp visual math notation. */
  readonly buttonLatex?: string;
  /** Optional override for the string inserted in 'unicode' mode (defaults to glyph). */
  readonly unicodeInsert?: string;
  /** LaTeX snippet inserted in 'latex' mode. */
  readonly latexInsert: string;
  /** Cursor offset from the end of inserted text (negative moves caret left, e.g. -1 lands inside '()'). */
  readonly unicodeCursorOffset?: number;
  readonly latexCursorOffset?: number;
  /** Human-readable Vietnamese label for tooltips and aria-label. */
  readonly label: string;
  readonly category: MathSymbolCategoryId;
}

export type MathSymbolScope = 'chapter' | 'course' | 'all';
export type MathSymbolInsertMode = 'unicode' | 'mathlib' | 'latex';

export interface MathSymbolContext {
  readonly subjectId?: EntityId;
  readonly courseId?: EntityId;
  readonly chapterId?: EntityId;
  readonly courseLabel?: string;
  readonly chapterLabel?: string;
}

export interface MathSymbolCatalogConfig {
  readonly categories: readonly MathSymbolCategory[];
  readonly symbols: readonly MathSymbol[];
  readonly fallbackIds: readonly EntityId[];
  readonly bySubject: Readonly<Record<EntityId, readonly EntityId[]>>;
  readonly byCourse: Readonly<Record<EntityId, readonly EntityId[]>>;
  readonly byChapter: Readonly<Record<EntityId, readonly EntityId[]>>;
}

/**
 * User-streamlined overrides per scope key (e.g. `byCourse[courseId]` or `byChapter[chapterId]`).
 * Stores explicit symbol IDs chosen by the learner for that scope.
 */
export interface MathSymbolPreferences {
  readonly schemaVersion: 1;
  readonly defaultScope: MathSymbolScope;
  readonly insertMode: MathSymbolInsertMode;
  readonly byCourse: Readonly<Record<EntityId, readonly EntityId[]>>;
  readonly byChapter: Readonly<Record<EntityId, readonly EntityId[]>>;
}
