import type { MathSymbolInsertMode } from '../../domain/math-symbols';
import {
  compileLimitBound,
  compileMathExpression,
  compileMathShorthandToMarkdown,
  expandCustomShorthandsInLatexMath,
  readBalancedGroup,
} from './math-shorthand';

export type RealtimeSegment =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'math'; readonly latex: string; readonly display: boolean };

const UNICODE_SYMBOL_TO_LATEX: Readonly<Record<string, string>> = {
  '±': '\\pm',
  '−': '-',
  '×': '\\times',
  '·': '\\cdot',
  '÷': '\\div',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '≈': '\\approx',
  '≡': '\\equiv',
  '→': '\\to',
  '⇒': '\\Rightarrow',
  '⇔': '\\Leftrightarrow',
  '∞': '\\infty',
  '∂': '\\partial',
  '∇': '\\nabla',
  '∝': '\\propto',
  '⇌': '\\rightleftharpoons',
  '∀': '\\forall',
  '∃': '\\exists',
  '∈': '\\in',
  '∉': '\\notin',
  '⊂': '\\subset',
  '⊆': '\\subseteq',
  '∪': '\\cup',
  '∩': '\\cap',
  '∅': '\\emptyset',
  '∧': '\\land',
  '∨': '\\lor',
  '¬': '\\neg',
  '⊢': '\\vdash',
  '∼': '\\sim',
  'ℕ': '\\mathbb{N}',
  'ℤ': '\\mathbb{Z}',
  'ℚ': '\\mathbb{Q}',
  'ℝ': '\\mathbb{R}',
  'ℂ': '\\mathbb{C}',
  'ℙ': '\\mathbb{P}',
  '𝔼': '\\mathbb{E}',
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'δ': '\\delta',
  'Δ': '\\Delta',
  'ε': '\\varepsilon',
  'θ': '\\theta',
  'Θ': '\\Theta',
  'λ': '\\lambda',
  'μ': '\\mu',
  'ν': '\\nu',
  'π': '\\pi',
  'ρ': '\\rho',
  'σ': '\\sigma',
  'Σ': '\\Sigma',
  'τ': '\\tau',
  'φ': '\\varphi',
  'Φ': '\\Phi',
  'χ': '\\chi',
  'ω': '\\omega',
  'Ω': '\\Omega',
};

const UNICODE_SUPERSCRIPTS: Readonly<Record<string, string>> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  'ⁿ': 'n',
};

const UNICODE_SUBSCRIPTS: Readonly<Record<string, string>> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

/**
 * Repairs incomplete LaTeX while a student is actively typing (e.g. `\frac{x+1}{` -> `\frac{x+1}{\square}`),
 * ensuring realtime KaTeX rendering stays smooth on every keystroke without raw error flashes.
 */
export function balanceIncompleteLatex(rawLatex: string): string {
  let s = rawLatex.trim();
  if (!s) return '';

  // Remove trailing lone backslash while user starts typing a command name
  s = s.replace(/\\$/, '');
  if (!s) return '';

  // Fill empty `{}` slots with `\square` so templates like `\frac{}{}` or `\int_{}^{}` render visually
  s = s.replace(/\{\s*\}/g, '{\\square}');
  s = s.replace(/\[\s*\]/g, '[\\square]');

  // Complete trailing `\to` inside subscripts like `\lim_{x \to }` -> `\lim_{x \to \square}`
  s = s.replace(/(\\to|->)\s*(\}|$)/g, '\\to \\square$2');

  // Upgrade keyboard-typed one-sided limits inside raw LaTeX (`\lim_{x \to a+}`, `\lim_{x \to 0-}`) -> `a^{+}`, `0^{-}`
  s = s.replace(
    /\\(lim|limsup|liminf)_\{([^{}]*?(?:\\to|->)\s*[^{}+-\s][^{}^]*?)([+-])\s*\}/g,
    '\\$1_{$2^{$3}}',
  );

  // Complete dangling `^` or `_` at end of expression
  s = s.replace(/([\^_])\s*$/, '$1{\\square}');

  // Balance unclosed `{` braces
  let braceDepth = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '\\') {
      i += 1;
      continue;
    }
    if (s[i] === '{') braceDepth += 1;
    else if (s[i] === '}' && braceDepth > 0) braceDepth -= 1;
  }
  if (braceDepth > 0) {
    if (s.endsWith('{')) {
      s += '\\square}';
      braceDepth -= 1;
    }
    s += '}'.repeat(braceDepth);
  }

  // If `\frac{num}` only has 1 group typed so far, append `{\square}`
  s = s.replace(/\\(frac|binom)(\{[^{}]*\})(?!\s*\{)/g, '\\$1$2{\\square}');

  // Balance `\left` without matching `\right`
  const leftCount = (s.match(/\\left(?![a-zA-Z])/g) ?? []).length;
  const rightCount = (s.match(/\\right(?![a-zA-Z])/g) ?? []).length;
  if (leftCount > rightCount) {
    s += '\\right.'.repeat(leftCount - rightCount);
  }

  return s;
}

/**
 * Balances incomplete `\{...` or `\cmd{...` at the end of a line before Mathlib compilation.
 */
function balanceTrailingShorthandBraces(line: string): string {
  if (!line.includes('\\')) return line;
  let depth = 0;
  let inDollar = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '\\' && line[i + 1] === '$') {
      i += 1;
      continue;
    }
    if (ch === '$') {
      inDollar = !inDollar;
      continue;
    }
    if (!inDollar) {
      if (ch === '{') depth += 1;
      else if (ch === '}' && depth > 0) depth -= 1;
    }
  }
  if (depth > 0) {
    return `${line}${'}'.repeat(depth)}`;
  }
  return line;
}

function compileUnicodeLimitSubscript(rawSub: string): string {
  const prepped = rawSub
    .trim()
    .replace(/→/g, '->')
    .replace(/∞/g, 'inf')
    .replace(/⁺/g, '^+')
    .replace(/⁻/g, '^-');
  const normalizedSymbols = prepped.replace(/[αβγδΔεθΘλμνπρσΣτφΦχωΩ]/g, ch => {
    const tex = UNICODE_SYMBOL_TO_LATEX[ch];
    return tex ? ` ${tex} ` : ch;
  });
  return compileLimitBound(normalizedSymbols);
}

function normalizeUnicodeInnerMath(raw: string): string {
  let s = raw.trim();
  if (!s) return '\\square';

  // Convert combining vector arrow `v⃗` -> `\vec{v}`
  s = s.replace(/([a-zA-Z0-9])\u20d7/g, '\\vec{$1}');
  // Convert x̄ -> \bar{x}
  s = s.replace(/([a-zA-Z])\u0304/g, '\\bar{$1}');

  // Superscript runs like `²`, `⁻¹`, `²⁺`
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+/g, match => {
    const mapped = [...match].map(ch => UNICODE_SUPERSCRIPTS[ch] ?? ch).join('');
    return `^{${mapped}}`;
  });

  // Subscript runs like `₀`, `₁`, `₂`
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, match => {
    const mapped = [...match].map(ch => UNICODE_SUBSCRIPTS[ch] ?? ch).join('');
    return `_{${mapped}}`;
  });

  // Primes `′`, `″`
  s = s.replace(/″/g, "''").replace(/′/g, "'");
  s = s.replace(/°/g, '^{\\circ}');

  // Replace Unicode symbols inside math fragments
  for (const [uni, tex] of Object.entries(UNICODE_SYMBOL_TO_LATEX)) {
    if (s.includes(uni)) {
      s = s.split(uni).join(` ${tex} `);
    }
  }

  return compileMathExpression(s) || '\\square';
}

/**
 * Upgrades Unicode toolbar insertions & natural typed math expressions outside `$...$`
 * into inline `$...$` LaTeX spans while keeping surrounding Vietnamese prose untouched.
 * Uses Private-Use-Area sentinels so earlier converted math spans are never re-matched by later passes.
 */
export function upgradePlainMathInProse(prose: string): string {
  if (!prose.trim()) return prose;

  const stashed: string[] = [];
  const stash = (latex: string): string => {
    const id = stashed.length;
    stashed.push(latex);
    return `\uE000${id}\uE001`;
  };
  const stashNoDigits = (id: number): string => {
    // Encode index using Private Use Area codepoints U+E100..U+E109 so digit regexes never match sentinel IDs!
    const encoded = String(id)
      .split('')
      .map(d => String.fromCharCode(0xe100 + Number(d)))
      .join('');
    return `\uE000${encoded}\uE001`;
  };
  const stashSafe = (latex: string): string => {
    const id = stashed.length;
    stashed.push(latex);
    return stashNoDigits(id);
  };
  void stash;

  let text = prose;

  // 1. Chemistry isotope template: `^(14)_(6)C` or `^()_()X`
  text = text.replace(
    /\^\(([^)\n]*)\)_\(([^)\n]*)\)([A-Za-z]{1,3})/g,
    (_m, a: string, z: string, el: string) => {
      const aTex = normalizeUnicodeInnerMath(a);
      const zTex = normalizeUnicodeInnerMath(z);
      return stashSafe(`{}_{${zTex}}^{${aTex}}\\text{${el}}`);
    },
  );

  // 2. Chemistry reaction arrow with condition: `→[t°]` or `->[xt]`
  text = text.replace(/(?:→|->)\[([^\]\n]*)\]/g, (_m, cond: string) => {
    const cTex = cond.trim() ? normalizeUnicodeInnerMath(cond) : '\\square';
    return stashSafe(`\\xrightarrow{${cTex}}`);
  });

  // 3. Limits: `lim_{x→a+}`, `lim_{x->0-}`, `lim_(x->a+)`, `lim(x->a-)`, and space-typed `lim x->a+` / `lim x->0-` / `lim x->+inf`
  text = text.replace(
    /\b(limsup|liminf|lim)_\{([^{}\n]*)\}/g,
    (_m, op: string, sub: string) => stashSafe(`\\${op}_{${compileUnicodeLimitSubscript(sub)}}`),
  );
  text = text.replace(
    /\b(limsup|liminf|lim)_\(([^()\n]*)\)/g,
    (_m, op: string, sub: string) => stashSafe(`\\${op}_{${compileUnicodeLimitSubscript(sub)}}`),
  );
  text = text.replace(
    /\b(limsup|liminf|lim)\(([^()\n]*(?:->|→)[^()\n]*)\)/g,
    (_m, op: string, sub: string) => stashSafe(`\\${op}_{${compileUnicodeLimitSubscript(sub)}}`),
  );
  text = text.replace(
    /\b(limsup|liminf|lim)\s+([a-zA-Z][a-zA-Z0-9_]*\s*(?:->|→)\s*(?:[+-]?\s*(?:inf|oo|∞)|[a-zA-Z0-9_]+(?:\^\s*\(?[+-]\)?|[+-])?)?)/g,
    (_m, op: string, sub: string) => stashSafe(`\\${op}_{${compileUnicodeLimitSubscript(sub)}}`),
  );

  // 4. Definite & indefinite Unicode integrals: `∫_(a)^(b) ... dx`, `∫ () dx`, `|_()^()`
  text = text.replace(
    /∫_[\({]([^){}\n]*)[\)}]\^[\({]([^){}\n]*)[\)}]\s*(?:\(([^)\n]*)\))?\s*(d[a-zA-Z])?/g,
    (_m, low: string, high: string, body?: string, diff?: string) => {
      const lTex = normalizeUnicodeInnerMath(low);
      const hTex = normalizeUnicodeInnerMath(high);
      const bTex = body !== undefined ? normalizeUnicodeInnerMath(body) : '';
      const dTex = diff ? `\\,${diff}` : '';
      return stashSafe(`\\int_{${lTex}}^{${hTex}}${bTex ? ` ${bTex}` : ''}${dTex}`);
    },
  );
  text = text.replace(/∫\s*\(([^)\n]*)\)\s*(d[a-zA-Z])?/g, (_m, body: string, diff?: string) => {
    const bTex = normalizeUnicodeInnerMath(body);
    const dTex = diff ? `\\,${diff}` : '';
    return stashSafe(`\\int ${bTex}${dTex}`);
  });
  text = text.replace(
    /\|_[\({]([^){}\n]*)[\)}]\^[\({]([^){}\n]*)[\)}]/g,
    (_m, low: string, high: string) =>
      stashSafe(`\\left.\\right|_{${normalizeUnicodeInnerMath(low)}}^{${normalizeUnicodeInnerMath(high)}}`),
  );

  // 5. Sums & Products: `∑_{i=1}^{n}`, `∏_{i=1}^{n}`
  text = text.replace(
    /([∑∏])_\{([^{}\n]*)\}\^\{([^{}\n]*)\}/g,
    (_m, sym: string, low: string, high: string) => {
      const op = sym === '∑' ? '\\sum' : '\\prod';
      return stashSafe(`${op}_{${normalizeUnicodeInnerMath(low)}}^{${normalizeUnicodeInnerMath(high)}}`);
    },
  );

  // 6. Derivatives: `d²/dx²(...)`, `d2/dx2(...)`, `d^2/dx^2(...)`, `d/dx(...)`, `d/dt(...)`, `∂/∂x(...)`
  text = text.replace(/d(?:²|\^?2)\/d([xt])(?:²|\^?2)\(([^)\n]*)\)/g, (_m, v: string, inner: string) =>
    stashSafe(`\\frac{d^2}{d${v}^2}\\left(${normalizeUnicodeInnerMath(inner)}\\right)`),
  );
  text = text.replace(/d\/d([xt])\(([^)\n]*)\)/g, (_m, v: string, inner: string) =>
    stashSafe(`\\frac{d}{d${v}}\\left(${normalizeUnicodeInnerMath(inner)}\\right)`),
  );
  text = text.replace(/∂\/∂([xyz])\(([^)\n]*)\)/g, (_m, v: string, inner: string) =>
    stashSafe(`\\frac{\\partial}{\\partial ${v}}\\left(${normalizeUnicodeInnerMath(inner)}\\right)`),
  );

  // 7. Roots & Logs & Probability & CS templates
  text = text.replace(/√\(([^)\n]*)\)/g, (_m, inner: string) =>
    stashSafe(`\\sqrt{${normalizeUnicodeInnerMath(inner)}}`),
  );
  text = text.replace(/\broot\(([^,\n]*),\s*([^)\n]*)\)/g, (_m, deg: string, rad: string) =>
    stashSafe(`\\sqrt[${normalizeUnicodeInnerMath(deg)}]{${normalizeUnicodeInnerMath(rad)}}`),
  );
  text = text.replace(/\blog_([a-zA-Z0-9]+)\(([^)\n]*)\)/g, (_m, base: string, arg: string) =>
    stashSafe(`\\log_{${normalizeUnicodeInnerMath(base)}}\\left(${normalizeUnicodeInnerMath(arg)}\\right)`),
  );
  text = text.replace(/\blog(?:₂|2)\(([^)\n]*)\)/g, (_m, arg: string) =>
    stashSafe(`\\log_{2}\\left(${normalizeUnicodeInnerMath(arg)}\\right)`),
  );
  text = text.replace(
    /\b(ln|sin|cos|tan|cot|arcsin|arccos|arctan)\(([^)\n]*)\)/g,
    (_m, fn: string, arg: string) => stashSafe(`\\${fn}\\left(${normalizeUnicodeInnerMath(arg)}\\right)`),
  );
  text = text.replace(/ℙ\(([^)|\n]*)\|([^)\n]*)\)/g, (_m, a: string, b: string) =>
    stashSafe(`\\mathbb{P}\\left(${normalizeUnicodeInnerMath(a)} \\mid ${normalizeUnicodeInnerMath(b)}\\right)`),
  );
  text = text.replace(/ℙ\(([^)\n]*)\)/g, (_m, a: string) =>
    stashSafe(`\\mathbb{P}\\left(${normalizeUnicodeInnerMath(a)}\\right)`),
  );
  text = text.replace(/𝔼\[([^\]\n]*)\]/g, (_m, a: string) =>
    stashSafe(`\\mathbb{E}\\left[${normalizeUnicodeInnerMath(a)}\\right]`),
  );
  text = text.replace(/\bVar\(([^)\n]*)\)/g, (_m, a: string) =>
    stashSafe(`\\operatorname{Var}\\left(${normalizeUnicodeInnerMath(a)}\\right)`),
  );
  text = text.replace(/Φ\(([^)\n]*)\)/g, (_m, a: string) =>
    stashSafe(`\\Phi\\left(${normalizeUnicodeInnerMath(a)}\\right)`),
  );
  text = text.replace(/\bC\(([^,\n]*),\s*([^)\n]*)\)/g, (_m, n: string, k: string) =>
    stashSafe(`\\binom{${normalizeUnicodeInnerMath(n)}}{${normalizeUnicodeInnerMath(k)}}`),
  );
  text = text.replace(/\b(O|Θ|Ω)\(([^)\n]*)\)/g, (_m, sym: string, inner: string) => {
    const head = sym === 'O' ? 'O' : sym === 'Θ' ? '\\Theta' : '\\Omega';
    return stashSafe(`${head}\\left(${normalizeUnicodeInnerMath(inner)}\\right)`);
  });
  text = text.replace(/⌊([^⌋\n]*)⌋/g, (_m, inner: string) =>
    stashSafe(`\\lfloor ${normalizeUnicodeInnerMath(inner)} \\rfloor`),
  );
  text = text.replace(/⌈([^⌉\n]*)⌉/g, (_m, inner: string) =>
    stashSafe(`\\lceil ${normalizeUnicodeInnerMath(inner)} \\rceil`),
  );

  // 8. Parenthesized stacked fractions `(num)/(den)`, `atom/(den)`, `(num)/atom` (including empty `()/()` template)
  text = text.replace(
    /\(([^()\n\uE000\uE001]*)\)\s*\/\s*\(([^()\n\uE000\uE001]*)\)/g,
    (_m, num: string, den: string) =>
      stashSafe(`\\frac{${normalizeUnicodeInnerMath(num)}}{${normalizeUnicodeInnerMath(den)}}`),
  );
  text = text.replace(
    /\b([a-zA-Z0-9]+)\s*\/\s*\(([^()\n\uE000\uE001]+)\)/g,
    (_m, num: string, den: string) =>
      stashSafe(`\\frac{${normalizeUnicodeInnerMath(num)}}{${normalizeUnicodeInnerMath(den)}}`),
  );
  text = text.replace(
    /\(([^()\n\uE000\uE001]+)\)\s*\/\s*([a-zA-Z0-9]+)\b/g,
    (_m, num: string, den: string) =>
      stashSafe(`\\frac{${normalizeUnicodeInnerMath(num)}}{${normalizeUnicodeInnerMath(den)}}`),
  );

  // 9. Special compound chemistry/math tokens (`ℕ*`, `ℝ+`, `ℝ-`, `ℝ*`, `ℤ+`, `ℤ-`, `δ+`, `δ-`, `δ⁺`, `δ⁻`, `σ*`, `π*`, `χ²`)
  text = text
    .replace(/ℕ\*/g, () => stashSafe('\\mathbb{N}^{*}'))
    .replace(/ℝ([*+-])(?=$|[\s,.;:)\]}])/g, (_m, s: string) => stashSafe(`\\mathbb{R}^{${s}}`))
    .replace(/ℤ([*+-])(?=$|[\s,.;:)\]}])/g, (_m, s: string) => stashSafe(`\\mathbb{Z}^{${s}}`))
    .replace(/δ[⁺+]/g, () => stashSafe('\\delta^{+}'))
    .replace(/δ[⁻-]/g, () => stashSafe('\\delta^{-}'))
    .replace(/σ\*/g, () => stashSafe('\\sigma^{*}'))
    .replace(/π\*/g, () => stashSafe('\\pi^{*}'))
    .replace(/χ(?:\^?2|²)/g, () => stashSafe('\\chi^{2}'));

  // 10. Standalone powers/subscripts/charges like `x^(n+1)`, `a^+`, `0^-`, `Cu^2+`, `SO_4^2-`, `t^o`, `x^2`, `a_n`, `x²`, `x⁻¹`, `v⃗`, `x̄`
  text = text.replace(
    /([a-zA-Z0-9]+)_[\({]([^){}\n\uE000\uE001]*)[\)}]\^[\({]([^){}\n\uE000\uE001]*)[\)}]/g,
    (_m, base: string, sub: string, sup: string) =>
      stashSafe(`${base}_{${normalizeUnicodeInnerMath(sub)}}^{${normalizeUnicodeInnerMath(sup)}}`),
  );
  text = text.replace(
    /([a-zA-Z0-9]+|\))\^[\({]([^){}\n\uE000\uE001]*)[\)}]/g,
    (_m, base: string, sup: string) => stashSafe(`${base}^{${normalizeUnicodeInnerMath(sup)}}`),
  );
  text = text.replace(
    /([a-zA-Z0-9]+)_[\({]([^){}\n\uE000\uE001]*)[\)}]/g,
    (_m, base: string, sub: string) => stashSafe(`${base}_{${normalizeUnicodeInnerMath(sub)}}`),
  );
  text = text.replace(
    /([a-zA-Z0-9)]+(?:_[a-zA-Z0-9]+)?)\^(\d*[+-]|\*)(?=$|[\s,.;:)\]}])/g,
    (_m, rawBase: string, charge: string) => {
      const baseFormatted = rawBase.replace(/_([a-zA-Z0-9]+)$/, '_{$1}');
      return stashSafe(`${baseFormatted}^{${charge}}`);
    },
  );
  text = text.replace(
    /([a-zA-Z0-9)]+)\^o(?=$|[\s,.;:)\]}C])/g,
    (_m, b: string) => stashSafe(`${b}^{\\circ}`),
  );
  text = text.replace(/([a-zA-Z0-9]+)\^([+-]?[a-zA-Z0-9]+)/g, (_m, b: string, e: string) =>
    stashSafe(`${b}^{${e}}`),
  );
  text = text.replace(/([a-zA-Z]+)_([a-zA-Z0-9]+)/g, (_m, b: string, s: string) =>
    stashSafe(`${b}_{${s}}`),
  );
  text = text.replace(/([a-zA-Z0-9)]+)([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)/g, (_m, b: string, sup: string) => {
    const mapped = [...sup].map(ch => UNICODE_SUPERSCRIPTS[ch] ?? ch).join('');
    return stashSafe(`${b}^{${mapped}}`);
  });
  text = text.replace(/([a-zA-Z0-9)]+)([₀₁₂₃₄₅₆₇₈₉]+)/g, (_m, b: string, sub: string) => {
    const mapped = [...sub].map(ch => UNICODE_SUBSCRIPTS[ch] ?? ch).join('');
    return stashSafe(`${b}_{${mapped}}`);
  });
  text = text.replace(/([a-zA-Z0-9])\u20d7/g, (_m, v: string) => stashSafe(`\\vec{${v}}`));
  text = text.replace(/([a-zA-Z])\u0304/g, (_m, v: string) => stashSafe(`\\bar{${v}}`));

  // 11. Multi-character ASCII math arrows/comparisons (`<=>`, `=>`, `->`, `<=`, `>=`, `!=`, `+-`)
  text = text
    .replace(/<=>/g, () => ` ${stashSafe('\\Leftrightarrow')} `)
    .replace(/=>/g, () => ` ${stashSafe('\\Rightarrow')} `)
    .replace(/->/g, () => ` ${stashSafe('\\to')} `)
    .replace(/<=/g, () => ` ${stashSafe('\\le')} `)
    .replace(/>=/g, () => ` ${stashSafe('\\ge')} `)
    .replace(/!=/g, () => ` ${stashSafe('\\ne')} `)
    .replace(/\+-/g, () => ` ${stashSafe('\\pm')} `);

  // 12. Remaining standalone Unicode math symbols (`∀`, `∃`, `∈`, `∞`, `α`, `Δ`, `⇌`, `≤`, `≥`, `≠`, ...)
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '\uE000') {
      const close = text.indexOf('\uE001', i + 1);
      if (close > i) {
        const digits = [...text.slice(i + 1, close)]
          .map(c => String(c.charCodeAt(0) - 0xe100))
          .join('');
        const restored = stashed[Number(digits)];
        out += restored !== undefined ? `$${restored}$` : '';
        i = close;
        continue;
      }
    }
    const mapped = UNICODE_SYMBOL_TO_LATEX[ch];
    if (mapped) {
      out += `$${mapped}$`;
    } else if (ch === '∑') {
      out += '$\\sum$';
    } else if (ch === '∏') {
      out += '$\\prod$';
    } else if (ch === '∫') {
      out += '$\\int$';
    } else {
      out += ch;
    }
  }

  // Merge adjacent `$A$ $B$` math spans joined only by math operators (`=`, `+`, `-`, `<`, `>`)
  return out.replace(
    /\$([^$\n]+)\$(\s*[=<>+-]\s*)\$([^$\n]+)\$/g,
    (_m, a: string, op: string, b: string) => `$${a}${op}${b}$`,
  );
}

function closeUnpairedDollarOnLine(line: string): string {
  if (!line.includes('$')) return line;
  let i = 0;
  let inDisplay = false;
  let inInline = false;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (!inInline && line.startsWith('$$', i)) {
      inDisplay = !inDisplay;
      i += 2;
      continue;
    }
    if (!inDisplay && line[i] === '$') {
      inInline = !inInline;
      i += 1;
      continue;
    }
    i += 1;
  }
  if (inDisplay) return `${line}$$`;
  if (inInline) return `${line}$`;
  return line;
}

/**
 * Converts a single line of essay text into plain-text and KaTeX-ready segments in real time.
 * Works across all 3 modes (`unicode`, `mathlib`, `latex`) and gracefully balances mid-typing formulas.
 */
export function parseLineToRealtimeSegments(
  rawLine: string,
  _mode: MathSymbolInsertMode,
): readonly RealtimeSegment[] {
  if (!rawLine) return [];

  // Step 1: Close any unclosed `$` / `$$` on this line first so mid-keystroke LaTeX stays inside math mode,
  // then compile `\` shorthands outside `$...$` so `\lim`, `\{1/n}`, `\frac{a}{b}`, `\alpha` render live!
  const dollarClosedLine = closeUnpairedDollarOnLine(rawLine);
  const balancedLine = balanceTrailingShorthandBraces(dollarClosedLine);
  const afterBackslash = balancedLine.includes('\\')
    ? compileMathShorthandToMarkdown(balancedLine)
    : balancedLine;

  // Step 2: Upgrade non-`$` prose chunks so Unicode toolbar buttons & natural math (`lim_{x→a}`, `x^2`, `(a)/(b)`, `<=`, `=>`) also render as KaTeX
  let upgraded = '';
  let cursor = 0;
  while (cursor < afterBackslash.length) {
    if (afterBackslash[cursor] === '`') {
      const closeTick = afterBackslash.indexOf('`', cursor + 1);
      if (closeTick > cursor) {
        upgraded += afterBackslash.slice(cursor, closeTick + 1);
        cursor = closeTick + 1;
        continue;
      }
    }
    if (afterBackslash.startsWith('$$', cursor)) {
      const closeDisp = afterBackslash.indexOf('$$', cursor + 2);
      if (closeDisp >= 0) {
        upgraded += afterBackslash.slice(cursor, closeDisp + 2);
        cursor = closeDisp + 2;
      } else {
        // Unclosed `$$...` while typing -> close at end of line for live preview
        upgraded += `${afterBackslash.slice(cursor)}$$`;
        break;
      }
      continue;
    }
    if (afterBackslash[cursor] === '$') {
      let closeInline = cursor + 1;
      while (closeInline < afterBackslash.length) {
        if (afterBackslash[closeInline] === '\\') {
          closeInline += 2;
          continue;
        }
        if (afterBackslash[closeInline] === '$') break;
        closeInline += 1;
      }
      if (closeInline < afterBackslash.length && afterBackslash[closeInline] === '$') {
        upgraded += afterBackslash.slice(cursor, closeInline + 1);
        cursor = closeInline + 1;
      } else {
        // Unclosed `$...` while typing -> close at end of line for live preview
        upgraded += `${afterBackslash.slice(cursor)}$`;
        break;
      }
      continue;
    }

    // Read plain prose up to next `$` or `` ` ``
    let nextSpecial = cursor;
    while (
      nextSpecial < afterBackslash.length &&
      afterBackslash[nextSpecial] !== '$' &&
      afterBackslash[nextSpecial] !== '`'
    ) {
      nextSpecial += 1;
    }
    const proseSlice = afterBackslash.slice(cursor, nextSpecial);
    upgraded += upgradePlainMathInProse(proseSlice);
    cursor = nextSpecial;
  }

  // Step 3: Tokenize `upgraded` into text & balanced math segments
  const segments: RealtimeSegment[] = [];
  let idx = 0;
  let textBuf = '';

  const flushText = () => {
    if (textBuf) {
      segments.push({ kind: 'text', value: textBuf });
      textBuf = '';
    }
  };

  while (idx < upgraded.length) {
    if (upgraded.startsWith('$$', idx)) {
      const end = upgraded.indexOf('$$', idx + 2);
      const rawMath = end >= 0 ? upgraded.slice(idx + 2, end) : upgraded.slice(idx + 2);
      const balanced = balanceIncompleteLatex(rawMath);
      if (balanced) {
        flushText();
        segments.push({ kind: 'math', latex: balanced, display: true });
      }
      idx = end >= 0 ? end + 2 : upgraded.length;
      continue;
    }

    if (upgraded[idx] === '$') {
      let end = idx + 1;
      while (end < upgraded.length) {
        if (upgraded[end] === '\\') {
          end += 2;
          continue;
        }
        if (upgraded[end] === '$') break;
        end += 1;
      }
      const rawMath = end < upgraded.length ? upgraded.slice(idx + 1, end) : upgraded.slice(idx + 1);
      const balanced = balanceIncompleteLatex(rawMath);
      if (balanced) {
        flushText();
        segments.push({ kind: 'math', latex: balanced, display: false });
      }
      idx = end < upgraded.length ? end + 1 : upgraded.length;
      continue;
    }

    if (upgraded[idx] === '`') {
      const grp = readBalancedGroup(
        upgraded.replace(/`/g, (_m, offset: number) => (offset === idx ? '(' : ')')),
        idx,
        '(',
        ')',
      );
      const closeTick = upgraded.indexOf('`', idx + 1);
      if (closeTick > idx) {
        textBuf += upgraded.slice(idx + 1, closeTick);
        idx = closeTick + 1;
        void grp;
        continue;
      }
    }

    textBuf += upgraded[idx];
    idx += 1;
  }

  flushText();
  return segments;
}

function convertSingleProseLineShorthandToLatex(line: string): string {
  if (!line || !line.trim()) return line;

  const balanced = balanceTrailingShorthandBraces(line);
  const afterBackslash = balanced.includes('\\')
    ? compileMathShorthandToMarkdown(balanced)
    : balanced;

  let out = '';
  let cursor = 0;
  const len = afterBackslash.length;

  while (cursor < len) {
    if (afterBackslash[cursor] === '`') {
      const closeTick = afterBackslash.indexOf('`', cursor + 1);
      if (closeTick > cursor) {
        out += afterBackslash.slice(cursor, closeTick + 1);
        cursor = closeTick + 1;
        continue;
      }
    }

    if (afterBackslash.startsWith('$$', cursor)) {
      const closeDisp = afterBackslash.indexOf('$$', cursor + 2);
      if (closeDisp >= 0) {
        const inner = afterBackslash.slice(cursor + 2, closeDisp);
        out += `$$${expandCustomShorthandsInLatexMath(inner)}$$`;
        cursor = closeDisp + 2;
        continue;
      }
    }

    if (afterBackslash[cursor] === '$') {
      let closeInline = cursor + 1;
      while (closeInline < len) {
        if (afterBackslash[closeInline] === '\\') {
          closeInline += 2;
          continue;
        }
        if (afterBackslash[closeInline] === '$') break;
        closeInline += 1;
      }
      if (closeInline < len && afterBackslash[closeInline] === '$') {
        const inner = afterBackslash.slice(cursor + 1, closeInline);
        out += `$${expandCustomShorthandsInLatexMath(inner)}$`;
        cursor = closeInline + 1;
        continue;
      }
      out += '$';
      cursor += 1;
      continue;
    }

    let nextSpecial = cursor;
    while (
      nextSpecial < len &&
      afterBackslash[nextSpecial] !== '$' &&
      afterBackslash[nextSpecial] !== '`'
    ) {
      nextSpecial += 1;
    }
    out += upgradePlainMathInProse(afterBackslash.slice(cursor, nextSpecial));
    cursor = nextSpecial;
  }

  // Merge adjacent inline `$A$ = $B$` spans for cleaner LaTeX reading by Gemini
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(
      /\$([^$\n]+)\$(\s*[=<>+-]\s*)\$([^$\n]+)\$/g,
      (_m, a: string, op: string, b: string) => `$${a}${op}${b}$`,
    );
  }

  return out;
}

/**
 * Converts a student's multi-line essay draft (which may use HUS Learning Hub's custom `\` shorthands,
 * Unicode toolbar templates, or mixed `$...$` expressions) into standard Markdown + `$...$` LaTeX
 * so external AI graders (such as Gemini) understand 100% of the mathematical expressions accurately
 * while leaving fenced/inline code blocks intact.
 */
export function convertStudentShorthandToLatex(rawDraft: string): string {
  if (!rawDraft || !rawDraft.trim()) return rawDraft;

  const lines = rawDraft.split('\n');
  const convertedLines: string[] = [];
  let inCodeFence = false;
  let inDisplayMathBlock = false;
  let displayBuffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inDisplayMathBlock && trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      convertedLines.push(line);
      continue;
    }
    if (inCodeFence) {
      convertedLines.push(line);
      continue;
    }

    if (!inDisplayMathBlock && trimmed === '$$') {
      inDisplayMathBlock = true;
      displayBuffer = [];
      continue;
    }
    if (inDisplayMathBlock) {
      if (trimmed === '$$') {
        inDisplayMathBlock = false;
        convertedLines.push('$$');
        convertedLines.push(expandCustomShorthandsInLatexMath(displayBuffer.join('\n')));
        convertedLines.push('$$');
        displayBuffer = [];
      } else {
        displayBuffer.push(line);
      }
      continue;
    }

    convertedLines.push(convertSingleProseLineShorthandToLatex(line));
  }

  if (inDisplayMathBlock && displayBuffer.length > 0) {
    convertedLines.push('$$');
    convertedLines.push(expandCustomShorthandsInLatexMath(displayBuffer.join('\n')));
  }

  return convertedLines.join('\n');
}
