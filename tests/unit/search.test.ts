import { describe, expect, it } from 'vitest';
import {
  AUTO_LIST_THRESHOLD,
  DEFAULT_ORBIT_PAGE_SIZE,
  buildProvenanceUrl,
  filterCourses,
  getCourseSubject,
  groupCoursesBySubject,
  normalizeVietnamese,
  paginateItems,
  recommendCoursesLayout,
} from '../../src/core/courses/search';
import { searchContent, type SearchEntry } from '../../src/core/learning/search';
import { extractMatchSnippet } from '../../src/components/ui/SearchHighlight';
import type { Course, Subject } from '../../src/domain/learning';

const subjects: readonly Subject[] = [
  { id: 'computer-science', title: 'Khoa học máy tính' },
  { id: 'chemistry', title: 'Hóa học' },
  { id: 'physics', title: 'Vật lý' },
];

const mat3504: Course = {
  schemaVersion: 1,
  id: 'mat3504',
  academicCode: 'MAT3504',
  subjectId: 'computer-science',
  title: 'Thiết kế và đánh giá thuật toán',
  language: 'vi',
  status: 'available',
  chapterIds: ['ch-1'],
  resourceIds: [],
  provenance: {
    repository: 'https://github.com/example/DSA-HUS',
    revision: '01e2385bc1bbf16e3b7a2ab527e1b572ae06360d',
    path: 'data/courses/MAT3504.json',
    rights: 'approved',
  },
};

const mat3514: Course = {
  schemaVersion: 1,
  id: 'mat3514',
  academicCode: 'MAT3514',
  subjectId: 'computer-science',
  title: 'Cấu trúc dữ liệu và giải thuật',
  language: 'vi',
  status: 'available',
  chapterIds: ['ch-1'],
  resourceIds: [],
  provenance: {
    repository: 'https://github.com/example/DSA-HUS',
    revision: '01e2385bc1bbf16e3b7a2ab527e1b572ae06360d',
    path: 'data/courses/MAT3514.json',
    rights: 'approved',
  },
};

const phy1159: Course = {
  schemaVersion: 1,
  id: 'phy1159',
  academicCode: 'PHY1159',
  subjectId: 'physics',
  title: 'Vật lý đại cương 1',
  language: 'vi',
  status: 'available',
  chapterIds: ['ch-1'],
  resourceIds: [],
  provenance: {
    repository: 'https://github.com/example/VLDC-HUS',
    revision: '01e2385bc1bbf16e3b7a2ab527e1b572ae06360d',
    path: 'data/courses/PHY1159.json',
    rights: 'approved',
  },
};

describe('course search and grouping', () => {
  it('normalizes Vietnamese diacritics and đ/Đ consistently', () => {
    expect(normalizeVietnamese('Thiết kế và đánh giá thuật toán')).toBe(
      'thiet ke va danh gia thuat toan',
    );
    expect(normalizeVietnamese('  ĐẠI số   tuyến tính  ')).toBe('dai so tuyen tinh');
  });

  it('filters courses by accent-insensitive title, academic code, subject, and status', () => {
    const courses = [mat3504];

    expect(filterCourses(courses, subjects, { search: 'thiet ke' })).toHaveLength(1);
    expect(filterCourses(courses, subjects, { search: 'danh gia' })).toHaveLength(1);
    expect(filterCourses(courses, subjects, { search: 'mat3504' })).toHaveLength(1);
    expect(filterCourses(courses, subjects, { search: 'khoa hoc may tinh' })).toHaveLength(1);
    expect(filterCourses(courses, subjects, { search: 'vat ly' })).toHaveLength(0);

    expect(filterCourses(courses, subjects, { subjectId: 'computer-science' })).toHaveLength(1);
    expect(filterCourses(courses, subjects, { subjectId: 'physics' })).toHaveLength(0);

    expect(filterCourses(courses, subjects, { status: 'metadata-only' })).toHaveLength(0);
    expect(filterCourses(courses, subjects, { status: 'available' })).toHaveLength(1);
  });

  it('groups courses by all registered subjects in order', () => {
    const groups = groupCoursesBySubject([mat3504], subjects);
    expect(groups).toHaveLength(subjects.length);
    expect(groups[0]?.subject.id).toBe('computer-science');
    expect(groups[0]?.courses).toHaveLength(1);
    expect(groups[1]?.courses).toHaveLength(0);
    expect(groups[2]?.courses).toHaveLength(0);
  });

  it('resolves course subject and immutable provenance URL', () => {
    expect(getCourseSubject(mat3504, subjects)?.title).toBe('Khoa học máy tính');
    expect(buildProvenanceUrl(mat3504)).toBe(
      'https://github.com/example/DSA-HUS/blob/01e2385bc1bbf16e3b7a2ab527e1b572ae06360d/data/courses/MAT3504.json',
    );
  });

  it('does not create public source links for local authored archives', () => {
    expect(buildProvenanceUrl({ ...phy1159, provenance: {
      ...phy1159.provenance, repository: 'local:docs/HUS-learning-resource',
      revision: 'sha256:local-content-hash',
    } })).toBeUndefined();
  });

  it('ranks exact academic code matches ahead of broader matches', () => {
    const courses = [mat3514, phy1159, mat3504];
    const results = filterCourses(courses, subjects, { search: 'mat3504' });
    expect(results.map(c => c.id)).toEqual(['mat3504']);

    const prefixResults = filterCourses(courses, subjects, { search: 'mat' });
    expect(prefixResults.map(c => c.id)).toEqual(['mat3514', 'mat3504']);
  });

  it('paginates large course collections safely with O(1) orbital window clamping', () => {
    const hundredIds = Array.from({ length: 100 }, (_, i) => `course-${i + 1}`);

    const firstOrbit = paginateItems(hundredIds, 0, DEFAULT_ORBIT_PAGE_SIZE);
    expect(firstOrbit.items).toHaveLength(DEFAULT_ORBIT_PAGE_SIZE);
    expect(firstOrbit.pageCount).toBe(17);
    expect(firstOrbit.hasPrev).toBe(false);
    expect(firstOrbit.hasNext).toBe(true);

    const lastOrbit = paginateItems(hundredIds, 999, DEFAULT_ORBIT_PAGE_SIZE);
    expect(lastOrbit.page).toBe(16);
    expect(lastOrbit.items).toEqual(['course-97', 'course-98', 'course-99', 'course-100']);
    expect(lastOrbit.hasPrev).toBe(true);
    expect(lastOrbit.hasNext).toBe(false);

    const clampedNegative = paginateItems(hundredIds, -5, DEFAULT_ORBIT_PAGE_SIZE);
    expect(clampedNegative.page).toBe(0);

    const emptyWindow = paginateItems([], 2, DEFAULT_ORBIT_PAGE_SIZE);
    expect(emptyWindow.items).toEqual([]);
    expect(emptyWindow.page).toBe(0);
    expect(emptyWindow.pageCount).toBe(1);
    expect(emptyWindow.hasPrev).toBe(false);
    expect(emptyWindow.hasNext).toBe(false);
  });

  it('recommends orbit layout for small catalogues and list layout at scale', () => {
    expect(recommendCoursesLayout(6)).toBe('orbit');
    expect(recommendCoursesLayout(AUTO_LIST_THRESHOLD - 1)).toBe('orbit');
    expect(recommendCoursesLayout(AUTO_LIST_THRESHOLD)).toBe('list');
    expect(recommendCoursesLayout(120)).toBe('list');
  });

  it('searches cached entries accurately and extracts bounded snippets from long Vietnamese text', () => {
    const padding = 'Nội dung mở đầu về phương pháp phân tích và bài tập tự luận. '.repeat(200);
    const body = `${padding}Định lý giá trị trung bình của Giải tích I và công thức $\\frac{1}{2} \\Delta x$. ${padding}`;
    const entries: readonly SearchEntry[] = [
      {
        id: 'mat1091-sample',
        title: 'Giải tích I — Định lý cơ bản',
        text: body,
        kind: 'lesson',
        to: '/courses/mat1091',
        courseId: 'mat1091',
        subjectId: 'mathematics',
      },
    ];

    expect(searchContent(entries, 'giai tich')).toHaveLength(1);
    expect(searchContent(entries, 'dinh ly trung binh')).toHaveLength(1);
    expect(searchContent(entries, 'khong co ket qua')).toHaveLength(0);

    const snippet = extractMatchSnippet(body, 'dinh ly gia tri');
    expect(snippet).not.toBeNull();
    expect(snippet).toContain('Định lý giá trị trung bình');
    expect(snippet).toContain('1/2 Δ x');
    expect(snippet!.length).toBeLessThanOrEqual(160);
  });
});
