import { describe, expect, it } from 'vitest';
import { buildChapterGraph, buildLessonGraph } from '../../src/core/learning/graph';
import type { Course } from '../../src/domain/learning';
import type { LearningContent } from '../../src/domain/workspace';

const sampleCourse: Course = {
  schemaVersion: 1,
  id: 'sample-course',
  academicCode: 'SCI101',
  subjectId: 'science',
  title: 'Học phần mẫu',
  language: 'vi',
  status: 'available',
  chapterIds: ['ch-1', 'ch-2', 'ch-3'],
  resourceIds: [],
  provenance: {
    repository: 'local:template',
    revision: 'template',
    path: 'sample',
    rights: 'approved',
  },
};

const sampleContent: LearningContent = {
  chapters: [
    { id: 'ch-1', courseId: 'sample-course', title: 'Chương 1', topicIds: ['t-1a', 't-1b'] },
    { id: 'ch-2', courseId: 'sample-course', title: 'Chương 2', topicIds: ['t-2'] },
    { id: 'ch-3', courseId: 'sample-course', title: 'Chương 3', topicIds: ['t-3'] },
  ],
  topics: [
    { id: 't-1a', chapterId: 'ch-1', title: 'Chủ đề 1A', lessonIds: ['l-1'] },
    { id: 't-1b', chapterId: 'ch-1', title: 'Chủ đề 1B', lessonIds: ['l-2'], prerequisiteIds: ['t-1a'] },
    { id: 't-2', chapterId: 'ch-2', title: 'Chủ đề 2', lessonIds: ['l-3'], prerequisiteIds: ['t-1b'] },
    { id: 't-3', chapterId: 'ch-3', title: 'Chủ đề 3', lessonIds: ['l-4'], prerequisiteIds: ['t-2'] },
  ],
  lessons: [
    {
      id: 'l-1',
      topicId: 't-1a',
      title: 'Bài 1',
      summary: 'Cơ bản',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-1.md' },
      exerciseIds: [],
      resourceIds: [],
    },
    {
      id: 'l-2',
      topicId: 't-1b',
      title: 'Bài 2',
      summary: 'Tiếp nối',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-2.md' },
      exerciseIds: [],
      resourceIds: [],
    },
    {
      id: 'l-3',
      topicId: 't-2',
      title: 'Bài 3',
      summary: 'Chương 2',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-3.md' },
      exerciseIds: [],
      resourceIds: [],
    },
    {
      id: 'l-4',
      topicId: 't-3',
      title: 'Bài 4',
      summary: 'Chương 3',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-4.md' },
      exerciseIds: [],
      resourceIds: [],
    },
  ],
  exercises: [],
  resources: [],
};

describe('learning prerequisite graph layout', () => {
  it('builds inter-chapter topological tiers', () => {
    const graph = buildChapterGraph(sampleCourse, sampleContent);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges.length).toBeGreaterThanOrEqual(2);

    const byId = new Map(graph.nodes.map(n => [n.chapter.id, n]));
    expect(byId.get('ch-1')?.tier).toBe(0);
    expect(byId.get('ch-2')?.tier).toBe(1);
    expect(byId.get('ch-3')?.tier).toBe(2);
    expect(byId.get('ch-2')?.directPrereqChapterIds).toContain('ch-1');
    expect(byId.get('ch-2')?.directNextChapterIds).toContain('ch-3');
  });

  it('builds lesson DAG with external prerequisite and unlock bridges for a focused chapter', () => {
    const ch2Graph = buildLessonGraph(sampleCourse, sampleContent, 'ch-2');
    const externalPrereqs = ch2Graph.nodes.filter(n => n.kind === 'external-prereq');
    expect(externalPrereqs.length).toBeGreaterThan(0);
    expect(externalPrereqs.every(n => n.tier === 0)).toBe(true);

    const nodeById = new Map(ch2Graph.nodes.map(n => [n.id, n]));
    for (const edge of ch2Graph.edges) {
      const from = nodeById.get(edge.fromId);
      const to = nodeById.get(edge.toId);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      expect(from!.tier).toBeLessThan(to!.tier);
    }

    const ch1Graph = buildLessonGraph(sampleCourse, sampleContent, 'ch-1');
    const externalNext = ch1Graph.nodes.filter(n => n.kind === 'external-next');
    expect(externalNext.length).toBeGreaterThan(0);

    const lesson2 = ch1Graph.nodes.find(n => n.id === 'l-2');
    expect(lesson2?.ancestorIds).toContain('l-1');
  });

  it('handles full-course DAGs and metadata-only courses cleanly', () => {
    const fullGraph = buildLessonGraph(sampleCourse, sampleContent, null);
    expect(fullGraph.nodes).toHaveLength(4);
    expect(fullGraph.edges.length).toBeGreaterThan(0);

    const metadataOnly = { ...sampleCourse, chapterIds: [] };
    expect(buildChapterGraph(metadataOnly, sampleContent).nodes).toHaveLength(0);
    expect(buildLessonGraph(metadataOnly, sampleContent, null).nodes).toHaveLength(0);
  });
});
