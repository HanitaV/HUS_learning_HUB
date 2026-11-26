import type { CoachingHistoryEntry, RevisionDiffContext } from '../../domain/curriculum-tutor';
import { convertStudentShorthandToLatex } from './realtime-math-preview';

const MAX_DELTA_CHARS = 500;

function normalizeDraftLines(raw: string): readonly string[] {
  return convertStudentShorthandToLatex(raw)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Summarizes line-level additions/updates between a previously coached draft and the current draft
 * so Gemini can recognize progress and focus only on remaining gaps.
 */
export function summarizeDraftDelta(previousDraft: string, currentDraft: string): string {
  const prevNorm = previousDraft.trim();
  const curNorm = currentDraft.trim();

  if (!curNorm) {
    return 'Sinh viên chưa nhập nội dung bài mới trên tờ giấy A4.';
  }
  if (!prevNorm) {
    const lineCount = normalizeDraftLines(curNorm).length;
    return `Sinh viên mới viết bản nháp đầu tiên (${lineCount} dòng).`;
  }
  if (prevNorm === curNorm) {
    return 'Sinh viên chưa sửa nội dung bài viết kể từ lần chấm trước.';
  }

  const prevLines = normalizeDraftLines(prevNorm);
  const curLines = normalizeDraftLines(curNorm);
  const prevSet = new Set(prevLines);
  const curSet = new Set(curLines);

  const addedOrUpdated = curLines.filter(line => !prevSet.has(line));
  const removed = prevLines.filter(line => !curSet.has(line));

  const parts: string[] = [];
  if (addedOrUpdated.length > 0) {
    const preview = addedOrUpdated
      .slice(0, 4)
      .map(line => `«${line.length > 95 ? `${line.slice(0, 92).trimEnd()}…` : line}»`)
      .join('; ');
    parts.push(
      `Đã thêm/chỉnh ${addedOrUpdated.length} dòng: ${preview}${
        addedOrUpdated.length > 4 ? ` (+${addedOrUpdated.length - 4} dòng khác)` : ''
      }`,
    );
  }
  if (removed.length > 0) {
    parts.push(`Đã lược bỏ/thay thế ${removed.length} dòng cũ`);
  }

  const joined =
    parts.length > 0
      ? parts.join('. ')
      : `Đã điều chỉnh khoảng trắng/bố cục (${curLines.length} dòng).`;

  return joined.length <= MAX_DELTA_CHARS
    ? joined
    : `${joined.slice(0, MAX_DELTA_CHARS - 1).trimEnd()}…`;
}

/**
 * Builds structured revision diff context from prior coaching history and the current student draft.
 * Returns `undefined` on the first coaching attempt when no history exists.
 */
export function buildRevisionDiffContext(
  history: readonly CoachingHistoryEntry[],
  currentDraft: string,
): RevisionDiffContext | undefined {
  if (history.length === 0) return undefined;
  const latest = history[history.length - 1]!;
  return {
    attemptNumber: history.length + 1,
    ...(latest.verdict !== undefined ? { previousVerdict: latest.verdict } : {}),
    ...(latest.score !== undefined ? { previousScore: latest.score } : {}),
    previousSummary: latest.summary,
    previousWarnings: latest.conventionWarnings,
    draftChangeSummary: summarizeDraftDelta(latest.draftSnapshot ?? '', currentDraft),
  };
}
