import { describe, expect, it } from 'vitest';
import {
  applyShorthandSuggestion,
  compileMathShorthandToMarkdown,
  detectActiveBackslashQuery,
  filterShorthandSuggestions,
  MATH_SHORTHAND_CATALOG,
  renderTextByMathMode,
} from '../../src/core/learning/math-shorthand';
import {
  balanceIncompleteLatex,
  convertStudentShorthandToLatex,
  parseLineToRealtimeSegments,
  upgradePlainMathInProse,
} from '../../src/core/learning/realtime-math-preview';
import { evaluateAnswer } from '../../src/core/learning/exercises';
import { mathSymbolCatalog } from '../../src/content/math-symbols';

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

  it('supports comprehensive \\lim family (x -> box, x -> a, one-sided, +-infty, n -> +infty, bare lim) without superficial bare lim fallback', () => {
    const limMatches = filterShorthandSuggestions('lim', 'unicode', 12);
    const limIds = limMatches.map(m => m.id);
    expect(limIds).toEqual(
      expect.arrayContaining([
        'cmd-lim',
        'cmd-lim-xa',
        'cmd-lim-right',
        'cmd-lim-left',
        'cmd-lim-inf',
        'cmd-lim-minf',
        'cmd-lim-n',
        'cmd-lim-bare',
        'cmd-limsup',
      ]),
    );

    const baseLim = MATH_SHORTHAND_CATALOG.find(e => e.id === 'cmd-lim')!;
    const q = { replaceFrom: 0, replaceTo: 4, query: 'lim' };

    // Default Unicode mode inserts structured `lim_{x→} ` with caret right after `→`, never bare `lim `!
    const uniApplied = applyShorthandSuggestion('\\lim', q, baseLim, 'unicode');
    expect(uniApplied.value).toBe('lim_{x→} ');
    expect(uniApplied.caret).toBe(7);

    // Mathlib \ mode places caret inside `x -> ` so user can type `a`, `0^+`, or `+inf`
    const mathlibApplied = applyShorthandSuggestion('\\lim', q, baseLim, 'mathlib');
    expect(mathlibApplied.value).toBe('\\lim{x->}{}');
    expect(mathlibApplied.caret).toBe(8);

    // LaTeX mode places caret right after `\to ` inside `\lim_{x \to }`
    const latexApplied = applyShorthandSuggestion('\\lim', q, baseLim, 'latex', {
      wrapLatexWithDollars: true,
    });
    expect(latexApplied.value).toBe('$\\lim_{x \\to } $');
    expect(latexApplied.caret).toBe(13);

    // Compiles general limits, one-sided limits, and empty-slot limits with placeholder box
    expect(compileMathShorthandToMarkdown('\\lim{x->a}{(x^(2) - a^(2))/(x - a)}')).toBe(
      '$\\lim_{x \\to a} \\frac{x^{2} - a^{2}}{x - a}$',
    );
    expect(compileMathShorthandToMarkdown('\\lim{x->0^+}{\\sin{x}/x}')).toBe(
      '$\\lim_{x \\to 0^{+}} \\frac{\\sin(x)}{x}$',
    );
    // Plain keyboard `a+`, `a-`, `0+`, `0-` without superscript `⁺`/`⁻` or `^`
    expect(compileMathShorthandToMarkdown('\\lim{x->a+}{f(x)}')).toBe(
      '$\\lim_{x \\to a^{+}} f(x)$',
    );
    expect(compileMathShorthandToMarkdown('\\lim{x->0-}{1/x}')).toBe(
      '$\\lim_{x \\to 0^{-}} \\frac{1}{x}$',
    );
    const limPlusEntry = MATH_SHORTHAND_CATALOG.find(e => e.id === 'cmd-lim-right')!;
    const limMinusEntry = MATH_SHORTHAND_CATALOG.find(e => e.id === 'cmd-lim-left')!;
    expect(limPlusEntry.unicodeInsert).toBe('lim_{x→a+} ');
    expect(limMinusEntry.unicodeInsert).toBe('lim_{x→a-} ');
    expect(limPlusEntry.mathlibInsert).toBe('\\lim{x->a+}{}');
    expect(limMinusEntry.mathlibInsert).toBe('\\lim{x->a-}{}');

    expect(compileMathShorthandToMarkdown('\\lim_{x->+inf} 1/x')).toContain('\\lim_{x \\to + \\infty}');
    expect(compileMathShorthandToMarkdown('\\lim{x->}{}')).toBe('$\\lim_{x \\to \\square} \\square$');
  });

  it('maintains 1-to-1 parity between all preset toolbar symbols and \\ shorthand catalog', () => {
    const shorthandSet = new Set<string>();
    for (const entry of MATH_SHORTHAND_CATALOG) {
      shorthandSet.add(entry.mathlibTrigger);
      shorthandSet.add(entry.latexTrigger);
      for (const alias of entry.aliases) {
        shorthandSet.add(alias.startsWith('\\') ? alias : `\\${alias}`);
      }
    }

    for (const sym of mathSymbolCatalog.symbols) {
      expect(sym.shorthand, `symbol ${sym.id} missing shorthand`).toBeTruthy();
      expect(
        shorthandSet.has(sym.shorthand!),
        `symbol ${sym.id} shorthand ${sym.shorthand} not in MATH_SHORTHAND_CATALOG`,
      ).toBe(true);
      expect(sym.mathlibInsert, `symbol ${sym.id} missing mathlibInsert`).toBeTruthy();
    }
  });

  it('converts typed expressions, Unicode templates, and incomplete mid-keystroke LaTeX into realtime KaTeX segments', () => {
    // Mid-keystroke incomplete LaTeX gets balanced cleanly without throwing
    expect(balanceIncompleteLatex('\\frac{x+1}{')).toBe('\\frac{x+1}{\\square}');
    expect(balanceIncompleteLatex('\\lim_{x \\to ')).toContain('\\lim_{x \\to');

    // Default Unicode mode upgrades toolbar templates & natural ASCII math into math segments
    const upgraded = upgradePlainMathInProse(
      'Ta có lim_{x→a} (x^2 - a^2)/(x - a) = 2a với x != a => kết luận.',
    );
    expect(upgraded).toContain('$\\lim_{x \\to a}$');
    expect(upgraded).toContain('$\\frac{x^{2} - a^{2}}{x - a}$');
    expect(upgraded).toContain('$\\ne$');
    expect(upgraded).toContain('$\\Rightarrow$');

    const segments = parseLineToRealtimeSegments(
      'Xét \\lim{x->0}{\\sin{x}/x} = 1',
      'unicode',
    );
    expect(segments.some(s => s.kind === 'math' && s.latex.includes('\\lim_{x \\to 0}'))).toBe(
      true,
    );

    const incompleteLatexSegs = parseLineToRealtimeSegments(
      'Đặt $\\frac{n+1}{',
      'latex',
    );
    expect(
      incompleteLatexSegs.some(
        s => s.kind === 'math' && s.latex.includes('\\frac{n+1}{\\square}'),
      ),
    ).toBe(true);

    // Keyboard-friendly one-sided limits (`lim_{x→a+}`, `lim_{x->0-}`, `lim x->a+`, `$\lim_{x \to 0-}$`) and ion charges (`Cu^2+`, `SO_4^2-`)
    const oneSidedProse = upgradePlainMathInProse(
      'Xét lim x->a+ f(x) = lim_{x->0-} (1)/(x) và ion Cu^2+, SO_4^2- ở 25^oC.',
    );
    expect(oneSidedProse).toContain('$\\lim_{x \\to a^{+}}$');
    expect(oneSidedProse).toContain('$\\lim_{x \\to 0^{-}}$');
    expect(oneSidedProse).toContain('$Cu^{2+}$');
    expect(oneSidedProse).toContain('$SO_{4}^{2-}$');
    expect(oneSidedProse).toContain('$25^{\\circ}$');

    expect(balanceIncompleteLatex('\\lim_{x \\to a+} f(x)')).toContain('\\lim_{x \\to a^{+}}');
    expect(balanceIncompleteLatex('\\lim_{x \\to 0-} f(x)')).toContain('\\lim_{x \\to 0^{-}}');
  });

  it('converts all custom website shorthands (both outside and inside $...$) and Unicode templates into standard LaTeX for Gemini without touching code blocks', () => {
    const rawDraft = [
      'ĐKXĐ: u != 0, n \\in \\N*.',
      'Xét \\lim{u->0}{\\{(\\root{3}{1+u}-1)/u}} = \\{1/3} <=> \\eval{x^(2)/2}{0..1} = \\{1/2}.',
      'Mặt khác $\\lim{u->0} \\frac{\\root{3}{1+u}-1}{u} = \\{1/3}$ với $\\forall \\eps > 0, k \\in \\N*$.',
      'Tích phân: ∫_(0)^(1) (x^2) dx = (1)/(3) và chuỗi \\suminf{1/n^(2)}.',
      'Vòng lặp `for (int i = 0; i <= n; i++)` chạy trong \\O{n*log(n)}.',
    ].join('\n');

    const converted = convertStudentShorthandToLatex(rawDraft);

    // Custom shorthand commands are completely replaced with standard LaTeX
    expect(converted).not.toContain('\\lim{u->0}');
    expect(converted).not.toContain('\\root{3}');
    expect(converted).not.toContain('\\{1/3}');
    expect(converted).not.toContain('\\eval{');
    expect(converted).not.toContain('\\N*');
    expect(converted).not.toContain('\\eps');
    expect(converted).not.toContain('\\suminf');

    expect(converted).toContain('\\lim_{u \\to 0}');
    expect(converted).toContain('\\sqrt[3]{1 + u}');
    expect(converted).toContain('\\frac{1}{3}');
    expect(converted).toContain('\\mathbb{N}^{*}');
    expect(converted).toContain('\\varepsilon');
    expect(converted).toContain('\\left.\\frac{x^{2}}{2}\\right|_{0}^{1}');
    expect(converted).toContain('\\int_{0}^{1}');
    expect(converted).toContain('\\sum_{n=1}^{\\infty}');
    // Inline code block remains verbatim
    expect(converted).toContain('`for (int i = 0; i <= n; i++)`');
  });
});
