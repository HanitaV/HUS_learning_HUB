import type { MathSymbolInsertMode } from '../../domain/math-symbols';

export type MathShorthandCategory =
  | 'expression'
  | 'calculus'
  | 'sets-logic'
  | 'greek'
  | 'science';

export interface MathShorthandEntry {
  readonly id: string;
  /** Primary canonical command name used for A -> Z sorting (e.g. `abs`, `alpha`, `sin`, `sigma`). */
  readonly sortKey: string;
  readonly unicodeInsert: string;
  readonly unicodeCursorOffset: number;
  readonly mathlibTrigger: string;
  readonly mathlibInsert: string;
  readonly mathlibCursorOffset: number;
  readonly mathlibExample: string;
  readonly latexTrigger: string;
  readonly latexInsert: string;
  readonly latexCursorOffset: number;
  readonly latexExample: string;
  readonly previewLatex: string;
  readonly label: string;
  readonly category: MathShorthandCategory;
  readonly aliases: readonly string[];
}

export const MATH_SHORTHAND_CATEGORIES: readonly {
  readonly id: MathShorthandCategory;
  readonly label: string;
}[] = [
  { id: 'expression', label: 'Biểu thức, Lượng giác & Hàm' },
  { id: 'calculus', label: 'Giải tích, Tổng & Giới hạn' },
  { id: 'sets-logic', label: 'Tập hợp, Quan hệ & Logic' },
  { id: 'greek', label: 'Chữ cái Hy Lạp' },
  { id: 'science', label: 'Vectơ, Trị tuyệt đối & Tập hợp' },
];

interface RawEntrySeed {
  readonly id: string;
  readonly sortKey: string;
  readonly unicode: string;
  readonly uOff?: number;
  readonly mTrig: string;
  readonly mIns: string;
  readonly mOff?: number;
  readonly mEx: string;
  readonly lTrig: string;
  readonly lIns: string;
  readonly lOff?: number;
  readonly lEx: string;
  readonly preview: string;
  readonly label: string;
  readonly cat: MathShorthandCategory;
  readonly aliases?: readonly string[];
}

function seed(item: RawEntrySeed): MathShorthandEntry {
  return {
    id: item.id,
    sortKey: item.sortKey,
    unicodeInsert: item.unicode,
    unicodeCursorOffset: item.uOff ?? 0,
    mathlibTrigger: item.mTrig,
    mathlibInsert: item.mIns,
    mathlibCursorOffset: item.mOff ?? 0,
    mathlibExample: item.mEx,
    latexTrigger: item.lTrig,
    latexInsert: item.lIns,
    latexCursorOffset: item.lOff ?? 0,
    latexExample: item.lEx,
    previewLatex: item.preview,
    label: item.label,
    category: item.cat,
    aliases: item.aliases ?? [],
  };
}

const RAW_SEEDS: readonly RawEntrySeed[] = [
  // Programming expression helpers (shown in Mathlib mode & table)
  {
    id: 'expr-div',
    sortKey: 'a/b',
    unicode: '()/( )',
    uOff: -5,
    mTrig: '\\{a/b}',
    mIns: '\\{1/n}',
    mOff: -1,
    mEx: '\\{1/n}',
    lTrig: '\\frac',
    lIns: '\\frac{}{}',
    lOff: -3,
    lEx: '$\\frac{1}{n}$',
    preview: '\\frac{1}{n}',
    label: 'Phân số 1 chia n (tự nhận diện tử/mẫu)',
    cat: 'expression',
    aliases: ['frac', 'phanso', 'chia', 'div', '{'],
  },
  {
    id: 'expr-pow',
    sortKey: 'a^(b)',
    unicode: '^()',
    uOff: -1,
    mTrig: '\\{a^(b)}',
    mIns: '\\{n^(n)}',
    mOff: -2,
    mEx: '\\{n^(n)}',
    lTrig: '\\pow',
    lIns: 'n^{}',
    lOff: -1,
    lEx: '$n^{n}$',
    preview: 'n^{n}',
    label: 'Lũy thừa n mũ n',
    cat: 'expression',
    aliases: ['pow', 'mu', 'luythua'],
  },
  {
    id: 'expr-sub',
    sortKey: 'a_(i)',
    unicode: '_()',
    uOff: -1,
    mTrig: '\\{a_(i)}',
    mIns: '\\{a_(n+1)}',
    mOff: -2,
    mEx: '\\{a_(n+1)}',
    lTrig: '\\sub',
    lIns: 'a_{}',
    lOff: -1,
    lEx: '$a_{n+1}$',
    preview: 'a_{n + 1}',
    label: 'Chỉ số dưới a_(n+1)',
    cat: 'expression',
    aliases: ['sub', 'chiso'],
  },

  // Full A -> Z Commands
  {
    id: 'cmd-abs',
    sortKey: 'abs',
    unicode: '||',
    uOff: -1,
    mTrig: '\\abs',
    mIns: '\\abs{}',
    mOff: -1,
    mEx: '\\abs{a_n - L}',
    lTrig: '\\abs',
    lIns: '\\left|\\right|',
    lOff: -7,
    lEx: '$\\left|a_{n} - L\\right|$',
    preview: '\\left|x\\right|',
    label: 'Giá trị tuyệt đối |x|',
    cat: 'science',
    aliases: ['trituyetdoi', 'mod'],
  },
  {
    id: 'greek-alpha',
    sortKey: 'alpha',
    unicode: 'α',
    mTrig: '\\alpha',
    mIns: '\\alpha',
    mEx: '\\alpha',
    lTrig: '\\alpha',
    lIns: '\\alpha',
    lEx: '$\\alpha$',
    preview: '\\alpha',
    label: 'Chữ Hy Lạp alpha (α)',
    cat: 'greek',
  },
  {
    id: 'sym-approx',
    sortKey: 'approx',
    unicode: '≈',
    mTrig: '\\approx',
    mIns: '\\approx ',
    mEx: 'x \\approx 3.14',
    lTrig: '\\approx',
    lIns: '\\approx ',
    lEx: '$x \\approx 3.14$',
    preview: '\\approx',
    label: 'Xấp xỉ bằng (≈)',
    cat: 'sets-logic',
    aliases: ['xapxi'],
  },
  {
    id: 'fn-arccos',
    sortKey: 'arccos',
    unicode: 'arccos()',
    uOff: -1,
    mTrig: '\\arccos',
    mIns: '\\arccos{}',
    mOff: -1,
    mEx: '\\arccos{1/2}',
    lTrig: '\\arccos',
    lIns: '\\arccos()',
    lOff: -1,
    lEx: '$\\arccos(x)$',
    preview: '\\arccos(x)',
    label: 'Hàm lượng giác ngược arccos',
    cat: 'expression',
  },
  {
    id: 'fn-arcsin',
    sortKey: 'arcsin',
    unicode: 'arcsin()',
    uOff: -1,
    mTrig: '\\arcsin',
    mIns: '\\arcsin{}',
    mOff: -1,
    mEx: '\\arcsin{1/2}',
    lTrig: '\\arcsin',
    lIns: '\\arcsin()',
    lOff: -1,
    lEx: '$\\arcsin(x)$',
    preview: '\\arcsin(x)',
    label: 'Hàm lượng giác ngược arcsin',
    cat: 'expression',
  },
  {
    id: 'fn-arctan',
    sortKey: 'arctan',
    unicode: 'arctan()',
    uOff: -1,
    mTrig: '\\arctan',
    mIns: '\\arctan{}',
    mOff: -1,
    mEx: '\\arctan{x}',
    lTrig: '\\arctan',
    lIns: '\\arctan()',
    lOff: -1,
    lEx: '$\\arctan(x)$',
    preview: '\\arctan(x)',
    label: 'Hàm lượng giác ngược arctan',
    cat: 'expression',
  },
  {
    id: 'greek-beta',
    sortKey: 'beta',
    unicode: 'β',
    mTrig: '\\beta',
    mIns: '\\beta',
    mEx: '\\beta',
    lTrig: '\\beta',
    lIns: '\\beta',
    lEx: '$\\beta$',
    preview: '\\beta',
    label: 'Chữ Hy Lạp beta (β)',
    cat: 'greek',
  },
  {
    id: 'cmd-binom',
    sortKey: 'binom',
    unicode: 'C(n, k)',
    uOff: -1,
    mTrig: '\\binom',
    mIns: '\\binom{n}{k}',
    mOff: -1,
    mEx: '\\binom{n}{k}',
    lTrig: '\\binom',
    lIns: '\\binom{}{}',
    lOff: -3,
    lEx: '$\\binom{n}{k}$',
    preview: '\\binom{n}{k}',
    label: 'Tổ hợp chập k của n',
    cat: 'expression',
    aliases: ['tohop', 'choose'],
  },
  {
    id: 'set-c',
    sortKey: 'c',
    unicode: 'ℂ',
    mTrig: '\\C',
    mIns: '\\C',
    mEx: 'z \\in \\C',
    lTrig: '\\mathbb{C}',
    lIns: '\\mathbb{C}',
    lEx: '$z \\in \\mathbb{C}$',
    preview: '\\mathbb{C}',
    label: 'Tập số phức ℂ',
    cat: 'sets-logic',
    aliases: ['sophuc', 'complex'],
  },
  {
    id: 'sym-cap',
    sortKey: 'cap',
    unicode: '∩',
    mTrig: '\\cap',
    mIns: '\\cap ',
    mEx: 'A \\cap B',
    lTrig: '\\cap',
    lIns: '\\cap ',
    lEx: '$A \\cap B$',
    preview: 'A \\cap B',
    label: 'Phép giao hai tập hợp (∩)',
    cat: 'sets-logic',
    aliases: ['giao', 'inter'],
  },
  {
    id: 'sym-cdot',
    sortKey: 'cdot',
    unicode: '·',
    mTrig: '\\cdot',
    mIns: '\\cdot ',
    mEx: 'a \\cdot b',
    lTrig: '\\cdot',
    lIns: '\\cdot ',
    lEx: '$a \\cdot b$',
    preview: 'a \\cdot b',
    label: 'Dấu nhân chấm giữa (·)',
    cat: 'expression',
    aliases: ['nhan', 'dot'],
  },
  {
    id: 'fn-cos',
    sortKey: 'cos',
    unicode: 'cos()',
    uOff: -1,
    mTrig: '\\cos',
    mIns: '\\cos{}',
    mOff: -1,
    mEx: '\\cos{x/2}',
    lTrig: '\\cos',
    lIns: '\\cos()',
    lOff: -1,
    lEx: '$\\cos(x)$',
    preview: '\\cos(x)',
    label: 'Hàm lượng giác cos(x)',
    cat: 'expression',
  },
  {
    id: 'fn-cot',
    sortKey: 'cot',
    unicode: 'cot()',
    uOff: -1,
    mTrig: '\\cot',
    mIns: '\\cot{}',
    mOff: -1,
    mEx: '\\cot{x}',
    lTrig: '\\cot',
    lIns: '\\cot()',
    lOff: -1,
    lEx: '$\\cot(x)$',
    preview: '\\cot(x)',
    label: 'Hàm lượng giác cot(x)',
    cat: 'expression',
  },
  {
    id: 'sym-cup',
    sortKey: 'cup',
    unicode: '∪',
    mTrig: '\\cup',
    mIns: '\\cup ',
    mEx: 'A \\cup B',
    lTrig: '\\cup',
    lIns: '\\cup ',
    lEx: '$A \\cup B$',
    preview: 'A \\cup B',
    label: 'Phép hợp hai tập hợp (∪)',
    cat: 'sets-logic',
    aliases: ['hop', 'union'],
  },
  {
    id: 'cmd-ddx',
    sortKey: 'ddx',
    unicode: 'd/dx()',
    uOff: -1,
    mTrig: '\\ddx',
    mIns: '\\ddx{}',
    mOff: -1,
    mEx: '\\ddx{ln(1 + x)}',
    lTrig: '\\ddx',
    lIns: '\\frac{d}{dx}\\left(\\right)',
    lOff: -7,
    lEx: '$\\frac{d}{dx}\\ln(1+x)$',
    preview: '\\frac{d}{dx}f(x)',
    label: 'Đạo hàm d/dx',
    cat: 'calculus',
    aliases: ['daoham', 'deriv'],
  },
  {
    id: 'greek-delta',
    sortKey: 'delta',
    unicode: 'δ',
    mTrig: '\\delta',
    mIns: '\\delta',
    mEx: '\\delta > 0',
    lTrig: '\\delta',
    lIns: '\\delta',
    lEx: '$\\delta > 0$',
    preview: '\\delta',
    label: 'Chữ Hy Lạp delta thường (δ)',
    cat: 'greek',
  },
  {
    id: 'greek-Delta',
    sortKey: 'delta-upper',
    unicode: 'Δ',
    mTrig: '\\Delta',
    mIns: '\\Delta ',
    mEx: '\\Delta U = Q + A',
    lTrig: '\\Delta',
    lIns: '\\Delta ',
    lEx: '$\\Delta U = Q + A$',
    preview: '\\Delta',
    label: 'Chữ Hy Lạp Delta hoa / Độ biến thiên (Δ)',
    cat: 'greek',
    aliases: ['bienthien'],
  },
  {
    id: 'sym-emptyset',
    sortKey: 'emptyset',
    unicode: '∅',
    mTrig: '\\emptyset',
    mIns: '\\emptyset',
    mEx: 'A = \\emptyset',
    lTrig: '\\emptyset',
    lIns: '\\emptyset',
    lEx: '$A = \\emptyset$',
    preview: '\\emptyset',
    label: 'Tập rỗng (∅)',
    cat: 'sets-logic',
    aliases: ['taprong', 'empty'],
  },
  {
    id: 'greek-eps',
    sortKey: 'eps',
    unicode: 'ε',
    mTrig: '\\eps',
    mIns: '\\eps',
    mEx: '\\eps > 0',
    lTrig: '\\varepsilon',
    lIns: '\\varepsilon',
    lEx: '$\\varepsilon > 0$',
    preview: '\\varepsilon',
    label: 'Epsilon (ε)',
    cat: 'greek',
    aliases: ['epsilon', 'varepsilon'],
  },
  {
    id: 'sym-equiv',
    sortKey: 'equiv',
    unicode: '≡',
    mTrig: '\\equiv',
    mIns: '\\equiv ',
    mEx: 'a \\equiv b',
    lTrig: '\\equiv',
    lIns: '\\equiv ',
    lEx: '$a \\equiv b$',
    preview: '\\equiv',
    label: 'Đồng dư / Đồng nhất (≡)',
    cat: 'sets-logic',
  },
  {
    id: 'sym-exists',
    sortKey: 'exists',
    unicode: '∃',
    mTrig: '\\exists',
    mIns: '\\exists ',
    mEx: '\\exists c \\in (a, b)',
    lTrig: '\\exists',
    lIns: '\\exists ',
    lEx: '$\\exists c \\in (a, b)$',
    preview: '\\exists',
    label: 'Tồn tại (∃)',
    cat: 'sets-logic',
    aliases: ['tontai', 'ex'],
  },
  {
    id: 'fn-exp',
    sortKey: 'exp',
    unicode: 'exp()',
    uOff: -1,
    mTrig: '\\exp',
    mIns: '\\exp{}',
    mOff: -1,
    mEx: '\\exp{-x^(2)}',
    lTrig: '\\exp',
    lIns: '\\exp()',
    lOff: -1,
    lEx: '$\\exp(-x^{2})$',
    preview: '\\exp(x)',
    label: 'Hàm mũ tự nhiên exp(x)',
    cat: 'expression',
  },
  {
    id: 'sym-forall',
    sortKey: 'forall',
    unicode: '∀',
    mTrig: '\\forall',
    mIns: '\\forall ',
    mEx: '\\forall \\eps > 0',
    lTrig: '\\forall',
    lIns: '\\forall ',
    lEx: '$\\forall \\varepsilon > 0$',
    preview: '\\forall',
    label: 'Với mọi (∀)',
    cat: 'sets-logic',
    aliases: ['voimoi', 'all'],
  },
  {
    id: 'cmd-frac',
    sortKey: 'frac',
    unicode: '()/( )',
    uOff: -5,
    mTrig: '\\frac',
    mIns: '\\frac{}{}',
    mOff: -3,
    mEx: '\\frac{1}{n + 1}',
    lTrig: '\\frac',
    lIns: '\\frac{}{}',
    lOff: -3,
    lEx: '$\\frac{1}{n + 1}$',
    preview: '\\frac{a}{b}',
    label: 'Phân số \\frac{tử}{mẫu}',
    cat: 'expression',
    aliases: ['phanso'],
  },
  {
    id: 'greek-gamma',
    sortKey: 'gamma',
    unicode: 'γ',
    mTrig: '\\gamma',
    mIns: '\\gamma',
    mEx: '\\gamma',
    lTrig: '\\gamma',
    lIns: '\\gamma',
    lEx: '$\\gamma$',
    preview: '\\gamma',
    label: 'Chữ Hy Lạp gamma (γ)',
    cat: 'greek',
  },
  {
    id: 'sym-ge',
    sortKey: 'ge',
    unicode: '≥',
    mTrig: '\\ge',
    mIns: '\\ge ',
    mEx: 'n \\ge 1',
    lTrig: '\\ge',
    lIns: '\\ge ',
    lEx: '$n \\ge 1$',
    preview: '\\ge',
    label: 'Lớn hơn hoặc bằng (≥)',
    cat: 'sets-logic',
    aliases: ['geq', 'lonhonbang'],
  },
  {
    id: 'sym-iff',
    sortKey: 'iff',
    unicode: '⇔',
    mTrig: '\\iff',
    mIns: '\\iff ',
    mEx: 'A \\iff B',
    lTrig: '\\iff',
    lIns: '\\iff ',
    lEx: '$A \\iff B$',
    preview: '\\iff',
    label: 'Khi và chỉ khi / Tương đương (⇔)',
    cat: 'sets-logic',
    aliases: ['tuongduong'],
  },
  {
    id: 'sym-implies',
    sortKey: 'implies',
    unicode: '⇒',
    mTrig: '\\implies',
    mIns: '\\implies ',
    mEx: 'A \\implies B',
    lTrig: '\\implies',
    lIns: '\\implies ',
    lEx: '$A \\implies B$',
    preview: '\\implies',
    label: 'Suy ra (⇒)',
    cat: 'sets-logic',
    aliases: ['suyra', 'imp'],
  },
  {
    id: 'sym-in',
    sortKey: 'in',
    unicode: '∈',
    mTrig: '\\in',
    mIns: '\\in ',
    mEx: 'n \\in \\N*',
    lTrig: '\\in',
    lIns: '\\in ',
    lEx: '$n \\in \\mathbb{N}^{*}$',
    preview: '\\in',
    label: 'Thuộc tập hợp (∈)',
    cat: 'sets-logic',
    aliases: ['thuoc'],
  },
  {
    id: 'sym-inf-op',
    sortKey: 'inf',
    unicode: 'inf ',
    mTrig: '\\inf',
    mIns: '\\inf ',
    mEx: '\\inf A = \\{1/2}',
    lTrig: '\\inf',
    lIns: '\\inf ',
    lEx: '$\\inf A = \\frac{1}{2}$',
    preview: '\\inf A',
    label: 'Cận dưới đúng (Infimum)',
    cat: 'calculus',
    aliases: ['canduoidung'],
  },
  {
    id: 'sym-infty',
    sortKey: 'infty',
    unicode: '∞',
    mTrig: '\\infty',
    mIns: '\\infty',
    mEx: '+\\infty',
    lTrig: '\\infty',
    lIns: '\\infty',
    lEx: '$+\\infty$',
    preview: '\\infty',
    label: 'Vô cùng (∞)',
    cat: 'calculus',
    aliases: ['oo', 'vocung'],
  },
  {
    id: 'cmd-int',
    sortKey: 'int',
    unicode: '∫',
    mTrig: '\\int',
    mIns: '\\int{0..1}{ dx}',
    mOff: -4,
    mEx: '\\int{0..pi}{sin(x)/x dx}',
    lTrig: '\\int',
    lIns: '\\int_{0}^{1}  \\,dx',
    lOff: -5,
    lEx: '$\\int_{0}^{\\pi} \\sin(x) \\,dx$',
    preview: '\\int_{a}^{b} f(x)\\,dx',
    label: 'Tích phân xác định / nguyên hàm',
    cat: 'calculus',
    aliases: ['integral', 'tichphan', 'nguyenham'],
  },
  {
    id: 'greek-lambda',
    sortKey: 'lambda',
    unicode: 'λ',
    mTrig: '\\lambda',
    mIns: '\\lambda',
    mEx: '\\lambda',
    lTrig: '\\lambda',
    lIns: '\\lambda',
    lEx: '$\\lambda$',
    preview: '\\lambda',
    label: 'Chữ Hy Lạp lambda (λ)',
    cat: 'greek',
  },
  {
    id: 'sym-le',
    sortKey: 'le',
    unicode: '≤',
    mTrig: '\\le',
    mIns: '\\le ',
    mEx: '0 \\le x \\le 1',
    lTrig: '\\le',
    lIns: '\\le ',
    lEx: '$0 \\le x \\le 1$',
    preview: '\\le',
    label: 'Nhỏ hơn hoặc bằng (≤)',
    cat: 'sets-logic',
    aliases: ['leq', 'nhohonbang'],
  },
  {
    id: 'cmd-lim',
    sortKey: 'lim',
    unicode: 'lim ',
    mTrig: '\\lim',
    mIns: '\\lim{n->inf}{}',
    mOff: -1,
    mEx: '\\lim{n->inf}{(1 + 1/n)^(n)}',
    lTrig: '\\lim',
    lIns: '\\lim_{n \\to \\infty} ',
    lEx: '$\\lim_{n \\to \\infty} a_{n}$',
    preview: '\\lim_{n \\to \\infty}',
    label: 'Giới hạn lim',
    cat: 'calculus',
    aliases: ['gioihan'],
  },
  {
    id: 'fn-ln',
    sortKey: 'ln',
    unicode: 'ln()',
    uOff: -1,
    mTrig: '\\ln',
    mIns: '\\ln{}',
    mOff: -1,
    mEx: '\\ln{1 + x}',
    lTrig: '\\ln',
    lIns: '\\ln()',
    lOff: -1,
    lEx: '$\\ln(1 + x)$',
    preview: '\\ln(x)',
    label: 'Logarit tự nhiên ln(x)',
    cat: 'expression',
  },
  {
    id: 'fn-log',
    sortKey: 'log',
    unicode: 'log()',
    uOff: -1,
    mTrig: '\\log',
    mIns: '\\log{}',
    mOff: -1,
    mEx: '\\log{n}',
    lTrig: '\\log',
    lIns: '\\log_{}()',
    lOff: -3,
    lEx: '$\\log_{2}(n)$',
    preview: '\\log(x)',
    label: 'Logarit log(x)',
    cat: 'expression',
  },
  {
    id: 'fn-max',
    sortKey: 'max',
    unicode: 'max()',
    uOff: -1,
    mTrig: '\\max',
    mIns: '\\max ',
    mEx: '\\max A',
    lTrig: '\\max',
    lIns: '\\max ',
    lEx: '$\\max A$',
    preview: '\\max A',
    label: 'Giá trị lớn nhất max',
    cat: 'calculus',
  },
  {
    id: 'fn-min',
    sortKey: 'min',
    unicode: 'min()',
    uOff: -1,
    mTrig: '\\min',
    mIns: '\\min ',
    mEx: '\\min A = \\{1/2}',
    lTrig: '\\min',
    lIns: '\\min ',
    lEx: '$\\min A = \\frac{1}{2}$',
    preview: '\\min A',
    label: 'Giá trị nhỏ nhất min',
    cat: 'calculus',
  },
  {
    id: 'greek-mu',
    sortKey: 'mu',
    unicode: 'μ',
    mTrig: '\\mu',
    mIns: '\\mu',
    mEx: '\\mu N',
    lTrig: '\\mu',
    lIns: '\\mu',
    lEx: '$\\mu N$',
    preview: '\\mu',
    label: 'Chữ Hy Lạp mu (μ)',
    cat: 'greek',
  },
  {
    id: 'set-n',
    sortKey: 'n',
    unicode: 'ℕ',
    mTrig: '\\N',
    mIns: '\\N',
    mEx: 'k \\in \\N',
    lTrig: '\\mathbb{N}',
    lIns: '\\mathbb{N}',
    lEx: '$k \\in \\mathbb{N}$',
    preview: '\\mathbb{N}',
    label: 'Tập số tự nhiên ℕ',
    cat: 'sets-logic',
    aliases: ['nat', 'tunhien'],
  },
  {
    id: 'set-nstar',
    sortKey: 'n*',
    unicode: 'ℕ*',
    mTrig: '\\N*',
    mIns: '\\N*',
    mEx: 'n \\in \\N*',
    lTrig: '\\mathbb{N}^*',
    lIns: '\\mathbb{N}^{*}',
    lEx: '$n \\in \\mathbb{N}^{*}$',
    preview: '\\mathbb{N}^{*}',
    label: 'Tập số nguyên dương ℕ* = {1, 2, ...}',
    cat: 'sets-logic',
    aliases: ['nstar', 'nguyenduong'],
  },
  {
    id: 'sym-ne',
    sortKey: 'ne',
    unicode: '≠',
    mTrig: '\\ne',
    mIns: '\\ne ',
    mEx: 'x \\ne 0',
    lTrig: '\\ne',
    lIns: '\\ne ',
    lEx: '$x \\ne 0$',
    preview: '\\ne',
    label: 'Khác (≠)',
    cat: 'sets-logic',
    aliases: ['neq', 'khac'],
  },
  {
    id: 'sym-notin',
    sortKey: 'notin',
    unicode: '∉',
    mTrig: '\\notin',
    mIns: '\\notin ',
    mEx: '1 \\notin A',
    lTrig: '\\notin',
    lIns: '\\notin ',
    lEx: '$1 \\notin A$',
    preview: '\\notin',
    label: 'Không thuộc tập hợp (∉)',
    cat: 'sets-logic',
    aliases: ['khongthuoc'],
  },
  {
    id: 'greek-omega',
    sortKey: 'omega',
    unicode: 'ω',
    mTrig: '\\omega',
    mIns: '\\omega',
    mEx: '\\omega t',
    lTrig: '\\omega',
    lIns: '\\omega',
    lEx: '$\\omega t$',
    preview: '\\omega',
    label: 'Chữ Hy Lạp omega thường / tần số góc (ω)',
    cat: 'greek',
  },
  {
    id: 'greek-Omega',
    sortKey: 'omega-upper',
    unicode: 'Ω',
    mTrig: '\\Omega',
    mIns: '\\Omega',
    mEx: '\\Omega(n)',
    lTrig: '\\Omega',
    lIns: '\\Omega',
    lEx: '$\\Omega(n)$',
    preview: '\\Omega',
    label: 'Chữ Hy Lạp Omega hoa / Không gian mẫu (Ω)',
    cat: 'greek',
  },
  {
    id: 'greek-phi',
    sortKey: 'phi',
    unicode: 'φ',
    mTrig: '\\phi',
    mIns: '\\phi',
    mEx: '\\phi',
    lTrig: '\\varphi',
    lIns: '\\varphi',
    lEx: '$\\varphi$',
    preview: '\\varphi',
    label: 'Chữ Hy Lạp phi / pha dao động (φ)',
    cat: 'greek',
    aliases: ['varphi'],
  },
  {
    id: 'greek-pi',
    sortKey: 'pi',
    unicode: 'π',
    mTrig: '\\pi',
    mIns: '\\pi',
    mEx: '\\{pi/2}',
    lTrig: '\\pi',
    lIns: '\\pi',
    lEx: '$\\frac{\\pi}{2}$',
    preview: '\\pi',
    label: 'Hằng số Pi (π)',
    cat: 'greek',
  },
  {
    id: 'sym-pm',
    sortKey: 'pm',
    unicode: '±',
    mTrig: '\\pm',
    mIns: '\\pm ',
    mEx: 'x \\pm \\delta',
    lTrig: '\\pm',
    lIns: '\\pm ',
    lEx: '$x \\pm \\delta$',
    preview: '\\pm',
    label: 'Cộng trừ (±)',
    cat: 'expression',
    aliases: ['congtru'],
  },
  {
    id: 'cmd-prod',
    sortKey: 'prod',
    unicode: '∏',
    mTrig: '\\prod',
    mIns: '\\prod{i=1..n}{}',
    mOff: -1,
    mEx: '\\prod{k=1..n}{k/(k+1)}',
    lTrig: '\\prod',
    lIns: '\\prod_{k=1}^{n} ',
    lEx: '$\\prod_{k=1}^{n} a_{k}$',
    preview: '\\prod_{k=1}^{n}',
    label: 'Tích có cận (∏)',
    cat: 'calculus',
    aliases: ['tich'],
  },
  {
    id: 'set-q',
    sortKey: 'q',
    unicode: 'ℚ',
    mTrig: '\\Q',
    mIns: '\\Q',
    mEx: 'q \\in \\Q',
    lTrig: '\\mathbb{Q}',
    lIns: '\\mathbb{Q}',
    lEx: '$q \\in \\mathbb{Q}$',
    preview: '\\mathbb{Q}',
    label: 'Tập số hữu tỉ ℚ',
    cat: 'sets-logic',
    aliases: ['huuti'],
  },
  {
    id: 'set-r',
    sortKey: 'r',
    unicode: 'ℝ',
    mTrig: '\\R',
    mIns: '\\R',
    mEx: 'x \\in \\R',
    lTrig: '\\mathbb{R}',
    lIns: '\\mathbb{R}',
    lEx: '$x \\in \\mathbb{R}$',
    preview: '\\mathbb{R}',
    label: 'Tập số thực ℝ',
    cat: 'sets-logic',
    aliases: ['real', 'sothuc'],
  },
  {
    id: 'cmd-root',
    sortKey: 'root',
    unicode: '√()',
    uOff: -1,
    mTrig: '\\root',
    mIns: '\\root{3}{}',
    mOff: -1,
    mEx: '\\root{n}{x + 1}',
    lTrig: '\\sqrt[n]',
    lIns: '\\sqrt[]{}',
    lOff: -3,
    lEx: '$\\sqrt[n]{x + 1}$',
    preview: '\\sqrt[n]{x}',
    label: 'Căn bậc n',
    cat: 'expression',
    aliases: ['canbacn', 'nthroot'],
  },
  {
    id: 'cmd-set',
    sortKey: 'set',
    unicode: '{}',
    uOff: -1,
    mTrig: '\\set',
    mIns: '\\set{}',
    mOff: -1,
    mEx: '\\set{n/(n+1) : n \\in \\N*}',
    lTrig: '\\left\\{',
    lIns: '\\left\\{\\right\\}',
    lOff: -8,
    lEx: '$\\left\\{x : x > 0\\right\\}$',
    preview: '\\left\\{x \\in A\\right\\}',
    label: 'Tập hợp trong ngoặc nhọn { ... }',
    cat: 'science',
    aliases: ['taphop'],
  },
  {
    id: 'greek-sigma',
    sortKey: 'sigma',
    unicode: 'σ',
    mTrig: '\\sigma',
    mIns: '\\sigma{}',
    mOff: -1,
    mEx: '\\sigma{n^(n)}',
    lTrig: '\\sigma',
    lIns: '\\sigma{}',
    lOff: -1,
    lEx: '$\\sigma{n^{n}}$',
    preview: '\\sigma{n^{n}}',
    label: 'Chữ Hy Lạp sigma thường (σ) hoặc kèm biểu thức',
    cat: 'greek',
  },
  {
    id: 'greek-Sigma',
    sortKey: 'sigma-upper',
    unicode: 'Σ',
    mTrig: '\\Sigma',
    mIns: '\\Sigma{}',
    mOff: -1,
    mEx: '\\Sigma{F_x} = m a',
    lTrig: '\\Sigma',
    lIns: '\\Sigma',
    lEx: '$\\Sigma F_{x} = m a$',
    preview: '\\Sigma',
    label: 'Chữ Hy Lạp Sigma hoa (Σ)',
    cat: 'greek',
  },
  {
    id: 'fn-sin',
    sortKey: 'sin',
    unicode: 'sin()',
    uOff: -1,
    mTrig: '\\sin',
    mIns: '\\sin{}',
    mOff: -1,
    mEx: '\\sin{x/2}',
    lTrig: '\\sin',
    lIns: '\\sin()',
    lOff: -1,
    lEx: '$\\sin(x)$',
    preview: '\\sin(x)',
    label: 'Hàm lượng giác sin(x)',
    cat: 'expression',
  },
  {
    id: 'cmd-sqrt',
    sortKey: 'sqrt',
    unicode: '√()',
    uOff: -1,
    mTrig: '\\sqrt',
    mIns: '\\sqrt{}',
    mOff: -1,
    mEx: '\\sqrt{x^(2) + 1}',
    lTrig: '\\sqrt',
    lIns: '\\sqrt{}',
    lOff: -1,
    lEx: '$\\sqrt{x^{2} + 1}$',
    preview: '\\sqrt{x}',
    label: 'Căn bậc hai √x',
    cat: 'expression',
    aliases: ['can', 'canbachai'],
  },
  {
    id: 'sym-subset',
    sortKey: 'subset',
    unicode: '⊂',
    mTrig: '\\subset',
    mIns: '\\subset ',
    mEx: 'A \\subset B',
    lTrig: '\\subset',
    lIns: '\\subset ',
    lEx: '$A \\subset B$',
    preview: 'A \\subset B',
    label: 'Tập con thực sự (⊂)',
    cat: 'sets-logic',
    aliases: ['tapcon'],
  },
  {
    id: 'sym-subseteq',
    sortKey: 'subseteq',
    unicode: '⊆',
    mTrig: '\\subseteq',
    mIns: '\\subseteq ',
    mEx: 'A \\subseteq B',
    lTrig: '\\subseteq',
    lIns: '\\subseteq ',
    lEx: '$A \\subseteq B$',
    preview: 'A \\subseteq B',
    label: 'Tập con (⊆)',
    cat: 'sets-logic',
  },
  {
    id: 'cmd-sum',
    sortKey: 'sum',
    unicode: '∑',
    mTrig: '\\sum',
    mIns: '\\sum{i=1..n}{}',
    mOff: -1,
    mEx: '\\sum{i=1..n}{1/i^(2)}',
    lTrig: '\\sum',
    lIns: '\\sum_{i=1}^{n} ',
    lEx: '$\\sum_{i=1}^{n} a_{i}$',
    preview: '\\sum_{i=1}^{n}',
    label: 'Tổng xích-ma có cận (∑)',
    cat: 'calculus',
    aliases: ['tong', 'xichma'],
  },
  {
    id: 'sym-sup',
    sortKey: 'sup',
    unicode: 'sup ',
    mTrig: '\\sup',
    mIns: '\\sup ',
    mEx: '\\sup A = 1',
    lTrig: '\\sup',
    lIns: '\\sup ',
    lEx: '$\\sup A = 1$',
    preview: '\\sup A',
    label: 'Cận trên đúng (Supremum)',
    cat: 'calculus',
    aliases: ['cantrendung'],
  },
  {
    id: 'fn-tan',
    sortKey: 'tan',
    unicode: 'tan()',
    uOff: -1,
    mTrig: '\\tan',
    mIns: '\\tan{}',
    mOff: -1,
    mEx: '\\tan{x}',
    lTrig: '\\tan',
    lIns: '\\tan()',
    lOff: -1,
    lEx: '$\\tan(x)$',
    preview: '\\tan(x)',
    label: 'Hàm lượng giác tan(x)',
    cat: 'expression',
  },
  {
    id: 'greek-theta',
    sortKey: 'theta',
    unicode: 'θ',
    mTrig: '\\theta',
    mIns: '\\theta',
    mEx: '\\theta',
    lTrig: '\\theta',
    lIns: '\\theta',
    lEx: '$\\theta$',
    preview: '\\theta',
    label: 'Chữ Hy Lạp theta (θ)',
    cat: 'greek',
  },
  {
    id: 'sym-times',
    sortKey: 'times',
    unicode: '×',
    mTrig: '\\times',
    mIns: '\\times ',
    mEx: 'A \\times B',
    lTrig: '\\times',
    lIns: '\\times ',
    lEx: '$A \\times B$',
    preview: '\\times',
    label: 'Phép nhân / Tích Đề-các (×)',
    cat: 'expression',
  },
  {
    id: 'sym-to',
    sortKey: 'to',
    unicode: '→',
    mTrig: '\\to',
    mIns: '\\to ',
    mEx: 'n \\to \\infty',
    lTrig: '\\to',
    lIns: '\\to ',
    lEx: '$n \\to \\infty$',
    preview: '\\to',
    label: 'Tiến tới / Ánh xạ (→)',
    cat: 'sets-logic',
    aliases: ['arrow', 'tientoi'],
  },
  {
    id: 'cmd-vec',
    sortKey: 'vec',
    unicode: 'v⃗',
    mTrig: '\\vec',
    mIns: '\\vec{}',
    mOff: -1,
    mEx: '\\vec{F_{ms}}',
    lTrig: '\\vec',
    lIns: '\\vec{}',
    lOff: -1,
    lEx: '$\\vec{F}$',
    preview: '\\vec{F}',
    label: 'Vectơ \\vec{F}',
    cat: 'science',
    aliases: ['vecto'],
  },
  {
    id: 'set-z',
    sortKey: 'z',
    unicode: 'ℤ',
    mTrig: '\\Z',
    mIns: '\\Z',
    mEx: 'k \\in \\Z',
    lTrig: '\\mathbb{Z}',
    lIns: '\\mathbb{Z}',
    lEx: '$k \\in \\mathbb{Z}$',
    preview: '\\mathbb{Z}',
    label: 'Tập số nguyên ℤ',
    cat: 'sets-logic',
    aliases: ['songuyen'],
  },
];

/** Canonical catalog sorted strictly A -> Z by `sortKey`. */
export const MATH_SHORTHAND_CATALOG: readonly MathShorthandEntry[] = RAW_SEEDS.map(seed).sort(
  (a, b) => a.sortKey.localeCompare(b.sortKey, 'en', { sensitivity: 'base' }),
);

const STANDALONE_SYMBOLS: Readonly<Record<string, string>> = {
  N: '\\mathbb{N}',
  Z: '\\mathbb{Z}',
  Q: '\\mathbb{Q}',
  R: '\\mathbb{R}',
  C: '\\mathbb{C}',
  eps: '\\varepsilon',
  epsilon: '\\epsilon',
  varepsilon: '\\varepsilon',
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  Gamma: '\\Gamma',
  delta: '\\delta',
  Delta: '\\Delta',
  theta: '\\theta',
  Theta: '\\Theta',
  lambda: '\\lambda',
  Lambda: '\\Lambda',
  mu: '\\mu',
  pi: '\\pi',
  Pi: '\\Pi',
  rho: '\\rho',
  sigma: '\\sigma',
  Sigma: '\\Sigma',
  tau: '\\tau',
  phi: '\\varphi',
  varphi: '\\varphi',
  Phi: '\\Phi',
  omega: '\\omega',
  Omega: '\\Omega',
  infty: '\\infty',
  oo: '\\infty',
  sup: '\\sup',
  inf: '\\inf',
  min: '\\min',
  max: '\\max',
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  cot: '\\cot',
  arcsin: '\\arcsin',
  arccos: '\\arccos',
  arctan: '\\arctan',
  ln: '\\ln',
  log: '\\log',
  exp: '\\exp',
  in: '\\in',
  notin: '\\notin',
  subset: '\\subset',
  subseteq: '\\subseteq',
  cup: '\\cup',
  cap: '\\cap',
  emptyset: '\\emptyset',
  forall: '\\forall',
  exists: '\\exists',
  le: '\\le',
  leq: '\\le',
  ge: '\\ge',
  geq: '\\ge',
  ne: '\\ne',
  neq: '\\ne',
  approx: '\\approx',
  equiv: '\\equiv',
  pm: '\\pm',
  cdot: '\\cdot',
  times: '\\times',
  to: '\\to',
  implies: '\\implies',
  iff: '\\iff',
};

const PAREN_WRAPPED_FUNCTIONS: ReadonlySet<string> = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'arcsin',
  'arccos',
  'arctan',
  'ln',
  'log',
  'exp',
]);

const KNOWN_MATH_FUNCTIONS: ReadonlySet<string> = new Set([
  ...PAREN_WRAPPED_FUNCTIONS,
  'sup',
  'inf',
  'min',
  'max',
]);

const BARE_GREEK_IN_EXPR: Readonly<Record<string, string>> = {
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  Delta: '\\Delta',
  eps: '\\varepsilon',
  epsilon: '\\varepsilon',
  pi: '\\pi',
  sigma: '\\sigma',
  Sigma: '\\Sigma',
  theta: '\\theta',
  lambda: '\\lambda',
  mu: '\\mu',
  omega: '\\omega',
  Omega: '\\Omega',
  phi: '\\varphi',
  oo: '\\infty',
  inf: '\\infty',
};

export function isInsideDollarMathSpan(textBeforeCursor: string): boolean {
  let dollarCount = 0;
  for (let i = 0; i < textBeforeCursor.length; i += 1) {
    const ch = textBeforeCursor[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '$') {
      dollarCount += 1;
    }
  }
  return dollarCount % 2 === 1;
}

function readBalancedGroup(
  src: string,
  startIndex: number,
  openChar: '{' | '(',
  closeChar: '}' | ')',
): { readonly content: string; readonly nextIndex: number } | null {
  if (src[startIndex] !== openChar) return null;
  let depth = 1;
  let idx = startIndex + 1;
  while (idx < src.length && depth > 0) {
    const ch = src[idx];
    if (ch === '\\' && idx + 1 < src.length) {
      idx += 2;
      continue;
    }
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) depth -= 1;
    idx += 1;
  }
  if (depth !== 0) return null;
  return {
    content: src.slice(startIndex + 1, idx - 1),
    nextIndex: idx,
  };
}

function splitRangeBound(rawBound: string): { readonly lower: string; readonly upper?: string } {
  const compactBound = (s: string) => compileMathExpression(s).replace(/\s*=\s*/g, '=');
  const dotsIdx = rawBound.indexOf('..');
  if (dotsIdx < 0) {
    return { lower: compactBound(rawBound.trim()) };
  }
  const low = rawBound.slice(0, dotsIdx).trim();
  const high = rawBound.slice(dotsIdx + 2).trim();
  return {
    lower: compactBound(low),
    upper: compactBound(high),
  };
}

function formatIntegralBody(compiledBody: string): string {
  return compiledBody.replace(/\s+\b(d[a-zA-Z])\s*$/, ' \\, $1');
}

function compileCommandInvocation(
  cmdName: string,
  args: readonly string[],
  trailingStar: boolean,
): string {
  if (
    (cmdName === 'N' || cmdName === 'R' || cmdName === 'Z' || cmdName === 'Q' || cmdName === 'C') &&
    args.length === 0
  ) {
    return trailingStar ? `\\mathbb{${cmdName}}^{*}` : `\\mathbb{${cmdName}}`;
  }

  if (cmdName === 'frac' && args.length >= 2) {
    return `\\frac{${compileMathExpression(args[0]!)}}{${compileMathExpression(args[1]!)}}`;
  }
  if (cmdName === 'binom' && args.length >= 2) {
    return `\\binom{${compileMathExpression(args[0]!)}}{${compileMathExpression(args[1]!)}}`;
  }
  if (cmdName === 'sqrt' && args.length >= 1) {
    return `\\sqrt{${compileMathExpression(args[0]!)}}`;
  }
  if (cmdName === 'root' && args.length >= 2) {
    return `\\sqrt[${compileMathExpression(args[0]!)}]{${compileMathExpression(args[1]!)}}`;
  }
  if (cmdName === 'abs' && args.length >= 1) {
    return `\\left|${compileMathExpression(args[0]!)}\\right|`;
  }
  if (cmdName === 'set' && args.length >= 1) {
    return `\\left\\{${compileMathExpression(args[0]!)}\\right\\}`;
  }
  if (cmdName === 'vec' && args.length >= 1) {
    return `\\vec{${compileMathExpression(args[0]!)}}`;
  }
  if (cmdName === 'ddx' && args.length >= 1) {
    return `\\frac{d}{dx}\\left(${compileMathExpression(args[0]!)}\\right)`;
  }
  if (PAREN_WRAPPED_FUNCTIONS.has(cmdName) && args.length === 1) {
    const inner = compileMathExpression(args[0]!);
    return inner.includes('\\frac')
      ? `\\${cmdName}\\left(${inner}\\right)`
      : `\\${cmdName}(${inner})`;
  }
  if ((cmdName === 'sum' || cmdName === 'prod') && args.length >= 1) {
    const op = `\\${cmdName}`;
    if (args.length >= 2) {
      const bounds = splitRangeBound(args[0]!);
      const body = compileMathExpression(args[1]!);
      return bounds.upper !== undefined
        ? `${op}_{${bounds.lower}}^{${bounds.upper}} ${body}`
        : `${op}_{${bounds.lower}} ${body}`;
    }
    return `${op} ${compileMathExpression(args[0]!)}`;
  }
  if (cmdName === 'lim' && args.length >= 1) {
    if (args.length >= 2) {
      return `\\lim_{${compileMathExpression(args[0]!)}} ${compileMathExpression(args[1]!)}`;
    }
    return `\\lim ${compileMathExpression(args[0]!)}`;
  }
  if (cmdName === 'int' && args.length >= 1) {
    if (args.length >= 2) {
      const bounds = splitRangeBound(args[0]!);
      const body = formatIntegralBody(compileMathExpression(args[1]!));
      return bounds.upper !== undefined
        ? `\\int_{${bounds.lower}}^{${bounds.upper}} ${body}`
        : `\\int_{${bounds.lower}} ${body}`;
    }
    return `\\int ${formatIntegralBody(compileMathExpression(args[0]!))}`;
  }

  const mappedSymbol = STANDALONE_SYMBOLS[cmdName] ?? `\\${cmdName}`;
  if (args.length === 0) {
    return trailingStar ? `${mappedSymbol}^{*}` : mappedSymbol;
  }
  return `${mappedSymbol}${args.map(a => `{${compileMathExpression(a)}}`).join('')}`;
}

interface ExprPiece {
  readonly kind: 'atom' | 'op';
  readonly latex: string;
  readonly unwrappedLatex: string;
}

export function compileMathExpression(raw: string): string {
  const src = raw.trim();
  if (!src) return '';

  const pieces: ExprPiece[] = [];
  let idx = 0;

  while (idx < src.length) {
    const ch = src[idx]!;

    if (/\s/.test(ch)) {
      idx += 1;
      continue;
    }

    if (src.startsWith('<=>', idx)) {
      pieces.push({ kind: 'op', latex: '\\iff', unwrappedLatex: '\\iff' });
      idx += 3;
      continue;
    }
    if (src.startsWith('...', idx)) {
      pieces.push({ kind: 'atom', latex: '\\dots', unwrappedLatex: '\\dots' });
      idx += 3;
      continue;
    }
    if (src.startsWith('<=', idx)) {
      pieces.push({ kind: 'op', latex: '\\le', unwrappedLatex: '\\le' });
      idx += 2;
      continue;
    }
    if (src.startsWith('>=', idx)) {
      pieces.push({ kind: 'op', latex: '\\ge', unwrappedLatex: '\\ge' });
      idx += 2;
      continue;
    }
    if (src.startsWith('!=', idx)) {
      pieces.push({ kind: 'op', latex: '\\ne', unwrappedLatex: '\\ne' });
      idx += 2;
      continue;
    }
    if (src.startsWith('->', idx)) {
      pieces.push({ kind: 'op', latex: '\\to', unwrappedLatex: '\\to' });
      idx += 2;
      continue;
    }
    if (src.startsWith('=>', idx)) {
      pieces.push({ kind: 'op', latex: '\\implies', unwrappedLatex: '\\implies' });
      idx += 2;
      continue;
    }
    if (src.startsWith('+-', idx)) {
      pieces.push({ kind: 'op', latex: '\\pm', unwrappedLatex: '\\pm' });
      idx += 2;
      continue;
    }

    if (ch === '\\') {
      if (src[idx + 1] === '{') {
        const grp = readBalancedGroup(src, idx + 1, '{', '}');
        if (grp) {
          const inner = compileMathExpression(grp.content);
          pieces.push({ kind: 'atom', latex: inner, unwrappedLatex: inner });
          idx = grp.nextIndex;
          continue;
        }
      }
      const cmdMatch = /^\\([a-zA-Z]+)/.exec(src.slice(idx));
      if (cmdMatch?.[1]) {
        const cmdName = cmdMatch[1];
        idx += 1 + cmdName.length;
        let trailingStar = false;
        if (src[idx] === '*' && /^[NZQRC]$/.test(cmdName)) {
          trailingStar = true;
          idx += 1;
        }
        const args: string[] = [];
        while (src[idx] === '{' && args.length < 2) {
          const grp = readBalancedGroup(src, idx, '{', '}');
          if (!grp) break;
          args.push(grp.content);
          idx = grp.nextIndex;
        }
        const compiled = compileCommandInvocation(cmdName, args, trailingStar);
        pieces.push({ kind: 'atom', latex: compiled, unwrappedLatex: compiled });
        continue;
      }
      pieces.push({ kind: 'atom', latex: '\\', unwrappedLatex: '\\' });
      idx += 1;
      continue;
    }

    if (ch === '(') {
      const grp = readBalancedGroup(src, idx, '(', ')');
      if (grp) {
        const inner = compileMathExpression(grp.content);
        const hasTall =
          inner.includes('\\frac') || inner.includes('\\sum') || inner.includes('\\int');
        const wrapped = hasTall ? `\\left(${inner}\\right)` : `(${inner})`;
        pieces.push({
          kind: 'atom',
          latex: wrapped,
          unwrappedLatex: inner,
        });
        idx = grp.nextIndex;
        continue;
      }
    }

    if (ch === '{') {
      const grp = readBalancedGroup(src, idx, '{', '}');
      if (grp) {
        const inner = compileMathExpression(grp.content);
        pieces.push({ kind: 'atom', latex: `{${inner}}`, unwrappedLatex: inner });
        idx = grp.nextIndex;
        continue;
      }
    }

    if ('^_/*+-=<>,:;'.includes(ch)) {
      pieces.push({ kind: 'op', latex: ch, unwrappedLatex: ch });
      idx += 1;
      continue;
    }

    const numMatch = /^\d+(?:\.\d+)?/.exec(src.slice(idx));
    if (numMatch?.[0]) {
      pieces.push({ kind: 'atom', latex: numMatch[0], unwrappedLatex: numMatch[0] });
      idx += numMatch[0].length;
      continue;
    }

    const idMatch = /^[a-zA-Z]+/.exec(src.slice(idx));
    if (idMatch?.[0]) {
      const word = idMatch[0];
      idx += word.length;

      if (/^[NZQRC]$/.test(word) && src[idx] === '*') {
        idx += 1;
        const setStar = `\\mathbb{${word}}^{*}`;
        pieces.push({ kind: 'atom', latex: setStar, unwrappedLatex: setStar });
        continue;
      }
      if (word === 'NN' || word === 'ZZ' || word === 'QQ' || word === 'RR' || word === 'CC') {
        const bb = `\\mathbb{${word[0]}}`;
        pieces.push({ kind: 'atom', latex: bb, unwrappedLatex: bb });
        continue;
      }

      if ((word === 'sqrt' || word === 'abs' || word === 'set' || word === 'root') && src[idx] === '(') {
        const grp = readBalancedGroup(src, idx, '(', ')');
        if (grp) {
          idx = grp.nextIndex;
          if (word === 'sqrt') {
            const s = `\\sqrt{${compileMathExpression(grp.content)}}`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
          if (word === 'abs') {
            const s = `\\left|${compileMathExpression(grp.content)}\\right|`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
          if (word === 'set') {
            const s = `\\left\\{${compileMathExpression(grp.content)}\\right\\}`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
          if (word === 'root') {
            const commaIdx = grp.content.indexOf(',');
            const deg = commaIdx >= 0 ? grp.content.slice(0, commaIdx) : '2';
            const rad = commaIdx >= 0 ? grp.content.slice(commaIdx + 1) : grp.content;
            const s = `\\sqrt[${compileMathExpression(deg)}]{${compileMathExpression(rad)}}`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
        }
      }

      if (KNOWN_MATH_FUNCTIONS.has(word)) {
        const fnLatex = `\\${word}`;
        const prevOp = pieces[pieces.length - 1];
        if (
          word === 'inf' &&
          prevOp?.kind === 'op' &&
          (prevOp.latex === '\\to' ||
            prevOp.latex === '+' ||
            prevOp.latex === '-' ||
            prevOp.latex === '=') &&
          src[idx] !== ' '
        ) {
          pieces.push({ kind: 'atom', latex: '\\infty', unwrappedLatex: '\\infty' });
          continue;
        }
        pieces.push({ kind: 'atom', latex: fnLatex, unwrappedLatex: fnLatex });
        continue;
      }

      if (word in BARE_GREEK_IN_EXPR) {
        const g = BARE_GREEK_IN_EXPR[word]!;
        pieces.push({ kind: 'atom', latex: g, unwrappedLatex: g });
        continue;
      }

      if (word === 'in') {
        pieces.push({ kind: 'op', latex: '\\in', unwrappedLatex: '\\in' });
        continue;
      }

      pieces.push({ kind: 'atom', latex: word, unwrappedLatex: word });
      continue;
    }

    pieces.push({ kind: 'atom', latex: ch, unwrappedLatex: ch });
    idx += 1;
  }

  const afterPow: ExprPiece[] = [];
  let pIdx = 0;
  while (pIdx < pieces.length) {
    const cur = pieces[pIdx]!;
    if (
      (cur.latex === '^' || cur.latex === '_') &&
      afterPow.length > 0 &&
      afterPow[afterPow.length - 1]!.kind === 'atom' &&
      pIdx + 1 < pieces.length
    ) {
      const base = afterPow.pop()!;
      let rhs = pieces[pIdx + 1]!;
      let advance = 2;
      if (rhs.kind === 'op' && (rhs.latex === '-' || rhs.latex === '+') && pIdx + 2 < pieces.length) {
        const nextAtom = pieces[pIdx + 2]!;
        rhs = {
          kind: 'atom',
          latex: `${rhs.latex}${nextAtom.unwrappedLatex}`,
          unwrappedLatex: `${rhs.latex}${nextAtom.unwrappedLatex}`,
        };
        advance = 3;
      }
      const combined = `${base.latex}${cur.latex}{${rhs.unwrappedLatex}}`;
      afterPow.push({ kind: 'atom', latex: combined, unwrappedLatex: combined });
      pIdx += advance;
      continue;
    }
    afterPow.push(cur);
    pIdx += 1;
  }

  const afterImplicit: ExprPiece[] = [];
  for (const piece of afterPow) {
    const prev = afterImplicit[afterImplicit.length - 1];
    if (
      prev &&
      prev.kind === 'atom' &&
      piece.kind === 'atom' &&
      !/^d[a-zA-Z]$/.test(piece.latex)
    ) {
      const needsSpace = /\\[a-zA-Z]+$/.test(prev.latex) && /^[a-zA-Z0-9]/.test(piece.latex);
      const joined = `${prev.latex}${needsSpace ? ' ' : ''}${piece.latex}`;
      afterImplicit[afterImplicit.length - 1] = {
        kind: 'atom',
        latex: joined,
        unwrappedLatex: joined,
      };
    } else {
      afterImplicit.push(piece);
    }
  }

  const afterMulDiv: ExprPiece[] = [];
  let mIdx = 0;
  while (mIdx < afterImplicit.length) {
    const cur = afterImplicit[mIdx]!;
    if (
      cur.kind === 'op' &&
      cur.latex === '/' &&
      afterMulDiv.length > 0 &&
      afterMulDiv[afterMulDiv.length - 1]!.kind === 'atom' &&
      mIdx + 1 < afterImplicit.length &&
      afterImplicit[mIdx + 1]!.kind === 'atom'
    ) {
      const num = afterMulDiv.pop()!;
      const den = afterImplicit[mIdx + 1]!;
      const frac = `\\frac{${num.unwrappedLatex}}{${den.unwrappedLatex}}`;
      afterMulDiv.push({ kind: 'atom', latex: frac, unwrappedLatex: frac });
      mIdx += 2;
      continue;
    }
    if (cur.kind === 'op' && cur.latex === '*') {
      afterMulDiv.push({ kind: 'op', latex: '\\cdot', unwrappedLatex: '\\cdot' });
      mIdx += 1;
      continue;
    }
    afterMulDiv.push(cur);
    mIdx += 1;
  }

  const out: string[] = [];
  for (let i = 0; i < afterMulDiv.length; i += 1) {
    const item = afterMulDiv[i]!;
    if (item.latex === ',' || item.latex === ';') {
      out.push(`${item.latex} `);
    } else if (i === 0) {
      out.push(item.latex);
    } else {
      const prev = out[out.length - 1] ?? '';
      out.push(prev.endsWith(' ') ? item.latex : ` ${item.latex}`);
    }
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

export function renderTextByMathMode(markdown: string, mode: MathSymbolInsertMode): string {
  if (mode !== 'mathlib') return markdown;
  return compileMathShorthandToMarkdown(markdown);
}

export function compileMathShorthandToMarkdown(markdown: string): string {
  if (!markdown || !markdown.includes('\\')) return markdown;

  let result = '';
  let idx = 0;
  const len = markdown.length;

  while (idx < len) {
    if (markdown.startsWith('```', idx)) {
      const closeFence = markdown.indexOf('```', idx + 3);
      if (closeFence < 0) {
        result += markdown.slice(idx);
        break;
      }
      result += markdown.slice(idx, closeFence + 3);
      idx = closeFence + 3;
      continue;
    }

    if (markdown[idx] === '`') {
      const closeTick = markdown.indexOf('`', idx + 1);
      if (closeTick < 0) {
        result += markdown.slice(idx);
        break;
      }
      result += markdown.slice(idx, closeTick + 1);
      idx = closeTick + 1;
      continue;
    }

    if (markdown.startsWith('$$', idx)) {
      const closeDisplay = markdown.indexOf('$$', idx + 2);
      if (closeDisplay < 0) {
        result += markdown.slice(idx);
        break;
      }
      result += markdown.slice(idx, closeDisplay + 2);
      idx = closeDisplay + 2;
      continue;
    }

    if (markdown[idx] === '$') {
      let closeInline = idx + 1;
      while (closeInline < len) {
        if (markdown[closeInline] === '\\') {
          closeInline += 2;
          continue;
        }
        if (markdown[closeInline] === '$' || markdown[closeInline] === '\n') break;
        closeInline += 1;
      }
      if (closeInline < len && markdown[closeInline] === '$') {
        result += markdown.slice(idx, closeInline + 1);
        idx = closeInline + 1;
        continue;
      }
      result += '$';
      idx += 1;
      continue;
    }

    if (markdown[idx] === '\\' && markdown[idx + 1] === '{') {
      const grp = readBalancedGroup(markdown, idx + 1, '{', '}');
      if (grp && grp.content.trim().length > 0) {
        result += `$${compileMathExpression(grp.content)}$`;
        idx = grp.nextIndex;
        continue;
      }
    }

    if (markdown[idx] === '\\') {
      const cmdMatch = /^\\([a-zA-Z]+)/.exec(markdown.slice(idx));
      if (cmdMatch?.[1]) {
        const cmdName = cmdMatch[1];
        let cursor = idx + 1 + cmdName.length;
        let trailingStar = false;
        if (markdown[cursor] === '*' && /^[NZQRC]$/.test(cmdName)) {
          trailingStar = true;
          cursor += 1;
        }
        const args: string[] = [];
        while (markdown[cursor] === '{' && args.length < 2) {
          const grp = readBalancedGroup(markdown, cursor, '{', '}');
          if (!grp) break;
          args.push(grp.content);
          cursor = grp.nextIndex;
        }

        const isKnownCommand =
          args.length > 0 ||
          cmdName in STANDALONE_SYMBOLS ||
          [
            'frac',
            'sqrt',
            'root',
            'sum',
            'prod',
            'lim',
            'int',
            'abs',
            'vec',
            'set',
            'binom',
            'ddx',
          ].includes(cmdName);

        if (isKnownCommand) {
          const compiled = compileCommandInvocation(cmdName, args, trailingStar);
          result += `$${compiled}$`;
          idx = cursor;
          continue;
        }
      }
    }

    result += markdown[idx];
    idx += 1;
  }

  return result;
}

export function shouldAutoShowMathPreview(text: string, mode: MathSymbolInsertMode): boolean {
  if (!text) return false;
  if (mode === 'mathlib') {
    return text.includes('$') || /\\(?:\{|\}|[a-zA-Z]+)/.test(text);
  }
  return text.includes('$');
}

export interface ActiveBackslashQuery {
  readonly replaceFrom: number;
  readonly replaceTo: number;
  readonly query: string;
}

export function detectActiveBackslashQuery(
  value: string,
  caretPos: number | null,
): ActiveBackslashQuery | null {
  if (caretPos === null || caretPos < 1 || caretPos > value.length) return null;
  const before = value.slice(0, caretPos);
  const match = /(?:^|[\s([{+$=<>,-])\\([a-zA-Z*]{0,16})$/.exec(before);
  if (!match) return null;
  const query = match[1] ?? '';
  const replaceFrom = caretPos - (query.length + 1);
  return {
    replaceFrom,
    replaceTo: caretPos,
    query,
  };
}

function boundedEditDistance(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    let rowMin = maxDist + 1;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2]![j - 2]! + 1);
      }
      dp[i]![j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[a.length]![b.length] ?? maxDist + 1;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
    if (needle[i] === haystack[j]) i += 1;
  }
  return i === needle.length;
}

export function getDisplayTriggerForMode(
  entry: MathShorthandEntry,
  mode: MathSymbolInsertMode,
): string {
  if (mode === 'latex') return entry.latexTrigger;
  if (mode === 'mathlib') return entry.mathlibTrigger;
  return `\\${entry.sortKey}`;
}

/**
 * - When `query === ""` (user just typed `\`): returns the complete A -> Z alphabetical list!
 * - When `query !== ""` (e.g. `\si`): ranks nearest matches (exact -> prefix like `\sigma`, `\Sigma`, `\sin` -> alias -> subsequence -> fuzzy Levenshtein <= 2).
 */
export function filterShorthandSuggestions(
  query: string,
  mode: MathSymbolInsertMode,
  limit?: number,
): readonly MathShorthandEntry[] {
  const pool =
    mode === 'latex'
      ? MATH_SHORTHAND_CATALOG.filter(e => !e.id.startsWith('expr-'))
      : MATH_SHORTHAND_CATALOG;

  const clean = query.trim().toLowerCase();
  if (!clean) {
    // Pure A -> Z alphabetical list (putting `a..z` commands in strict alphabetical order)
    const pureCommands = pool.filter(e => !e.id.startsWith('expr-'));
    const exprHelpers = pool.filter(e => e.id.startsWith('expr-'));
    const ordered = [...pureCommands, ...exprHelpers];
    return limit !== undefined ? ordered.slice(0, limit) : ordered;
  }

  const scored: {
    readonly entry: MathShorthandEntry;
    readonly tier: number;
    readonly tieBreaker: number;
  }[] = [];

  for (const entry of pool) {
    const trig = getDisplayTriggerForMode(entry, mode).replace(/^\\/, '').toLowerCase();
    const key = entry.sortKey.toLowerCase();

    if (key === clean || trig === clean) {
      scored.push({ entry, tier: 0, tieBreaker: key.length });
      continue;
    }
    if (key.startsWith(clean) || trig.startsWith(clean)) {
      // Shorter commands with the prefix (like `\sin` for `\si`) rank right alongside `\sigma`!
      scored.push({ entry, tier: 1, tieBreaker: key.length });
      continue;
    }
    if (entry.aliases.some(a => a === clean || a.startsWith(clean))) {
      scored.push({ entry, tier: 2, tieBreaker: key.length });
      continue;
    }
    if (
      key.includes(clean) ||
      trig.includes(clean) ||
      entry.aliases.some(a => a.includes(clean)) ||
      entry.label.toLowerCase().includes(clean)
    ) {
      scored.push({ entry, tier: 3, tieBreaker: key.length });
      continue;
    }
    if (clean.length >= 2 && isSubsequence(clean, key)) {
      scored.push({ entry, tier: 4, tieBreaker: key.length });
      continue;
    }
    if (clean.length >= 2) {
      const dist = Math.min(
        boundedEditDistance(clean, key, 2),
        boundedEditDistance(clean, key.slice(0, clean.length + 1), 1),
      );
      if (dist <= (clean.length <= 3 ? 1 : 2)) {
        scored.push({ entry, tier: 5 + dist, tieBreaker: key.length });
      }
    }
  }

  const sorted = scored
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.tieBreaker - b.tieBreaker ||
        a.entry.sortKey.localeCompare(b.entry.sortKey, 'en', { sensitivity: 'base' }),
    )
    .map(s => s.entry);

  return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

export function applyShorthandSuggestion(
  currentValue: string,
  activeQuery: ActiveBackslashQuery,
  entry: MathShorthandEntry,
  mode: MathSymbolInsertMode,
  options?: { readonly wrapLatexWithDollars?: boolean | undefined },
): { readonly value: string; readonly caret: number } {
  const before = currentValue.slice(0, activeQuery.replaceFrom);
  const after = currentValue.slice(activeQuery.replaceTo);

  let snippet: string;
  let offset: number;

  if (mode === 'mathlib') {
    snippet = entry.mathlibInsert;
    offset = entry.mathlibCursorOffset;
  } else if (mode === 'latex') {
    snippet = entry.latexInsert;
    offset = entry.latexCursorOffset;
    if (
      options?.wrapLatexWithDollars &&
      !snippet.startsWith('$') &&
      !isInsideDollarMathSpan(before)
    ) {
      snippet = `$${snippet}$`;
      offset -= 1;
    }
  } else {
    snippet = entry.unicodeInsert;
    offset = entry.unicodeCursorOffset;
  }

  const nextValue = `${before}${snippet}${after}`;
  const rawCaret = activeQuery.replaceFrom + snippet.length + offset;
  const caret = Math.max(activeQuery.replaceFrom, Math.min(rawCaret, nextValue.length));
  return { value: nextValue, caret };
}
