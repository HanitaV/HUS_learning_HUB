import type { ChapterExamDraft, ChapterExamLengthPreset } from '../../domain/chapter-exam';

export interface StoredChapterExamSession {
  readonly version: 1;
  readonly preset: ChapterExamLengthPreset;
  readonly customCount?: number | undefined;
  readonly seed: number;
  readonly submitted: boolean;
  readonly draft: ChapterExamDraft;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY_PREFIX = 'hus-learning-hub:chapter-exam:v1';
const MAX_TEXT_LENGTH = 20000;
const VALID_PRESETS = new Set<ChapterExamLengthPreset>(['short', 'standard', 'comprehensive']);

function sessionKey(courseId: string, chapterId: string): string {
  return `${KEY_PREFIX}:${courseId}:${chapterId}`;
}

function defaultBrowserStorage(): KeyValueStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseChapterExamSessionJson(raw: string): StoredChapterExamSession | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed) || parsed.version !== 1) return null;
    if (typeof parsed.preset !== 'string' || !VALID_PRESETS.has(parsed.preset as ChapterExamLengthPreset)) {
      return null;
    }
    if (
      parsed.customCount !== undefined &&
      (typeof parsed.customCount !== 'number' ||
        !Number.isInteger(parsed.customCount) ||
        parsed.customCount < 1 ||
        parsed.customCount > 10)
    ) {
      return null;
    }
    if (typeof parsed.seed !== 'number' || !Number.isFinite(parsed.seed)) return null;
    if (typeof parsed.submitted !== 'boolean') return null;
    if (!isPlainRecord(parsed.draft)) return null;

    const rawObj = parsed.draft.objectiveAnswers;
    const rawWritten = parsed.draft.writtenResponses;
    const rawRubric = parsed.draft.checkedRubricIds;
    if (!isPlainRecord(rawObj) || !isPlainRecord(rawWritten) || !isPlainRecord(rawRubric)) {
      return null;
    }

    const objectiveAnswers: Record<string, string | readonly string[]> = {};
    for (const [key, val] of Object.entries(rawObj)) {
      if (typeof val === 'string' && val.length <= MAX_TEXT_LENGTH) {
        objectiveAnswers[key] = val;
      } else if (
        Array.isArray(val) &&
        val.length <= 20 &&
        val.every(item => typeof item === 'string' && item.length <= 200)
      ) {
        objectiveAnswers[key] = val as readonly string[];
      } else {
        return null;
      }
    }

    const writtenResponses: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawWritten)) {
      if (typeof val !== 'string' || val.length > MAX_TEXT_LENGTH) return null;
      writtenResponses[key] = val;
    }

    const checkedRubricIds: Record<string, readonly string[]> = {};
    for (const [key, val] of Object.entries(rawRubric)) {
      if (
        !Array.isArray(val) ||
        val.length > 30 ||
        !val.every(item => typeof item === 'string' && item.length <= 200)
      ) {
        return null;
      }
      checkedRubricIds[key] = val as readonly string[];
    }

    return {
      version: 1,
      preset: parsed.preset as ChapterExamLengthPreset,
      ...(parsed.customCount !== undefined ? { customCount: parsed.customCount } : {}),
      seed: parsed.seed,
      submitted: parsed.submitted,
      draft: {
        objectiveAnswers,
        writtenResponses,
        checkedRubricIds,
      },
    };
  } catch {
    return null;
  }
}

export function loadStoredChapterExamSession(
  courseId: string,
  chapterId: string,
  storage: KeyValueStorage | null = defaultBrowserStorage(),
): StoredChapterExamSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(sessionKey(courseId, chapterId));
    if (!raw) return null;
    return parseChapterExamSessionJson(raw);
  } catch {
    return null;
  }
}

export function saveStoredChapterExamSession(
  courseId: string,
  chapterId: string,
  session: StoredChapterExamSession,
  storage: KeyValueStorage | null = defaultBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(sessionKey(courseId, chapterId), JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredChapterExamSession(
  courseId: string,
  chapterId: string,
  storage: KeyValueStorage | null = defaultBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(sessionKey(courseId, chapterId));
  } catch {
    // Ignore blocked storage
  }
}
