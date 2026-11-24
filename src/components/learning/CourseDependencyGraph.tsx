import { useCallback, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Course, EntityId } from '../../domain/learning';
import type { SemiEssayExercise } from '../../domain/semi-essay';
import type { SkillQuest } from '../../domain/skill-quest';
import type { LearningContent } from '../../domain/workspace';
import {
  buildChapterGraph,
  buildLessonGraph,
  type ChapterGraphNode,
  type LessonGraphNode,
} from '../../core/learning/graph';
import { CheckCircleIcon, ChevronRightIcon } from '../ui/Icons';

export interface CourseDependencyGraphProps {
  readonly course: Course;
  readonly content: LearningContent;
  readonly completedLessonIds: readonly EntityId[];
  readonly completedQuestIds?: readonly EntityId[] | undefined;
  readonly courseQuests?: readonly SkillQuest[] | undefined;
  readonly writtenByLessonId?: ReadonlyMap<EntityId, readonly SemiEssayExercise[]> | undefined;
  readonly nextRecommendedLessonId?: EntityId | undefined;
  readonly selectedChapterId: EntityId | null;
  readonly onSelectChapter: (chapterId: EntityId | null) => void;
}

const CHAPTER_NODE_W = 216;
const CHAPTER_NODE_H = 86;
const CHAPTER_GAP_X = 72;
const CHAPTER_GAP_Y = 18;
const CHAPTER_PAD_X = 20;
const CHAPTER_PAD_Y = 20;

const LESSON_NODE_W = 228;
const LESSON_NODE_H = 104;
const LESSON_GAP_X = 68;
const LESSON_GAP_Y = 18;
const LESSON_PAD_X = 20;
const LESSON_PAD_TOP = 44;
const LESSON_PAD_BOTTOM = 22;

function chapterPos(node: ChapterGraphNode) {
  return {
    x: CHAPTER_PAD_X + node.tier * (CHAPTER_NODE_W + CHAPTER_GAP_X),
    y: CHAPTER_PAD_Y + node.lane * (CHAPTER_NODE_H + CHAPTER_GAP_Y),
  };
}

function lessonPos(node: LessonGraphNode) {
  return {
    x: LESSON_PAD_X + node.tier * (LESSON_NODE_W + LESSON_GAP_X),
    y: LESSON_PAD_TOP + node.lane * (LESSON_NODE_H + LESSON_GAP_Y),
  };
}

function cubicEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(28, (x2 - x1) * 0.5);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/**
 * Interactive Atmospheric Constellation Dependency Graph:
 * - Macro Chapter Graph shows how chapters unlock each other left-to-right.
 * - Micro Lesson Graph shows a topological left-to-right DAG of readable lesson nodes,
 *   including cross-chapter prerequisite & next-chapter unlock bridge nodes.
 * - Hovering or focusing any node immediately illuminates its full upstream prerequisite chain
 *   ("Cần học trước" in starlight gold) and downstream progression ("Liên quan tiếp theo" in sapphire).
 */
export function CourseDependencyGraph({
  course,
  content,
  completedLessonIds,
  completedQuestIds,
  courseQuests,
  writtenByLessonId,
  nextRecommendedLessonId,
  selectedChapterId,
  onSelectChapter,
}: CourseDependencyGraphProps) {
  const uid = useId().replace(/:/g, '');
  const [hoveredChapterId, setHoveredChapterId] = useState<EntityId | null>(null);
  const [hoveredLessonId, setHoveredLessonId] = useState<EntityId | null>(null);

  const chapterGraph = useMemo(() => buildChapterGraph(course, content), [course, content]);

  const totalLessons = useMemo(
    () => chapterGraph.nodes.reduce((sum, n) => sum + n.lessonIds.length, 0),
    [chapterGraph.nodes],
  );

  // For dense courses (> 12 lessons), default the lesson graph to Chapter 1 unless a specific chapter is chosen
  const effectiveChapterId =
    selectedChapterId ?? (totalLessons > 12 ? (chapterGraph.nodes[0]?.chapter.id ?? null) : null);

  const lessonGraph = useMemo(
    () => buildLessonGraph(course, content, effectiveChapterId),
    [course, content, effectiveChapterId],
  );

  const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
  const completedQuestSet = useMemo(
    () => new Set(completedQuestIds ?? []),
    [completedQuestIds],
  );
  const questsByLessonId = useMemo(() => {
    const map = new Map<EntityId, SkillQuest[]>();
    for (const quest of courseQuests ?? []) {
      const existing = map.get(quest.lessonId);
      if (existing) {
        existing.push(quest);
      } else {
        map.set(quest.lessonId, [quest]);
      }
    }
    return map;
  }, [courseQuests]);

  const isLessonMastered = useCallback(
    (lessonId: EntityId) => {
      if (completedSet.has(lessonId)) return true;
      const lessonQuests = questsByLessonId.get(lessonId);
      return lessonQuests ? lessonQuests.some(q => completedQuestSet.has(q.id)) : false;
    },
    [completedSet, questsByLessonId, completedQuestSet],
  );

  const chapterNodeById = useMemo(
    () => new Map(chapterGraph.nodes.map(n => [n.chapter.id, n])),
    [chapterGraph.nodes],
  );

  const lessonNodeById = useMemo(
    () => new Map(lessonGraph.nodes.map(n => [n.id, n])),
    [lessonGraph.nodes],
  );

  const activeChapterNode = hoveredChapterId ? chapterNodeById.get(hoveredChapterId) ?? null : null;
  const activeLessonNode = hoveredLessonId ? lessonNodeById.get(hoveredLessonId) ?? null : null;

  const activeAncestorSet = useMemo(
    () => new Set(activeLessonNode?.ancestorIds ?? []),
    [activeLessonNode],
  );
  const activeDescendantSet = useMemo(
    () => new Set(activeLessonNode?.descendantIds ?? []),
    [activeLessonNode],
  );

  const chapterCanvasW =
    CHAPTER_PAD_X * 2 +
    Math.max(1, chapterGraph.tierCount) * CHAPTER_NODE_W +
    Math.max(0, chapterGraph.tierCount - 1) * CHAPTER_GAP_X;
  const chapterCanvasH =
    CHAPTER_PAD_Y * 2 +
    Math.max(1, chapterGraph.maxLanes) * CHAPTER_NODE_H +
    Math.max(0, chapterGraph.maxLanes - 1) * CHAPTER_GAP_Y;

  const lessonCanvasW =
    LESSON_PAD_X * 2 +
    Math.max(1, lessonGraph.tierCount) * LESSON_NODE_W +
    Math.max(0, lessonGraph.tierCount - 1) * LESSON_GAP_X;
  const lessonCanvasH =
    LESSON_PAD_TOP +
    LESSON_PAD_BOTTOM +
    Math.max(1, lessonGraph.maxLanes) * LESSON_NODE_H +
    Math.max(0, lessonGraph.maxLanes - 1) * LESSON_GAP_Y;

  const hasExternalPrereqs = lessonGraph.nodes.some(n => n.kind === 'external-prereq');
  const hasExternalNext = lessonGraph.nodes.some(n => n.kind === 'external-next');

  const tierLabels = useMemo(() => {
    const labels: string[] = [];
    for (let t = 0; t < lessonGraph.tierCount; t += 1) {
      if (hasExternalPrereqs && t === 0) {
        labels.push('Nền từ chương trước');
      } else if (hasExternalNext && t === lessonGraph.tierCount - 1) {
        labels.push('Mở sang chương sau');
      } else {
        const stepNum = hasExternalPrereqs ? t : t + 1;
        labels.push(stepNum === 1 ? 'Nền tảng bắt đầu' : `Bước ${stepNum}`);
      }
    }
    return labels;
  }, [lessonGraph.tierCount, hasExternalPrereqs, hasExternalNext]);

  const focusedChapterNode = effectiveChapterId
    ? chapterNodeById.get(effectiveChapterId) ?? null
    : null;

  return (
    <div className="space-y-8">
      {/* 1. Macro Chapter Dependency Graph (when course has > 1 chapter) */}
      {chapterGraph.nodes.length > 1 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-medium text-ink">
                Mạch liên kết giữa các chương
              </h3>
              <p className="text-xs text-ink-muted">
                Đi từ trái sang phải theo thứ tự tiên quyết · Nhấn vào một chương để mở sơ đồ bài
                học chi tiết bên dưới.
              </p>
            </div>
            {totalLessons <= 12 && effectiveChapterId !== null ? (
              <button
                type="button"
                onClick={() => onSelectChapter(null)}
                className="text-xs font-medium text-accent hover:underline"
              >
                Xem sơ đồ cả môn ({totalLessons} bài)
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface/65 backdrop-blur-sm">
            <div
              className="relative"
              style={{ width: `${chapterCanvasW}px`, height: `${chapterCanvasH}px`, minWidth: '100%' }}
            >
              {/* Directional SVG curves between chapters */}
              <svg
                width={chapterCanvasW}
                height={chapterCanvasH}
                viewBox={`0 0 ${chapterCanvasW} ${chapterCanvasH}`}
                fill="none"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <defs>
                  <marker
                    id={`ch-arrow-base-${uid}`}
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-orbit-strong)" />
                  </marker>
                  <marker
                    id={`ch-arrow-pre-${uid}`}
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6.5"
                    markerHeight="6.5"
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-starlight)" />
                  </marker>
                  <marker
                    id={`ch-arrow-next-${uid}`}
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6.5"
                    markerHeight="6.5"
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-accent)" />
                  </marker>
                </defs>

                {chapterGraph.edges.map(edge => {
                  const fromNode = chapterNodeById.get(edge.fromChapterId);
                  const toNode = chapterNodeById.get(edge.toChapterId);
                  if (!fromNode || !toNode) return null;
                  const p1 = chapterPos(fromNode);
                  const p2 = chapterPos(toNode);
                  const x1 = p1.x + CHAPTER_NODE_W;
                  const y1 = p1.y + CHAPTER_NODE_H / 2;
                  const x2 = p2.x - 2;
                  const y2 = p2.y + CHAPTER_NODE_H / 2;

                  const isIncoming = activeChapterNode?.chapter.id === edge.toChapterId;
                  const isOutgoing = activeChapterNode?.chapter.id === edge.fromChapterId;
                  const isDimmed = activeChapterNode !== null && !isIncoming && !isOutgoing;

                  const stroke = isIncoming
                    ? 'var(--hus-starlight)'
                    : isOutgoing
                      ? 'var(--hus-accent)'
                      : 'var(--hus-orbit-strong)';
                  const marker = isIncoming
                    ? `url(#ch-arrow-pre-${uid})`
                    : isOutgoing
                      ? `url(#ch-arrow-next-${uid})`
                      : `url(#ch-arrow-base-${uid})`;

                  return (
                    <path
                      key={`${edge.fromChapterId}->${edge.toChapterId}`}
                      d={cubicEdgePath(x1, y1, x2, y2)}
                      stroke={stroke}
                      strokeWidth={isIncoming || isOutgoing ? 2.2 : 1.4}
                      strokeOpacity={isDimmed ? 0.16 : isIncoming || isOutgoing ? 0.95 : 0.65}
                      markerEnd={marker}
                      className="transition-opacity duration-200"
                    />
                  );
                })}
              </svg>

              {/* Readable HTML Chapter Nodes */}
              {chapterGraph.nodes.map(node => {
                const pos = chapterPos(node);
                const isSelected = effectiveChapterId === node.chapter.id;
                const completedCount = node.lessonIds.filter(id => isLessonMastered(id)).length;
                const chapterQuestCount = node.lessonIds.reduce(
                  (sum, id) => sum + (questsByLessonId.get(id)?.length ?? 0),
                  0,
                );
                const isDone = node.lessonIds.length > 0 && completedCount === node.lessonIds.length;
                const isPrereqOfHovered = Boolean(
                  activeChapterNode?.directPrereqChapterIds.includes(node.chapter.id),
                );
                const isNextOfHovered = Boolean(
                  activeChapterNode?.directNextChapterIds.includes(node.chapter.id),
                );
                const isDimmed =
                  activeChapterNode !== null &&
                  activeChapterNode.chapter.id !== node.chapter.id &&
                  !isPrereqOfHovered &&
                  !isNextOfHovered;

                return (
                  <button
                    key={node.chapter.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectChapter(node.chapter.id)}
                    onMouseEnter={() => setHoveredChapterId(node.chapter.id)}
                    onMouseLeave={() =>
                      setHoveredChapterId(prev => (prev === node.chapter.id ? null : prev))
                    }
                    onFocus={() => setHoveredChapterId(node.chapter.id)}
                    onBlur={() =>
                      setHoveredChapterId(prev => (prev === node.chapter.id ? null : prev))
                    }
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: `${CHAPTER_NODE_W}px`,
                      height: `${CHAPTER_NODE_H}px`,
                    }}
                    className={`group absolute flex flex-col justify-between rounded-[var(--radius-lg)] border px-3.5 py-2.5 text-left transition-[transform,opacity,border-color,background-color] duration-200 hover:-translate-y-0.5 ${
                      isDimmed ? 'opacity-40' : 'opacity-100'
                    } ${
                      isPrereqOfHovered
                        ? 'border-starlight bg-surface ring-2 ring-starlight/20'
                        : isNextOfHovered
                          ? 'border-accent bg-surface ring-2 ring-accent/20'
                          : isSelected
                            ? 'border-accent bg-accent-subtle/75'
                            : 'border-border bg-surface/95 hover:border-border-strong'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-ink-muted">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 rounded-full ${
                            isDone
                              ? 'bg-success'
                              : isPrereqOfHovered
                                ? 'bg-starlight'
                                : isSelected || isNextOfHovered
                                  ? 'bg-accent'
                                  : 'bg-border-strong'
                          }`}
                        />
                        <span className={isSelected ? 'text-accent-ink' : undefined}>
                          Chương {node.chapterIndex + 1}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-ink-muted">
                        {isPrereqOfHovered ? (
                          <span className="font-sans font-medium text-warning">Học trước</span>
                        ) : isNextOfHovered ? (
                          <span className="font-sans font-medium text-accent-ink">Tiếp theo</span>
                        ) : (
                          <>
                            {chapterQuestCount > 0 ? (
                              <span className="rounded-full border border-starlight/45 bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                                ⚡ {chapterQuestCount}
                              </span>
                            ) : null}
                            <span>
                              {completedCount}/{node.lessonIds.length} chặng
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    <span
                      className={`line-clamp-2 font-display text-[14px] font-medium leading-snug ${
                        isSelected ? 'text-accent-ink' : 'text-ink group-hover:text-accent'
                      }`}
                    >
                      {node.chapter.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Micro Lesson Topological Dependency Graph */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-xl font-medium text-ink">
              {focusedChapterNode
                ? `Sơ đồ bài học · Chương ${focusedChapterNode.chapterIndex + 1}: ${focusedChapterNode.chapter.title}`
                : 'Sơ đồ liên kết bài học toàn môn'}
            </h3>
            {/* Live Path Summary Strip */}
            <div className="mt-1 min-h-[1.5rem] text-xs" role="status" aria-live="polite">
              {activeLessonNode ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-secondary">
                  <span className="inline-flex items-center gap-1 font-medium text-warning">
                    Cần học trước: {activeLessonNode.ancestorIds.length} bài
                  </span>
                  <span aria-hidden="true" className="text-ink-muted">
                    →
                  </span>
                  <strong className="font-semibold text-accent">
                    {activeLessonNode.lesson.title}
                  </strong>
                  <span aria-hidden="true" className="text-ink-muted">
                    →
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-success">
                    Liên quan tiếp theo: {activeLessonNode.descendantIds.length} bài
                  </span>
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-starlight" />
                    Cần học trước
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                    Bài đang xem / Mở tiếp theo
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
                    Đã hoàn thành
                  </span>
                  <span className="hidden sm:inline">
                    · Rê chuột lên một bài để sáng toàn bộ mạch kiến thức.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Atmospheric Graph Viewport */}
        <div className="relative overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface/65 backdrop-blur-sm">
          <div
            className="relative"
            style={{
              width: `${lessonCanvasW}px`,
              height: `${lessonCanvasH}px`,
              minWidth: '100%',
            }}
          >
            {/* Subtle column guides & progression labels */}
            {tierLabels.map((label, tierIdx) => {
              const x = LESSON_PAD_X + tierIdx * (LESSON_NODE_W + LESSON_GAP_X);
              const isBridgeCol =
                (hasExternalPrereqs && tierIdx === 0) ||
                (hasExternalNext && tierIdx === tierLabels.length - 1);
              return (
                <div
                  key={`${tierIdx}-${label}`}
                  aria-hidden="true"
                  style={{ left: `${x}px`, width: `${LESSON_NODE_W}px` }}
                  className="pointer-events-none absolute top-3 flex items-center gap-2"
                >
                  <span
                    className={`font-mono text-[11px] font-medium ${
                      isBridgeCol ? 'text-warning' : 'text-ink-muted'
                    }`}
                  >
                    {label}
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                </div>
              );
            })}

            {/* Directional SVG Bézier Edges */}
            <svg
              width={lessonCanvasW}
              height={lessonCanvasH}
              viewBox={`0 0 ${lessonCanvasW} ${lessonCanvasH}`}
              fill="none"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <defs>
                <marker
                  id={`ls-arrow-base-${uid}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-orbit-strong)" />
                </marker>
                <marker
                  id={`ls-arrow-pre-${uid}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-starlight)" />
                </marker>
                <marker
                  id={`ls-arrow-next-${uid}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--hus-accent)" />
                </marker>
              </defs>

              {lessonGraph.edges.map(edge => {
                const fromNode = lessonNodeById.get(edge.fromId);
                const toNode = lessonNodeById.get(edge.toId);
                if (!fromNode || !toNode) return null;

                const p1 = lessonPos(fromNode);
                const p2 = lessonPos(toNode);
                const x1 = p1.x + LESSON_NODE_W;
                const y1 = p1.y + LESSON_NODE_H / 2;
                const x2 = p2.x - 2;
                const y2 = p2.y + LESSON_NODE_H / 2;

                const isUpstreamEdge =
                  activeLessonNode !== null &&
                  (edge.toId === activeLessonNode.id || activeAncestorSet.has(edge.toId)) &&
                  activeAncestorSet.has(edge.fromId);
                const isDownstreamEdge =
                  activeLessonNode !== null &&
                  (edge.fromId === activeLessonNode.id || activeDescendantSet.has(edge.fromId)) &&
                  activeDescendantSet.has(edge.toId);
                const isDimmed =
                  activeLessonNode !== null && !isUpstreamEdge && !isDownstreamEdge;

                const stroke = isUpstreamEdge
                  ? 'var(--hus-starlight)'
                  : isDownstreamEdge
                    ? 'var(--hus-accent)'
                    : 'var(--hus-orbit-strong)';
                const marker = isUpstreamEdge
                  ? `url(#ls-arrow-pre-${uid})`
                  : isDownstreamEdge
                    ? `url(#ls-arrow-next-${uid})`
                    : `url(#ls-arrow-base-${uid})`;

                return (
                  <path
                    key={`${edge.fromId}->${edge.toId}`}
                    d={cubicEdgePath(x1, y1, x2, y2)}
                    stroke={stroke}
                    strokeWidth={isUpstreamEdge || isDownstreamEdge ? 2.3 : 1.35}
                    strokeOpacity={
                      isDimmed ? 0.12 : isUpstreamEdge || isDownstreamEdge ? 0.95 : 0.65
                    }
                    strokeDasharray={
                      edge.crossChapter && !isUpstreamEdge && !isDownstreamEdge
                        ? '4 4'
                        : undefined
                    }
                    markerEnd={marker}
                    className="transition-opacity duration-200"
                  />
                );
              })}
            </svg>

            {/* Readable Interactive HTML Lesson Nodes */}
            {lessonGraph.nodes.map(node => {
              const pos = lessonPos(node);
              const isCompleted = isLessonMastered(node.id);
              const lessonQuests = questsByLessonId.get(node.id) ?? [];
              const primaryQuest = lessonQuests[0];
              const lessonWritten = writtenByLessonId?.get(node.id) ?? [];
              const primaryWritten = lessonWritten[0];
              const isNextRec = nextRecommendedLessonId === node.id && !isCompleted;
              const isActive = activeLessonNode?.id === node.id;
              const isAncestor = activeAncestorSet.has(node.id);
              const isDescendant = activeDescendantSet.has(node.id);
              const isDimmed =
                activeLessonNode !== null && !isActive && !isAncestor && !isDescendant;
              const isExternal = node.kind !== 'lesson';

              const nodeToneClass = isActive
                ? 'border-accent bg-surface ring-2 ring-accent/25 -translate-y-0.5'
                : isAncestor
                  ? 'border-starlight bg-surface ring-2 ring-starlight/20'
                  : isDescendant
                    ? 'border-accent/80 bg-surface ring-2 ring-accent/15'
                    : isExternal
                      ? 'border-dashed border-border-strong bg-canvas/85 hover:border-starlight hover:bg-surface'
                      : isNextRec
                        ? 'border-accent/50 bg-surface hover:border-accent'
                        : 'border-border bg-surface/95 hover:border-border-strong hover:bg-surface';

              return (
                <div
                  key={node.id}
                  onMouseEnter={() => setHoveredLessonId(node.id)}
                  onMouseLeave={() =>
                    setHoveredLessonId(prev => (prev === node.id ? null : prev))
                  }
                  onFocus={() => setHoveredLessonId(node.id)}
                  onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setHoveredLessonId(prev => (prev === node.id ? null : prev));
                    }
                  }}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${LESSON_NODE_W}px`,
                    height: `${LESSON_NODE_H}px`,
                  }}
                  className={`group absolute flex flex-col justify-between rounded-[var(--radius-lg)] border px-3.5 py-2.5 transition-[transform,opacity,border-color,background-color] duration-200 hover:-translate-y-0.5 ${
                    isDimmed ? 'opacity-30' : 'opacity-100'
                  } ${nodeToneClass}`}
                >
                  <Link
                    to={`/courses/${course.id}/lessons/${node.id}`}
                    aria-label={node.lesson.title}
                    className="absolute inset-0 z-0 rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-accent"
                  />

                  <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-mono font-medium text-ink-muted">
                      {isCompleted ? (
                        <CheckCircleIcon width={13} height={13} className="shrink-0 text-success" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isAncestor
                              ? 'bg-starlight'
                              : isActive || isDescendant || isNextRec
                                ? 'bg-accent'
                                : 'bg-border-strong'
                          }`}
                        />
                      )}
                      <span className={isExternal ? 'text-warning' : undefined}>
                        {node.kind === 'external-prereq'
                          ? `Ch. ${node.chapterIndex + 1} · Nền`
                          : node.kind === 'external-next'
                            ? `Sang Ch. ${node.chapterIndex + 1}`
                            : `Bài ${node.chapterIndex + 1}.${node.lessonIndexInChapter}`}
                      </span>
                    </span>

                    {isAncestor ? (
                      <span className="rounded-full bg-warning-subtle px-1.5 py-0.5 font-medium text-warning">
                        Học trước
                      </span>
                    ) : isDescendant ? (
                      <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 font-medium text-accent-ink">
                        Mở khóa
                      </span>
                    ) : isNextRec ? (
                      <span className="rounded-full bg-warning-subtle px-1.5 py-0.5 font-semibold text-warning">
                        ☞ Tiếp theo
                      </span>
                    ) : node.lesson.exerciseIds.length > 0 ? (
                      <span className="font-mono text-ink-muted">
                        {node.lesson.exerciseIds.length} BT
                      </span>
                    ) : (
                      <span className="font-mono text-ink-muted">Chia chặng</span>
                    )}
                  </div>

                  <div className="pointer-events-none relative z-10 flex items-end justify-between gap-2">
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
                      {node.lesson.title}
                    </span>
                    {primaryQuest ? (
                      <Link
                        to={`/quests/${primaryQuest.id}`}
                        aria-label={`Nhiệm vụ 4 mốc: ${primaryQuest.title}`}
                        className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border border-starlight/55 bg-warning-subtle px-2 py-0.5 font-mono text-[10px] font-semibold text-warning no-underline transition-colors hover:border-starlight hover:bg-warning-subtle/90 focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        ⚡ 4 mốc
                      </Link>
                    ) : primaryWritten && !isExternal ? (
                      <Link
                        to={`/courses/${course.id}/lessons/${node.id}/practice/${primaryWritten.id}`}
                        aria-label={`Tự luận giấy A4: ${primaryWritten.title}`}
                        className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/45 bg-accent-subtle px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-ink no-underline transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Tự luận A4
                      </Link>
                    ) : (
                      <ChevronRightIcon
                        width={13}
                        height={13}
                        className="mb-0.5 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
