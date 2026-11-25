import { describe, expect, it } from 'vitest';
import type { Course, Lesson } from '../../src/domain/learning';
import {
  completedCourseLessonIds,
  courseEffectiveProgress,
  effectiveCompletedLessonIds,
  emptyProgress,
  isPracticeOnlyCourse,
  subjectProgress,
  updateProgress,
} from '../../src/core/learning/progress';

const baseProvenance = {
  repository: 'local:test',
  revision: 'sha256:0000',
  path: 'test',
  rights: 'approved' as const,
};

function makeCourse(id: string, subjectId: string, studyMode?: Course['studyMode']): Course {
  return {
    schemaVersion: 1,
    id,
    subjectId,
    title: id,
    language: 'vi',
    status: 'available',
    ...(studyMode ? { studyMode } : {}),
    chapterIds: ['ch-1'],
    resourceIds: [],
    provenance: baseProvenance,
  };
}

function makeLesson(id: string, topicId: string, exerciseIds: readonly string[]): Lesson {
  return {
    id,
    topicId,
    title: id,
    content: { format: 'markdown', assetPath: `${id}.md` },
    exerciseIds,
    resourceIds: [],
  };
}

describe('practice-only studyMode logic', () => {
  it('identifies practice-only courses declaratively via studyMode', () => {
    expect(isPracticeOnlyCourse(undefined)).toBe(false);
    expect(isPracticeOnlyCourse(makeCourse('default-course', 'mathematics'))).toBe(false);
    expect(isPracticeOnlyCourse(makeCourse('explicit-default', 'mathematics', 'default'))).toBe(false);
    expect(isPracticeOnlyCourse(makeCourse('practice-course', 'mathematics', 'practice-only'))).toBe(true);
  });

  it('counts solved exercises toward lesson mastery and progress only on practice-only courses', () => {
    const practiceCourse = makeCourse('sample-practice', 'mathematics', 'practice-only');
    const defaultCourse = makeCourse('sample-default', 'physics');
    const lessons = [
      makeLesson('l-1', 't-1', ['ex-1a', 'ex-1b']),
      makeLesson('l-2', 't-2', ['ex-2a']),
    ];

    let state = emptyProgress();
    state = updateProgress(state, {
      type: 'attempt',
      exerciseId: 'ex-1a',
      correct: false,
      at: '2026-11-25T00:00:00.000Z',
    });

    expect(completedCourseLessonIds(practiceCourse, lessons, state)).toEqual([]);
    expect(courseEffectiveProgress(practiceCourse, lessons, state)).toBe(0);

    state = updateProgress(state, {
      type: 'attempt',
      exerciseId: 'ex-1b',
      correct: true,
      at: '2026-11-25T00:01:00.000Z',
    });
    expect(completedCourseLessonIds(practiceCourse, lessons, state)).toEqual(['l-1']);
    expect(courseEffectiveProgress(practiceCourse, lessons, state)).toBe(50);
    expect(completedCourseLessonIds(defaultCourse, lessons, state)).toEqual([]);
    expect(courseEffectiveProgress(defaultCourse, lessons, state)).toBe(0);

    state = updateProgress(state, { type: 'complete', lessonId: 'l-1', completed: true });
    state = updateProgress(state, { type: 'complete', lessonId: 'l-2', completed: true });
    expect(completedCourseLessonIds(practiceCourse, lessons, state)).toEqual(['l-1', 'l-2']);
    expect(courseEffectiveProgress(practiceCourse, lessons, state)).toBe(100);
  });

  it('aggregates subjectProgress using practice-based mastery for practice-only courses', () => {
    const practiceCourse = makeCourse('sample-practice', 'mathematics', 'practice-only');
    const theoryCourse = makeCourse('sample-theory', 'mathematics');
    const content = {
      chapters: [
        { id: 'ch-1', courseId: 'sample-practice', title: 'Ch1', topicIds: ['t-1'] },
        { id: 'ch-2', courseId: 'sample-theory', title: 'Ch2', topicIds: ['t-2'] },
      ],
      topics: [
        { id: 't-1', chapterId: 'ch-1', title: 'T1', lessonIds: ['l-1'] },
        { id: 't-2', chapterId: 'ch-2', title: 'T2', lessonIds: ['l-2'] },
      ],
      lessons: [
        makeLesson('l-1', 't-1', ['ex-1']),
        makeLesson('l-2', 't-2', ['ex-2']),
      ],
      exercises: [],
      resources: [],
    };
    const courses = [
      { ...practiceCourse, chapterIds: ['ch-1'] },
      { ...theoryCourse, chapterIds: ['ch-2'] },
    ];

    const state = updateProgress(emptyProgress(), {
      type: 'attempt',
      exerciseId: 'ex-1',
      correct: true,
      at: '2026-11-25T00:02:00.000Z',
    });

    expect(subjectProgress(content, courses, 'mathematics', state)).toBe(50);
    expect(effectiveCompletedLessonIds(courses, content, state)).toEqual(['l-1']);
  });
});
