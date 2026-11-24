import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '../../src/core/learning/exercises';
import { parseProgress, emptyProgress, updateProgress, courseProgress } from '../../src/core/learning/progress';
import { bubbleSortSteps } from '../../src/core/learning/replay';
import { searchContent } from '../../src/core/learning/search';

describe('exercise evaluation', () => {
  const base = { id: 'e', lessonId: 'l', title: 'Q', prompt: 'Q' };
  const choices = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
  it('grades exact sets and rejects duplicates and unknown choices', () => {
    const e = { ...base, kind: 'multiple-answer' as const, choices, answers: ['a', 'b'] };
    expect(evaluateAnswer(e, ['b', 'a'])).toBe(true);
    for (const answer of [['a'], ['a', 'b', 'c'], ['a', 'a', 'b'], ['z']]) expect(evaluateAnswer(e, answer)).toBe(false);
    expect(evaluateAnswer({ ...e, kind: 'multiple-choice', answers: ['a'] }, ['a', 'b'])).toBe(false);
  });
  it('normalizes Vietnamese short answers without evaluating expressions', () => {
    const e = { ...base, kind: 'short-answer' as const, answers: ['Động lượng'] };
    expect(evaluateAnswer(e, '  dong LUONG ')).toBe(true);
    expect(evaluateAnswer(e, 'alert(1)')).toBe(false);
  });
});

describe('progress boundary and transitions', () => {
  it('rejects malformed, future and inconsistent imports', () => {
    for (const input of ['null', '{}', '{', JSON.stringify({ ...emptyProgress(), schemaVersion: 2 }), JSON.stringify({ ...emptyProgress(), completedLessonIds: [1] })]) {
      expect(() => parseProgress(input)).toThrow();
    }
  });
  it('deduplicates completions, records attempts and keeps recent topics ordered', () => {
    let state = emptyProgress();
    state = updateProgress(state, { type: 'complete', lessonId: 'l', completed: true });
    state = updateProgress(state, { type: 'complete', lessonId: 'l', completed: true });
    expect(courseProgress(['l', 'm'], state)).toBe(50);
    expect(courseProgress([], state)).toBe(0);
    state = updateProgress(state, { type: 'visit', topicId: 't', lessonId: 'l', courseId: 'c', at: '2026-11-19T00:00:00.000Z' });
    state = updateProgress(state, { type: 'attempt', exerciseId: 'e', correct: false, at: '2026-11-19T00:00:00.000Z' });
    expect(parseProgress(JSON.stringify(state))).toEqual(state);
    expect(state.attempts).toHaveLength(1);
    expect(state.recentTopics[0]?.topicId).toBe('t');
    state = updateProgress(state, { type: 'complete', lessonId: 'l', completed: false });
    expect(courseProgress(['l'], state)).toBe(0);
  });
  it('toggles bookmarks without duplicates', () => {
    const marked = updateProgress(emptyProgress(), { type: 'bookmark', resourceId: 'r' });
    expect(marked.bookmarkedResourceIds).toEqual(['r']);
    expect(updateProgress(marked, { type: 'bookmark', resourceId: 'r' }).bookmarkedResourceIds).toEqual([]);
  });
});

it('replays sorting deterministically without mutating input', () => {
  const input = [3, 1, 2];
  const steps = bubbleSortSteps(input);
  expect(steps.at(-1)?.values).toEqual([1, 2, 3]);
  expect(bubbleSortSteps(input)).toEqual(steps);
  expect(input).toEqual([3, 1, 2]);
  expect(steps[0]?.values).toEqual(input);
});

it('searches all normalized Vietnamese tokens', () => {
  const entries = [{ id: 'l', title: 'Động học', text: 'Vận tốc và gia tốc', to: '/l', kind: 'lesson' as const, courseId: 'c', subjectId: 'physics' }];
  expect(searchContent(entries, 'DONG gia')).toHaveLength(1);
  expect(searchContent(entries, 'hoa hoc')).toHaveLength(0);
});
