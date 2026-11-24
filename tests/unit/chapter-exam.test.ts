import { describe, expect, it } from 'vitest';
import type { ExerciseDefinition } from '../../src/domain/workspace';
import {
  buildChapterExamPaper,
  evaluateChapterExam,
  summarizeChapterExamPool,
} from '../../src/core/learning/chapter-exam';
import {
  clearStoredChapterExamSession,
  loadStoredChapterExamSession,
  parseChapterExamSessionJson,
  saveStoredChapterExamSession,
} from '../../src/infrastructure/progress/chapter-exam-store';

const samplePool: readonly ExerciseDefinition[] = [
  {
    id: 'ex-mc-1',
    lessonId: 'l1',
    kind: 'multiple-choice',
    title: 'MC 1',
    prompt: 'Chọn đáp án đúng 1',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    answers: ['a'],
  },
  {
    id: 'ex-mc-2',
    lessonId: 'l2',
    kind: 'multiple-choice',
    title: 'MC 2',
    prompt: 'Chọn đáp án đúng 2',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    answers: ['b'],
  },
  {
    id: 'ex-mc-3',
    lessonId: 'l3',
    kind: 'multiple-choice',
    title: 'MC 3',
    prompt: 'Chọn đáp án đúng 3',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    answers: ['a'],
  },
  {
    id: 'ex-ma-1',
    lessonId: 'l1',
    kind: 'multiple-answer',
    title: 'MA 1',
    prompt: 'Chọn nhiều đáp án 1',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    answers: ['a', 'c'],
  },
  {
    id: 'ex-ma-2',
    lessonId: 'l2',
    kind: 'multiple-answer',
    title: 'MA 2',
    prompt: 'Chọn nhiều đáp án 2',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    answers: ['a', 'b'],
  },
  {
    id: 'ex-sa-1',
    lessonId: 'l2',
    kind: 'short-answer',
    title: 'SA 1',
    prompt: 'Tính giới hạn 1',
    answers: ['1/2', '0.5'],
  },
  {
    id: 'ex-sa-2',
    lessonId: 'l3',
    kind: 'short-answer',
    title: 'SA 2',
    prompt: 'Tính đạo hàm 2',
    answers: ['2x'],
  },
  {
    id: 'ex-sa-3',
    lessonId: 'l4',
    kind: 'short-answer',
    title: 'SA 3',
    prompt: 'Tính tích phân 3',
    answers: ['pi'],
  },
  {
    id: 'ex-written-1',
    lessonId: 'l3',
    kind: 'semi-essay',
    title: 'Written 1',
    prompt: 'Chứng minh tính hội tụ của dãy số.',
    given: [],
    theoryAnchors: [],
    steps: [
      {
        id: 'ex-written-1-s1',
        kind: 'written-reasoning',
        title: 'Chứng minh dãy tăng và bị chặn',
        prompt: 'Trình bày lập luận chi tiết.',
        theoryAnchorIds: [],
        modelAnswer: 'Dãy tăng nghiêm ngặt và bị chặn trên bởi 2.',
        rubric: [
          { id: 'r1', prompt: 'Chứng minh dãy đơn điệu tăng.' },
          { id: 'r2', prompt: 'Chứng minh dãy bị chặn trên.' },
        ],
        summaryTemplate: 'Áp dụng định lý Weierstrass.',
      },
    ],
  },
  {
    id: 'ex-written-2',
    lessonId: 'l4',
    kind: 'semi-essay',
    title: 'Written 2',
    prompt: 'Tìm giới hạn bằng định lý kẹp.',
    given: [],
    theoryAnchors: [],
    steps: [
      {
        id: 'ex-written-2-s1',
        kind: 'written-reasoning',
        title: 'Thiết lập bất đẳng thức kẹp',
        prompt: 'Đánh giá hai biên.',
        theoryAnchorIds: [],
        modelAnswer: 'Ta có 0 <= u_n <= 1/n -> 0.',
        rubric: [{ id: 'k1', prompt: 'Thiết lập đúng hai dãy kẹp cùng tiến về 0.' }],
        summaryTemplate: 'Theo nguyên lý kẹp, giới hạn bằng 0.',
      },
    ],
  },
  {
    id: 'ex-mc-4',
    lessonId: 'l4',
    kind: 'multiple-choice',
    title: 'MC 4',
    prompt: 'Chọn đáp án đúng 4',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    answers: ['b'],
  },
  {
    id: 'ex-mc-5',
    lessonId: 'l1',
    kind: 'multiple-choice',
    title: 'MC 5',
    prompt: 'Chọn đáp án đúng 5',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    answers: ['a'],
  },
];

const lessonOrder = ['l1', 'l2', 'l3', 'l4'] as const;

describe('chapter-exam core engine', () => {
  it('summarizes distinct question forms and bounds exam length between 3 and 10', () => {
    const summary = summarizeChapterExamPool(samplePool, lessonOrder);
    expect(summary.totalExercises).toBe(12);
    expect(summary.lessonCount).toBe(4);
    expect(summary.distinctForms).toEqual([
      'semi-essay',
      'short-answer',
      'multiple-answer',
      'multiple-choice',
    ]);
    expect(summary.minSelectableCount).toBe(3);
    expect(summary.maxSelectableCount).toBe(10);
    expect(summary.recommendedCountByPreset.short).toBeGreaterThanOrEqual(3);
    expect(summary.recommendedCountByPreset.short).toBeLessThanOrEqual(4);
    expect(summary.recommendedCountByPreset.standard).toBeGreaterThanOrEqual(5);
    expect(summary.recommendedCountByPreset.standard).toBeLessThanOrEqual(7);
    expect(summary.recommendedCountByPreset.comprehensive).toBeGreaterThanOrEqual(8);
    expect(summary.recommendedCountByPreset.comprehensive).toBeLessThanOrEqual(10);
  });

  it('clamps maxSelectableCount when a chapter has fewer than 10 exercises', () => {
    const smallPool = samplePool.slice(0, 5);
    const summary = summarizeChapterExamPool(smallPool, ['l1', 'l2']);
    expect(summary.minSelectableCount).toBe(3);
    expect(summary.maxSelectableCount).toBe(5);
    expect(summary.recommendedCountByPreset.comprehensive).toBe(5);
  });

  it('guarantees every available question form (including written semi-essay) when count >= distinctForms', () => {
    const paper = buildChapterExamPaper({
      exercises: samplePool,
      lessonOrder,
      preset: 'short',
      customCount: 4,
      seed: 42,
    });
    expect(paper.items).toHaveLength(4);
    const kinds = new Set(paper.items.map(item => item.exercise.kind));
    expect(kinds).toEqual(
      new Set(['multiple-choice', 'multiple-answer', 'short-answer', 'semi-essay']),
    );
    // Written semi-essay items appear at the end of the exam paper (Phần Tự luận)
    expect(paper.items[paper.items.length - 1]?.exercise.kind).toBe('semi-essay');
  });

  it('respects user customCount clamped within [3, 10] and spreads across chapter lessons', () => {
    const paper = buildChapterExamPaper({
      exercises: samplePool,
      lessonOrder,
      preset: 'comprehensive',
      customCount: 15,
      seed: 7,
    });
    expect(paper.items).toHaveLength(10);
    const coveredLessons = new Set(paper.items.map(item => item.exercise.lessonId));
    expect(coveredLessons).toEqual(new Set(['l1', 'l2', 'l3', 'l4']));
  });

  it('always includes at least one written semi-essay even on a 3-question exam when available', () => {
    const paper = buildChapterExamPaper({
      exercises: samplePool,
      lessonOrder,
      preset: 'short',
      customCount: 3,
      seed: 99,
    });
    expect(paper.items).toHaveLength(3);
    expect(paper.items.some(item => item.exercise.kind === 'semi-essay')).toBe(true);
  });

  it('evaluates objective answers deterministically and tracks written A4 self-review separately', () => {
    const paper = buildChapterExamPaper({
      exercises: [samplePool[0]!, samplePool[3]!, samplePool[5]!, samplePool[8]!],
      lessonOrder,
      preset: 'short',
      customCount: 4,
      seed: 1,
    });

    const evaluation = evaluateChapterExam(paper, {
      objectiveAnswers: {
        'ex-mc-1': 'a', // correct
        'ex-ma-1': ['a'], // missing 'c' -> incorrect
        'ex-sa-1': '0.5', // correct
      },
      writtenResponses: {
        'ex-written-1-s1': 'Ta chứng minh quy nạp dãy tăng và nhỏ hơn 2.',
      },
      checkedRubricIds: {
        'ex-written-1-s1': ['r1', 'r2'],
      },
    });

    expect(evaluation.objectiveTotal).toBe(3);
    expect(evaluation.objectiveCorrect).toBe(2);
    expect(evaluation.writtenTotal).toBe(1);
    expect(evaluation.writtenDrafted).toBe(1);
    expect(evaluation.writtenSelfReviewed).toBe(1);
    expect(evaluation.lessonsToReview).toEqual(['l1']);
  });

  it('validates and persists chapter exam sessions in storage while rejecting malformed JSON', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };

    saveStoredChapterExamSession(
      'mat1091',
      'mat1091-ch2',
      {
        version: 1,
        preset: 'standard',
        customCount: 6,
        seed: 123,
        submitted: true,
        draft: {
          objectiveAnswers: { 'ex-mc-1': 'a', 'ex-ma-1': ['a', 'c'] },
          writtenResponses: { 'ex-written-1-s1': 'Bài làm trên giấy A4.' },
          checkedRubricIds: { 'ex-written-1-s1': ['r1'] },
        },
      },
      storage,
    );

    const loaded = loadStoredChapterExamSession('mat1091', 'mat1091-ch2', storage);
    expect(loaded?.preset).toBe('standard');
    expect(loaded?.customCount).toBe(6);
    expect(loaded?.seed).toBe(123);
    expect(loaded?.submitted).toBe(true);
    expect(loaded?.draft.writtenResponses['ex-written-1-s1']).toBe('Bài làm trên giấy A4.');

    expect(parseChapterExamSessionJson('{"version":1,"preset":"invalid"}')).toBeNull();
    expect(parseChapterExamSessionJson('not-json')).toBeNull();

    clearStoredChapterExamSession('mat1091', 'mat1091-ch2', storage);
    expect(loadStoredChapterExamSession('mat1091', 'mat1091-ch2', storage)).toBeNull();
  });
});
