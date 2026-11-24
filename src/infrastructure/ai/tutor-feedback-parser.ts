import type {
  TutorCoachingFeedback,
  TutorCriterionFeedback,
  TutorCriterionStatus,
} from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import type { SemiEssayExercise, WrittenReasoningStep } from '../../domain/semi-essay';

export type ParseTutorFeedbackResult =
  | { readonly ok: true; readonly value: TutorCoachingFeedback }
  | { readonly ok: false; readonly error: string };

const MAX_RAW_CHARS = 60_000;
const MAX_SUMMARY_CHARS = 1_500;
const MAX_ITEM_CHARS = 700;
const VALID_STATUSES: ReadonlySet<TutorCriterionStatus> = new Set(['met', 'partial', 'missing']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  // Strip ASCII control characters except \n and \t
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, maxLen).trimEnd()}…`;
}

function sanitizeStringList(value: unknown, maxItems: number, maxItemLen: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    const clean = sanitizeText(item, maxItemLen);
    if (clean && !out.includes(clean)) {
      out.push(clean);
    }
  }
  return out;
}

/**
 * Extracts a JSON candidate from a conversational AI response (fenced ```json block or outermost {...})
 * without ever evaluating code.
 */
export function extractJsonObjectFromText(rawText: string): unknown {
  if (rawText.length > MAX_RAW_CHARS) {
    throw new Error('Nội dung phản hồi vượt quá giới hạn an toàn (60 KB).');
  }
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Nội dung phản hồi đang trống.');
  }

  // 1. Prefer the last ```json ... ``` or ``` ... ``` block (since Gemini places JSON at the end)
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let lastBlock: string | null = null;
  let match: RegExpExecArray | null = fenceRegex.exec(trimmed);
  while (match) {
    const candidate = match[1]?.trim();
    if (candidate && candidate.startsWith('{')) {
      lastBlock = candidate;
    }
    match = fenceRegex.exec(trimmed);
  }
  if (lastBlock) {
    return JSON.parse(lastBlock);
  }

  // 2. Fallback: direct JSON or outermost { ... }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('Không tìm thấy khối dữ liệu JSON hợp lệ trong phản hồi.');
}

export function parseExternalTutorFeedback(
  rawInput: unknown,
  exercise: SemiEssayExercise,
  fallbackStepId: EntityId,
  source: 'webmcp' | 'clipboard',
  nowIso?: string,
): ParseTutorFeedbackResult {
  let candidate: unknown = rawInput;

  if (typeof rawInput === 'string') {
    try {
      candidate = extractJsonObjectFromText(rawInput);
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Không thể phân tích cú pháp JSON từ phản hồi của Gemini.',
      };
    }
  }

  if (!isRecord(candidate)) {
    return {
      ok: false,
      error: 'Phản hồi phải là một đối tượng JSON có cấu trúc.',
    };
  }

  if (
    typeof candidate.exerciseId === 'string' &&
    candidate.exerciseId.trim() !== '' &&
    candidate.exerciseId !== exercise.id
  ) {
    return {
      ok: false,
      error: `Phản hồi này thuộc bài tập khác (${candidate.exerciseId}), không khớp bài hiện tại (${exercise.id}).`,
    };
  }

  const writtenSteps = exercise.steps.filter(
    (s): s is WrittenReasoningStep => s.kind === 'written-reasoning',
  );
  const requestedStepId =
    typeof candidate.stepId === 'string' && candidate.stepId.trim()
      ? candidate.stepId.trim()
      : fallbackStepId;

  const targetStep = writtenSteps.find(s => s.id === requestedStepId);
  if (!targetStep) {
    return {
      ok: false,
      error: `Mã bước "${requestedStepId}" không khớp với bất kỳ bước tự viết nào của bài tập này.`,
    };
  }

  const summary = sanitizeText(candidate.summary, MAX_SUMMARY_CHARS);
  const socraticQuestions = sanitizeStringList(candidate.socraticQuestions, 5, MAX_ITEM_CHARS);
  const conventionWarnings = sanitizeStringList(candidate.conventionWarnings, 5, MAX_ITEM_CHARS);
  const citedSections = sanitizeStringList(candidate.citedSections, 6, 320);

  const validCriterionIds = new Set(targetStep.rubric.map(r => r.id));
  const seenCriteria = new Set<string>();
  const criterionFeedback: TutorCriterionFeedback[] = [];

  if (Array.isArray(candidate.criterionFeedback)) {
    for (const item of candidate.criterionFeedback) {
      if (!isRecord(item)) continue;
      const cid = typeof item.criterionId === 'string' ? item.criterionId.trim() : '';
      if (!cid || !validCriterionIds.has(cid) || seenCriteria.has(cid)) continue;
      const rawStatus = typeof item.status === 'string' ? item.status.trim() : '';
      if (!VALID_STATUSES.has(rawStatus as TutorCriterionStatus)) continue;
      const comment = sanitizeText(item.comment, MAX_ITEM_CHARS);
      if (!comment) continue;
      seenCriteria.add(cid);
      criterionFeedback.push({
        criterionId: cid,
        status: rawStatus as TutorCriterionStatus,
        comment,
      });
    }
  }

  if (!summary && socraticQuestions.length === 0 && criterionFeedback.length === 0) {
    return {
      ok: false,
      error:
        'Khối JSON thiếu nội dung nhận xét (`summary`, `socraticQuestions` hoặc `criterionFeedback`).',
    };
  }

  return {
    ok: true,
    value: {
      version: 1,
      exerciseId: exercise.id,
      stepId: targetStep.id,
      source,
      receivedAt: nowIso ?? new Date().toISOString(),
      summary: summary ?? 'Đã cập nhật gợi ý đối chiếu theo giáo trình.',
      socraticQuestions,
      criterionFeedback,
      conventionWarnings,
      citedSections,
    },
  };
}

export function tutorFeedbackStorageKey(exerciseId: EntityId): string {
  return `hus-learning-hub:tutor-feedback:v1:${exerciseId}`;
}

export function loadStoredTutorFeedback(
  exercise: SemiEssayExercise,
): Readonly<Record<string, TutorCoachingFeedback>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(tutorFeedbackStorageKey(exercise.id));
    if (!raw || raw.length > MAX_RAW_CHARS) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.byStepId)) return {};
    const out: Record<string, TutorCoachingFeedback> = {};
    for (const [stepId, val] of Object.entries(parsed.byStepId)) {
      const validated = parseExternalTutorFeedback(
        val,
        exercise,
        stepId,
        isRecord(val) && val.source === 'webmcp' ? 'webmcp' : 'clipboard',
        isRecord(val) && typeof val.receivedAt === 'string' ? val.receivedAt : undefined,
      );
      if (validated.ok) {
        out[validated.value.stepId] = validated.value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStoredTutorFeedback(
  exerciseId: EntityId,
  byStepId: Readonly<Record<string, TutorCoachingFeedback>>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      tutorFeedbackStorageKey(exerciseId),
      JSON.stringify({ version: 1, byStepId }),
    );
  } catch {
    // Ignore storage quota / blocked localStorage errors gracefully
  }
}
