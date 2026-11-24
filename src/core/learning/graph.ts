import type { Chapter, Course, EntityId, Lesson, Topic } from '../../domain/learning';
import type { LearningContent } from '../../domain/workspace';

export interface ChapterGraphNode {
  readonly chapter: Chapter;
  readonly chapterIndex: number;
  readonly lessonIds: readonly EntityId[];
  readonly exerciseCount: number;
  readonly tier: number;
  readonly lane: number;
  readonly directPrereqChapterIds: readonly EntityId[];
  readonly directNextChapterIds: readonly EntityId[];
}

export interface ChapterGraphEdge {
  readonly fromChapterId: EntityId;
  readonly toChapterId: EntityId;
  readonly linkCount: number;
}

export interface ChapterGraphLayout {
  readonly nodes: readonly ChapterGraphNode[];
  readonly edges: readonly ChapterGraphEdge[];
  readonly tierCount: number;
  readonly maxLanes: number;
}

export type LessonGraphNodeKind = 'lesson' | 'external-prereq' | 'external-next';

export interface LessonGraphNode {
  readonly id: EntityId;
  readonly lesson: Lesson;
  readonly topic: Topic;
  readonly chapter: Chapter;
  readonly chapterIndex: number;
  readonly lessonIndexInChapter: number;
  readonly kind: LessonGraphNodeKind;
  readonly tier: number;
  readonly lane: number;
  readonly directPrereqIds: readonly EntityId[];
  readonly directNextIds: readonly EntityId[];
  readonly ancestorIds: readonly EntityId[];
  readonly descendantIds: readonly EntityId[];
}

export interface LessonGraphEdge {
  readonly fromId: EntityId;
  readonly toId: EntityId;
  readonly crossChapter: boolean;
}

export interface LessonGraphLayout {
  readonly nodes: readonly LessonGraphNode[];
  readonly edges: readonly LessonGraphEdge[];
  readonly tierCount: number;
  readonly maxLanes: number;
}

interface ResolvedLessonEntry {
  readonly lesson: Lesson;
  readonly topic: Topic;
  readonly chapter: Chapter;
  readonly chapterIndex: number;
  readonly lessonIndexInChapter: number;
}

function resolveCourseEntries(course: Course, content: LearningContent): readonly ResolvedLessonEntry[] {
  const entries: ResolvedLessonEntry[] = [];
  const chapters = course.chapterIds
    .map(id => content.chapters.find(ch => ch.id === id))
    .filter((ch): ch is Chapter => ch !== undefined);

  chapters.forEach((chapter, chapterIndex) => {
    let lessonIdx = 0;
    for (const topicId of chapter.topicIds) {
      const topic = content.topics.find(t => t.id === topicId);
      if (!topic) continue;
      for (const lessonId of topic.lessonIds) {
        const lesson = content.lessons.find(l => l.id === lessonId);
        if (!lesson) continue;
        lessonIdx += 1;
        entries.push({
          lesson,
          topic,
          chapter,
          chapterIndex,
          lessonIndexInChapter: lessonIdx,
        });
      }
    }
  });

  return entries;
}

function computeTransitiveReach(
  startId: EntityId,
  adjacency: ReadonlyMap<EntityId, readonly EntityId[]>,
): readonly EntityId[] {
  const visited = new Set<EntityId>();
  const stack = [...(adjacency.get(startId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const next = adjacency.get(current);
    if (next) {
      for (const n of next) {
        if (!visited.has(n)) stack.push(n);
      }
    }
  }
  return [...visited];
}

function assignTopologicalTiers(
  ids: readonly EntityId[],
  prereqsMap: ReadonlyMap<EntityId, readonly EntityId[]>,
): ReadonlyMap<EntityId, number> {
  const inSet = new Set(ids);
  const memo = new Map<EntityId, number>();
  const visiting = new Set<EntityId>();

  function getTier(id: EntityId): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // Guard against unexpected cycles
    visiting.add(id);

    let maxParentTier = -1;
    const parents = prereqsMap.get(id) ?? [];
    for (const pid of parents) {
      if (!inSet.has(pid) || pid === id) continue;
      const pt = getTier(pid);
      if (pt > maxParentTier) maxParentTier = pt;
    }

    visiting.delete(id);
    const tier = maxParentTier + 1;
    memo.set(id, tier);
    return tier;
  }

  for (const id of ids) {
    getTier(id);
  }
  return memo;
}

/**
 * Builds a deterministic, left-to-right topological DAG of chapters for a course,
 * derived strictly from real topic prerequisite relationships across chapters.
 */
export function buildChapterGraph(
  course: Course,
  content: LearningContent,
): ChapterGraphLayout {
  const entries = resolveCourseEntries(course, content);
  const chapters = course.chapterIds
    .map(id => content.chapters.find(ch => ch.id === id))
    .filter((ch): ch is Chapter => ch !== undefined);

  if (chapters.length === 0) {
    return { nodes: [], edges: [], tierCount: 0, maxLanes: 0 };
  }

  const chapterByTopicId = new Map<EntityId, EntityId>();
  for (const entry of entries) {
    chapterByTopicId.set(entry.topic.id, entry.chapter.id);
  }

  const edgeCounts = new Map<string, number>();
  const prereqChapters = new Map<EntityId, Set<EntityId>>();
  const nextChapters = new Map<EntityId, Set<EntityId>>();

  for (const ch of chapters) {
    prereqChapters.set(ch.id, new Set());
    nextChapters.set(ch.id, new Set());
  }

  const seenTopics = new Set<EntityId>();
  for (const entry of entries) {
    if (seenTopics.has(entry.topic.id)) continue;
    seenTopics.add(entry.topic.id);
    const toCh = entry.chapter.id;
    for (const prereqTopicId of entry.topic.prerequisiteIds ?? []) {
      const fromCh = chapterByTopicId.get(prereqTopicId);
      if (!fromCh || fromCh === toCh) continue;
      const key = `${fromCh}->${toCh}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      prereqChapters.get(toCh)?.add(fromCh);
      nextChapters.get(fromCh)?.add(toCh);
    }
  }

  const prereqArrays = new Map<EntityId, readonly EntityId[]>(
    chapters.map(ch => [ch.id, [...(prereqChapters.get(ch.id) ?? [])]]),
  );
  const tiers = assignTopologicalTiers(
    chapters.map(ch => ch.id),
    prereqArrays,
  );

  const byTier = new Map<number, Chapter[]>();
  for (const ch of chapters) {
    const t = tiers.get(ch.id) ?? 0;
    const list = byTier.get(t) ?? [];
    list.push(ch);
    byTier.set(t, list);
  }

  const nodes: ChapterGraphNode[] = [];
  let maxTier = 0;
  let maxLanes = 0;

  chapters.forEach((chapter, chapterIndex) => {
    const tier = tiers.get(chapter.id) ?? 0;
    if (tier > maxTier) maxTier = tier;
    const tierGroup = byTier.get(tier) ?? [];
    const lane = tierGroup.findIndex(c => c.id === chapter.id);
    if (tierGroup.length > maxLanes) maxLanes = tierGroup.length;

    const chEntries = entries.filter(e => e.chapter.id === chapter.id);
    nodes.push({
      chapter,
      chapterIndex,
      lessonIds: chEntries.map(e => e.lesson.id),
      exerciseCount: chEntries.reduce((sum, e) => sum + e.lesson.exerciseIds.length, 0),
      tier,
      lane,
      directPrereqChapterIds: [...(prereqChapters.get(chapter.id) ?? [])],
      directNextChapterIds: [...(nextChapters.get(chapter.id) ?? [])],
    });
  });

  const edges: ChapterGraphEdge[] = [];
  for (const [key, linkCount] of edgeCounts.entries()) {
    const [fromChapterId, toChapterId] = key.split('->');
    if (fromChapterId && toChapterId) {
      edges.push({ fromChapterId, toChapterId, linkCount });
    }
  }

  return {
    nodes,
    edges,
    tierCount: maxTier + 1,
    maxLanes,
  };
}

/**
 * Builds a deterministic, left-to-right topological DAG of lessons.
 * When `chapterId` is specified, includes external prerequisite bridges on the left
 * and external unlocked next-chapter bridges on the right so students see the complete
 * cross-chapter learning flow at a glance.
 */
export function buildLessonGraph(
  course: Course,
  content: LearningContent,
  chapterId?: EntityId | null,
): LessonGraphLayout {
  const allEntries = resolveCourseEntries(course, content);
  if (allEntries.length === 0) {
    return { nodes: [], edges: [], tierCount: 0, maxLanes: 0 };
  }

  const entryByLessonId = new Map<EntityId, ResolvedLessonEntry>(
    allEntries.map(e => [e.lesson.id, e]),
  );
  const firstLessonByTopicId = new Map<EntityId, EntityId>();
  for (const entry of allEntries) {
    if (!firstLessonByTopicId.has(entry.topic.id)) {
      firstLessonByTopicId.set(entry.topic.id, entry.lesson.id);
    }
  }

  // Build full course lesson-level prerequisite & dependent adjacency
  const fullPrereqs = new Map<EntityId, EntityId[]>();
  const fullNext = new Map<EntityId, EntityId[]>();
  for (const entry of allEntries) {
    fullPrereqs.set(entry.lesson.id, []);
    fullNext.set(entry.lesson.id, []);
  }

  for (const entry of allEntries) {
    const prereqIds = new Set<EntityId>();
    for (const prereqTopicId of entry.topic.prerequisiteIds ?? []) {
      const prereqLessonId = firstLessonByTopicId.get(prereqTopicId);
      if (prereqLessonId && prereqLessonId !== entry.lesson.id) {
        prereqIds.add(prereqLessonId);
      }
    }
    const list = [...prereqIds];
    fullPrereqs.set(entry.lesson.id, list);
    for (const pid of list) {
      fullNext.get(pid)?.push(entry.lesson.id);
    }
  }

  const primaryEntries = chapterId
    ? allEntries.filter(e => e.chapter.id === chapterId)
    : allEntries;

  if (primaryEntries.length === 0) {
    return { nodes: [], edges: [], tierCount: 0, maxLanes: 0 };
  }

  const primaryIds = new Set(primaryEntries.map(e => e.lesson.id));
  const externalPrereqIds = new Set<EntityId>();
  const externalNextIds = new Set<EntityId>();

  if (chapterId) {
    for (const entry of primaryEntries) {
      for (const pid of fullPrereqs.get(entry.lesson.id) ?? []) {
        if (!primaryIds.has(pid)) externalPrereqIds.add(pid);
      }
      for (const nid of fullNext.get(entry.lesson.id) ?? []) {
        if (!primaryIds.has(nid)) externalNextIds.add(nid);
      }
    }
  }

  // Compute primary topological tiers
  const primaryTierMap = assignTopologicalTiers(
    primaryEntries.map(e => e.lesson.id),
    fullPrereqs,
  );
  const hasExternalPrereqs = externalPrereqIds.size > 0;
  const tierOffset = hasExternalPrereqs ? 1 : 0;

  let maxPrimaryTier = 0;
  for (const t of primaryTierMap.values()) {
    if (t > maxPrimaryTier) maxPrimaryTier = t;
  }

  // Assemble scoped node list with kind & tier
  const scopedItems: {
    readonly entry: ResolvedLessonEntry;
    readonly kind: LessonGraphNodeKind;
    readonly tier: number;
  }[] = [];

  for (const pid of externalPrereqIds) {
    const entry = entryByLessonId.get(pid);
    if (entry) scopedItems.push({ entry, kind: 'external-prereq', tier: 0 });
  }

  for (const entry of primaryEntries) {
    const tier = (primaryTierMap.get(entry.lesson.id) ?? 0) + tierOffset;
    scopedItems.push({ entry, kind: 'lesson', tier });
  }

  const externalNextTier = maxPrimaryTier + tierOffset + 1;
  for (const nid of externalNextIds) {
    const entry = entryByLessonId.get(nid);
    if (entry) scopedItems.push({ entry, kind: 'external-next', tier: externalNextTier });
  }

  const scopedIdSet = new Set(scopedItems.map(i => i.entry.lesson.id));

  // Build scoped edges
  const edges: LessonGraphEdge[] = [];
  const scopedPrereqs = new Map<EntityId, EntityId[]>();
  const scopedNext = new Map<EntityId, EntityId[]>();
  for (const item of scopedItems) {
    scopedPrereqs.set(item.entry.lesson.id, []);
    scopedNext.set(item.entry.lesson.id, []);
  }

  for (const item of scopedItems) {
    const toId = item.entry.lesson.id;
    // External prereq nodes only emit outgoing edges into primary nodes
    if (item.kind === 'external-prereq') continue;
    for (const fromId of fullPrereqs.get(toId) ?? []) {
      if (!scopedIdSet.has(fromId)) continue;
      // External next nodes only accept edges from primary nodes
      if (item.kind === 'external-next' && !primaryIds.has(fromId)) continue;
      const fromEntry = entryByLessonId.get(fromId);
      const crossChapter = fromEntry ? fromEntry.chapter.id !== item.entry.chapter.id : false;
      edges.push({ fromId, toId, crossChapter });
      scopedPrereqs.get(toId)?.push(fromId);
      scopedNext.get(fromId)?.push(toId);
    }
  }

  // Group by tier and sort lanes using parent barycenter to reduce edge crossings
  const tierGroups = new Map<number, typeof scopedItems>();
  let maxTier = 0;
  for (const item of scopedItems) {
    if (item.tier > maxTier) maxTier = item.tier;
    const list = tierGroups.get(item.tier) ?? [];
    list.push(item);
    tierGroups.set(item.tier, list);
  }

  const laneById = new Map<EntityId, number>();
  let maxLanes = 0;

  for (let tier = 0; tier <= maxTier; tier += 1) {
    const group = tierGroups.get(tier);
    if (!group) continue;
    if (tier > 0) {
      group.sort((a, b) => {
        const aParents = scopedPrereqs.get(a.entry.lesson.id) ?? [];
        const bParents = scopedPrereqs.get(b.entry.lesson.id) ?? [];
        const aAvg =
          aParents.length > 0
            ? aParents.reduce((s, id) => s + (laneById.get(id) ?? 0), 0) / aParents.length
            : Number.MAX_SAFE_INTEGER;
        const bAvg =
          bParents.length > 0
            ? bParents.reduce((s, id) => s + (laneById.get(id) ?? 0), 0) / bParents.length
            : Number.MAX_SAFE_INTEGER;
        if (aAvg !== bAvg) return aAvg - bAvg;
        return a.entry.chapterIndex - b.entry.chapterIndex ||
          a.entry.lessonIndexInChapter - b.entry.lessonIndexInChapter;
      });
    }
    group.forEach((item, lane) => {
      laneById.set(item.entry.lesson.id, lane);
    });
    if (group.length > maxLanes) maxLanes = group.length;
  }

  const nodes: LessonGraphNode[] = scopedItems.map(item => {
    const id = item.entry.lesson.id;
    return {
      id,
      lesson: item.entry.lesson,
      topic: item.entry.topic,
      chapter: item.entry.chapter,
      chapterIndex: item.entry.chapterIndex,
      lessonIndexInChapter: item.entry.lessonIndexInChapter,
      kind: item.kind,
      tier: item.tier,
      lane: laneById.get(id) ?? 0,
      directPrereqIds: scopedPrereqs.get(id) ?? [],
      directNextIds: scopedNext.get(id) ?? [],
      ancestorIds: computeTransitiveReach(id, scopedPrereqs),
      descendantIds: computeTransitiveReach(id, scopedNext),
    };
  });

  return {
    nodes,
    edges,
    tierCount: maxTier + 1,
    maxLanes,
  };
}
