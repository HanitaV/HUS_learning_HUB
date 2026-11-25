import type {
  TutorCoachingFeedback,
  TutorCriterionFeedback,
  TutorCriterionStatus,
} from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import type { SemiEssayExercise, WrittenReasoningStep } from '../../domain/semi-essay';
import { normalizeM1TutorGrade } from '../../core/learning/webmcp-essay-adapters';

export type ParseTutorFeedbackResult =
  | { readonly ok: true; readonly value: TutorCoachingFeedback }
  | { readonly ok: false; readonly error: string };

export type ParseBatchTutorFeedbackResult =
  | { readonly ok: true; readonly items: readonly TutorCoachingFeedback[] }
  | { readonly ok: false; readonly error: string };

const MAX_RAW_CHARS = 60_000;
const MAX_SUMMARY_CHARS = 1_500;
const MAX_ITEM_CHARS = 700;
const VALID_STATUSES: ReadonlySet<TutorCriterionStatus> = new Set(['met', 'partial', 'missing']);
const LATEX_AFTER_N_RE =
  /^(?:eq\b|e\b|abla\b|u\b|otin\b|i\b|eg\b|atural\b|mid\b|less\b|gtr\b|leq\b|geq\b|sim\b|cong\b|parallel\b|vdash\b|subset|supset)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely repairs unescaped single-backslash LaTeX commands inside JSON string literals
 * (e.g. `\lim`, `\frac`, `\to`, `\tan`, `\beta`, `\neq`) without altering valid JSON escapes
 * (`\"`, `\\`, `\/`, `\uXXXX`, or real `\n` newlines).
 */
export function repairJsonLatexEscapes(jsonSource: string): string {
  let out = '';
  let inString = false;
  let i = 0;

  while (i < jsonSource.length) {
    const ch = jsonSource[i]!;
    if (!inString) {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += ch;
      i += 1;
      continue;
    }

    if (ch !== '\\') {
      // Escape literal unescaped newlines/tabs inside JSON strings if an LLM emitted raw multiline strings
      if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
      i += 1;
      continue;
    }

    const next = jsonSource[i + 1];
    if (next === undefined) {
      out += '\\\\';
      i += 1;
      continue;
    }

    if (next === '"' || next === '\\' || next === '/') {
      out += '\\' + next;
      i += 2;
      continue;
    }

    if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(jsonSource.slice(i + 2, i + 6))) {
      out += jsonSource.slice(i, i + 6);
      i += 6;
      continue;
    }

    if (next === 'n') {
      const rest = jsonSource.slice(i + 2, i + 14);
      if (LATEX_AFTER_N_RE.test(rest)) {
        out += '\\\\n';
      } else {
        out += '\\n';
      }
      i += 2;
      continue;
    }

    if (next === 'b' || next === 'f' || next === 'r' || next === 't') {
      const afterControl = jsonSource[i + 2] ?? '';
      if (/^[a-zA-Z]$/.test(afterControl)) {
        // LaTeX command starting with \b (\beta), \f (\frac), \r (\rightarrow), \t (\to, \tan, \theta, \text)
        out += '\\\\' + next;
      } else {
        out += '\\' + next;
      }
      i += 2;
      continue;
    }

    // Any other `\x` (such as `\lim`, `\arctan`, `\sim`, `\ln`, `\sqrt`, `\,`, `\{`) is invalid JSON -> double backslash
    out += '\\\\' + next;
    i += 2;
  }

  return out;
}

function parseJsonWithLatexRepair(candidate: string): unknown {
  return JSON.parse(repairJsonLatexEscapes(candidate));
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
    if (candidate && (candidate.startsWith('{') || candidate.startsWith('['))) {
      lastBlock = candidate;
    }
    match = fenceRegex.exec(trimmed);
  }
  if (lastBlock) {
    return parseJsonWithLatexRepair(lastBlock);
  }

  // 2. Fallback: direct JSON or outermost { ... } / [ ... ]
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return parseJsonWithLatexRepair(trimmed);
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return parseJsonWithLatexRepair(trimmed.slice(firstBrace, lastBrace + 1));
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

  const normalizedGrade = normalizeM1TutorGrade({
    rawVerdict: candidate.verdict,
    rawScore: candidate.score,
    rawMaxScore: candidate.maxScore,
    criterionFeedback,
  });

  if (
    !summary &&
    socraticQuestions.length === 0 &&
    criterionFeedback.length === 0 &&
    normalizedGrade.verdict === undefined
  ) {
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
      summary: summary ?? 'Đã cập nhật kết quả chấm & gợi ý đối chiếu theo giáo trình.',
      ...(normalizedGrade.verdict !== undefined ? { verdict: normalizedGrade.verdict } : {}),
      ...(normalizedGrade.score !== undefined ? { score: normalizedGrade.score } : {}),
      ...(normalizedGrade.maxScore !== undefined ? { maxScore: normalizedGrade.maxScore } : {}),
      socraticQuestions,
      criterionFeedback,
      conventionWarnings,
      citedSections,
    },
  };
}

export function parseBatchExternalTutorFeedback(
  rawText: string,
  targets: readonly { readonly exercise: SemiEssayExercise; readonly stepId: EntityId }[],
  nowIso?: string,
): ParseBatchTutorFeedbackResult {
  if (rawText.length > MAX_RAW_CHARS) {
    return { ok: false, error: 'Nội dung phản hồi vượt quá giới hạn an toàn (60 KB).' };
  }
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: 'Nội dung phản hồi đang trống.' };
  }

  const rawPayloads: unknown[] = [];
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null = fenceRegex.exec(trimmed);
  while (match) {
    const block = match[1]?.trim();
    if (block && (block.startsWith('{') || block.startsWith('['))) {
      try {
        rawPayloads.push(parseJsonWithLatexRepair(block));
      } catch {
        // Ignore non-JSON fenced blocks
      }
    }
    match = fenceRegex.exec(trimmed);
  }

  if (rawPayloads.length === 0) {
    try {
      rawPayloads.push(extractJsonObjectFromText(trimmed));
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Không tìm thấy khối JSON hợp lệ trong câu trả lời của Gemini.',
      };
    }
  }

  const candidateObjects: Record<string, unknown>[] = [];
  for (const payload of rawPayloads) {
    if (Array.isArray(payload)) {
      for (const entry of payload) {
        if (isRecord(entry)) candidateObjects.push(entry);
      }
    } else if (isRecord(payload)) {
      if (Array.isArray(payload.items)) {
        for (const entry of payload.items) {
          if (isRecord(entry)) candidateObjects.push(entry);
        }
      } else {
        candidateObjects.push(payload);
      }
    }
  }

  const targetByStepId = new Map(targets.map(t => [t.stepId, t]));
  const targetByExerciseId = new Map(targets.map(t => [t.exercise.id, t]));
  const seenStepIds = new Set<string>();
  const validatedItems: TutorCoachingFeedback[] = [];

  for (const item of candidateObjects) {
    const reqStepId = typeof item.stepId === 'string' ? item.stepId.trim() : '';
    const reqExerciseId = typeof item.exerciseId === 'string' ? item.exerciseId.trim() : '';
    const matchedTarget =
      (reqStepId ? targetByStepId.get(reqStepId) : undefined) ??
      (reqExerciseId ? targetByExerciseId.get(reqExerciseId) : undefined) ??
      (candidateObjects.length === 1 ? targets[0] : undefined);

    if (!matchedTarget) continue;
    const res = parseExternalTutorFeedback(
      item,
      matchedTarget.exercise,
      matchedTarget.stepId,
      'clipboard',
      nowIso,
    );
    if (res.ok && !seenStepIds.has(res.value.stepId)) {
      seenStepIds.add(res.value.stepId);
      validatedItems.push(res.value);
    }
  }

  if (validatedItems.length === 0) {
    return {
      ok: false,
      error:
        'Không tìm thấy nhận xét nào khớp với mã câu hỏi (`stepId`) của đề thi hiện tại trong phản hồi JSON.',
    };
  }

  return { ok: true, items: validatedItems };
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
