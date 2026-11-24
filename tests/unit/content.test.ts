import { expect, it } from 'vitest';
import { courseLessons, validateContent } from '../../src/core/learning/content';
import { createProgressStore } from '../../src/infrastructure/progress/store';
import { emptyProgress, subjectProgress } from '../../src/core/learning/progress';
import type { Course } from '../../src/domain/learning';
import type { LearningContent } from '../../src/domain/workspace';

const course: Course = { schemaVersion: 1, id: 'c', title: 'C', subjectId: 's', language: 'vi', status: 'available', chapterIds: ['c-ch'], resourceIds: [], provenance: { repository: 'https://github.com/a/b', revision: 'a'.repeat(40), path: 'x', rights: 'approved' } };
const content: LearningContent = { chapters: [{ id: 'c-ch', courseId: 'c', title: 'Ch', topicIds: ['c-t'] }], topics: [{ id: 'c-t', chapterId: 'c-ch', title: 'T', lessonIds: ['c-l'] }], lessons: [{ id: 'c-l', topicId: 'c-t', title: 'L', content: { format: 'markdown', assetPath: 'c/l.md' }, exerciseIds: [], resourceIds: [] }], exercises: [], resources: [] };

it('validates references, ownership, duplicate IDs and prerequisite cycles', () => {
  expect(() => validateContent([course], content)).not.toThrow();
  expect(() => validateContent([course], { ...content, lessons: [] })).toThrow();
  expect(() => validateContent([course], { ...content, lessons: [...content.lessons, ...content.lessons] })).toThrow();
  expect(() => validateContent([course], { ...content, topics: [{ ...content.topics[0]!, prerequisiteIds: ['c-t'] }] })).toThrow();
  expect(() => validateContent([course], { ...content, chapters: [{ ...content.chapters[0]!, courseId: 'other' }] })).toThrow();
  expect(() => validateContent([course], { ...content, resources: [{ id: 'bad-pdf', title: 'PDF', kind: 'pdf', assetPath: '../private.pdf', provenance: course.provenance }] })).toThrow();
  expect(() => validateContent([course], { ...content, exercises: [{ id: 'c-e', lessonId: 'c-l', title: 'Q', prompt: 'Q', kind: 'multiple-choice', choices: [{ id: 'a', label: 'A' }], answers: ['missing'] }] })).toThrow();
});

it('uses the course chapter ID order even when manifests are physically reordered', () => {
  const data = { ...content,
    chapters: [{ id: 'c-ch2', courseId: 'c', title: 'Second', topicIds: ['c-t2'] }, ...content.chapters],
    topics: [...content.topics, { id: 'c-t2', chapterId: 'c-ch2', title: 'T2', lessonIds: ['c-l2'] }],
    lessons: [...content.lessons, { ...content.lessons[0]!, id: 'c-l2', topicId: 'c-t2' }],
  };
  expect(courseLessons(data, { ...course, chapterIds: ['c-ch', 'c-ch2'] }).map(l => l.id)).toEqual(['c-l', 'c-l2']);
});

it('aggregates only lessons belonging to the selected subject', () => {
  expect(subjectProgress(content, [course], 's', { ...emptyProgress(), completedLessonIds: ['c-l', 'foreign'] })).toBe(100);
  expect(subjectProgress(content, [course], 'other', emptyProgress())).toBe(0);
});

it('keeps malformed storage intact and warns; failed imports preserve memory', () => {
  let value = '{broken';
  const store = createProgressStore({ getItem: () => value, setItem: (_key, v) => { value = v; } });
  expect(store.getSnapshot().error).toBeTruthy();
  expect(value).toBe('{broken');
  expect(() => store.restore('{}')).toThrow();
  expect(store.getSnapshot().progress).toEqual(emptyProgress());
  store.dispatch({ type: 'complete', lessonId: 'l', completed: true });
  expect(value).toBe('{broken');
  store.restore(JSON.stringify(emptyProgress()));
  expect(JSON.parse(value)).toEqual(emptyProgress());
});

it('continues in memory when browser storage is blocked', () => {
  const store = createProgressStore({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
  store.dispatch({ type: 'complete', lessonId: 'l', completed: true });
  expect(store.getSnapshot().progress.completedLessonIds).toEqual(['l']);
  expect(store.getSnapshot().error).toBeTruthy();
});

it('validates semi-essay exercises, theory anchor references, and step uniqueness', () => {
  const withSemiEssay: LearningContent = {
    ...content,
    lessons: [{ ...content.lessons[0]!, exerciseIds: ['c-se-1'] }],
    exercises: [
      {
        id: 'c-se-1',
        lessonId: 'c-l',
        kind: 'semi-essay',
        title: 'Bài tự luận mẫu',
        prompt: 'Đề bài mẫu',
        given: [],
        theoryAnchors: [{ id: 'a1', title: 'Định luật', summary: 'Tóm tắt', conditions: ['Điều kiện 1'] }],
        steps: [
          {
            id: 's1',
            kind: 'choice-reasoning',
            title: 'Bước 1',
            prompt: 'Chọn',
            theoryAnchorIds: ['a1'],
            choices: [{ id: 'c1', label: 'Đáp án 1', rationale: 'Lý do' }],
            answers: ['c1'],
            summaryTemplate: 'Tóm tắt bước 1',
          },
        ],
      },
    ],
  };
  expect(() => validateContent([course], withSemiEssay)).not.toThrow();

  const badAnchor: LearningContent = {
    ...withSemiEssay,
    exercises: [
      {
        ...withSemiEssay.exercises[0]!,
        kind: 'semi-essay',
        steps: [
          {
            ...(withSemiEssay.exercises[0]! as Extract<LearningContent['exercises'][number], { kind: 'semi-essay' }>).steps[0]!,
            theoryAnchorIds: ['missing-anchor'],
          },
        ],
      } as LearningContent['exercises'][number],
    ],
  };
  expect(() => validateContent([course], badAnchor)).toThrow();
});
