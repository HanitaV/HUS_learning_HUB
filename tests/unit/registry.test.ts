import { describe, expect, it } from 'vitest';
import { createCourseRegistry } from '../../src/core/courses/registry';
import type { Course, Subject } from '../../src/domain/learning';

const sampleSubjects: readonly Subject[] = [
  { id: 'computer-science', title: 'Khoa học máy tính' },
  { id: 'mathematics', title: 'Toán học' },
];

const sampleCourse: Course = {
  schemaVersion: 1,
  id: 'sample-algo',
  academicCode: 'CS101',
  subjectId: 'computer-science',
  title: 'Thiết kế và đánh giá thuật toán',
  language: 'vi',
  status: 'available',
  chapterIds: ['ch-1'],
  resourceIds: [],
  provenance: {
    repository: 'https://github.com/example/course-repo',
    revision: '0123456789abcdef0123456789abcdef01234567',
    path: 'courses/CS101.json',
    rights: 'approved',
  },
};

describe('course registry', () => {
  it('finds verified metadata by stable ID and returns undefined for an unknown course', () => {
    const registry = createCourseRegistry([sampleCourse], sampleSubjects);
    expect(registry.get('sample-algo')?.academicCode).toBe('CS101');
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.list()).toHaveLength(1);
  });
  it('rejects duplicate IDs instead of silently replacing courses', () => {
    expect(() => createCourseRegistry([sampleCourse, sampleCourse], sampleSubjects)).toThrow(/duplicate/i);
  });
  it('rejects unknown subject references', () => {
    expect(() => createCourseRegistry([{ ...sampleCourse, subjectId: 'missing' }], sampleSubjects)).toThrow(/subject/i);
  });
  it('rejects path-dependent IDs and repeated chapter references', () => {
    expect(() => createCourseRegistry([{ ...sampleCourse, id: '../course' }], sampleSubjects)).toThrow(/id/i);
    expect(() => createCourseRegistry([{ ...sampleCourse, chapterIds: ['intro', 'intro'] }], sampleSubjects)).toThrow(/chapter/i);
  });
  it('does not expose the caller array as mutable registry state', () => {
    const courses = [sampleCourse];
    const registry = createCourseRegistry(courses, sampleSubjects);
    courses.pop();
    expect(registry.list()).toHaveLength(1);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });
});
