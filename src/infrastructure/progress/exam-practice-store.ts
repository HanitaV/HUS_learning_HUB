import type { ExamAnswerMode, ExamQuestionSourceFilter } from '../../domain/chapter-exam';
import {
  parseChapterExamSessionJson,
  type KeyValueStorage,
  type StoredChapterExamSession,
} from './chapter-exam-store';

export interface StoredExamPracticeConfig {
  readonly version: 1;
  readonly courseId: string;
  readonly chapterScope: string;
  readonly answerMode: ExamAnswerMode;
  readonly questionSource: ExamQuestionSourceFilter;
}

const CONFIG_KEY = 'hus-learning-hub:exam-practice-config:v1';
const SESSION_PREFIX = 'hus-learning-hub:exam-practice-session:v1';

const VALID_ANSWER_MODES = new Set<ExamAnswerMode>(['written-all', 'mixed']);
const VALID_SOURCES = new Set<ExamQuestionSourceFilter>(['all-db', 'essay-only']);

function defaultStorage(): KeyValueStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sessionKey(
  courseId: string,
  chapterScope: string,
  questionSource: ExamQuestionSourceFilter,
  answerMode: ExamAnswerMode,
): string {
  return `${SESSION_PREFIX}:${courseId}:${chapterScope}:${questionSource}:${answerMode}`;
}

export function loadStoredExamPracticeConfig(
  storage: KeyValueStorage | null = defaultStorage(),
): StoredExamPracticeConfig | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CONFIG_KEY);
    if (!raw || raw.length > 4000) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    if (typeof parsed.courseId !== 'string' || !parsed.courseId.trim()) return null;
    if (typeof parsed.chapterScope !== 'string' || !parsed.chapterScope.trim()) return null;
    if (
      typeof parsed.answerMode !== 'string' ||
      !VALID_ANSWER_MODES.has(parsed.answerMode as ExamAnswerMode)
    ) {
      return null;
    }
    if (
      typeof parsed.questionSource !== 'string' ||
      !VALID_SOURCES.has(parsed.questionSource as ExamQuestionSourceFilter)
    ) {
      return null;
    }
    return {
      version: 1,
      courseId: parsed.courseId,
      chapterScope: parsed.chapterScope,
      answerMode: parsed.answerMode as ExamAnswerMode,
      questionSource: parsed.questionSource as ExamQuestionSourceFilter,
    };
  } catch {
    return null;
  }
}

export function saveStoredExamPracticeConfig(
  config: StoredExamPracticeConfig,
  storage: KeyValueStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function loadStoredExamPracticeSession(
  courseId: string,
  chapterScope: string,
  questionSource: ExamQuestionSourceFilter,
  answerMode: ExamAnswerMode,
  storage: KeyValueStorage | null = defaultStorage(),
): StoredChapterExamSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(sessionKey(courseId, chapterScope, questionSource, answerMode));
    if (!raw) return null;
    return parseChapterExamSessionJson(raw);
  } catch {
    return null;
  }
}

export function saveStoredExamPracticeSession(
  courseId: string,
  chapterScope: string,
  questionSource: ExamQuestionSourceFilter,
  answerMode: ExamAnswerMode,
  session: StoredChapterExamSession,
  storage: KeyValueStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      sessionKey(courseId, chapterScope, questionSource, answerMode),
      JSON.stringify(session),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredExamPracticeSession(
  courseId: string,
  chapterScope: string,
  questionSource: ExamQuestionSourceFilter,
  answerMode: ExamAnswerMode,
  storage: KeyValueStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(sessionKey(courseId, chapterScope, questionSource, answerMode));
  } catch {
    // Ignore storage errors gracefully
  }
}
