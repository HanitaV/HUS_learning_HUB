import type { SemiEssayExercise, WrittenReasoningStep, WrittenStepDraft } from '../../domain/semi-essay';
import { emptyWrittenStepDraft, evaluateWrittenReasoningReview } from '../../core/learning/semi-essay';

interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WrittenDraftSnapshot {
  readonly drafts: Readonly<Record<string, WrittenStepDraft>>;
  readonly error: string | null;
}

export interface WrittenDraftStore {
  readonly getSnapshot: () => WrittenDraftSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly updateDraft: (stepId: string, patch: Partial<WrittenStepDraft>) => void;
  readonly resetDrafts: () => void;
}

const MAX_TEXT_LENGTH = 20000;
const CORRUPT_MESSAGE = 'Bản nháp cũ không đọc được và được giữ nguyên. Thay đổi mới chỉ lưu trong phiên này; chọn làm lại để thay bản nháp cũ.';
const STORAGE_MESSAGE = 'Không thể lưu bản nháp vào bộ nhớ trình duyệt. Hãy sao chép phần viết trước khi đóng trang.';

export function writtenDraftStorageKey(exerciseId: string): string {
  return `hus-learning-hub:written-draft:v1:${exerciseId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH;
}

function parseDrafts(raw: string, exerciseId: string, steps: readonly WrittenReasoningStep[]): Readonly<Record<string, WrittenStepDraft>> {
  if (raw.length > 1000000) throw new Error('Draft too large');
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || parsed.version !== 1 || parsed.exerciseId !== exerciseId || !isRecord(parsed.drafts)) throw new Error('Invalid draft');
  const drafts: Record<string, WrittenStepDraft> = {};
  for (const [id, value] of Object.entries(parsed.drafts)) {
    const step = steps.find(item => item.id === id);
    if (!step || !isRecord(value) || !boundedText(value.response) || !boundedText(value.revision) || typeof value.modelRevealed !== 'boolean' || typeof value.selfReviewed !== 'boolean' || !Array.isArray(value.reviewedCriterionIds)) throw new Error('Invalid written step');
    const criteria: readonly unknown[] = value.reviewedCriterionIds;
    if (criteria.length > step.rubric.length || !criteria.every((criterion): criterion is string => typeof criterion === 'string' && step.rubric.some(item => item.id === criterion))) throw new Error('Invalid criteria');
    const reviewedCriterionIds = criteria.filter((criterion): criterion is string => typeof criterion === 'string');
    if (new Set(reviewedCriterionIds).size !== reviewedCriterionIds.length) throw new Error('Repeated criterion');
    drafts[id] = { response: value.response, revision: value.revision, modelRevealed: value.modelRevealed, reviewedCriterionIds, selfReviewed: value.selfReviewed };
    if (value.selfReviewed && !evaluateWrittenReasoningReview(step, drafts[id]).complete) throw new Error('Incomplete self-review');
  }
  return Object.fromEntries(steps.map(step => [step.id, drafts[step.id] ?? emptyWrittenStepDraft()]));
}

export function createWrittenDraftStore(exercise: SemiEssayExercise, storage: StoragePort): WrittenDraftStore {
  const steps = exercise.steps.filter((step): step is WrittenReasoningStep => step.kind === 'written-reasoning');
  const emptyDrafts = () => Object.fromEntries(steps.map(step => [step.id, emptyWrittenStepDraft()]));
  const key = writtenDraftStorageKey(exercise.id);
  let snapshot: WrittenDraftSnapshot = { drafts: emptyDrafts(), error: null };
  let preserveCorrupt = false;
  const listeners = new Set<() => void>();
  try {
    const raw = storage.getItem(key);
    if (raw !== null) {
      try { snapshot = { drafts: parseDrafts(raw, exercise.id, steps), error: null }; }
      catch { preserveCorrupt = true; snapshot = { ...snapshot, error: CORRUPT_MESSAGE }; }
    }
  } catch { snapshot = { ...snapshot, error: STORAGE_MESSAGE }; }

  function save(drafts: Readonly<Record<string, WrittenStepDraft>>, replace = false) {
    let error = snapshot.error;
    if (!preserveCorrupt || replace) {
      try {
        storage.setItem(key, JSON.stringify({ version: 1, exerciseId: exercise.id, drafts }));
        preserveCorrupt = false;
        error = null;
      } catch { error = STORAGE_MESSAGE; }
    }
    snapshot = { drafts, error };
    listeners.forEach(listener => listener());
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    updateDraft: (stepId: string, patch: Partial<WrittenStepDraft>) => {
      const step = steps.find(item => item.id === stepId);
      const previous = snapshot.drafts[stepId];
      if (!step || !previous) return;
      const next = { ...previous, ...patch };
      if (next.response.length > MAX_TEXT_LENGTH || next.revision.length > MAX_TEXT_LENGTH) return;
      if (next.reviewedCriterionIds.some(id => !step.rubric.some(item => item.id === id))) return;
      if (new Set(next.reviewedCriterionIds).size !== next.reviewedCriterionIds.length) return;
      const responseChanged = next.response !== previous.response;
      const reviewChanged = next.revision !== previous.revision || next.modelRevealed !== previous.modelRevealed || next.reviewedCriterionIds.join('\0') !== previous.reviewedCriterionIds.join('\0');
      const draft = responseChanged
        ? { ...next, modelRevealed: false, reviewedCriterionIds: [], selfReviewed: false }
        : reviewChanged ? { ...next, selfReviewed: false } : next;
      if (draft.selfReviewed && !evaluateWrittenReasoningReview(step, draft).complete) return;
      save({ ...snapshot.drafts, [stepId]: draft });
    },
    resetDrafts: () => save(emptyDrafts(), true),
  };
}
