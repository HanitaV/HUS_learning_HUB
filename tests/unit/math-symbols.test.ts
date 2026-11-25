import { describe, expect, it } from 'vitest';
import {
  createDefaultMathSymbolPreferences,
  insertMathSymbolAtCursor,
  normalizeMathTextForEvaluation,
  resetScopeSymbols,
  resolveVisibleSymbols,
  toggleSymbolForScope,
} from '../../src/core/learning/math-symbols';
import { evaluateAnswer } from '../../src/core/learning/exercises';
import { mathSymbolCatalog } from '../../src/content/math-symbols';

describe('math-symbols catalog & resolver', () => {
  it('contains unique symbol IDs and every subject/course/chapter preset references valid symbols', () => {
    const ids = mathSymbolCatalog.symbols.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const idSet = new Set(ids);

    for (const id of mathSymbolCatalog.fallbackIds) {
      expect(idSet.has(id)).toBe(true);
    }
    for (const [subjectId, list] of Object.entries(mathSymbolCatalog.bySubject)) {
      expect(list.length, `subject ${subjectId}`).toBeGreaterThan(0);
      for (const id of list) expect(idSet.has(id), `${subjectId}:${id}`).toBe(true);
    }
    for (const [courseId, list] of Object.entries(mathSymbolCatalog.byCourse)) {
      expect(list.length, `course ${courseId}`).toBeGreaterThan(0);
      for (const id of list) expect(idSet.has(id), `${courseId}:${id}`).toBe(true);
    }
    for (const [chapterId, list] of Object.entries(mathSymbolCatalog.byChapter)) {
      expect(list.length, `chapter ${chapterId}`).toBeGreaterThan(0);
      for (const id of list) expect(idSet.has(id), `${chapterId}:${id}`).toBe(true);
    }
  });

  it('falls back cleanly to fallbackIds when no subject/course/chapter preset is registered', () => {
    const res = resolveVisibleSymbols(
      mathSymbolCatalog,
      { subjectId: 'unregistered-subject', courseId: 'unregistered-course', chapterId: 'ch-1' },
      'chapter',
    );
    expect(res.symbols.length).toBe(mathSymbolCatalog.fallbackIds.length);
    expect(res.symbols.length).toBeGreaterThan(0);
    expect(res.symbols.length).toBeLessThan(mathSymbolCatalog.symbols.length);
  });

  it('allows learners to streamline symbols per chapter and per course and reset to defaults', () => {
    const ctx = {
      subjectId: 'mathematics',
      courseId: 'sample-calc',
      chapterId: 'sample-calc-ch1',
    };
    let prefs = createDefaultMathSymbolPreferences();

    const initial = resolveVisibleSymbols(mathSymbolCatalog, ctx, 'chapter', prefs);
    expect(initial.isCustomized).toBe(false);
    const firstId = initial.symbols[0]!.id;

    // Remove first symbol from chapter
    prefs = toggleSymbolForScope(prefs, mathSymbolCatalog, ctx, 'chapter', firstId);
    const afterRemove = resolveVisibleSymbols(mathSymbolCatalog, ctx, 'chapter', prefs);
    expect(afterRemove.isCustomized).toBe(true);
    expect(afterRemove.symbols.some(s => s.id === firstId)).toBe(false);
    expect(afterRemove.symbols.length).toBe(initial.symbols.length - 1);

    // Course scope remains untouched
    const courseRes = resolveVisibleSymbols(mathSymbolCatalog, ctx, 'course', prefs);
    expect(courseRes.isCustomized).toBe(false);

    // Add a symbol from another domain (equilibrium) into this chapter
    prefs = toggleSymbolForScope(prefs, mathSymbolCatalog, ctx, 'chapter', 'equilibrium');
    const afterAdd = resolveVisibleSymbols(mathSymbolCatalog, ctx, 'chapter', prefs);
    expect(afterAdd.symbols.some(s => s.id === 'equilibrium')).toBe(true);

    // Reset chapter restores defaults
    prefs = resetScopeSymbols(prefs, ctx, 'chapter');
    const afterReset = resolveVisibleSymbols(mathSymbolCatalog, ctx, 'chapter', prefs);
    expect(afterReset.isCustomized).toBe(false);
    expect(afterReset.symbols.map(s => s.id)).toEqual(initial.symbols.map(s => s.id));
  });

  it('prevents removing the last remaining symbol in a scope', () => {
    const ctx = { courseId: 'sample-calc', chapterId: 'sample-calc-ch1' };
    const singlePrefs = {
      ...createDefaultMathSymbolPreferences(),
      byChapter: { 'sample-calc-ch1': ['integral'] },
    };
    const next = toggleSymbolForScope(singlePrefs, mathSymbolCatalog, ctx, 'chapter', 'integral');
    expect(next.byChapter['sample-calc-ch1']).toEqual(['integral']);
  });

  it('inserts Unicode, Mathlib, and LaTeX snippets at cursor with accurate caret offsets, selection wrapping, and auto-$ wrapping', () => {
    const frac = mathSymbolCatalog.symbols.find(s => s.id === 'frac')!;
    const bigO = mathSymbolCatalog.symbols.find(s => s.id === 'big-o')!;
    const integral = mathSymbolCatalog.symbols.find(s => s.id === 'integral')!;

    const uni = insertMathSymbolAtCursor('T(n) = ', 7, 7, bigO, 'unicode');
    expect(uni.value).toBe('T(n) = O()');
    expect(uni.selectionStart).toBe(9);
    expect(uni.selectionEnd).toBe(9);

    // Highlighted text gets wrapped inside the numerator of \frac{selected}{}
    const latexWrapped = insertMathSymbolAtCursor('x + 1', 0, 5, frac, 'latex');
    expect(latexWrapped.value).toBe('\\frac{x + 1}{}');
    expect(latexWrapped.selectionStart).toBe(13);

    // Mathlib \ mode uses unified catalog snippet directly
    const limSym = mathSymbolCatalog.symbols.find(s => s.id === 'lim')!;
    const mathlibLim = insertMathSymbolAtCursor('', 0, 0, limSym, 'mathlib');
    expect(mathlibLim.value).toBe('\\lim{x->}{}');
    expect(mathlibLim.selectionStart).toBe(8);

    // Auto-$ wrapping outside math mode
    const autoDollar = insertMathSymbolAtCursor('Ta có ', 6, 6, integral, 'latex', {
      wrapLatexWithDollars: true,
    });
    expect(autoDollar.value).toBe('Ta có $\\int_{}^{}  \\,dx$');
    expect(autoDollar.selectionStart).toBe(13);

    // Already inside $...$ does not double-wrap
    const insideDollar = insertMathSymbolAtCursor('$f(x) = $', 8, 8, frac, 'latex', {
      wrapLatexWithDollars: true,
    });
    expect(insideDollar.value).toBe('$f(x) = \\frac{}{}$');
    expect(insideDollar.selectionStart).toBe(14);
  });

  it('includes structured templates and 1-to-1 \\ shorthands across all toolbar symbols', () => {
    const byId = new Map(mathSymbolCatalog.symbols.map(s => [s.id, s]));
    for (const sym of mathSymbolCatalog.symbols) {
      expect(sym.shorthand, `${sym.id}.shorthand`).toMatch(/^\\.+/);
    }
    for (const id of [
      'frac',
      'power',
      'subscript',
      'nth-root',
      'ddx',
      'd2dx2',
      'partial-x',
      'indef-integral',
      'integral',
      'eval-bar',
      'lim',
      'sum',
      'binom',
      'cases',
    ]) {
      const sym = byId.get(id);
      expect(sym, id).toBeDefined();
      expect(sym?.buttonLatex, `${id}.buttonLatex`).toBeTruthy();
    }
  });

  it('normalizes Unicode math symbols when evaluating short-answer exercises', () => {
    expect(normalizeMathTextForEvaluation('x² − 2 ≤ π')).toBe('x^2 - 2 <= pi');

    const exercise = {
      id: 'test-sa',
      lessonId: 'test-lesson',
      kind: 'short-answer' as const,
      title: 'Test',
      prompt: 'Test',
      answers: ['O(n^2)', 'pi/2', '-1/2'],
    };

    expect(evaluateAnswer(exercise, 'O(n²)')).toBe(true);
    expect(evaluateAnswer(exercise, 'π/2')).toBe(true);
    expect(evaluateAnswer(exercise, '−1/2')).toBe(true);
    expect(evaluateAnswer(exercise, 'O(n)')).toBe(false);
  });
});
