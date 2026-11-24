import type { Che1080BankExercise, Che1080Difficulty } from '../../domain/che1080-bank';
import { normalizeVietnamese } from '../courses/search';
import { parseNumericInput } from './essay-engine';

export const DIFFICULTY_ORDER: readonly Che1080Difficulty[] = ['basic', 'standard', 'advanced'];

export interface DifficultyMeta {
  readonly id: Che1080Difficulty;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
}

export const DIFFICULTY_META: Readonly<Record<Che1080Difficulty, DifficultyMeta>> = {
  basic: {
    id: 'basic',
    label: 'Cơ bản',
    shortLabel: 'Cơ bản',
    description: 'Áp dụng trực tiếp công thức và khái niệm nền tảng.',
  },
  standard: {
    id: 'standard',
    label: 'Chuẩn đề',
    shortLabel: 'Chuẩn đề',
    description: 'Mức độ đề thi chuẩn HUS, nhiều bước tính toán hoặc biện luận.',
  },
  advanced: {
    id: 'advanced',
    label: 'Nâng cao',
    shortLabel: 'Nâng cao',
    description: 'Bài toán tổng hợp nhiều ý, suy luận ngược hoặc điều kiện biên.',
  },
};

export interface FeaturedByDifficultyResult {
  readonly featured: readonly Che1080BankExercise[];
  readonly remaining: readonly Che1080BankExercise[];
}

export interface ChapterFeaturedGroup {
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  readonly featured: readonly Che1080BankExercise[];
  readonly practiceCount: number;
}

export interface FeaturedAcrossChaptersResult {
  readonly featuredIds: ReadonlySet<string>;
  readonly byChapter: readonly ChapterFeaturedGroup[];
  readonly practiceBank: readonly Che1080BankExercise[];
}

export interface PracticeExerciseFilters {
  readonly query?: string;
  readonly chapterNumber?: number | 'all';
  readonly difficulty?: Che1080Difficulty | 'all';
  readonly onlyRecent?: boolean;
  readonly excludeIds?: ReadonlySet<string>;
}

export interface AnswerCheckResult {
  readonly ok: boolean;
  readonly matchedValue?: number;
  readonly message: string;
}

/**
 * Selects at most 1 representative exercise per difficulty level (`basic`,
 * `standard`, `advanced`), preferring `isRecent: true` (đề từ 2020) for each
 * tier. All other exercises in the scope are returned in `remaining` in their
 * original order so `featured.length + remaining.length === scoped.length`.
 */
export function selectFeaturedByDifficulty(
  exercises: readonly Che1080BankExercise[],
  chapterNumber?: number,
): FeaturedByDifficultyResult {
  const scoped =
    chapterNumber === undefined
      ? exercises
      : exercises.filter(exercise => exercise.chapterNumber === chapterNumber);

  const featured: Che1080BankExercise[] = [];
  const featuredIds = new Set<string>();

  for (const difficulty of DIFFICULTY_ORDER) {
    const candidates = scoped.filter(exercise => exercise.difficulty === difficulty);
    if (candidates.length === 0) continue;

    const preferred = candidates.find(exercise => exercise.isRecent) ?? candidates[0];
    if (preferred) {
      featured.push(preferred);
      featuredIds.add(preferred.id);
    }
  }

  const remaining = scoped.filter(exercise => !featuredIds.has(exercise.id));
  return { featured, remaining };
}

/**
 * Groups exercises by `chapterNumber` (sorted ascending) and picks at most 1
 * featured exercise per difficulty level for each chapter, returning the
 * combined `featuredIds`, per-chapter groups, and the remaining `practiceBank`.
 */
export function selectFeaturedAcrossChapters(
  exercises: readonly Che1080BankExercise[],
): FeaturedAcrossChaptersResult {
  const grouped = new Map<number, Che1080BankExercise[]>();
  for (const exercise of exercises) {
    const bucket = grouped.get(exercise.chapterNumber);
    if (bucket) {
      bucket.push(exercise);
    } else {
      grouped.set(exercise.chapterNumber, [exercise]);
    }
  }

  const sortedChapters = [...grouped.keys()].sort((a, b) => a - b);
  const featuredIds = new Set<string>();
  const byChapter: ChapterFeaturedGroup[] = [];

  for (const chapterNumber of sortedChapters) {
    const chapterExercises = grouped.get(chapterNumber) ?? [];
    const { featured, remaining } = selectFeaturedByDifficulty(chapterExercises);
    for (const item of featured) {
      featuredIds.add(item.id);
    }
    byChapter.push({
      chapterNumber,
      chapterTitle: chapterExercises[0]?.chapterTitle ?? `Chương ${chapterNumber}`,
      featured,
      practiceCount: remaining.length,
    });
  }

  const practiceBank = exercises.filter(exercise => !featuredIds.has(exercise.id));
  return { featuredIds, byChapter, practiceBank };
}

/**
 * Filters practice bank exercises using accent-insensitive Vietnamese search
 * across code, prompt, formTitle, subTypeTitle, chapterTitle, and finalAnswer.
 */
export function filterPracticeExercises(
  exercises: readonly Che1080BankExercise[],
  filters: PracticeExerciseFilters,
): readonly Che1080BankExercise[] {
  const normalizedQuery = normalizeVietnamese(filters.query ?? '');

  return exercises.filter(exercise => {
    if (filters.excludeIds?.has(exercise.id)) {
      return false;
    }
    if (
      filters.chapterNumber !== undefined &&
      filters.chapterNumber !== 'all' &&
      exercise.chapterNumber !== filters.chapterNumber
    ) {
      return false;
    }
    if (
      filters.difficulty !== undefined &&
      filters.difficulty !== 'all' &&
      exercise.difficulty !== filters.difficulty
    ) {
      return false;
    }
    if (filters.onlyRecent && !exercise.isRecent) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const searchableFields = [
      exercise.code,
      exercise.prompt,
      exercise.formTitle,
      exercise.subTypeTitle,
      exercise.chapterTitle,
      exercise.finalAnswer,
    ];

    return searchableFields.some(field => normalizeVietnamese(field).includes(normalizedQuery));
  });
}

const SUPERSCRIPT_MAP: Readonly<Record<string, string>> = {
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
};

function decodeSuperscripts(raw: string): string {
  return raw
    .split('')
    .map(ch => SUPERSCRIPT_MAP[ch] ?? ch)
    .join('');
}

function normalizeMathText(raw: string): string {
  return raw
    .replaceAll('\u2212', '-')
    .replaceAll('{,}', '.')
    .replaceAll('{.}', '.');
}

const NUMERIC_TOKEN_PATTERN =
  /([+-]?\d+(?:[.,]\d+)?)\s*(?:[×*·]|\\times)\s*10\s*(?:\^\s*\{?\s*([+-]?\d+)\s*\}?|([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+))|([+-]?\d+(?:[.,]\d+)?)[eE]([+-]?\d+)|\b10\s*(?:\^\s*\{?\s*([+-]?\d+)\s*\}?|([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+))|([+-]?\d+(?:[.,]\d+)?)/g;

/**
 * Extracts numeric values from a formatted answer string, supporting
 * Vietnamese decimal commas, Unicode minus, and scientific notation.
 */
export function extractNumericTargets(text: string): readonly number[] {
  const normalized = normalizeMathText(text);
  const results: number[] = [];

  for (const match of normalized.matchAll(NUMERIC_TOKEN_PATTERN)) {
    const [, sciMantissa, sciExpAscii, sciExpSuper, eMantissa, eExp, powExpAscii, powExpSuper, plain] =
      match;

    let value: number | null = null;
    if (sciMantissa !== undefined) {
      const m = Number(sciMantissa.replace(',', '.'));
      const expStr = sciExpAscii ?? decodeSuperscripts(sciExpSuper ?? '');
      const exp = Number(expStr);
      if (Number.isFinite(m) && Number.isFinite(exp)) {
        value = Number(`${m}e${exp}`);
      }
    } else if (eMantissa !== undefined && eExp !== undefined) {
      const m = Number(eMantissa.replace(',', '.'));
      const exp = Number(eExp);
      if (Number.isFinite(m) && Number.isFinite(exp)) {
        value = Number(`${m}e${exp}`);
      }
    } else if (powExpAscii !== undefined || powExpSuper !== undefined) {
      const expStr = powExpAscii ?? decodeSuperscripts(powExpSuper ?? '');
      const exp = Number(expStr);
      if (Number.isFinite(exp)) {
        value = Number(`1e${exp}`);
      }
    } else if (plain !== undefined) {
      const parsed = Number(plain.replace(',', '.'));
      if (Number.isFinite(parsed)) {
        value = parsed;
      }
    }

    if (value !== null && Number.isFinite(value)) {
      results.push(value);
    }
  }

  return results;
}

function parseFlexibleUserNumber(rawInput: string): number | null {
  const cleaned = normalizeMathText(rawInput).trim();
  if (!cleaned) return null;

  const basic = parseNumericInput(cleaned);
  if (basic !== null) return basic;

  const extracted = extractNumericTargets(cleaned);
  if (extracted.length === 1 && extracted[0] !== undefined) {
    // Ensure the input doesn't contain unrelated extra numeric tokens
    const stripped = cleaned.replace(NUMERIC_TOKEN_PATTERN, '').trim();
    if (!/\d/.test(stripped)) {
      return extracted[0];
    }
  }
  return null;
}

function isWithinTolerance(value: number, target: number): boolean {
  const diff = Math.abs(value - target);
  if (target === 0) {
    return diff <= 0.05;
  }
  const absTarget = Math.abs(target);
  const relativeTol = absTarget * 0.025;
  // For tiny scientific-notation values (< 1e-3), apply pure 2.5% relative tolerance
  // so 0 does not falsely match constants like 1.6e-19.
  const tolerance = absTarget < 1e-3 ? relativeTol : Math.max(0.05, relativeTol);
  return diff <= tolerance;
}

/**
 * Evaluates a user's numeric input against all numeric values extracted from
 * `finalAnswer`, allowing 2.5% relative tolerance (or 0.05 absolute tolerance
 * for small ordinary numbers).
 */
export function checkAnswerAgainstFinal(rawInput: string, finalAnswer: string): AnswerCheckResult {
  const targets = extractNumericTargets(finalAnswer);
  if (targets.length === 0) {
    return {
      ok: false,
      message: 'Đáp án mẫu của bài này là dạng định tính, hãy đối chiếu trực tiếp với hướng giải.',
    };
  }

  const userValue = parseFlexibleUserNumber(rawInput);
  if (userValue === null) {
    return {
      ok: false,
      message: 'Vui lòng nhập một giá trị số hợp lệ (ví dụ: 617,5 hoặc 1,6e-19).',
    };
  }

  const matched = targets.find(target => isWithinTolerance(userValue, target));
  if (matched !== undefined) {
    return {
      ok: true,
      matchedValue: matched,
      message: `Chính xác! Giá trị ${rawInput.trim()} khớp với đáp án (${matched}).`,
    };
  }

  return {
    ok: false,
    message: 'Chưa khớp với đáp án mẫu (sai số cho phép ±2,5%). Hãy kiểm tra lại đơn vị và bước tính.',
  };
}
