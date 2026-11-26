import type { ProgressState } from '../../domain/workspace';
import { parseProgress } from '../../core/learning/progress';
import { PROGRESS_KEY } from './store';

const MAX_ARCHIVE_BYTES = 5_000_000;
const MAX_KEY_COUNT = 2_000;
const MAX_VALUE_CHARS = 80_000;

const ALLOWED_KEY_PREFIXES = [
  'hus-learning-hub:written-draft:v1:',
  'hus-learning-hub:tutor-feedback:v1:',
  'hus-learning-hub:interactive-draft:v1:',
  'hus-learning-hub:semi-essay-steps:v1:',
  'hus-learning-hub:chapter-exam:v1:',
  'hus-learning-hub:exam-practice-session:v1:',
  'hus-learning-hub:exam-practice-config:v1',
  'hus-che1080-practice-solved:v1',
  'hus-code-lab:draft:v1:',
  'hus-code-lab:playground:v1:',
  'hus-code-lab:solved:v1',
] as const;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface StudyArchiveV2 {
  readonly schemaVersion: 2;
  readonly exportedAt: string;
  readonly progress: ProgressState;
  readonly studyEntries: Readonly<Record<string, string>>;
}

function isAllowedStudyKey(key: string): boolean {
  if (!key || key.length > 260 || FORBIDDEN_KEYS.has(key)) return false;
  return ALLOWED_KEY_PREFIXES.some(prefix =>
    prefix.endsWith(':') ? key.startsWith(prefix) : key === prefix,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Exports a version-2 study archive containing `hus-progress-v1` plus all local A4 drafts,
 * WebMCP/Gemini coaching cards & histories, interactive diagram drafts, exam sessions, and CodeLab drafts.
 */
export function exportFullStudyArchive(
  progress: ProgressState,
  nowIso?: string,
): StudyArchiveV2 {
  const studyEntries: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key || !isAllowedStudyKey(key)) continue;
        const val = window.localStorage.getItem(key);
        if (typeof val === 'string' && val.length <= MAX_VALUE_CHARS) {
          studyEntries[key] = val;
        }
      }
    } catch {
      // Ignore blocked storage gracefully
    }
  }

  return {
    schemaVersion: 2,
    exportedAt: nowIso ?? new Date().toISOString(),
    progress,
    studyEntries,
  };
}

/**
 * Restores either a standard v1 progress backup (`schemaVersion: 1`) or a full v2 study archive
 * (`schemaVersion: 2`), validating every key against an explicit allowlist before writing to `localStorage`.
 */
export function importStudyArchiveOrProgress(
  rawJson: string,
  restoreProgress: (progressJson: string) => void,
): { readonly version: 1 | 2; readonly restoredEntries: number } {
  if (rawJson.length > MAX_ARCHIVE_BYTES) {
    throw new Error('Bản sao lưu quá lớn (tối đa 5 MB).');
  }
  const parsed: unknown = JSON.parse(rawJson);
  if (!isRecord(parsed)) {
    throw new Error('Bản sao lưu không đúng cấu trúc JSON.');
  }

  if (parsed.schemaVersion === 1) {
    restoreProgress(rawJson);
    return { version: 1, restoredEntries: 0 };
  }

  if (parsed.schemaVersion !== 2) {
    throw new Error('Dữ liệu bản sao lưu không hợp lệ hoặc phiên bản chưa được hỗ trợ.');
  }

  if (!isRecord(parsed.progress) || !isRecord(parsed.studyEntries)) {
    throw new Error('Bản sao lưu đầy đủ (v2) thiếu mục `progress` hoặc `studyEntries`.');
  }

  const normalizedProgressJson = JSON.stringify(parsed.progress);
  parseProgress(normalizedProgressJson);

  const entries = Object.entries(parsed.studyEntries);
  if (entries.length > MAX_KEY_COUNT) {
    throw new Error('Số lượng bản ghi trong bản sao lưu vượt quá giới hạn an toàn.');
  }

  const safeEntries: [string, string][] = [];
  for (const [key, val] of entries) {
    if (!isAllowedStudyKey(key)) continue;
    if (typeof val !== 'string' || val.length > MAX_VALUE_CHARS) continue;
    safeEntries.push([key, val]);
  }

  restoreProgress(normalizedProgressJson);

  let restoredEntries = 0;
  if (typeof window !== 'undefined') {
    try {
      for (const [key, val] of safeEntries) {
        if (key === PROGRESS_KEY) continue;
        window.localStorage.setItem(key, val);
        restoredEntries += 1;
      }
    } catch {
      // Progress was restored even if extra storage quota was exceeded
    }
  }

  return { version: 2, restoredEntries };
}
