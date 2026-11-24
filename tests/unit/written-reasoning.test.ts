import { describe, expect, it } from 'vitest';
import type { SemiEssayExercise, WrittenReasoningStep } from '../../src/domain/semi-essay';
import type { Lesson } from '../../src/domain/learning';
import { emptyWrittenStepDraft, evaluateWrittenReasoningReview } from '../../src/core/learning/semi-essay';
import { createWrittenDraftStore, writtenDraftStorageKey } from '../../src/infrastructure/practice/written-drafts';
import { validateExercises } from '../../src/core/learning/content';

const step: WrittenReasoningStep = {
  id: 'course-reason', kind: 'written-reasoning', title: 'Explain', prompt: 'Why?',
  theoryAnchorIds: [], summaryTemplate: 'Reviewed reasoning', modelAnswer: 'A model explanation.',
  rubric: [{ id: 'evidence', prompt: 'Explain the evidence' }, { id: 'conclusion', prompt: 'State a conclusion' }],
};
const exercise: SemiEssayExercise = {
  id: 'course-exercise', lessonId: 'course-lesson', kind: 'semi-essay', title: 'Reasoning',
  prompt: 'Explain', given: [], theoryAnchors: [], steps: [step],
};

function memoryStorage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(writtenDraftStorageKey(exercise.id), initial);
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe('written reasoning self-review', () => {
  it('requires a first answer, revealed model, each criterion and a final revision without claiming correctness', () => {
    const draft = emptyWrittenStepDraft();
    expect(evaluateWrittenReasoningReview(step, draft)).toEqual({ readyForReview: false, readyToComplete: false, complete: false, missingCriterionIds: ['evidence', 'conclusion'] });
    const written = { ...draft, response: 'My explanation' };
    expect(evaluateWrittenReasoningReview(step, written).readyForReview).toBe(true);
    expect(evaluateWrittenReasoningReview(step, { ...written, modelRevealed: true, revision: 'Revised explanation', reviewedCriterionIds: ['unknown'] }).complete).toBe(false);
    const reviewed = { ...written, modelRevealed: true, reviewedCriterionIds: ['evidence', 'conclusion'], revision: 'Final explanation' };
    expect(evaluateWrittenReasoningReview(step, reviewed)).toEqual({ readyForReview: true, readyToComplete: true, complete: false, missingCriterionIds: [] });
    expect(evaluateWrittenReasoningReview(step, { ...reviewed, selfReviewed: true }).complete).toBe(true);
    expect(evaluateWrittenReasoningReview(step, { ...reviewed, revision: '  ' }).complete).toBe(false);
    expect(evaluateWrittenReasoningReview(step, { ...reviewed, modelRevealed: false }).complete).toBe(false);
  });

  it('restores written drafts, invalidates prior review on first-response edits, and ignores unknown step updates', () => {
    const storage = memoryStorage();
    const store = createWrittenDraftStore(exercise, storage);
    store.updateDraft(step.id, { response: 'First' });
    store.updateDraft(step.id, { modelRevealed: true, reviewedCriterionIds: ['evidence', 'conclusion'], revision: 'Final' });
    store.updateDraft(step.id, { selfReviewed: true });
    expect(createWrittenDraftStore(exercise, storage).getSnapshot().drafts[step.id]?.selfReviewed).toBe(true);
    store.updateDraft(step.id, { revision: 'Better final' });
    expect(store.getSnapshot().drafts[step.id]?.selfReviewed).toBe(false);
    store.updateDraft(step.id, { selfReviewed: true });
    store.updateDraft(step.id, { reviewedCriterionIds: ['evidence'] });
    expect(store.getSnapshot().drafts[step.id]?.selfReviewed).toBe(false);
    expect(createWrittenDraftStore(exercise, storage).getSnapshot().drafts[step.id]?.revision).toBe('Better final');
    store.updateDraft(step.id, { response: 'Changed' });
    expect(store.getSnapshot().drafts[step.id]).toEqual({ response: 'Changed', modelRevealed: false, reviewedCriterionIds: [], revision: 'Better final', selfReviewed: false });
    expect(evaluateWrittenReasoningReview(step, store.getSnapshot().drafts[step.id]!).complete).toBe(false);
    expect(createWrittenDraftStore(exercise, storage).getSnapshot().drafts[step.id]?.revision).toBe('Better final');
    store.resetDrafts();
    expect(store.getSnapshot().drafts[step.id]).toEqual(emptyWrittenStepDraft());
    store.updateDraft('unknown', { response: 'Ignore' });
    expect(store.getSnapshot().drafts.unknown).toBeUndefined();
  });

  it('preserves malformed, oversized and unknown-step saved data until an explicit reset', () => {
    for (const raw of ['{bad', JSON.stringify({ version: 1, exerciseId: exercise.id, drafts: { unknown: emptyWrittenStepDraft() } }), JSON.stringify({ version: 1, exerciseId: exercise.id, drafts: { [step.id]: { ...emptyWrittenStepDraft(), response: 'x'.repeat(20001) } } })]) {
      const storage = memoryStorage(raw);
      const store = createWrittenDraftStore(exercise, storage);
      expect(store.getSnapshot().error).toBeTruthy();
      store.updateDraft(step.id, { response: 'Fresh' });
      expect(storage.getItem(writtenDraftStorageKey(exercise.id))).toBe(raw);
      store.resetDrafts();
      expect(store.getSnapshot().error).toBeNull();
      expect(storage.getItem(writtenDraftStorageKey(exercise.id))).not.toBe(raw);
    }
  });

  it('keeps edits in memory when browser storage is blocked', () => {
    const store = createWrittenDraftStore(exercise, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    store.updateDraft(step.id, { response: 'Still here' });
    expect(store.getSnapshot().drafts[step.id]?.response).toBe('Still here');
    expect(store.getSnapshot().error).toBeTruthy();
  });

  it('rejects missing models and repeated rubric identities in authored content', () => {
    const lesson: Lesson = { id: exercise.lessonId, topicId: 'course-topic', title: 'Lesson', content: { format: 'markdown', assetPath: 'lesson.md' }, exerciseIds: [exercise.id], resourceIds: [] };
    expect(() => validateExercises([lesson], [exercise])).not.toThrow();
    expect(() => validateExercises([lesson], [{ ...exercise, steps: [{ ...step, modelAnswer: '' }] }])).toThrow();
    expect(() => validateExercises([lesson], [{ ...exercise, steps: [{ ...step, rubric: [step.rubric[0]!, step.rubric[0]!] }] }])).toThrow();
  });
});
