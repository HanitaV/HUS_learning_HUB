import type { Course, EntityId, Subject } from '../../domain/learning';

export const DEFAULT_ORBIT_PAGE_SIZE = 6;
export const DEFAULT_LIST_PAGE_SIZE = 24;
export const AUTO_LIST_THRESHOLD = 18;

export type CoursesLayoutMode = 'orbit' | 'list';

export interface CourseFilterQuery {
  readonly search?: string;
  readonly subjectId?: EntityId | 'all';
  readonly status?: Course['status'] | 'all';
}

export interface SubjectCourseGroup {
  readonly subject: Subject;
  readonly courses: readonly Course[];
}

export interface PageWindow<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageCount: number;
  readonly totalItems: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
}

/**
 * Recommends the initial /courses layout based on catalogue scale.
 * Small catalogues open in the Orbital Universe; larger catalogues default to
 * scannable list mode while keeping orbital spotlight one click away.
 */
export function recommendCoursesLayout(totalCourseCount: number): CoursesLayoutMode {
  return totalCourseCount >= AUTO_LIST_THRESHOLD ? 'list' : 'orbit';
}

/**
 * Slices an ordered collection into a clamped page window for O(1) orbital
 * rendering or paginated list views.
 */
export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
): PageWindow<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / safePageSize));
  const page = Math.min(Math.max(0, Math.floor(requestedPage)), pageCount - 1);
  const startIndex = totalItems === 0 ? 0 : page * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    page,
    pageCount,
    totalItems,
    startIndex,
    endIndex,
    hasPrev: page > 0,
    hasNext: page + 1 < pageCount,
  };
}

/**
 * Normalizes Vietnamese text for accent-insensitive matching.
 * Handles đ/Đ explicitly before NFD diacritic stripping.
 */
export function normalizeVietnamese(value: string): string {
  return value
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function getCourseSubject(
  course: Course,
  subjects: readonly Subject[],
): Subject | undefined {
  return subjects.find(subject => subject.id === course.subjectId);
}

function scoreCourseMatch(
  course: Course,
  subjectTitle: string,
  normalizedSearch: string,
): number {
  const code = normalizeVietnamese(course.academicCode ?? '');
  const id = normalizeVietnamese(course.id);
  const title = normalizeVietnamese(course.title);
  const subject = normalizeVietnamese(subjectTitle);

  let score = 0;
  if (code === normalizedSearch || id === normalizedSearch) {
    score = 100;
  } else if (code.startsWith(normalizedSearch) || id.startsWith(normalizedSearch)) {
    score = 85;
  } else if (title.startsWith(normalizedSearch)) {
    score = 70;
  } else if (title.includes(normalizedSearch)) {
    score = 55;
  } else if (subject.includes(normalizedSearch)) {
    score = 30;
  } else {
    const combined = `${code} ${id} ${title} ${subject}`.trim();
    if (combined.includes(normalizedSearch)) {
      score = 20;
    }
  }

  if (score === 0) return 0;
  return score + (course.status === 'available' ? 5 : 0);
}

export function filterCourses(
  courses: readonly Course[],
  subjects: readonly Subject[],
  query: CourseFilterQuery,
): readonly Course[] {
  const normalizedSearch = normalizeVietnamese(query.search ?? '');
  const subjectById = new Map(subjects.map(subject => [subject.id, subject]));

  const matched = courses.filter(course => {
    if (query.subjectId && query.subjectId !== 'all' && course.subjectId !== query.subjectId) {
      return false;
    }
    if (query.status && query.status !== 'all' && course.status !== query.status) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    const subjectTitle = subjectById.get(course.subjectId)?.title ?? '';
    return scoreCourseMatch(course, subjectTitle, normalizedSearch) > 0;
  });

  if (!normalizedSearch) {
    return matched;
  }

  return matched
    .map((course, index) => ({
      course,
      index,
      score: scoreCourseMatch(
        course,
        subjectById.get(course.subjectId)?.title ?? '',
        normalizedSearch,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.course);
}

export function groupCoursesBySubject(
  courses: readonly Course[],
  subjects: readonly Subject[],
): readonly SubjectCourseGroup[] {
  const bySubject = new Map<EntityId, Course[]>();
  for (const course of courses) {
    const bucket = bySubject.get(course.subjectId);
    if (bucket) {
      bucket.push(course);
    } else {
      bySubject.set(course.subjectId, [course]);
    }
  }

  return subjects.map(subject => ({
    subject,
    courses: bySubject.get(subject.id) ?? [],
  }));
}

export function buildProvenanceUrl(course: Course): string | undefined {
  const repo = course.provenance.repository.replace(/\/+$/, '');
  if (!repo.startsWith('https://github.com/')) return undefined;
  const encodedPath = course.provenance.path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${repo}/blob/${course.provenance.revision}/${encodedPath}`;
}
