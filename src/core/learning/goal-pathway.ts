import type { Chapter, Course, EntityId, Topic } from '../../domain/learning';
import type { SkillQuest } from '../../domain/skill-quest';
import type { LearningContent } from '../../domain/workspace';
import { normalizeVietnamese } from '../courses/search';
import { buildChapterGraph, buildLessonGraph } from './graph';

export type GoalCatalogKind = 'chapter' | 'quest' | 'lesson';

export interface GoalCatalogItem {
  readonly id: string;
  readonly kind: GoalCatalogKind;
  readonly title: string;
  readonly subtitle: string;
  readonly categoryLabel: string;
  readonly courseId: EntityId;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly subjectId: EntityId;
  readonly lessonId: EntityId;
  readonly chapterId?: EntityId;
  readonly chapterIndex?: number;
  readonly lessonIds?: readonly EntityId[];
  readonly questId?: EntityId;
  readonly estimatedMinutes: number;
}

export interface GoalCatalogFilter {
  readonly query?: string;
  readonly subjectId?: EntityId | 'all';
  readonly courseId?: EntityId | 'all';
  readonly chapterId?: EntityId | 'all';
  readonly kind?: 'all' | GoalCatalogKind;
}

export interface GoalPathwayStation {
  readonly lessonId: EntityId;
  readonly title: string;
  readonly isTarget: boolean;
  readonly completed: boolean;
  readonly questId?: EntityId;
}

export interface GoalPathway {
  readonly targetLessonId: EntityId;
  readonly stations: readonly GoalPathwayStation[];
  readonly remainingCount: number;
}

export interface NeighborhoodFlowNode {
  readonly id: string;
  readonly kind: 'chapter' | 'lesson';
  readonly codeLabel: string;
  readonly title: string;
  readonly relationLabel: string;
  readonly completed: boolean;
  readonly to: string;
  readonly goalId: string;
  readonly questId?: EntityId;
}

export interface NeighborhoodFlowGraph {
  readonly scope: 'chapter' | 'lesson';
  readonly beforeNodes: readonly NeighborhoodFlowNode[];
  readonly center: {
    readonly id: string;
    readonly codeLabel: string;
    readonly title: string;
    readonly subtitle: string;
    readonly completed: boolean;
  };
  readonly afterNodes: readonly NeighborhoodFlowNode[];
}

export function buildNeighborhoodFlow(
  target:
    | { readonly kind: 'chapter'; readonly chapterId: EntityId }
    | { readonly kind: 'lesson'; readonly lessonId: EntityId },
  course: Course,
  content: LearningContent,
  completedLessonIds: readonly string[],
  completedQuestIds: readonly string[],
  quests: readonly SkillQuest[],
): NeighborhoodFlowGraph {
  const completedLessonSet = new Set(completedLessonIds);
  const completedQuestSet = new Set(completedQuestIds);
  const isLessonDone = (lessonId: string): boolean =>
    completedLessonSet.has(lessonId) ||
    quests.some(q => q.lessonId === lessonId && completedQuestSet.has(q.id));
  const cleanChapterTitle = (raw: string): string =>
    raw.replace(/^Chương\s*\d+\s*[:.\-–—]?\s*/i, '').trim() || raw;

  if (target.kind === 'chapter') {
    const chapterGraph = buildChapterGraph(course, content);
    const centerCh = chapterGraph.nodes.find(n => n.chapter.id === target.chapterId);
    if (!centerCh) {
      return {
        scope: 'chapter',
        beforeNodes: [],
        center: {
          id: target.chapterId,
          codeLabel: course.academicCode ?? course.id,
          title: target.chapterId,
          subtitle: course.title,
          completed: false,
        },
        afterNodes: [],
      };
    }

    const toChapterFlowNode = (
      node: (typeof chapterGraph.nodes)[number],
      relationLabel: string,
    ): NeighborhoodFlowNode => {
      const doneCount = node.lessonIds.filter(isLessonDone).length;
      const completed = node.lessonIds.length > 0 && doneCount === node.lessonIds.length;
      const firstQuest = quests.find(q => node.lessonIds.includes(q.lessonId));
      return {
        id: node.chapter.id,
        kind: 'chapter',
        codeLabel: `Chương ${node.chapterIndex + 1}`,
        title: cleanChapterTitle(node.chapter.title),
        relationLabel,
        completed,
        to: `/courses/${course.id}?chapter=${encodeURIComponent(node.chapter.id)}`,
        goalId: `chapter:${node.chapter.id}`,
        ...(firstQuest ? { questId: firstQuest.id } : {}),
      };
    };

    let beforeNodes: readonly NeighborhoodFlowNode[] = [];
    if (centerCh.directPrereqChapterIds.length > 0) {
      beforeNodes = chapterGraph.nodes
        .filter(n => centerCh.directPrereqChapterIds.includes(n.chapter.id))
        .map(n => toChapterFlowNode(n, 'Chương tiên quyết'))
        .slice(0, 3);
    } else if (centerCh.chapterIndex > 0) {
      const prev = chapterGraph.nodes[centerCh.chapterIndex - 1];
      if (prev) {
        beforeNodes = [toChapterFlowNode(prev, 'Chương liền trước')];
      }
    }

    let afterNodes: readonly NeighborhoodFlowNode[] = [];
    if (centerCh.directNextChapterIds.length > 0) {
      afterNodes = chapterGraph.nodes
        .filter(n => centerCh.directNextChapterIds.includes(n.chapter.id))
        .map(n => toChapterFlowNode(n, 'Mở khóa chương sau'))
        .slice(0, 3);
    } else if (centerCh.chapterIndex + 1 < chapterGraph.nodes.length) {
      const next = chapterGraph.nodes[centerCh.chapterIndex + 1];
      if (next) {
        afterNodes = [toChapterFlowNode(next, 'Chương kế tiếp')];
      }
    }

    const doneCount = centerCh.lessonIds.filter(isLessonDone).length;
    const completed = centerCh.lessonIds.length > 0 && doneCount === centerCh.lessonIds.length;

    return {
      scope: 'chapter',
      beforeNodes,
      center: {
        id: centerCh.chapter.id,
        codeLabel: `Chương ${centerCh.chapterIndex + 1} · ${course.academicCode ?? course.id}`,
        title: cleanChapterTitle(centerCh.chapter.title),
        subtitle: `${doneCount}/${centerCh.lessonIds.length} bài hoàn thành · ${course.title}`,
        completed,
      },
      afterNodes,
    };
  } else {
    const lessonGraph = buildLessonGraph(course, content, null);
    const idx = lessonGraph.nodes.findIndex(n => n.id === target.lessonId);
    const centerNode = lessonGraph.nodes[idx];
    if (!centerNode || idx === -1) {
      return {
        scope: 'lesson',
        beforeNodes: [],
        center: {
          id: target.lessonId,
          codeLabel: course.academicCode ?? course.id,
          title: target.lessonId,
          subtitle: course.title,
          completed: isLessonDone(target.lessonId),
        },
        afterNodes: [],
      };
    }

    const toLessonFlowNode = (
      node: (typeof lessonGraph.nodes)[number],
      relationLabel: string,
    ): NeighborhoodFlowNode => {
      const q = quests.find(item => item.lessonId === node.id);
      return {
        id: node.id,
        kind: 'lesson',
        codeLabel: `Bài ${node.chapterIndex + 1}.${node.lessonIndexInChapter}`,
        title: node.lesson.title,
        relationLabel,
        completed: isLessonDone(node.id),
        to: `/courses/${course.id}/lessons/${node.id}`,
        goalId: q ? `quest:${q.id}` : `lesson:${node.id}`,
        ...(q ? { questId: q.id } : {}),
      };
    };

    const beforeMap = new Map<string, NeighborhoodFlowNode>();
    for (const prereqId of centerNode.directPrereqIds) {
      const node = lessonGraph.nodes.find(n => n.id === prereqId);
      if (node && !beforeMap.has(node.id)) {
        beforeMap.set(node.id, toLessonFlowNode(node, 'Bài tiên quyết'));
      }
    }
    const topicLessonIds = centerNode.topic.lessonIds;
    const topicIdx = topicLessonIds.indexOf(target.lessonId);
    if (topicIdx > 0) {
      const prevTopicLessonId = topicLessonIds[topicIdx - 1];
      const node = lessonGraph.nodes.find(n => n.id === prevTopicLessonId);
      if (node && !beforeMap.has(node.id)) {
        beforeMap.set(node.id, toLessonFlowNode(node, 'Phần liền trước'));
      }
    }
    if (beforeMap.size === 0 && idx > 0) {
      const prev = lessonGraph.nodes[idx - 1];
      if (prev && !beforeMap.has(prev.id)) {
        beforeMap.set(prev.id, toLessonFlowNode(prev, 'Bài liền trước'));
      }
    }
    const beforeNodes = Array.from(beforeMap.values()).slice(0, 3);

    const afterMap = new Map<string, NeighborhoodFlowNode>();
    for (const nextId of centerNode.directNextIds) {
      const node = lessonGraph.nodes.find(n => n.id === nextId);
      if (node && !afterMap.has(node.id)) {
        afterMap.set(node.id, toLessonFlowNode(node, 'Mở khóa trực tiếp'));
      }
    }
    if (topicIdx !== -1 && topicIdx + 1 < topicLessonIds.length) {
      const nextTopicLessonId = topicLessonIds[topicIdx + 1];
      const node = lessonGraph.nodes.find(n => n.id === nextTopicLessonId);
      if (node && !afterMap.has(node.id)) {
        afterMap.set(node.id, toLessonFlowNode(node, 'Phần kế tiếp'));
      }
    }
    if (afterMap.size === 0 && idx + 1 < lessonGraph.nodes.length) {
      const next = lessonGraph.nodes[idx + 1];
      if (next && !afterMap.has(next.id)) {
        afterMap.set(next.id, toLessonFlowNode(next, 'Bài kế tiếp'));
      }
    }
    const afterNodes = Array.from(afterMap.values()).slice(0, 3);

    return {
      scope: 'lesson',
      beforeNodes,
      center: {
        id: centerNode.id,
        codeLabel: `Bài ${centerNode.chapterIndex + 1}.${centerNode.lessonIndexInChapter} · Chương ${centerNode.chapterIndex + 1}`,
        title: centerNode.lesson.title,
        subtitle: `Thuộc Chương ${centerNode.chapterIndex + 1}: ${cleanChapterTitle(centerNode.chapter.title)}`,
        completed: isLessonDone(centerNode.id),
      },
      afterNodes,
    };
  }
}

export function buildGoalCatalog(
  courses: readonly Course[],
  content: LearningContent,
  quests: readonly SkillQuest[],
): readonly GoalCatalogItem[] {
  const items: GoalCatalogItem[] = [];
  const courseById = new Map(courses.map(c => [c.id, c]));

  // Helper map from lessonId to chapter info
  const lessonChapterMap = new Map<EntityId, { chapter: Chapter; course: Course; chapterIdx: number; chapterLessonIds: readonly EntityId[] }>();

  for (const course of courses) {
    const chapters = course.chapterIds
      .map(id => content.chapters.find(ch => ch.id === id))
      .filter((ch): ch is Chapter => ch !== undefined);

    chapters.forEach((chapter, chapterIdx) => {
      const chapterLessonIds: EntityId[] = [];
      for (const topicId of chapter.topicIds) {
        const topic = content.topics.find(t => t.id === topicId);
        if (!topic) continue;
        for (const lessonId of topic.lessonIds) {
          const lesson = content.lessons.find(l => l.id === lessonId);
          if (lesson && !chapterLessonIds.includes(lessonId)) {
            chapterLessonIds.push(lessonId);
          }
        }
      }

      if (chapterLessonIds.length > 0) {
        // FIRST (Highest Priority): Build 'chapter' items
        const rawTitle = chapter.title;
        const cleanedChapterTitle = rawTitle.replace(/^Chương\s*\d+\s*[:.\-–—]?\s*/i, '').trim() || rawTitle;
        const formattedTitle = `Chương ${chapterIdx + 1}: ${cleanedChapterTitle}`;
        const chapterQuestCount = quests.filter(q => q.courseId === course.id && chapterLessonIds.includes(q.lessonId)).length;

        items.push({
          id: `chapter:${chapter.id}`,
          kind: 'chapter',
          title: formattedTitle,
          subtitle: `${course.title} · ${chapterLessonIds.length} bài học theo thứ tự${chapterQuestCount > 0 ? ` · ${chapterQuestCount} nhiệm vụ 4 mốc` : ''}`,
          categoryLabel: 'Trọn chương',
          courseId: course.id,
          courseCode: course.academicCode ?? course.id,
          courseTitle: course.title,
          subjectId: course.subjectId,
          lessonId: chapterLessonIds[0]!,
          chapterId: chapter.id,
          chapterIndex: chapterIdx + 1,
          lessonIds: chapterLessonIds,
          estimatedMinutes: Math.max(10, chapterLessonIds.length * 8),
        });

        for (const lid of chapterLessonIds) {
          if (!lessonChapterMap.has(lid)) {
            lessonChapterMap.set(lid, { chapter, course, chapterIdx, chapterLessonIds });
          }
        }
      }
    });
  }

  // SECOND: Build 'quest' items
  for (const quest of quests) {
    const course = courseById.get(quest.courseId);
    const lessonInfo = lessonChapterMap.get(quest.lessonId);
    items.push({
      id: `quest:${quest.id}`,
      kind: 'quest',
      title: quest.title,
      subtitle: quest.subtitle,
      categoryLabel: quest.categoryLabel,
      courseId: quest.courseId,
      courseCode: course?.academicCode ?? quest.courseId,
      courseTitle: course?.title ?? quest.courseId,
      subjectId: quest.subjectId,
      lessonId: quest.lessonId,
      ...(lessonInfo ? { chapterId: lessonInfo.chapter.id, chapterIndex: lessonInfo.chapterIdx + 1 } : {}),
      questId: quest.id,
      estimatedMinutes: quest.estimatedMinutes,
    });
  }

  // THIRD: Build 'lesson' items
  for (const course of courses) {
    const chapters = course.chapterIds
      .map(id => content.chapters.find(ch => ch.id === id))
      .filter((ch): ch is Chapter => ch !== undefined);

    chapters.forEach((chapter, chapterIdx) => {
      for (const topicId of chapter.topicIds) {
        const topic = content.topics.find(t => t.id === topicId);
        if (!topic) continue;
        for (const lessonId of topic.lessonIds) {
          const lesson = content.lessons.find(l => l.id === lessonId);
          if (!lesson) continue;
          items.push({
            id: `lesson:${lesson.id}`,
            kind: 'lesson',
            title: lesson.title,
            subtitle: topic.title,
            categoryLabel: chapter.title,
            courseId: course.id,
            courseCode: course.academicCode ?? course.id,
            courseTitle: course.title,
            subjectId: course.subjectId,
            lessonId: lesson.id,
            chapterId: chapter.id,
            chapterIndex: chapterIdx + 1,
            estimatedMinutes: 8,
          });
        }
      }
    });
  }

  return items;
}

export function filterGoalCatalog(
  items: readonly GoalCatalogItem[],
  filter: GoalCatalogFilter,
): readonly GoalCatalogItem[] {
  const tokens = filter.query
    ? normalizeVietnamese(filter.query).trim().split(/\s+/).filter(Boolean)
    : [];

  const filtered = items.filter(item => {
    if (filter.subjectId && filter.subjectId !== 'all' && item.subjectId !== filter.subjectId) {
      return false;
    }
    if (filter.courseId && filter.courseId !== 'all' && item.courseId !== filter.courseId) {
      return false;
    }
    if (filter.chapterId && filter.chapterId !== 'all' && item.chapterId !== filter.chapterId) {
      return false;
    }
    if (filter.kind && filter.kind !== 'all' && item.kind !== filter.kind) {
      return false;
    }
    if (tokens.length > 0) {
      const haystack = normalizeVietnamese(
        `${item.title} ${item.subtitle} ${item.categoryLabel} ${item.courseCode} ${item.courseTitle}`,
      );
      if (!tokens.every(token => haystack.includes(token))) {
        return false;
      }
    }
    return true;
  });

  const kindRank = (kind: GoalCatalogItem['kind']): number => {
    if (kind === 'chapter') return 0;
    if (kind === 'quest') return 1;
    return 2;
  };

  return [...filtered].sort((a, b) => {
    const rA = kindRank(a.kind);
    const rB = kindRank(b.kind);
    if (rA !== rB) return rA - rB;

    if (a.kind === 'chapter' && b.kind === 'chapter') {
      const courseFilterAll = !filter.courseId || filter.courseId === 'all';
      if (courseFilterAll) {
        // Sort earlier chapter numbers first across courses or general browsing
        const diff = (a.chapterIndex ?? 99) - (b.chapterIndex ?? 99);
        if (diff !== 0) return diff;
      } else {
        const diff = (a.chapterIndex ?? 99) - (b.chapterIndex ?? 99);
        if (diff !== 0) return diff;
      }
    }
    return 0;
  });
}

export function buildChapterPathway(
  chapterId: EntityId,
  content: LearningContent,
  completedLessonIds: readonly string[],
  completedQuestIds: readonly string[],
  quests: readonly SkillQuest[],
): GoalPathway {
  const chapter = content.chapters.find(ch => ch.id === chapterId);
  if (!chapter) {
    return { targetLessonId: '', stations: [], remainingCount: 0 };
  }

  const chapterLessonIds: EntityId[] = [];
  for (const topicId of chapter.topicIds) {
    const topic = content.topics.find(t => t.id === topicId);
    if (!topic) continue;
    for (const lessonId of topic.lessonIds) {
      const lesson = content.lessons.find(l => l.id === lessonId);
      if (lesson && !chapterLessonIds.includes(lessonId)) {
        chapterLessonIds.push(lessonId);
      }
    }
  }

  if (chapterLessonIds.length === 0) {
    return { targetLessonId: '', stations: [], remainingCount: 0 };
  }

  const completedLessonSet = new Set(completedLessonIds);
  const completedQuestSet = new Set(completedQuestIds);

  const stationsData = chapterLessonIds.map(lessonId => {
    const lesson = content.lessons.find(l => l.id === lessonId);
    const matchingQuests = quests.filter(q => q.lessonId === lessonId);
    const isQuestDone = matchingQuests.some(q => completedQuestSet.has(q.id));
    const completed = completedLessonSet.has(lessonId) || isQuestDone;
    const questId = matchingQuests[0]?.id;

    return {
      lessonId,
      title: lesson?.title ?? lessonId,
      completed,
      ...(questId !== undefined ? { questId } : {}),
    };
  });

  // Determine activeTargetLessonId: first uncompleted lesson, OR last lesson if all completed
  let targetIndex = stationsData.findIndex(s => !s.completed);
  if (targetIndex === -1) {
    targetIndex = stationsData.length - 1;
  }
  const activeTargetLessonId = stationsData[targetIndex]!.lessonId;

  const stations: GoalPathwayStation[] = stationsData.map((s, idx) => ({
    lessonId: s.lessonId,
    title: s.title,
    isTarget: idx === targetIndex,
    completed: s.completed,
    ...(s.questId !== undefined ? { questId: s.questId } : {}),
  }));

  const remainingCount = stations.filter(s => !s.completed).length;

  return {
    targetLessonId: activeTargetLessonId,
    stations,
    remainingCount,
  };
}

export function buildGoalPathway(
  targetLessonId: EntityId,
  course: Course,
  content: LearningContent,
  completedLessonIds: readonly string[],
  completedQuestIds: readonly string[],
  quests: readonly SkillQuest[],
): GoalPathway {
  const chapters = course.chapterIds
    .map(id => content.chapters.find(ch => ch.id === id))
    .filter((ch): ch is Chapter => ch !== undefined);

  const orderedLessons: { readonly lessonId: EntityId; readonly topic: Topic }[] = [];
  const firstLessonByTopicId = new Map<EntityId, EntityId>();
  const topicById = new Map<EntityId, Topic>();

  for (const chapter of chapters) {
    for (const topicId of chapter.topicIds) {
      const topic = content.topics.find(t => t.id === topicId);
      if (!topic) continue;
      topicById.set(topic.id, topic);
      for (const lessonId of topic.lessonIds) {
        if (!firstLessonByTopicId.has(topic.id)) {
          firstLessonByTopicId.set(topic.id, lessonId);
        }
        orderedLessons.push({ lessonId, topic });
      }
    }
  }

  const targetEntry = orderedLessons.find(e => e.lessonId === targetLessonId);
  const ancestorLessonIds = new Set<EntityId>();

  if (targetEntry) {
    // Same-topic preceding lessons
    for (const lid of targetEntry.topic.lessonIds) {
      if (lid === targetLessonId) break;
      ancestorLessonIds.add(lid);
    }

    // Transitive topic prerequisites (cycle-safe DFS)
    const visitedTopics = new Set<EntityId>();
    const stack = [...(targetEntry.topic.prerequisiteIds ?? [])];
    while (stack.length > 0) {
      const tid = stack.pop();
      if (!tid || visitedTopics.has(tid)) continue;
      visitedTopics.add(tid);
      const prereqLesson = firstLessonByTopicId.get(tid);
      if (prereqLesson && prereqLesson !== targetLessonId) {
        ancestorLessonIds.add(prereqLesson);
      }
      const prereqTopic = topicById.get(tid);
      for (const parentTid of prereqTopic?.prerequisiteIds ?? []) {
        if (!visitedTopics.has(parentTid)) {
          stack.push(parentTid);
        }
      }
    }
  }

  // Order ancestors according to natural course topological/chapter order
  const orderedAncestors = orderedLessons
    .map(e => e.lessonId)
    .filter(id => ancestorLessonIds.has(id));

  let selectedIds: readonly EntityId[];
  if (orderedAncestors.length > 4) {
    const root = orderedAncestors[0]!;
    const nearAncestors = orderedAncestors.slice(-3);
    selectedIds = [root, ...nearAncestors, targetLessonId];
  } else {
    selectedIds = [...orderedAncestors, targetLessonId];
  }

  const completedLessonSet = new Set(completedLessonIds);
  const completedQuestSet = new Set(completedQuestIds);

  const stations: GoalPathwayStation[] = selectedIds.map(lessonId => {
    const lesson = content.lessons.find(l => l.id === lessonId);
    const matchingQuests = quests.filter(q => q.lessonId === lessonId);
    const isQuestDone = matchingQuests.some(q => completedQuestSet.has(q.id));
    const completed = completedLessonSet.has(lessonId) || isQuestDone;
    const questId = matchingQuests[0]?.id;

    return {
      lessonId,
      title: lesson?.title ?? lessonId,
      isTarget: lessonId === targetLessonId,
      completed,
      ...(questId !== undefined ? { questId } : {}),
    };
  });

  const remainingCount = stations.filter(s => !s.completed).length;

  return {
    targetLessonId,
    stations,
    remainingCount,
  };
}
