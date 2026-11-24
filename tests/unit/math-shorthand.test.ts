import { describe, expect, it } from 'vitest';
import {
  applyShorthandSuggestion,
  compileMathShorthandToMarkdown,
  detectActiveBackslashQuery,
  filterShorthandSuggestions,
  renderTextByMathMode,
} from '../../src/core/learning/math-shorthand';
import { evaluateAnswer } from '../../src/core/learning/exercises';

describe('math-shorthand compiler, mode isolation & A-Z nearest search', () => {
  it('compiles programming-style Mathlib \\ expressions into KaTeX', () => {
    expect(compileMathShorthandToMarkdown('\\{1/n}')).toBe('$\\frac{1}{n}$');
    expect(compileMathShorthandToMarkdown('\\{n^(n)}')).toBe('$n^{n}$');
    expect(compileMathShorthandToMarkdown('\\sigma{n^(n)}')).toBe('$\\sigma{n^{n}}$');
    expect(compileMathShorthandToMarkdown('\\sin{x/2}')).toBe('$\\sin\\left(\\frac{x}{2}\\right)$');
    expect(compileMathShorthandToMarkdown('\\{1 - 1/(n + 1)}')).toBe(
      '$1 - \\frac{1}{n + 1}$',
    );
    expect(compileMathShorthandToMarkdown('\\{(x + 1)/(n^(2) + 1)}')).toBe(
      '$\\frac{x + 1}{n^{2} + 1}$',
    );
    expect(compileMathShorthandToMarkdown('\\sum{i=1..n}{1/i^(2)}')).toBe(
      '$\\sum_{i=1}^{n} \\frac{1}{i^{2}}$',
    );
    expect(compileMathShorthandToMarkdown('\\lim{n->inf}{(1 + 1/n)^(n)}')).toBe(
      '$\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^{n}$',
    );
    expect(
      compileMathShorthandToMarkdown('Với mọi \\eps > 0, chọn n \\in \\N* sao cho \\{1/n} < \\eps'),
    ).toBe('Với mọi $\\varepsilon$ > 0, chọn n $\\in$ $\\mathbb{N}^{*}$ sao cho $\\frac{1}{n}$ < $\\varepsilon$');
  });

  it('strictly isolates Mathlib \\ mode from LaTeX and Unicode modes (never running both in parallel)', () => {
    const raw = 'Xét tập $A = \\{1, 2\\}$ và ghi chú \\{1/n}';
    // In LaTeX mode, `renderTextByMathMode` leaves raw Markdown/LaTeX completely untouched
    expect(renderTextByMathMode(raw, 'latex')).toBe(raw);
    expect(renderTextByMathMode(raw, 'unicode')).toBe(raw);
    // In Mathlib \ mode, existing `$A = \{1, 2\}$` stays intact while outer `\{1/n}` compiles to `$\frac{1}{n}$`
    expect(renderTextByMathMode(raw, 'mathlib')).toBe('Xét tập $A = \\{1, 2\\}$ và ghi chú $\\frac{1}{n}$');
  });

  it('lists commands strictly from A to Z on bare \\ and finds nearest commands like \\sin for \\si', () => {
    const azList = filterShorthandSuggestions('', 'mathlib');
    expect(azList.length).toBeGreaterThan(40);
    // Pure commands start with `abs`, `alpha`, `approx`... and end at `vec`, `z`
    expect(azList[0]!.sortKey).toBe('abs');
    expect(azList[1]!.sortKey).toBe('alpha');
    const pureOnly = azList.filter(e => !e.id.startsWith('expr-'));
    expect(pureOnly[pureOnly.length - 1]!.sortKey).toBe('z');

    // Typing `\si` finds `\sin`, `\sigma`, `\Sigma` at the very top
    const siMatches = filterShorthandSuggestions('si', 'mathlib', 5);
    const siTriggers = siMatches.map(m => m.mathlibTrigger);
    expect(siTriggers).toContain('\\sin');
    expect(siTriggers).toContain('\\sigma');
    expect(siTriggers[0]).toBe('\\sin'); // shorter exact-prefix `\sin` ranks #1 for `\si`!

    // Fuzzy typo `\sni` still finds `\sin` via bounded Levenshtein distance
    const fuzzyMatches = filterShorthandSuggestions('sni', 'mathlib', 5);
    expect(fuzzyMatches.some(m => m.id === 'fn-sin')).toBe(true);
  });

  it('detects active backslash queries and inserts mode-specific snippets with exact caret placement', () => {
    const text = 'Ta có \\si';
    const q = detectActiveBackslashQuery(text, text.length);
    expect(q).toEqual({ replaceFrom: 6, replaceTo: 9, query: 'si' });

    const sinEntry = filterShorthandSuggestions('si', 'mathlib')[0]!;
    expect(sinEntry.id).toBe('fn-sin');

    // Mathlib \ mode -> `\sin{}` with caret inside `{|}`
    const mathlibApplied = applyShorthandSuggestion(text, q!, sinEntry, 'mathlib');
    expect(mathlibApplied.value).toBe('Ta có \\sin{}');
    expect(mathlibApplied.caret).toBe(11);

    // LaTeX mode outside `$...$` -> `$\sin()$` with caret inside `(|)`
    const latexApplied = applyShorthandSuggestion(text, q!, sinEntry, 'latex', {
      wrapLatexWithDollars: true,
    });
    expect(latexApplied.value).toBe('Ta có $\\sin()$');
    expect(latexApplied.caret).toBe(12);

    // LaTeX mode already inside `$...$` -> `\sin()` without double `$`
    const insideLatex = '$1 + \\si$';
    const qInside = detectActiveBackslashQuery(insideLatex, 8)!;
    const latexInsideApplied = applyShorthandSuggestion(insideLatex, qInside, sinEntry, 'latex', {
      wrapLatexWithDollars: true,
    });
    expect(latexInsideApplied.value).toBe('$1 + \\sin()$');
    expect(latexInsideApplied.caret).toBe(10);

    // Short-answer evaluation normalizes `\{1/2}` and `\pi/2`
    const saExercise = {
      id: 'sa-1',
      lessonId: 'l-1',
      kind: 'short-answer' as const,
      title: 'T',
      prompt: 'P',
      answers: ['1/2', 'pi/2'],
    };
    expect(evaluateAnswer(saExercise, '\\{1/2}')).toBe(true);
    expect(evaluateAnswer(saExercise, '\\pi/2')).toBe(true);
  });
});
