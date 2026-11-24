import { describe, expect, it } from 'vitest';
import {
  buildChapterPathway,
  buildGoalCatalog,
  buildGoalPathway,
  buildNeighborhoodFlow,
  filterGoalCatalog,
} from '../../src/core/learning/goal-pathway';
import type { Course } from '../../src/domain/learning';
import type { SkillQuest } from '../../src/domain/skill-quest';
import type { LearningContent } from '../../src/domain/workspace';

describe('goal-pathway and catalog (chapter-first)', () => {
  const provenance = {
    repository: 'local:test',
    revision: '1',
    path: 'course.ts',
    rights: 'approved' as const,
  };

  const mockCourses: readonly Course[] = [
    {
      schemaVersion: 1,
      id: 'thcs4',
      academicCode: 'THCS4',
      subjectId: 'computer-science',
      title: 'Lập trình cơ bản',
      language: 'vi',
      status: 'available',
      chapterIds: ['ch1', 'ch2'],
      resourceIds: [],
      provenance,
    },
    {
      schemaVersion: 1,
      id: 'math1',
      academicCode: 'MATH1',
      subjectId: 'mathematics',
      title: 'Toán cao cấp',
      language: 'vi',
      status: 'available',
      chapterIds: ['ch-math-1'],
      resourceIds: [],
      provenance,
    },
  ];

  const mockContent: LearningContent = {
    chapters: [
      { id: 'ch1', courseId: 'thcs4', title: 'Chương 1: Khởi đầu', topicIds: ['t1', 't2'] },
      { id: 'ch2', courseId: 'thcs4', title: 'Chương 2: Nâng cao', topicIds: ['t3'] },
      { id: 'ch-math-1', courseId: 'math1', title: 'Chương 1: Đại số', topicIds: ['t-math-1'] },
    ],
    topics: [
      { id: 't1', chapterId: 'ch1', title: 'Biến', lessonIds: ['l1'], prerequisiteIds: [] },
      { id: 't2', chapterId: 'ch1', title: 'Mảng', lessonIds: ['l2'], prerequisiteIds: [] },
      { id: 't3', chapterId: 'ch2', title: 'Đệ quy', lessonIds: ['l3'], prerequisiteIds: ['t1'] },
      { id: 't-math-1', chapterId: 'ch-math-1', title: 'Ma trận', lessonIds: ['l-math-1'], prerequisiteIds: [] },
    ],
    lessons: [
      { id: 'l1', topicId: 't1', title: 'Phương thức cơ bản', content: { format: 'markdown', assetPath: 'a.md' }, exerciseIds: [], resourceIds: [] },
      { id: 'l2', topicId: 't2', title: 'Mảng một chiều', content: { format: 'markdown', assetPath: 'b.md' }, exerciseIds: [], resourceIds: [] },
      { id: 'l3', topicId: 't3', title: 'Đệ quy Euclid', content: { format: 'markdown', assetPath: 'c.md' }, exerciseIds: [], resourceIds: [] },
      { id: 'l-math-1', topicId: 't-math-1', title: 'Định thức', content: { format: 'markdown', assetPath: 'm.md' }, exerciseIds: [], resourceIds: [] },
    ],
    exercises: [],
    resources: [],
  };

  const mockQuests: readonly SkillQuest[] = [
    {
      id: 'quest-rec',
      courseId: 'thcs4',
      subjectId: 'computer-science',
      lessonId: 'l3',
      title: 'Làm chủ Đệ quy',
      subtitle: 'Từ phanh dừng tới bài lớn',
      categoryLabel: 'Đệ quy',
      estimatedMinutes: 8,
      milestones: [],
    },
  ];

  it('ranks chapters first, then quests, then lessons, and sorts Chapter 1 before Chapter 2 when courseId is all', () => {
    const catalog = buildGoalCatalog(mockCourses, mockContent, mockQuests);
    
    // Chapters should be at the top
    expect(catalog[0]?.kind).toBe('chapter');
    expect(catalog[1]?.kind).toBe('chapter');
    expect(catalog[2]?.kind).toBe('chapter');

    const chapterItems = catalog.filter(item => item.kind === 'chapter');
    const indices = chapterItems.map(i => i.chapterIndex);
    expect(indices).toEqual([1, 2, 1]);

    const filteredByKind = filterGoalCatalog(catalog, { kind: 'chapter' });
    expect(filteredByKind.every(item => item.kind === 'chapter')).toBe(true);

    const filteredByChapterId = filterGoalCatalog(catalog, { chapterId: 'ch1' });
    expect(filteredByChapterId.some(item => item.id === 'chapter:ch1')).toBe(true);

    const matches = filterGoalCatalog(catalog, { query: 'khoi dau' });
    expect(matches.map(m => m.id)).toContain('chapter:ch1');
  });

  it('buildChapterPathway returns all lessons in sequential order, sets target, and handles completion', () => {
    const pathway = buildChapterPathway('ch1', mockContent, ['l1'], [], mockQuests);
    expect(pathway.stations.map(s => s.lessonId)).toEqual(['l1', 'l2']);
    expect(pathway.stations[0]?.completed).toBe(true);
    expect(pathway.stations[0]?.isTarget).toBe(false);
    expect(pathway.stations[1]?.completed).toBe(false);
    expect(pathway.stations[1]?.isTarget).toBe(true);
    expect(pathway.targetLessonId).toBe('l2');
    expect(pathway.remainingCount).toBe(1);
  });

  it('preserves existing buildGoalPathway prerequisite test', () => {
    const pathway = buildGoalPathway('l3', mockCourses[0]!, mockContent, ['l1'], ['quest-rec'], mockQuests);
    expect(pathway.stations.map(s => s.lessonId)).toEqual(['l1', 'l3']);
    expect(pathway.stations[0]?.completed).toBe(true);
    expect(pathway.stations[1]?.completed).toBe(true);
    expect(pathway.remainingCount).toBe(0);
  });

  it('builds neighborhood flow for chapters and lessons correctly', () => {
    const course = mockCourses[0]!;
    const flowCh1 = buildNeighborhoodFlow({ kind: 'chapter', chapterId: 'ch1' }, course, mockContent, [], [], mockQuests);
    expect(flowCh1.scope).toBe('chapter');
    expect(flowCh1.beforeNodes.length).toBe(0);
    expect(flowCh1.afterNodes.length).toBe(1);
    expect(flowCh1.afterNodes[0]?.id).toBe('ch2');

    const flowCh2 = buildNeighborhoodFlow({ kind: 'chapter', chapterId: 'ch2' }, course, mockContent, [], [], mockQuests);
    expect(flowCh2.beforeNodes.length).toBe(1);
    expect(flowCh2.beforeNodes[0]?.id).toBe('ch1');

    const flowLesson = buildNeighborhoodFlow({ kind: 'lesson', lessonId: 'l3' }, course, mockContent, [], [], mockQuests);
    expect(flowLesson.scope).toBe('lesson');
    expect(flowLesson.beforeNodes.some(n => n.id === 'l1')).toBe(true);
  });
});
