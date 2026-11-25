import type { MathSymbolInsertMode } from '../../domain/math-symbols';

export type MathShorthandCategory =
  | 'expression'
  | 'calculus'
  | 'sets-logic'
  | 'probability'
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
  { id: 'expression', label: 'Phân số, Lũy thừa, Căn & Hàm' },
  { id: 'calculus', label: 'Giới hạn, Đạo hàm & Tích phân' },
  { id: 'probability', label: 'Xác suất – Thống kê' },
  { id: 'sets-logic', label: 'Tập hợp, Độ phức tạp & Logic' },
  { id: 'science', label: 'Vật lý & Hóa học' },
  { id: 'greek', label: 'Chữ cái Hy Lạp' },
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
  // Programming expression helpers (shown at end of bare \ list & in guide table)
  {
    id: 'expr-div',
    sortKey: 'a/b',
    unicode: '()/()',
    uOff: -4,
    mTrig: '\\{a/b}',
    mIns: '\\{1/n}',
    mOff: -1,
    mEx: '\\{(x+1)/(n+1)}',
    lTrig: '\\frac',
    lIns: '\\frac{}{}',
    lOff: -3,
    lEx: '$\\frac{1}{n}$',
    preview: '\\frac{a}{b}',
    label: 'Phân số tự nhận tử/mẫu',
    cat: 'expression',
    aliases: ['phanso', 'chia', '{'],
  },
  {
    id: 'expr-pow',
    sortKey: 'a^(b)',
    unicode: '^()',
    uOff: -1,
    mTrig: '\\{a^(b)}',
    mIns: '\\{^()}',
    mOff: -2,
    mEx: '\\{n^(n)}',
    lTrig: '\\pow',
    lIns: '^{}',
    lOff: -1,
    lEx: '$n^{n}$',
    preview: 'x^{n}',
    label: 'Lũy thừa bất kỳ x^y',
    cat: 'expression',
    aliases: ['pow', 'mu', 'luythua'],
  },
  {
    id: 'expr-sub',
    sortKey: 'a_(i)',
    unicode: '_()',
    uOff: -1,
    mTrig: '\\{a_(i)}',
    mIns: '\\{_()}',
    mOff: -2,
    mEx: '\\{a_(n+1)}',
    lTrig: '\\sub',
    lIns: '_{}',
    lOff: -1,
    lEx: '$a_{n+1}$',
    preview: 'a_{i}',
    label: 'Chỉ số dưới a_i',
    cat: 'expression',
    aliases: ['sub', 'chiso'],
  },

  // Full Canonical A -> Z Commands (aligned 1-to-1 with MathSymbolToolbar!)
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
    lIns: '\\left|  \\right|',
    lOff: -8,
    lEx: '$\\left|a_{n} - L\\right|$',
    preview: '\\left|x\\right|',
    label: 'Giá trị tuyệt đối (|x|)',
    cat: 'expression',
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
    label: 'Alpha (α)',
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
    label: 'Beta (β)',
    cat: 'greek',
  },
  {
    id: 'cmd-binom',
    sortKey: 'binom',
    unicode: 'C(, )',
    uOff: -3,
    mTrig: '\\binom',
    mIns: '\\binom{}{}',
    mOff: -3,
    mEx: '\\binom{n}{k}',
    lTrig: '\\binom',
    lIns: '\\binom{}{}',
    lOff: -3,
    lEx: '$\\binom{n}{k}$',
    preview: '\\binom{n}{k}',
    label: 'Tổ hợp chập k của n',
    cat: 'probability',
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
    label: 'Giao tập hợp (∩)',
    cat: 'sets-logic',
    aliases: ['giao', 'inter', 'intersect'],
  },
  {
    id: 'cmd-cases',
    sortKey: 'cases',
    unicode: '{ ; }',
    uOff: -3,
    mTrig: '\\cases',
    mIns: '\\cases{ ; }',
    mOff: -4,
    mEx: '\\cases{x^(2) khi x >= 0; -x khi x < 0}',
    lTrig: '\\cases',
    lIns: '\\begin{cases}  \\\\  \\end{cases}',
    lOff: -15,
    lEx: '$\\begin{cases} x \\\\ -x \\end{cases}$',
    preview: '\\begin{cases} a \\\\ b \\end{cases}',
    label: 'Hệ phương trình / Hàm từng khúc',
    cat: 'expression',
    aliases: ['hephuongtrinh', 'he', 'piecewise'],
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
    label: 'Nhân chấm (·)',
    cat: 'expression',
    aliases: ['nhan', 'dot'],
  },
  {
    id: 'cmd-ceil',
    sortKey: 'ceil',
    unicode: '⌈⌉',
    uOff: -1,
    mTrig: '\\ceil',
    mIns: '\\ceil{}',
    mOff: -1,
    mEx: '\\ceil{n/2}',
    lTrig: '\\ceil',
    lIns: '\\lceil  \\rceil',
    lOff: -7,
    lEx: '$\\lceil x \\rceil$',
    preview: '\\lceil x \\rceil',
    label: 'Hàm trần (⌈x⌉)',
    cat: 'sets-logic',
    aliases: ['hamtran', 'lceil'],
  },
  {
    id: 'prob-chisq',
    sortKey: 'chisq',
    unicode: 'χ²',
    mTrig: '\\chisq',
    mIns: '\\chisq',
    mEx: 'T \\sim \\chisq',
    lTrig: '\\chi^2',
    lIns: '\\chi^2',
    lEx: '$\\chi^2$',
    preview: '\\chi^{2}',
    label: 'Phân phối Chi bình phương (χ²)',
    cat: 'probability',
    aliases: ['chi', 'chi2', 'chibinhphuong'],
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
    id: 'cmd-cube',
    sortKey: 'cube',
    unicode: '³',
    mTrig: '\\cube',
    mIns: '^(3)',
    mEx: '\\{x^(3)}',
    lTrig: '\\cube',
    lIns: '^{3}',
    lEx: '$x^{3}$',
    preview: 'x^{3}',
    label: 'Lập phương (³)',
    cat: 'expression',
    aliases: ['mu3', 'lapphuong'],
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
    label: 'Hợp tập hợp (∪)',
    cat: 'sets-logic',
    aliases: ['hop', 'union'],
  },
  {
    id: 'cmd-d2dx2',
    sortKey: 'd2dx2',
    unicode: 'd2/dx2()',
    uOff: -1,
    mTrig: '\\d2dx2',
    mIns: '\\d2dx2{}',
    mOff: -1,
    mEx: '\\d2dx2{sin(x)}',
    lTrig: '\\d2dx2',
    lIns: '\\frac{d^2}{dx^2}()',
    lOff: -1,
    lEx: '$\\frac{d^2}{dx^2}f(x)$',
    preview: '\\frac{d^2}{dx^2}f(x)',
    label: 'Đạo hàm bậc hai (d²/dx²)',
    cat: 'calculus',
    aliases: ['daoham2'],
  },
  {
    id: 'cmd-ddt',
    sortKey: 'ddt',
    unicode: 'd/dt()',
    uOff: -1,
    mTrig: '\\ddt',
    mIns: '\\ddt{}',
    mOff: -1,
    mEx: '\\ddt{x(t)}',
    lTrig: '\\ddt',
    lIns: '\\frac{d}{dt}()',
    lOff: -1,
    lEx: '$\\frac{d}{dt}x(t)$',
    preview: '\\frac{d}{dt}x(t)',
    label: 'Đạo hàm theo thời gian (d/dt)',
    cat: 'science',
    aliases: ['vantoc'],
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
    lIns: '\\frac{d}{dx}()',
    lOff: -1,
    lEx: '$\\frac{d}{dx}\\ln(1+x)$',
    preview: '\\frac{d}{dx}f(x)',
    label: 'Đạo hàm theo x (d/dx)',
    cat: 'calculus',
    aliases: ['daoham', 'deriv'],
  },
  {
    id: 'sym-deg',
    sortKey: 'deg',
    unicode: '°',
    mTrig: '\\deg',
    mIns: '\\deg',
    mEx: '25\\deg C',
    lTrig: '\\deg',
    lIns: '^\\circ',
    lEx: '$\\Delta H^\\circ$',
    preview: '^\\circ',
    label: 'Độ / Trạng thái chuẩn (°)',
    cat: 'science',
    aliases: ['do', 'circ', 'degree'],
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
    label: 'Delta thường (δ)',
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
    label: 'Độ biến thiên / Delta hoa (Δ)',
    cat: 'greek',
    aliases: ['bienthien'],
  },
  {
    id: 'cmd-derivn',
    sortKey: 'derivn',
    unicode: '^(n)',
    mTrig: '\\derivn',
    mIns: '\\{f^((n))(x)}',
    mEx: '\\{f^((n))(0)}',
    lTrig: '\\derivn',
    lIns: '^{(n)}',
    lEx: '$f^{(n)}(x)$',
    preview: 'f^{(n)}(x)',
    label: 'Đạo hàm cấp n (f⁽ⁿ⁾)',
    cat: 'calculus',
    aliases: ['daohamcapn'],
  },
  {
    id: 'sym-div',
    sortKey: 'div',
    unicode: '÷',
    mTrig: '\\div',
    mIns: '\\div ',
    mEx: 'a \\div b',
    lTrig: '\\div',
    lIns: '\\div ',
    lEx: '$a \\div b$',
    preview: '\\div',
    label: 'Phép chia (÷)',
    cat: 'expression',
  },
  {
    id: 'chem-dminus',
    sortKey: 'dminus',
    unicode: 'δ-',
    mTrig: '\\dminus',
    mIns: '\\dminus',
    mEx: 'O\\dminus',
    lTrig: '\\delta^-',
    lIns: '\\delta^-',
    lEx: '$\\delta^-$',
    preview: '\\delta^{-}',
    label: 'Điện tích riêng phần âm (δ⁻)',
    cat: 'science',
    aliases: ['delta-'],
  },
  {
    id: 'chem-dplus',
    sortKey: 'dplus',
    unicode: 'δ+',
    mTrig: '\\dplus',
    mIns: '\\dplus',
    mEx: 'H\\dplus',
    lTrig: '\\delta^+',
    lIns: '\\delta^+',
    lEx: '$\\delta^+$',
    preview: '\\delta^{+}',
    label: 'Điện tích riêng phần dương (δ⁺)',
    cat: 'science',
    aliases: ['delta+'],
  },
  {
    id: 'cmd-dprime',
    sortKey: 'dprime',
    unicode: '″',
    mTrig: '\\dprime',
    mIns: "''",
    mEx: "f''(x)",
    lTrig: '\\dprime',
    lIns: "''",
    lEx: "$f''(x)$",
    preview: "f''(x)",
    label: 'Đạo hàm cấp 2 (f″)',
    cat: 'calculus',
  },
  {
    id: 'prob-e',
    sortKey: 'e-expect',
    unicode: '𝔼[]',
    uOff: -1,
    mTrig: '\\E',
    mIns: '\\E{}',
    mOff: -1,
    mEx: '\\E{X}',
    lTrig: '\\mathbb{E}',
    lIns: '\\mathbb{E}[]',
    lOff: -1,
    lEx: '$\\mathbb{E}[X]$',
    preview: '\\mathbb{E}[X]',
    label: 'Kỳ vọng 𝔼[X]',
    cat: 'probability',
    aliases: ['expect', 'kyvong'],
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
    id: 'chem-eq',
    sortKey: 'eq',
    unicode: '⇌',
    mTrig: '\\eq',
    mIns: '\\eq ',
    mEx: 'N_2 + 3H_2 \\eq 2NH_3',
    lTrig: '\\rightleftharpoons',
    lIns: '\\rightleftharpoons ',
    lEx: '$\\rightleftharpoons$',
    preview: '\\rightleftharpoons',
    label: 'Phản ứng thuận nghịch (⇌)',
    cat: 'science',
    aliases: ['canbang', 'thuannghich', 'rightleftharpoons'],
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
    id: 'cmd-eval',
    sortKey: 'eval',
    unicode: '|_()^()',
    uOff: -4,
    mTrig: '\\eval',
    mIns: '\\eval{}{a..b}',
    mOff: -7,
    mEx: '\\eval{x^(2)/2}{0..1}',
    lTrig: '\\eval',
    lIns: '\\left.  \\right|_{}^{}',
    lOff: -14,
    lEx: '$\\left. F(x) \\right|_{a}^{b}$',
    preview: '\\left. F(x) \\right|_{a}^{b}',
    label: 'Cận thế tích phân Newton–Leibniz',
    cat: 'calculus',
    aliases: ['canthe', 'barab'],
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
    unicode: 'e^()',
    uOff: -1,
    mTrig: '\\exp',
    mIns: '\\exp{}',
    mOff: -1,
    mEx: '\\exp{-x^(2)}',
    lTrig: '\\exp',
    lIns: 'e^{}',
    lOff: -1,
    lEx: '$e^{x}$',
    preview: 'e^{x}',
    label: 'Hàm mũ tự nhiên eˣ / exp(x)',
    cat: 'expression',
  },
  {
    id: 'cmd-floor',
    sortKey: 'floor',
    unicode: '⌊⌋',
    uOff: -1,
    mTrig: '\\floor',
    mIns: '\\floor{}',
    mOff: -1,
    mEx: '\\floor{n/2}',
    lTrig: '\\floor',
    lIns: '\\lfloor  \\rfloor',
    lOff: -8,
    lEx: '$\\lfloor x \\rfloor$',
    preview: '\\lfloor x \\rfloor',
    label: 'Hàm sàn (⌊x⌋)',
    cat: 'sets-logic',
    aliases: ['hamsan', 'lfloor'],
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
    unicode: '()/()',
    uOff: -4,
    mTrig: '\\frac',
    mIns: '\\frac{}{}',
    mOff: -3,
    mEx: '\\frac{1}{n + 1}',
    lTrig: '\\frac',
    lIns: '\\frac{}{}',
    lOff: -3,
    lEx: '$\\frac{1}{n + 1}$',
    preview: '\\frac{a}{b}',
    label: 'Phân số (tử / mẫu)',
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
    label: 'Gamma (γ)',
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
    lTrig: '\\Leftrightarrow',
    lIns: '\\Leftrightarrow ',
    lEx: '$A \\Leftrightarrow B$',
    preview: '\\Leftrightarrow',
    label: 'Tương đương / Khi và chỉ khi (⇔)',
    cat: 'sets-logic',
    aliases: ['tuongduong', 'leftrightarrow'],
  },
  {
    id: 'sym-implies',
    sortKey: 'implies',
    unicode: '⇒',
    mTrig: '\\implies',
    mIns: '\\implies ',
    mEx: 'A \\implies B',
    lTrig: '\\Rightarrow',
    lIns: '\\Rightarrow ',
    lEx: '$A \\Rightarrow B$',
    preview: '\\Rightarrow',
    label: 'Suy ra (⇒)',
    cat: 'sets-logic',
    aliases: ['suyra', 'imp', 'rightarrow'],
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
    unicode: '∫ () dx',
    uOff: -4,
    mTrig: '\\int',
    mIns: '\\int{ dx}',
    mOff: -4,
    mEx: '\\int{sin(x) dx}',
    lTrig: '\\int',
    lIns: '\\int  \\,dx',
    lOff: -5,
    lEx: '$\\int f(x)\\,dx$',
    preview: '\\int f(x)\\,dx',
    label: 'Nguyên hàm / Tích phân bất định',
    cat: 'calculus',
    aliases: ['nguyenham', 'indef'],
  },
  {
    id: 'cmd-intab',
    sortKey: 'intab',
    unicode: '∫_()^() dx',
    uOff: -7,
    mTrig: '\\intab',
    mIns: '\\int{a..b}{ dx}',
    mOff: -4,
    mEx: '\\int{0..pi}{sin(x) dx}',
    lTrig: '\\int_{a}^{b}',
    lIns: '\\int_{}^{}  \\,dx',
    lOff: -10,
    lEx: '$\\int_{0}^{\\pi} \\sin(x)\\,dx$',
    preview: '\\int_{a}^{b} f(x)\\,dx',
    label: 'Tích phân xác định có cận [a, b]',
    cat: 'calculus',
    aliases: ['integral', 'tichphan', 'intdef'],
  },
  {
    id: 'cmd-intinf',
    sortKey: 'intinf',
    unicode: '∫_(1)^(+∞) dx',
    uOff: -3,
    mTrig: '\\intinf',
    mIns: '\\int{1..+inf}{ dx}',
    mOff: -4,
    mEx: '\\int{1..+inf}{1/x^(2) dx}',
    lTrig: '\\int_{a}^{+\\infty}',
    lIns: '\\int_{1}^{+\\infty}  \\,dx',
    lOff: -5,
    lEx: '$\\int_{1}^{+\\infty} \\frac{1}{x^2}\\,dx$',
    preview: '\\int_{a}^{+\\infty} f(x)\\,dx',
    label: 'Tích phân suy rộng cận +∞',
    cat: 'calculus',
    aliases: ['suyrong'],
  },
  {
    id: 'cmd-inv',
    sortKey: 'inv',
    unicode: '⁻¹',
    mTrig: '\\inv',
    mIns: '^(-1)',
    mEx: '\\{f^(-1)(x)}',
    lTrig: '\\inv',
    lIns: '^{-1}',
    lEx: '$f^{-1}(x)$',
    preview: 'x^{-1}',
    label: 'Nghịch đảo / Hàm ngược (⁻¹)',
    cat: 'expression',
    aliases: ['nghichdao'],
  },
  {
    id: 'chem-ion-plus',
    sortKey: 'ion+',
    unicode: '^+',
    mTrig: '\\ion+',
    mIns: '^+',
    mEx: 'H^+',
    lTrig: '^{+}',
    lIns: '^{+}',
    lEx: '$\\mathrm{H}^{+}$',
    preview: '\\mathrm{M}^{+}',
    label: 'Điện tích dương (gõ ^+)',
    cat: 'science',
  },
  {
    id: 'chem-ion-minus',
    sortKey: 'ion-',
    unicode: '^-',
    mTrig: '\\ion-',
    mIns: '^-',
    mEx: 'OH^-',
    lTrig: '^{-}',
    lIns: '^{-}',
    lEx: '$\\mathrm{OH}^{-}$',
    preview: '\\mathrm{X}^{-}',
    label: 'Điện tích âm (gõ ^-)',
    cat: 'science',
  },
  {
    id: 'chem-ion-2plus',
    sortKey: 'ion2+',
    unicode: '^2+',
    mTrig: '\\ion2+',
    mIns: '^2+',
    mEx: 'Cu^2+',
    lTrig: '^{2+}',
    lIns: '^{2+}',
    lEx: '$\\mathrm{Cu}^{2+}$',
    preview: '\\mathrm{M}^{2+}',
    label: 'Ion 2+ (gõ ^2+)',
    cat: 'science',
  },
  {
    id: 'chem-ion-2minus',
    sortKey: 'ion2-',
    unicode: '^2-',
    mTrig: '\\ion2-',
    mIns: '^2-',
    mEx: 'SO_4^2-',
    lTrig: '^{2-}',
    lIns: '^{2-}',
    lEx: '$\\mathrm{SO}_4^{2-}$',
    preview: '\\mathrm{X}^{2-}',
    label: 'Ion 2- (gõ ^2-)',
    cat: 'science',
  },
  {
    id: 'chem-iso',
    sortKey: 'iso',
    unicode: '^()_()X',
    uOff: -5,
    mTrig: '\\iso',
    mIns: '\\iso{A}{Z}{X}',
    mOff: -1,
    mEx: '\\iso{14}{6}{C}',
    lTrig: '\\iso',
    lIns: '{}_{}^{}\\text{}',
    lOff: -10,
    lEx: '${}_{6}^{14}\\text{C}$',
    preview: '{}_{Z}^{A}\\text{X}',
    label: 'Ký hiệu hạt nhân / đồng vị',
    cat: 'science',
    aliases: ['dongvi', 'hatnhan'],
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
    label: 'Lambda (λ)',
    cat: 'greek',
  },
  {
    id: 'sym-land',
    sortKey: 'land',
    unicode: '∧',
    mTrig: '\\land',
    mIns: '\\land ',
    mEx: 'P \\land Q',
    lTrig: '\\land',
    lIns: '\\land ',
    lEx: '$P \\land Q$',
    preview: 'P \\land Q',
    label: 'Và logic (∧)',
    cat: 'sets-logic',
    aliases: ['and'],
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
  // Complete Limit Suite: x -> [any], x -> a, x -> a+, x -> a-, x -> +inf, x -> -inf, n -> +inf, bare lim, limsup, liminf
  {
    id: 'cmd-lim',
    sortKey: 'lim',
    unicode: 'lim_{x→} ',
    uOff: -2,
    mTrig: '\\lim',
    mIns: '\\lim{x->}{}',
    mOff: -3,
    mEx: '\\lim{x->a+}{f(x)}',
    lTrig: '\\lim',
    lIns: '\\lim_{x \\to } ',
    lOff: -2,
    lEx: '$\\lim_{x \\to a} f(x)$',
    preview: '\\lim_{x \\to \\square} f(x)',
    label: 'Giới hạn khi x → giá trị bất kỳ (a, a+, a-, ±∞)',
    cat: 'calculus',
    aliases: ['gioihan'],
  },
  {
    id: 'cmd-lim-xa',
    sortKey: 'lima',
    unicode: 'lim_{x→a} ',
    mTrig: '\\lima',
    mIns: '\\lim{x->a}{}',
    mOff: -1,
    mEx: '\\lim{x->a}{f(x)}',
    lTrig: '\\lim_{x \\to a}',
    lIns: '\\lim_{x \\to a} ',
    lEx: '$\\lim_{x \\to a} f(x)$',
    preview: '\\lim_{x \\to a} f(x)',
    label: 'Giới hạn hữu hạn khi x → a',
    cat: 'calculus',
    aliases: ['limx', 'xtoa'],
  },
  {
    id: 'cmd-lim-right',
    sortKey: 'lim+',
    unicode: 'lim_{x→a+} ',
    mTrig: '\\lim+',
    mIns: '\\lim{x->a+}{}',
    mOff: -1,
    mEx: '\\lim{x->0+}{1/x}',
    lTrig: '\\lim_{x \\to a^+}',
    lIns: '\\lim_{x \\to a^{+}} ',
    lEx: '$\\lim_{x \\to a^{+}} f(x)$',
    preview: '\\lim_{x \\to a^{+}} f(x)',
    label: 'Giới hạn bên phải khi x → a+ (gõ thẳng a+, 0+)',
    cat: 'calculus',
    aliases: ['limright', 'gioihanphai', 'a+'],
  },
  {
    id: 'cmd-lim-left',
    sortKey: 'lim-',
    unicode: 'lim_{x→a-} ',
    mTrig: '\\lim-',
    mIns: '\\lim{x->a-}{}',
    mOff: -1,
    mEx: '\\lim{x->0-}{1/x}',
    lTrig: '\\lim_{x \\to a^-}',
    lIns: '\\lim_{x \\to a^{-}} ',
    lEx: '$\\lim_{x \\to a^{-}} f(x)$',
    preview: '\\lim_{x \\to a^{-}} f(x)',
    label: 'Giới hạn bên trái khi x → a- (gõ thẳng a-, 0-)',
    cat: 'calculus',
    aliases: ['limleft', 'gioihantrai', 'a-'],
  },
  {
    id: 'cmd-lim-inf',
    sortKey: 'liminf',
    unicode: 'lim_{x→+∞} ',
    mTrig: '\\liminf',
    mIns: '\\lim{x->+inf}{}',
    mOff: -1,
    mEx: '\\lim{x->+inf}{(2x+1)/(x-1)}',
    lTrig: '\\lim_{x \\to +\\infty}',
    lIns: '\\lim_{x \\to +\\infty} ',
    lEx: '$\\lim_{x \\to +\\infty} f(x)$',
    preview: '\\lim_{x \\to +\\infty} f(x)',
    label: 'Giới hạn hàm số khi x → +∞',
    cat: 'calculus',
    aliases: ['limoo', 'limvocung'],
  },
  {
    id: 'cmd-lim-minf',
    sortKey: 'limminf',
    unicode: 'lim_{x→-∞} ',
    mTrig: '\\limminf',
    mIns: '\\lim{x->-inf}{}',
    mOff: -1,
    mEx: '\\lim{x->-inf}{e^(x)}',
    lTrig: '\\lim_{x \\to -\\infty}',
    lIns: '\\lim_{x \\to -\\infty} ',
    lEx: '$\\lim_{x \\to -\\infty} f(x)$',
    preview: '\\lim_{x \\to -\\infty} f(x)',
    label: 'Giới hạn hàm số khi x → −∞',
    cat: 'calculus',
    aliases: ['limamvocung'],
  },
  {
    id: 'cmd-lim-n',
    sortKey: 'limn',
    unicode: 'lim_{n→+∞} ',
    mTrig: '\\limn',
    mIns: '\\lim{n->+inf}{}',
    mOff: -1,
    mEx: '\\lim{n->+inf}{(1 + 1/n)^(n)}',
    lTrig: '\\lim_{n \\to +\\infty}',
    lIns: '\\lim_{n \\to +\\infty} ',
    lEx: '$\\lim_{n \\to +\\infty} u_{n}$',
    preview: '\\lim_{n \\to +\\infty} u_{n}',
    label: 'Giới hạn dãy số khi n → +∞',
    cat: 'calculus',
    aliases: ['limday', 'ntooom'],
  },
  {
    id: 'cmd-lim-bare',
    sortKey: 'limop',
    unicode: 'lim ',
    mTrig: '\\limop',
    mIns: '\\lim ',
    mEx: '\\lim u_n = L',
    lTrig: '\\lim',
    lIns: '\\lim ',
    lEx: '$\\lim u_n = L$',
    preview: '\\lim u_{n}',
    label: 'Toán tử lim không ghi cận dưới',
    cat: 'calculus',
    aliases: ['limkhongcan', 'limbare'],
  },
  {
    id: 'cmd-limsup',
    sortKey: 'limsup',
    unicode: 'limsup_{n→∞} ',
    mTrig: '\\limsup',
    mIns: '\\limsup{n->inf}{}',
    mOff: -1,
    mEx: '\\limsup{n->inf}{root(n, abs(a_n))}',
    lTrig: '\\limsup',
    lIns: '\\limsup_{n \\to \\infty} ',
    lEx: '$\\limsup_{n \\to \\infty} a_n$',
    preview: '\\limsup_{n \\to \\infty} a_{n}',
    label: 'Giới hạn trên limsup',
    cat: 'calculus',
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
    lIns: '\\log()',
    lOff: -1,
    lEx: '$\\log(n)$',
    preview: '\\log(x)',
    label: 'Logarit log(x)',
    cat: 'expression',
  },
  {
    id: 'fn-log2',
    sortKey: 'log2',
    unicode: 'log2()',
    uOff: -1,
    mTrig: '\\log2',
    mIns: '\\log2{}',
    mOff: -1,
    mEx: '\\log2{n}',
    lTrig: '\\log_2',
    lIns: '\\log_2()',
    lOff: -1,
    lEx: '$\\log_2(n)$',
    preview: '\\log_{2}(n)',
    label: 'Logarit cơ số 2 (log₂)',
    cat: 'sets-logic',
  },
  {
    id: 'fn-loga',
    sortKey: 'loga',
    unicode: 'log_a()',
    uOff: -1,
    mTrig: '\\loga',
    mIns: '\\loga{}{}',
    mOff: -3,
    mEx: '\\loga{a}{x}',
    lTrig: '\\log_a',
    lIns: '\\log_{}()',
    lOff: -3,
    lEx: '$\\log_{a}(x)$',
    preview: '\\log_{a}(x)',
    label: 'Logarit cơ số a bất kỳ',
    cat: 'expression',
    aliases: ['logbase'],
  },
  {
    id: 'sym-lor',
    sortKey: 'lor',
    unicode: '∨',
    mTrig: '\\lor',
    mIns: '\\lor ',
    mEx: 'P \\lor Q',
    lTrig: '\\lor',
    lIns: '\\lor ',
    lEx: '$P \\lor Q$',
    preview: 'P \\lor Q',
    label: 'Hoặc logic (∨)',
    cat: 'sets-logic',
    aliases: ['or'],
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
    id: 'sym-minus',
    sortKey: 'minus',
    unicode: '−',
    mTrig: '\\minus',
    mIns: '- ',
    mEx: 'a - b',
    lTrig: '-',
    lIns: '-',
    lEx: '$a - b$',
    preview: 'a - b',
    label: 'Dấu trừ toán học (−)',
    cat: 'expression',
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
    label: 'Mu (μ)',
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
    id: 'phys-nabla',
    sortKey: 'nabla',
    unicode: '∇',
    mTrig: '\\nabla',
    mIns: '\\nabla ',
    mEx: '\\nabla U',
    lTrig: '\\nabla',
    lIns: '\\nabla ',
    lEx: '$\\nabla U$',
    preview: '\\nabla',
    label: 'Toán tử Nabla / Gradient (∇)',
    cat: 'science',
    aliases: ['grad'],
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
    id: 'sym-neg',
    sortKey: 'neg',
    unicode: '¬',
    mTrig: '\\neg',
    mIns: '\\neg ',
    mEx: '\\neg P',
    lTrig: '\\neg',
    lIns: '\\neg ',
    lEx: '$\\neg P$',
    preview: '\\neg P',
    label: 'Phủ định logic (¬)',
    cat: 'sets-logic',
    aliases: ['lnot', 'not', 'phudinh'],
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
    id: 'greek-nu',
    sortKey: 'nu',
    unicode: 'ν',
    mTrig: '\\nu',
    mIns: '\\nu',
    mEx: 'E = h\\nu',
    lTrig: '\\nu',
    lIns: '\\nu',
    lEx: '$E = h\\nu$',
    preview: '\\nu',
    label: 'Nu / Tần số bức xạ (ν)',
    cat: 'greek',
    aliases: ['tanso'],
  },
  {
    id: 'cs-bigo',
    sortKey: 'o-big',
    unicode: 'O()',
    uOff: -1,
    mTrig: '\\O',
    mIns: '\\O{}',
    mOff: -1,
    mEx: '\\O{n log(n)}',
    lTrig: 'O()',
    lIns: 'O()',
    lOff: -1,
    lEx: '$O(n \\log n)$',
    preview: 'O(n \\log n)',
    label: 'Độ phức tạp Big-O',
    cat: 'sets-logic',
    aliases: ['bigo', 'dophuctap'],
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
    label: 'Omega thường / Tần số góc (ω)',
    cat: 'greek',
  },
  {
    id: 'greek-Omega',
    sortKey: 'omega-upper',
    unicode: 'Ω()',
    uOff: -1,
    mTrig: '\\Omega',
    mIns: '\\Omega',
    mEx: '\\Omega(n)',
    lTrig: '\\Omega',
    lIns: '\\Omega',
    lEx: '$\\Omega(n)$',
    preview: '\\Omega',
    label: 'Omega lớn / Không gian mẫu / Độ phức tạp Ω',
    cat: 'greek',
    aliases: ['bigomega'],
  },
  {
    id: 'prob-p',
    sortKey: 'p-prob',
    unicode: 'ℙ()',
    uOff: -1,
    mTrig: '\\P',
    mIns: '\\P{}',
    mOff: -1,
    mEx: '\\P{A}',
    lTrig: '\\mathbb{P}',
    lIns: '\\mathbb{P}()',
    lOff: -1,
    lEx: '$\\mathbb{P}(A)$',
    preview: '\\mathbb{P}(A)',
    label: 'Xác suất ℙ(A)',
    cat: 'probability',
    aliases: ['prob', 'xacsuat'],
  },
  {
    id: 'cmd-partial',
    sortKey: 'partial',
    unicode: '∂',
    mTrig: '\\partial',
    mIns: '\\partial ',
    mEx: '\\partial u / \\partial x',
    lTrig: '\\partial',
    lIns: '\\partial ',
    lEx: '$\\partial f$',
    preview: '\\partial',
    label: 'Ký hiệu đạo hàm riêng (∂)',
    cat: 'calculus',
    aliases: ['daohamrieng'],
  },
  {
    id: 'prob-pcond',
    sortKey: 'pcond',
    unicode: 'ℙ( | )',
    uOff: -4,
    mTrig: '\\Pcond',
    mIns: '\\Pcond{}{}',
    mOff: -3,
    mEx: '\\Pcond{A}{B}',
    lTrig: '\\mathbb{P}(A\\mid B)',
    lIns: '\\mathbb{P}( \\mid )',
    lOff: -7,
    lEx: '$\\mathbb{P}(A \\mid B)$',
    preview: '\\mathbb{P}(A \\mid B)',
    label: 'Xác suất có điều kiện ℙ(A|B)',
    cat: 'probability',
    aliases: ['condprob', 'xacsuatdieukien'],
  },
  {
    id: 'cmd-pdx',
    sortKey: 'pdx',
    unicode: '∂/∂x()',
    uOff: -1,
    mTrig: '\\pdx',
    mIns: '\\pdx{}',
    mOff: -1,
    mEx: '\\pdx{u(x, y)}',
    lTrig: '\\pdx',
    lIns: '\\frac{\\partial }{\\partial x}',
    lOff: -12,
    lEx: '$\\frac{\\partial u}{\\partial x}$',
    preview: '\\frac{\\partial}{\\partial x}u',
    label: 'Đạo hàm riêng ∂/∂x',
    cat: 'calculus',
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
    label: 'Phi / Pha dao động (φ)',
    cat: 'greek',
    aliases: ['varphi'],
  },
  {
    id: 'prob-Phi',
    sortKey: 'phi-upper',
    unicode: 'Φ()',
    uOff: -1,
    mTrig: '\\Phi',
    mIns: '\\Phi{}',
    mOff: -1,
    mEx: '\\Phi{1.96}',
    lTrig: '\\Phi',
    lIns: '\\Phi()',
    lOff: -1,
    lEx: '$\\Phi(z)$',
    preview: '\\Phi(z)',
    label: 'Hàm phân phối chuẩn tắc Φ(z)',
    cat: 'probability',
    aliases: ['chuantac', 'laplace'],
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
    label: 'Số Pi / Liên kết π',
    cat: 'greek',
  },
  {
    id: 'chem-pistar',
    sortKey: 'pistar',
    unicode: 'π*',
    mTrig: '\\pistar',
    mIns: '\\pistar',
    mEx: '\\pistar_{2p}',
    lTrig: '\\pi^*',
    lIns: '\\pi^*',
    lEx: '$\\pi^*_{2p}$',
    preview: '\\pi^{*}',
    label: 'Orbital phản liên kết π*',
    cat: 'science',
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
    id: 'cmd-prime',
    sortKey: 'prime',
    unicode: '′',
    mTrig: '\\prime',
    mIns: "'",
    mEx: "f'(x)",
    lTrig: '\\prime',
    lIns: "'",
    lEx: "$f'(x)$",
    preview: "f'(x)",
    label: 'Đạo hàm cấp 1 (f′)',
    cat: 'calculus',
  },
  {
    id: 'cmd-prod',
    sortKey: 'prod',
    unicode: '∏_{i=1}^{n} ',
    mTrig: '\\prod',
    mIns: '\\prod{i=1..n}{}',
    mOff: -1,
    mEx: '\\prod{k=1..n}{k/(k+1)}',
    lTrig: '\\prod',
    lIns: '\\prod_{i=1}^{n} ',
    lEx: '$\\prod_{i=1}^{n} a_{i}$',
    preview: '\\prod_{i=1}^{n}',
    label: 'Tích pi có cận (∏)',
    cat: 'calculus',
    aliases: ['tich'],
  },
  {
    id: 'phys-propto',
    sortKey: 'propto',
    unicode: '∝',
    mTrig: '\\propto',
    mIns: '\\propto ',
    mEx: 'F \\propto a',
    lTrig: '\\propto',
    lIns: '\\propto ',
    lEx: '$F \\propto a$',
    preview: '\\propto',
    label: 'Tỉ lệ thuận (∝)',
    cat: 'science',
    aliases: ['tilethuan'],
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
    id: 'greek-rho',
    sortKey: 'rho',
    unicode: 'ρ',
    mTrig: '\\rho',
    mIns: '\\rho',
    mEx: 'p = \\rho g h',
    lTrig: '\\rho',
    lIns: '\\rho',
    lEx: '$\\rho$',
    preview: '\\rho',
    label: 'Rho / Khối lượng riêng (ρ)',
    cat: 'greek',
    aliases: ['khoiluongrieng'],
  },
  {
    id: 'cmd-root',
    sortKey: 'root',
    unicode: 'root(n, )',
    uOff: -1,
    mTrig: '\\root',
    mIns: '\\root{}{}',
    mOff: -3,
    mEx: '\\root{n}{x + 1}',
    lTrig: '\\sqrt[n]',
    lIns: '\\sqrt[]{}',
    lOff: -3,
    lEx: '$\\sqrt[n]{x + 1}$',
    preview: '\\sqrt[n]{x}',
    label: 'Căn bậc n (ⁿ√x)',
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
    cat: 'sets-logic',
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
    label: 'Sigma thường (σ) hoặc kèm biểu thức',
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
    label: 'Sigma hoa (Σ)',
    cat: 'greek',
  },
  {
    id: 'chem-sigmastar',
    sortKey: 'sigmastar',
    unicode: 'σ*',
    mTrig: '\\sigmastar',
    mIns: '\\sigmastar',
    mEx: '\\sigmastar_{2s}',
    lTrig: '\\sigma^*',
    lIns: '\\sigma^*',
    lEx: '$\\sigma^*_{2s}$',
    preview: '\\sigma^{*}',
    label: 'Orbital phản liên kết σ*',
    cat: 'science',
  },
  {
    id: 'prob-sim',
    // Keep sortKey longer than `sin` (3) so typing `\si` keeps `\sin` ranked #1 while `\sim` matches exact trigger!
    sortKey: 'sim-dist',
    unicode: '∼',
    mTrig: '\\sim',
    mIns: '\\sim ',
    mEx: 'X \\sim N(\\mu, \\sigma^(2))',
    lTrig: '\\sim',
    lIns: '\\sim ',
    lEx: '$X \\sim \\mathcal{N}(\\mu, \\sigma^2)$',
    preview: 'X \\sim \\mathcal{N}',
    label: 'Tuân theo phân phối / Tương đương vô cùng bé (∼)',
    cat: 'probability',
    aliases: ['phanphoi', 'tuongduongvcb'],
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
    id: 'cmd-sq',
    sortKey: 'sq',
    unicode: '²',
    mTrig: '\\sq',
    mIns: '^(2)',
    mEx: '\\{x^(2)}',
    lTrig: '\\sq',
    lIns: '^{2}',
    lEx: '$x^{2}$',
    preview: 'x^{2}',
    label: 'Bình phương (²)',
    cat: 'expression',
    aliases: ['binhphuong', 'mu2'],
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
    label: 'Căn bậc hai (√)',
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
    label: 'Tập con (⊂)',
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
    label: 'Tập con hoặc bằng (⊆)',
    cat: 'sets-logic',
  },
  {
    id: 'cmd-subsup',
    sortKey: 'subsup',
    unicode: '_()^()',
    uOff: -4,
    mTrig: '\\subsup',
    mIns: '\\{_()^()}',
    mOff: -5,
    mEx: '\\{x_(i)^(2)}',
    lTrig: '\\subsup',
    lIns: '_{}^{}',
    lOff: -4,
    lEx: '$x_{i}^{2}$',
    preview: 'x_{i}^{k}',
    label: 'Chỉ số dưới và lũy thừa (xᵢʸ)',
    cat: 'expression',
  },
  {
    id: 'cmd-sum',
    sortKey: 'sum',
    unicode: '∑_{i=1}^{n} ',
    mTrig: '\\sum',
    mIns: '\\sum{i=1..n}{}',
    mOff: -1,
    mEx: '\\sum{i=1..n}{1/i^(2)}',
    lTrig: '\\sum',
    lIns: '\\sum_{i=1}^{n} ',
    lEx: '$\\sum_{i=1}^{n} a_{i}$',
    preview: '\\sum_{i=1}^{n}',
    label: 'Tổng sigma có cận i=1..n (∑)',
    cat: 'calculus',
    aliases: ['tong', 'xichma'],
  },
  {
    id: 'cmd-suminf',
    sortKey: 'suminf',
    unicode: '∑_{n=1}^{+∞} ',
    mTrig: '\\suminf',
    mIns: '\\sum{n=1..+inf}{}',
    mOff: -1,
    mEx: '\\sum{n=1..+inf}{1/n^(2)}',
    lTrig: '\\sum_{n=1}^{\\infty}',
    lIns: '\\sum_{n=1}^{\\infty} ',
    lEx: '$\\sum_{n=1}^{\\infty} u_{n}$',
    preview: '\\sum_{n=1}^{\\infty} u_{n}',
    label: 'Chuỗi số vô hạn n=1..∞',
    cat: 'calculus',
    aliases: ['chuoi', 'series'],
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
    id: 'greek-tau',
    sortKey: 'tau',
    unicode: 'τ',
    mTrig: '\\tau',
    mIns: '\\tau',
    mEx: '\\tau = r F',
    lTrig: '\\tau',
    lIns: '\\tau',
    lEx: '$\\tau$',
    preview: '\\tau',
    label: 'Tau / Mômen lực (τ)',
    cat: 'greek',
    aliases: ['momen'],
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
    label: 'Theta (θ)',
    cat: 'greek',
  },
  {
    id: 'cs-Theta',
    sortKey: 'theta-upper',
    unicode: 'Θ()',
    uOff: -1,
    mTrig: '\\Theta',
    mIns: '\\Theta{}',
    mOff: -1,
    mEx: '\\Theta{n^(2)}',
    lTrig: '\\Theta',
    lIns: '\\Theta()',
    lOff: -1,
    lEx: '$\\Theta(n^2)$',
    preview: '\\Theta(n)',
    label: 'Độ phức tạp Theta (Θ)',
    cat: 'sets-logic',
    aliases: ['bigtheta'],
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
    label: 'Mũi tên tiến tới / suy ra (→)',
    cat: 'sets-logic',
    aliases: ['arrow', 'tientoi'],
  },
  {
    id: 'prob-var',
    sortKey: 'var',
    unicode: 'Var()',
    uOff: -1,
    mTrig: '\\Var',
    mIns: '\\Var{}',
    mOff: -1,
    mEx: '\\Var{X}',
    lTrig: '\\operatorname{Var}',
    lIns: '\\operatorname{Var}()',
    lOff: -1,
    lEx: '$\\operatorname{Var}(X)$',
    preview: '\\operatorname{Var}(X)',
    label: 'Phương sai Var(X)',
    cat: 'probability',
    aliases: ['phuongsai', 'variance'],
  },
  {
    id: 'sym-vdash',
    sortKey: 'vdash',
    unicode: '⊢',
    mTrig: '\\vdash',
    mIns: '\\vdash ',
    mEx: '(q_0, w) \\vdash (q_1, x)',
    lTrig: '\\vdash',
    lIns: '\\vdash ',
    lEx: '$q_0 \\vdash q_1$',
    preview: '\\vdash',
    label: 'Bước chuyển cấu hình / Suy diễn (⊢)',
    cat: 'sets-logic',
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
    label: 'Ký hiệu vectơ (v⃗)',
    cat: 'science',
    aliases: ['vecto'],
  },
  {
    id: 'prob-xbar',
    sortKey: 'xbar',
    unicode: 'x̄',
    mTrig: '\\xbar',
    mIns: '\\bar{x}',
    mEx: '\\bar{x} = 12.5',
    lTrig: '\\bar{x}',
    lIns: '\\bar{x}',
    lEx: '$\\bar{x}$',
    preview: '\\bar{x}',
    label: 'Trung bình mẫu (x̄)',
    cat: 'probability',
    aliases: ['bar', 'trungbinhmau'],
  },
  {
    id: 'chem-xto',
    sortKey: 'xto',
    unicode: '→[]',
    uOff: -1,
    mTrig: '\\xto',
    mIns: '\\xto{}',
    mOff: -1,
    mEx: '\\xto{t^o, xt}',
    lTrig: '\\xrightarrow',
    lIns: '\\xrightarrow{}',
    lOff: -1,
    lEx: '$\\xrightarrow{t^\\circ}$',
    preview: '\\xrightarrow{\\text{đk}}',
    label: 'Mũi tên phản ứng có điều kiện',
    cat: 'science',
    aliases: ['xrightarrow', 'phanung'],
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
  P: '\\mathbb{P}',
  E: '\\mathbb{E}',
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
  nu: '\\nu',
  pi: '\\pi',
  Pi: '\\Pi',
  rho: '\\rho',
  sigma: '\\sigma',
  Sigma: '\\Sigma',
  tau: '\\tau',
  phi: '\\varphi',
  varphi: '\\varphi',
  Phi: '\\Phi',
  chi: '\\chi',
  chisq: '\\chi^{2}',
  psi: '\\psi',
  Psi: '\\Psi',
  omega: '\\omega',
  Omega: '\\Omega',
  infty: '\\infty',
  oo: '\\infty',
  sup: '\\sup',
  inf: '\\inf',
  lim: '\\lim',
  limsup: '\\limsup',
  liminf: '\\liminf',
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
  land: '\\land',
  lor: '\\lor',
  neg: '\\neg',
  lnot: '\\neg',
  vdash: '\\vdash',
  le: '\\le',
  leq: '\\le',
  ge: '\\ge',
  geq: '\\ge',
  ne: '\\ne',
  neq: '\\ne',
  approx: '\\approx',
  equiv: '\\equiv',
  sim: '\\sim',
  pm: '\\pm',
  cdot: '\\cdot',
  times: '\\times',
  div: '\\div',
  to: '\\to',
  implies: '\\implies',
  Rightarrow: '\\Rightarrow',
  iff: '\\iff',
  Leftrightarrow: '\\Leftrightarrow',
  partial: '\\partial',
  nabla: '\\nabla',
  propto: '\\propto',
  eq: '\\rightleftharpoons',
  rightleftharpoons: '\\rightleftharpoons',
  deg: '^{\\circ}',
  dplus: '\\delta^{+}',
  dminus: '\\delta^{-}',
  sigmastar: '\\sigma^{*}',
  pistar: '\\pi^{*}',
  xbar: '\\bar{x}',
  limop: '\\lim',
  lima: '\\lim_{x \\to a}',
  limn: '\\lim_{n \\to +\\infty}',
  limminf: '\\lim_{x \\to -\\infty}',
  suminf: '\\sum_{n=1}^{\\infty}',
  intab: '\\int_{a}^{b}',
  intinf: '\\int_{1}^{+\\infty}',
  sq: '^{2}',
  cube: '^{3}',
  inv: '^{-1}',
  derivn: '^{(n)}',
  prime: "'",
  dprime: "''",
  minus: '-',
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
  'lim',
  'limsup',
  'liminf',
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
  Theta: '\\Theta',
  lambda: '\\lambda',
  mu: '\\mu',
  nu: '\\nu',
  rho: '\\rho',
  tau: '\\tau',
  omega: '\\omega',
  Omega: '\\Omega',
  phi: '\\varphi',
  Phi: '\\Phi',
  chi: '\\chi',
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

export function readBalancedGroup(
  src: string,
  startIndex: number,
  openChar: '{' | '(' | '[',
  closeChar: '}' | ')' | ']',
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
  const compactBound = (s: string) => {
    const compiled = compileMathExpression(s).replace(/\s*=\s*/g, '=');
    return compiled || '\\square';
  };
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
  if (!compiledBody) return '\\square';
  return compiledBody.replace(/(?:^|\s+)\b(d[a-zA-Z])\s*$/, (_m, diff: string) =>
    compiledBody.trim() === diff ? `\\square \\, ${diff}` : ` \\, ${diff}`,
  );
}

function exprOrPlaceholder(raw: string): string {
  const compiled = compileMathExpression(raw);
  return compiled || '\\square';
}

function formatOneSidedLimitTarget(baseRaw: string, sign: string): string {
  const baseLatex = compileMathExpression(baseRaw) || '\\square';
  const needsParens =
    baseLatex.startsWith('\\frac') ||
    (baseRaw.trim().length > 1 && /[+\-*/]/.test(baseRaw.trim().slice(1)));
  return needsParens ? `\\left(${baseLatex}\\right)^{${sign}}` : `${baseLatex}^{${sign}}`;
}

export function compileLimitBound(rawBound: string): string {
  const trimmed = rawBound.trim().replace(/⁺/g, '^+').replace(/⁻/g, '^-');
  if (!trimmed) return 'x \\to \\square';

  const arrowMatch = /^(.*?)(?:->|\\to|→)(.*)$/.exec(trimmed);
  if (arrowMatch) {
    const lhs = compileMathExpression((arrowMatch[1] ?? '').trim() || 'x') || 'x';
    const rhsRaw = (arrowMatch[2] ?? '')
      .trim()
      .replace(/(?<!\\)\b(?:inf|oo)\b/g, '\\infty');
    if (!rhsRaw) return `${lhs} \\to \\square`;
    if (rhsRaw === '+' || rhsRaw === '-') return `${lhs} \\to ${rhsRaw}\\square`;

    // Explicit `a^+`, `0^-`, `a^(+)`, `a^{+}`
    const explicitOneSided = /^(.+?)\^\s*(?:\(\s*([+-])\s*\)|\{\s*([+-])\s*\}|([+-]))$/.exec(
      rhsRaw,
    );
    if (explicitOneSided?.[1]) {
      const sign = explicitOneSided[2] ?? explicitOneSided[3] ?? explicitOneSided[4] ?? '+';
      return `${lhs} \\to ${formatOneSidedLimitTarget(explicitOneSided[1], sign)}`;
    }

    // Keyboard-friendly `a+`, `a-`, `0+`, `0-`, `-1+`, `(pi/2)-`
    const trailingOneSided = /^(.+?)\s*([+-])$/.exec(rhsRaw);
    if (
      trailingOneSided?.[1] &&
      trailingOneSided[2] &&
      !/[+\-*/^_=<>]$/.test(trailingOneSided[1].trim())
    ) {
      return `${lhs} \\to ${formatOneSidedLimitTarget(trailingOneSided[1], trailingOneSided[2])}`;
    }

    return `${lhs} \\to ${compileMathExpression(rhsRaw) || '\\square'}`;
  }

  return compileMathExpression(trimmed);
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
    return `\\frac{${exprOrPlaceholder(args[0]!)}}{${exprOrPlaceholder(args[1]!)}}`;
  }
  if (cmdName === 'binom' && args.length >= 2) {
    return `\\binom{${exprOrPlaceholder(args[0]!)}}{${exprOrPlaceholder(args[1]!)}}`;
  }
  if (cmdName === 'sqrt' && args.length >= 1) {
    return `\\sqrt{${exprOrPlaceholder(args[0]!)}}`;
  }
  if (cmdName === 'root' && args.length >= 2) {
    return `\\sqrt[${exprOrPlaceholder(args[0]!)}]{${exprOrPlaceholder(args[1]!)}}`;
  }
  if (cmdName === 'abs' && args.length >= 1) {
    return `\\left|${exprOrPlaceholder(args[0]!)}\\right|`;
  }
  if (cmdName === 'floor' && args.length >= 1) {
    return `\\lfloor ${exprOrPlaceholder(args[0]!)} \\rfloor`;
  }
  if (cmdName === 'ceil' && args.length >= 1) {
    return `\\lceil ${exprOrPlaceholder(args[0]!)} \\rceil`;
  }
  if (cmdName === 'set' && args.length >= 1) {
    return `\\left\\{${exprOrPlaceholder(args[0]!)}\\right\\}`;
  }
  if ((cmdName === 'vec' || cmdName === 'bar' || cmdName === 'hat') && args.length >= 1) {
    return `\\${cmdName}{${exprOrPlaceholder(args[0]!)}}`;
  }
  if (cmdName === 'ddx' && args.length >= 1) {
    return `\\frac{d}{dx}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'd2dx2' && args.length >= 1) {
    return `\\frac{d^2}{dx^2}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'ddt' && args.length >= 1) {
    return `\\frac{d}{dt}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'pdx' && args.length >= 1) {
    return `\\frac{\\partial}{\\partial x}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'eval' && args.length >= 2) {
    const bounds = splitRangeBound(args[1]!);
    const expr = exprOrPlaceholder(args[0]!);
    return bounds.upper !== undefined
      ? `\\left.${expr}\\right|_{${bounds.lower}}^{${bounds.upper}}`
      : `\\left.${expr}\\right|_{${bounds.lower}}`;
  }
  if (cmdName === 'loga' && args.length >= 2) {
    return `\\log_{${exprOrPlaceholder(args[0]!)}}\\left(${exprOrPlaceholder(args[1]!)}\\right)`;
  }
  if (cmdName === 'log2' && args.length >= 1) {
    return `\\log_{2}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'P' && args.length >= 1) {
    return `\\mathbb{P}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'Pcond' && args.length >= 2) {
    return `\\mathbb{P}\\left(${exprOrPlaceholder(args[0]!)} \\mid ${exprOrPlaceholder(args[1]!)}\\right)`;
  }
  if (cmdName === 'E' && args.length >= 1) {
    return `\\mathbb{E}\\left[${exprOrPlaceholder(args[0]!)}\\right]`;
  }
  if (cmdName === 'Var' && args.length >= 1) {
    return `\\operatorname{Var}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if (cmdName === 'Phi' && args.length >= 1) {
    return `\\Phi\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if ((cmdName === 'O' || cmdName === 'Theta' || cmdName === 'Omega') && args.length >= 1) {
    const head = cmdName === 'O' ? 'O' : `\\${cmdName}`;
    return `${head}\\left(${exprOrPlaceholder(args[0]!)}\\right)`;
  }
  if ((cmdName === 'xto' || cmdName === 'xrightarrow') && args.length >= 1) {
    return `\\xrightarrow{${exprOrPlaceholder(args[0]!)}}`;
  }
  if (cmdName === 'iso' && args.length >= 3) {
    return `{}_{${exprOrPlaceholder(args[1]!)} }^{${exprOrPlaceholder(args[0]!)} }\\text{${args[2]!.trim() || 'X'}}`;
  }
  if (cmdName === 'cases' && args.length >= 1) {
    const rows = args[0]!
      .split(';')
      .map(part => exprOrPlaceholder(part))
      .join(' \\\\ ');
    return `\\begin{cases} ${rows} \\end{cases}`;
  }
  if (PAREN_WRAPPED_FUNCTIONS.has(cmdName) && args.length === 1) {
    const inner = compileMathExpression(args[0]!);
    if (!inner) return `\\${cmdName}(\\square)`;
    return inner.includes('\\frac')
      ? `\\${cmdName}\\left(${inner}\\right)`
      : `\\${cmdName}(${inner})`;
  }
  if ((cmdName === 'sum' || cmdName === 'prod') && args.length >= 1) {
    const op = `\\${cmdName}`;
    if (args.length >= 2) {
      const bounds = splitRangeBound(args[0]!);
      const body = compileMathExpression(args[1]!);
      const suffix = body ? ` ${body}` : '';
      return bounds.upper !== undefined
        ? `${op}_{${bounds.lower}}^{${bounds.upper}}${suffix}`
        : `${op}_{${bounds.lower}}${suffix}`;
    }
    return `${op} ${exprOrPlaceholder(args[0]!)}`;
  }
  if ((cmdName === 'lim' || cmdName === 'limsup' || cmdName === 'liminf') && args.length >= 1) {
    const op = `\\${cmdName}`;
    if (args.length >= 2) {
      const bound = compileLimitBound(args[0]!);
      const body = compileMathExpression(args[1]!);
      return `${op}_{${bound}} ${body || '\\square'}`;
    }
    const single = compileLimitBound(args[0]!);
    return single.includes('\\to') ? `${op}_{${single}}` : `${op} ${single}`;
  }
  if (cmdName === 'lima' && args.length >= 1) {
    return `\\lim_{x \\to a} ${exprOrPlaceholder(args[0]!)}`;
  }
  if (cmdName === 'limn' && args.length >= 1) {
    return `\\lim_{n \\to +\\infty} ${exprOrPlaceholder(args[0]!)}`;
  }
  if (cmdName === 'limminf' && args.length >= 1) {
    return `\\lim_{x \\to -\\infty} ${exprOrPlaceholder(args[0]!)}`;
  }
  if (cmdName === 'suminf' && args.length >= 1) {
    return `\\sum_{n=1}^{\\infty} ${exprOrPlaceholder(args[0]!)}`;
  }
  if (cmdName === 'intab' && args.length >= 1) {
    return `\\int_{a}^{b} ${formatIntegralBody(compileMathExpression(args[0]!))}`;
  }
  if (cmdName === 'intinf' && args.length >= 1) {
    return `\\int_{1}^{+\\infty} ${formatIntegralBody(compileMathExpression(args[0]!))}`;
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
      const cmdMatch = /^\\([a-zA-Z0-9]+)/.exec(src.slice(idx));
      if (cmdMatch?.[1]) {
        const cmdName = cmdMatch[1];
        idx += 1 + cmdName.length;
        let trailingStar = false;
        if (src[idx] === '*' && /^[NZQRC]$/.test(cmdName)) {
          trailingStar = true;
          idx += 1;
        }
        const args: string[] = [];
        const maxArgs = cmdName === 'iso' ? 3 : 2;
        while (src[idx] === '{' && args.length < maxArgs) {
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

      if (/^[NZQRC]$/.test(word) && (src[idx] === '*' || ((src[idx] === '+' || src[idx] === '-') && !/[a-zA-Z0-9\\(]/.test(src[idx + 1] ?? '')))) {
        const sup = src[idx]!;
        idx += 1;
        const setStar = `\\mathbb{${word}}^{${sup}}`;
        pieces.push({ kind: 'atom', latex: setStar, unwrappedLatex: setStar });
        continue;
      }
      if (word === 'log' && src[idx] === '2' && src[idx + 1] === '(') {
        const grp = readBalancedGroup(src, idx + 1, '(', ')');
        if (grp) {
          idx = grp.nextIndex;
          const s = `\\log_{2}\\left(${exprOrPlaceholder(grp.content)}\\right)`;
          pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
          continue;
        }
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
            const s = `\\sqrt{${exprOrPlaceholder(grp.content)}}`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
          if (word === 'abs') {
            const s = `\\left|${exprOrPlaceholder(grp.content)}\\right|`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
          if (word === 'set') {
            const s = `\\left\\{${exprOrPlaceholder(grp.content)}\\right\\}`;
            pieces.push({ kind: 'atom', latex: s, unwrappedLatex: s });
            continue;
          }
          if (word === 'root') {
            const commaIdx = grp.content.indexOf(',');
            const deg = commaIdx >= 0 ? grp.content.slice(0, commaIdx) : 'n';
            const rad = commaIdx >= 0 ? grp.content.slice(commaIdx + 1) : grp.content;
            const s = `\\sqrt[${exprOrPlaceholder(deg)}]{${exprOrPlaceholder(rad)}}`;
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
            prevOp.latex === '=' ||
            prevOp.latex === '..') &&
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
      if (
        cur.latex === '^' &&
        rhs.kind === 'op' &&
        (rhs.latex === '-' || rhs.latex === '+') &&
        pIdx + 2 < pieces.length &&
        pieces[pIdx + 2]!.kind === 'atom'
      ) {
        const nextAtom = pieces[pIdx + 2]!;
        rhs = {
          kind: 'atom',
          latex: `${rhs.latex}${nextAtom.unwrappedLatex}`,
          unwrappedLatex: `${rhs.latex}${nextAtom.unwrappedLatex}`,
        };
        advance = 3;
      } else if (
        cur.latex === '^' &&
        rhs.kind === 'atom' &&
        /^\d+$/.test(rhs.latex) &&
        pIdx + 2 < pieces.length &&
        pieces[pIdx + 2]!.kind === 'op' &&
        (pieces[pIdx + 2]!.latex === '+' || pieces[pIdx + 2]!.latex === '-') &&
        (pIdx + 3 >= pieces.length || pieces[pIdx + 3]!.kind === 'op')
      ) {
        const sign = pieces[pIdx + 2]!.latex;
        rhs = {
          kind: 'atom',
          latex: `${rhs.latex}${sign}`,
          unwrappedLatex: `${rhs.latex}${sign}`,
        };
        advance = 3;
      } else if (cur.latex === '^' && rhs.latex === 'o') {
        rhs = { kind: 'atom', latex: '\\circ', unwrappedLatex: '\\circ' };
      }
      const rhsBody = rhs.unwrappedLatex || '\\square';
      const combined = `${base.latex}${cur.latex}{${rhsBody}}`;
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
      const frac = `\\frac{${num.unwrappedLatex || '\\square'}}{${den.unwrappedLatex || '\\square'}}`;
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

const KNOWN_PARAMETRIC_COMMANDS: ReadonlySet<string> = new Set([
  'frac',
  'sqrt',
  'root',
  'sum',
  'prod',
  'lim',
  'limsup',
  'liminf',
  'int',
  'abs',
  'floor',
  'ceil',
  'vec',
  'bar',
  'hat',
  'set',
  'binom',
  'ddx',
  'd2dx2',
  'ddt',
  'pdx',
  'eval',
  'loga',
  'log2',
  'P',
  'Pcond',
  'E',
  'Var',
  'Phi',
  'O',
  'Theta',
  'Omega',
  'xto',
  'xrightarrow',
  'iso',
  'cases',
  'lima',
  'limn',
  'limminf',
  'suminf',
  'intab',
  'intinf',
]);

const CUSTOM_STANDALONE_IN_MATH: ReadonlySet<string> = new Set([
  'N',
  'Z',
  'Q',
  'R',
  'C',
  'eps',
  'oo',
  'chisq',
  'eq',
  'deg',
  'dplus',
  'dminus',
  'sigmastar',
  'pistar',
  'xbar',
  'limop',
  'lima',
  'limn',
  'limminf',
  'suminf',
  'intab',
  'intinf',
  'sq',
  'cube',
  'inv',
  'derivn',
  'prime',
  'dprime',
  'minus',
]);

const CUSTOM_PARAMETRIC_IN_MATH: ReadonlySet<string> = new Set([
  'root',
  'sum',
  'prod',
  'lim',
  'limsup',
  'liminf',
  'int',
  'abs',
  'floor',
  'ceil',
  'set',
  'ddx',
  'd2dx2',
  'ddt',
  'pdx',
  'eval',
  'loga',
  'log2',
  'P',
  'Pcond',
  'E',
  'Var',
  'O',
  'Theta',
  'Omega',
  'xto',
  'iso',
  'cases',
  'lima',
  'limn',
  'limminf',
  'suminf',
  'intab',
  'intinf',
]);

/**
 * Expands custom website shorthand commands (e.g. `\{1/3}`, `\root{3}{1+u}`, `\lim{u->0}`, `\N*`, `\eps`)
 * that a student may have typed inside an existing `$...$` or `$$...$$` LaTeX span, while leaving
 * standard LaTeX (`\frac`, `\sqrt[3]{...}`, `\lim_{u \to 0}`, `\begin{cases}`, `1/2`) untouched.
 */
export function expandCustomShorthandsInLatexMath(latexBody: string): string {
  if (!latexBody || !latexBody.includes('\\')) return latexBody;

  let out = '';
  let idx = 0;
  const len = latexBody.length;

  while (idx < len) {
    if (latexBody[idx] === '\\' && latexBody[idx + 1] === '{') {
      const grp = readBalancedGroup(latexBody, idx + 1, '{', '}');
      if (grp && grp.content.trim().length > 0) {
        out += compileMathExpression(grp.content);
        idx = grp.nextIndex;
        continue;
      }
    }

    if (latexBody[idx] === '\\') {
      const cmdMatch = /^\\([a-zA-Z0-9]+)/.exec(latexBody.slice(idx));
      if (cmdMatch?.[1]) {
        const cmdName = cmdMatch[1];
        let cursor = idx + 1 + cmdName.length;
        let trailingStar = false;
        if (latexBody[cursor] === '*' && /^[NZQRC]$/.test(cmdName)) {
          trailingStar = true;
          cursor += 1;
        }

        // Standard LaTeX `\lim_{...}`, `\sum_{...}`, `\int_{...}`, `\frac{a}{b}` -> keep head, recurse inside `{...}` groups!
        if (CUSTOM_PARAMETRIC_IN_MATH.has(cmdName) && latexBody[cursor] === '{') {
          const args: string[] = [];
          const maxArgs = cmdName === 'iso' ? 3 : 2;
          while (latexBody[cursor] === '{' && args.length < maxArgs) {
            const grp = readBalancedGroup(latexBody, cursor, '{', '}');
            if (!grp) break;
            args.push(grp.content);
            cursor = grp.nextIndex;
          }
          if (args.length > 0) {
            out += compileCommandInvocation(cmdName, args, trailingStar);
            idx = cursor;
            continue;
          }
        }

        if (CUSTOM_STANDALONE_IN_MATH.has(cmdName) && latexBody[cursor] !== '{') {
          const mapped = compileCommandInvocation(cmdName, [], trailingStar);
          const needsTrailingSpace = /^[a-zA-Z0-9]/.test(latexBody[cursor] ?? '');
          out += needsTrailingSpace ? `${mapped} ` : mapped;
          idx = cursor;
          continue;
        }

        // Otherwise keep standard LaTeX command (`\frac`, `\sqrt`, `\begin`, `\left`, ...) and recursively process its `{...}` groups
        out += latexBody.slice(idx, cursor);
        idx = cursor;
        continue;
      }
    }

    if (latexBody[idx] === '{') {
      const grp = readBalancedGroup(latexBody, idx, '{', '}');
      if (grp) {
        out += `{${expandCustomShorthandsInLatexMath(grp.content)}}`;
        idx = grp.nextIndex;
        continue;
      }
    }

    out += latexBody[idx];
    idx += 1;
  }

  return out;
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
      const cmdMatch = /^\\([a-zA-Z0-9]+)/.exec(markdown.slice(idx));
      if (cmdMatch?.[1]) {
        const cmdName = cmdMatch[1];
        let cursor = idx + 1 + cmdName.length;
        let trailingStar = false;
        let trailingSetSign: '*' | '+' | '-' | null = null;
        if (
          /^[NZQRC]$/.test(cmdName) &&
          (markdown[cursor] === '*' ||
            ((markdown[cursor] === '+' || markdown[cursor] === '-') &&
              !/[a-zA-Z0-9\\(]/.test(markdown[cursor + 1] ?? '')))
        ) {
          trailingSetSign = markdown[cursor] as '*' | '+' | '-';
          trailingStar = trailingSetSign === '*';
          cursor += 1;
        }

        // Also support standard LaTeX subscript/superscript directly after `\lim_{...}`, `\sum_{...}^{...}`, `\int_{...}^{...}`
        if (markdown[cursor] === '_' || markdown[cursor] === '^') {
          let subSupLatex = '';
          while (markdown[cursor] === '_' || markdown[cursor] === '^') {
            const op = markdown[cursor]!;
            cursor += 1;
            if (markdown[cursor] === '{') {
              const grp = readBalancedGroup(markdown, cursor, '{', '}');
              if (!grp) break;
              const inner = op === '_' && (cmdName === 'lim' || cmdName === 'limsup' || cmdName === 'liminf')
                ? compileLimitBound(grp.content)
                : exprOrPlaceholder(grp.content);
              subSupLatex += `${op}{${inner}}`;
              cursor = grp.nextIndex;
            } else if (markdown[cursor] === '(') {
              const grp = readBalancedGroup(markdown, cursor, '(', ')');
              if (!grp) break;
              subSupLatex += `${op}{${exprOrPlaceholder(grp.content)}}`;
              cursor = grp.nextIndex;
            } else {
              const atom = /^[a-zA-Z0-9+-]+/.exec(markdown.slice(cursor));
              if (!atom?.[0]) break;
              subSupLatex += `${op}{${atom[0]}}`;
              cursor += atom[0].length;
            }
          }
          const head = STANDALONE_SYMBOLS[cmdName] ?? `\\${cmdName}`;
          result += `$${head}${subSupLatex}$`;
          idx = cursor;
          continue;
        }

        const args: string[] = [];
        const maxArgs = cmdName === 'iso' ? 3 : 2;
        while (markdown[cursor] === '{' && args.length < maxArgs) {
          const grp = readBalancedGroup(markdown, cursor, '{', '}');
          if (!grp) break;
          args.push(grp.content);
          cursor = grp.nextIndex;
        }

        const isKnownCommand =
          args.length > 0 ||
          cmdName in STANDALONE_SYMBOLS ||
          KNOWN_PARAMETRIC_COMMANDS.has(cmdName);

        if (isKnownCommand) {
          const compiled =
            trailingSetSign && trailingSetSign !== '*' && args.length === 0
              ? `\\mathbb{${cmdName}}^{${trailingSetSign}}`
              : compileCommandInvocation(cmdName, args, trailingStar);
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

const UNICODE_MATH_CUE_RE =
  /[∑∏∫√∞≈≠≤≥±×÷·⇌∀∃∈∉⊂⊆∪∩∅∧∨¬⊢∇∝ℙ𝔼Φχ²³ⁿ⁻¹⁺⁻₀₁₂₃₄₅₆₇₈₉⌊⌋⌈⌉→⇒⇔⃗]|(?:\blim_|\broot\(|\blog_[a-zA-Z0-9]|\bd\/d[xt]\b|\b[OΘΩ]\([^)\n]+\)|[a-zA-Z0-9)\]]\s*[\^_]\s*[({a-zA-Z0-9+-]|\([^()\n]+\)\s*\/\s*\([^()\n]+\)|<=|>=|!=|=>|<=>|->)/;

export function shouldAutoShowMathPreview(text: string, _mode?: MathSymbolInsertMode): boolean {
  if (!text || !text.trim()) return false;
  if (text.includes('$') || /\\(?:\{|\}|[a-zA-Z]+)/.test(text)) return true;
  return UNICODE_MATH_CUE_RE.test(text);
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
  const match = /(?:^|[\s([{+$=<>,-])\\([a-zA-Z0-9*+-]{0,16})$/.exec(before);
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
  return entry.mathlibTrigger;
}

/**
 * - When `query === ""` (user just typed `\`): returns the complete A -> Z alphabetical list!
 * - When `query !== ""` (e.g. `\si`, `\lim`): ranks nearest matches (exact -> prefix -> alias -> substring -> subsequence -> fuzzy Levenshtein <= 2).
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
    const mTrig = entry.mathlibTrigger.replace(/^\\/, '').toLowerCase();
    const key = entry.sortKey.toLowerCase();

    if (key === clean || trig === clean || mTrig === clean) {
      scored.push({ entry, tier: 0, tieBreaker: key.length });
      continue;
    }
    if (key.startsWith(clean) || trig.startsWith(clean) || mTrig.startsWith(clean)) {
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
      mTrig.includes(clean) ||
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
