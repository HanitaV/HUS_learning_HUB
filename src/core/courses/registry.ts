import type { Course, Subject } from '../../domain/learning';

const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function checkIds(ids: readonly string[], label: string): void {
  if (ids.some(id => !stableId.test(id))) throw new Error(`Invalid ${label} ID`);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} ID`);
}

/** Accepts trusted, compiled manifests; external JSON requires a separate parser. */
export function createCourseRegistry(courses: readonly Course[], subjects: readonly Subject[]) {
  checkIds(subjects.map(subject => subject.id), 'subject');
  checkIds(courses.map(course => course.id), 'course');
  const subjectIds = new Set(subjects.map(subject => subject.id));
  const entries = courses.map(course => {
    if (!subjectIds.has(course.subjectId)) throw new Error(`Unknown subject: ${course.subjectId}`);
    checkIds(course.chapterIds, 'chapter');
    checkIds(course.resourceIds, 'resource');
    return Object.freeze({
      ...course,
      chapterIds: Object.freeze([...course.chapterIds]),
      resourceIds: Object.freeze([...course.resourceIds]),
      provenance: Object.freeze({ ...course.provenance }),
    });
  });
  const catalogue = Object.freeze(entries);
  const byId = new Map(catalogue.map(course => [course.id, course]));
  return Object.freeze({
    list: (): readonly Course[] => catalogue,
    get: (id: string): Course | undefined => byId.get(id),
  });
}
