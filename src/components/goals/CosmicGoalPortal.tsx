import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router';
import {
  buildChapterPathway,
  buildGoalCatalog,
  buildGoalPathway,
  buildNeighborhoodFlow,
  filterGoalCatalog,
  type GoalCatalogFilter,
  type GoalCatalogItem,
} from '../../core/learning/goal-pathway';
import type { Chapter, Course, EntityId, Subject } from '../../domain/learning';
import type { SkillQuest } from '../../domain/skill-quest';
import type { LearningContent } from '../../domain/workspace';
import { LearningFlowNeighborhoodGraph } from '../learning/LearningFlowNeighborhoodGraph';
import { Badge } from '../ui/Badge';
import { GuidingBeacon } from '../ui/GuidingBeacon';
import { ArrowRightIcon, CheckCircleIcon, ClockIcon } from '../ui/Icons';
import { SearchInput } from '../ui/SearchInput';
import { StarlightBurst } from '../ui/StarlightBurst';

export interface CosmicGoalPortalProps {
  readonly courses: readonly Course[];
  readonly subjects: readonly Subject[];
  readonly content: LearningContent;
  readonly quests: readonly SkillQuest[];
  readonly completedLessonIds: readonly string[];
  readonly completedQuestIds: readonly string[];
  readonly onActiveSubjectChange?: ((subjectId: EntityId | 'all') => void) | undefined;
}

const PAGE_SIZE = 12;

const KIND_OPTIONS: readonly {
  readonly id: NonNullable<GoalCatalogFilter['kind']>;
  readonly label: string;
}[] = [
  { id: 'all', label: 'Ưu tiên chương' },
  { id: 'chapter', label: 'Theo chương' },
  { id: 'quest', label: 'Nhiệm vụ 4 mốc' },
  { id: 'lesson', label: 'Bài nhỏ lẻ' },
];

interface FloatingSlot {
  readonly left: string;
  readonly top: string;
  readonly depth: 'far' | 'mid';
}

const FLOATING_SLOTS: readonly FloatingSlot[] = [
  { left: '11%', top: '21%', depth: 'mid' },
  { left: '89%', top: '20%', depth: 'mid' },
  { left: '32%', top: '14%', depth: 'far' },
  { left: '68%', top: '15%', depth: 'far' },
  { left: '10%', top: '74%', depth: 'mid' },
  { left: '90%', top: '75%', depth: 'mid' },
  { left: '32%', top: '86%', depth: 'far' },
  { left: '68%', top: '85%', depth: 'far' },
];

function pickDistinctFromPool(
  pool: readonly GoalCatalogItem[],
  picked: GoalCatalogItem[],
  pickedIds: Set<string>,
  usedCourses: Set<EntityId>,
  maxCount: number,
): void {
  const buckets = new Map<EntityId, GoalCatalogItem[]>();
  for (const item of pool) {
    if (pickedIds.has(item.id)) continue;
    const existing = buckets.get(item.subjectId);
    if (existing) {
      existing.push(item);
    } else {
      buckets.set(item.subjectId, [item]);
    }
  }

  const subjectQueues = [...buckets.values()];
  let madeProgress = true;
  while (picked.length < maxCount && madeProgress) {
    madeProgress = false;
    for (const queue of subjectQueues) {
      if (picked.length >= maxCount) break;
      const distinctIdx = queue.findIndex(
        item => !pickedIds.has(item.id) && !usedCourses.has(item.courseId),
      );
      const fallbackIdx =
        distinctIdx >= 0 ? distinctIdx : queue.findIndex(item => !pickedIds.has(item.id));
      if (fallbackIdx >= 0) {
        const chosen = queue[fallbackIdx];
        if (chosen) {
          picked.push(chosen);
          pickedIds.add(chosen.id);
          usedCourses.add(chosen.courseId);
          madeProgress = true;
        }
      }
    }
  }
}

function pickFloatingGoals(
  matched: readonly GoalCatalogItem[],
  isFiltered: boolean,
  maxCount = 8,
): readonly GoalCatalogItem[] {
  if (isFiltered || matched.length <= maxCount) {
    return matched.slice(0, maxCount);
  }

  // Spread unfiltered sky cards across subjects and courses, prioritizing Chương 1 of each course first.
  const picked: GoalCatalogItem[] = [];
  const pickedIds = new Set<string>();
  const usedCourses = new Set<EntityId>();

  const chapterPool = matched
    .filter(item => item.kind === 'chapter')
    .sort(
      (a, b) =>
        (a.chapterIndex ?? Number.MAX_SAFE_INTEGER) - (b.chapterIndex ?? Number.MAX_SAFE_INTEGER),
    );

  pickDistinctFromPool(chapterPool, picked, pickedIds, usedCourses, maxCount);
  if (picked.length < maxCount) {
    pickDistinctFromPool(matched, picked, pickedIds, usedCourses, maxCount);
  }

  return picked;
}

function cleanChapterTitle(raw: string): string {
  return raw.replace(/^Chương\s*\d+\s*[:.\-–—]?\s*/i, '').trim() || raw;
}

function getChapterProgressCount(
  item: GoalCatalogItem,
  completedLessonSet: ReadonlySet<string>,
  completedQuestSet: ReadonlySet<string>,
  quests: readonly SkillQuest[],
): number {
  const lessonIds = item.lessonIds ?? [];
  if (lessonIds.length === 0) return 0;

  let completed = 0;
  for (const lessonId of lessonIds) {
    if (
      completedLessonSet.has(lessonId) ||
      quests.some(q => q.lessonId === lessonId && completedQuestSet.has(q.id))
    ) {
      completed += 1;
    }
  }
  return completed;
}

function isGoalCompleted(
  item: GoalCatalogItem,
  completedLessonSet: ReadonlySet<string>,
  completedQuestSet: ReadonlySet<string>,
  quests: readonly SkillQuest[],
): boolean {
  if (item.kind === 'chapter') {
    const lessonIds = item.lessonIds ?? [];
    return (
      lessonIds.length > 0 &&
      getChapterProgressCount(item, completedLessonSet, completedQuestSet, quests) ===
        lessonIds.length
    );
  }
  if (item.kind === 'quest' && item.questId) {
    return completedQuestSet.has(item.questId) || completedLessonSet.has(item.lessonId);
  }
  return completedLessonSet.has(item.lessonId);
}

function GoalCardBadges({
  item,
  chapterDoneCount,
}: {
  readonly item: GoalCatalogItem;
  readonly chapterDoneCount: number;
}): JSX.Element {
  const totalLessons = item.lessonIds?.length ?? 0;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone="accent" mono>
        {item.courseCode}
      </Badge>
      {item.kind === 'chapter' ? (
        <Badge tone="success">
          {chapterDoneCount > 0 && chapterDoneCount < totalLessons
            ? `${chapterDoneCount}/${totalLessons} bài`
            : `Trọn chương · ${totalLessons} bài`}
        </Badge>
      ) : item.kind === 'quest' ? (
        <Badge tone="warning">4 mốc</Badge>
      ) : (
        <Badge tone="neutral">Bài lẻ</Badge>
      )}
    </span>
  );
}

export function CosmicGoalPortal({
  courses,
  subjects,
  content,
  quests,
  completedLessonIds,
  completedQuestIds,
  onActiveSubjectChange,
}: CosmicGoalPortalProps): JSX.Element {
  const headingId = useId();
  const [query, setQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<EntityId | 'all'>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<EntityId | 'all'>('all');
  const [selectedKind, setSelectedKind] = useState<NonNullable<GoalCatalogFilter['kind']>>('all');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [burstKey, setBurstKey] = useState(0);
  const [stagePaused, setStagePaused] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let inViewport = true;
    const syncPaused = () => {
      setStagePaused(!inViewport || document.visibilityState === 'hidden');
    };
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            entries => {
              const entry = entries[0];
              if (entry) {
                inViewport = entry.isIntersecting;
                syncPaused();
              }
            },
            { threshold: 0.05 },
          )
        : null;
    observer?.observe(el);
    document.addEventListener('visibilitychange', syncPaused);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncPaused);
    };
  }, []);

  const catalog = useMemo(
    () => buildGoalCatalog(courses, content, quests),
    [courses, content, quests],
  );

  const availableCourses = useMemo(
    () =>
      selectedSubjectId === 'all'
        ? courses
        : courses.filter(course => course.subjectId === selectedSubjectId),
    [courses, selectedSubjectId],
  );

  const matched = useMemo(
    () =>
      filterGoalCatalog(catalog, {
        query,
        subjectId: selectedSubjectId,
        courseId: selectedCourseId,
        kind: selectedKind,
      }),
    [catalog, query, selectedSubjectId, selectedCourseId, selectedKind],
  );

  const isFiltered =
    query.trim().length > 0 ||
    selectedSubjectId !== 'all' ||
    selectedCourseId !== 'all' ||
    selectedKind !== 'all';

  const isGridOpen = showAllGrid || isFiltered;

  const floatingGoals = useMemo(
    () => pickFloatingGoals(matched, isFiltered, FLOATING_SLOTS.length),
    [matched, isFiltered],
  );

  const visibleGoals = useMemo(
    () => matched.slice(0, visibleLimit),
    [matched, visibleLimit],
  );

  const completedLessonSet = useMemo(
    () => new Set(completedLessonIds),
    [completedLessonIds],
  );
  const completedQuestSet = useMemo(
    () => new Set(completedQuestIds),
    [completedQuestIds],
  );

  const selectedGoal = useMemo(
    () =>
      selectedGoalId
        ? catalog.find(
            item =>
              item.id === selectedGoalId ||
              (item.kind === 'chapter' && `chapter:${item.chapterId}` === selectedGoalId),
          ) ?? null
        : null,
    [catalog, selectedGoalId],
  );

  const effectiveSubjectId: EntityId | 'all' = selectedGoal
    ? selectedGoal.subjectId
    : selectedCourseId !== 'all'
      ? (courses.find(c => c.id === selectedCourseId)?.subjectId ?? selectedSubjectId)
      : selectedSubjectId;

  useEffect(() => {
    onActiveSubjectChange?.(effectiveSubjectId);
  }, [effectiveSubjectId, onActiveSubjectChange]);

  const activeRoadmapCourse = useMemo(() => {
    if (selectedCourseId !== 'all') {
      return courses.find(c => c.id === selectedCourseId) ?? null;
    }
    if (selectedGoal) {
      return courses.find(c => c.id === selectedGoal.courseId) ?? null;
    }
    return availableCourses[0] ?? courses[0] ?? null;
  }, [selectedCourseId, selectedGoal, courses, availableCourses]);

  const topicById = useMemo(
    () => new Map(content.topics.map(topic => [topic.id, topic])),
    [content.topics],
  );

  const lessonIdSet = useMemo(
    () => new Set(content.lessons.map(lesson => lesson.id)),
    [content.lessons],
  );

  const roadmapChapters = useMemo(() => {
    if (!activeRoadmapCourse) return [];
    const chapterById = new Map(content.chapters.map(ch => [ch.id, ch]));
    return activeRoadmapCourse.chapterIds
      .map(id => chapterById.get(id))
      .filter((ch): ch is Chapter => {
        if (!ch) return false;
        return ch.topicIds.some(topicId => {
          const topic = topicById.get(topicId);
          return topic ? topic.lessonIds.some(lessonId => lessonIdSet.has(lessonId)) : false;
        });
      });
  }, [activeRoadmapCourse, content.chapters, topicById, lessonIdSet]);

  const targetCourse = useMemo(
    () =>
      selectedGoal
        ? courses.find(course => course.id === selectedGoal.courseId) ?? null
        : null,
    [courses, selectedGoal],
  );

  const pathway = useMemo(() => {
    if (!selectedGoal || !targetCourse) return null;
    if (selectedGoal.kind === 'chapter' && selectedGoal.chapterId) {
      return buildChapterPathway(
        selectedGoal.chapterId,
        content,
        completedLessonIds,
        completedQuestIds,
        quests,
      );
    }
    return buildGoalPathway(
      selectedGoal.lessonId,
      targetCourse,
      content,
      completedLessonIds,
      completedQuestIds,
      quests,
    );
  }, [selectedGoal, targetCourse, content, completedLessonIds, completedQuestIds, quests]);

  const neighborhoodFlow = useMemo(() => {
    if (!selectedGoal || !targetCourse) return null;
    if (selectedGoal.kind === 'chapter' && selectedGoal.chapterId) {
      return buildNeighborhoodFlow(
        { kind: 'chapter', chapterId: selectedGoal.chapterId },
        targetCourse,
        content,
        completedLessonIds,
        completedQuestIds,
        quests,
      );
    }
    return buildNeighborhoodFlow(
      { kind: 'lesson', lessonId: selectedGoal.lessonId },
      targetCourse,
      content,
      completedLessonIds,
      completedQuestIds,
      quests,
    );
  }, [selectedGoal, targetCourse, content, completedLessonIds, completedQuestIds, quests]);

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setVisibleLimit(PAGE_SIZE);
  };

  const handleSelectSubject = (subjectId: EntityId | 'all') => {
    setSelectedSubjectId(subjectId);
    setVisibleLimit(PAGE_SIZE);
    if (
      subjectId !== 'all' &&
      selectedCourseId !== 'all' &&
      !courses.some(course => course.id === selectedCourseId && course.subjectId === subjectId)
    ) {
      setSelectedCourseId('all');
    }
  };

  const handleSelectCourse = (courseId: EntityId | 'all') => {
    setSelectedCourseId(courseId);
    setVisibleLimit(PAGE_SIZE);
  };

  const handleSelectKind = (kind: NonNullable<GoalCatalogFilter['kind']>) => {
    setSelectedKind(kind);
    setVisibleLimit(PAGE_SIZE);
  };

  const handleResetFilters = () => {
    setQuery('');
    setSelectedSubjectId('all');
    setSelectedCourseId('all');
    setSelectedKind('all');
    setVisibleLimit(PAGE_SIZE);
  };

  const handleSelectGoal = (item: GoalCatalogItem) => {
    setSelectedGoalId(item.id);
    setBurstKey(prev => prev + 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    if (selectedGoalId !== null) {
      event.stopPropagation();
      setSelectedGoalId(null);
      return;
    }
    if (isFiltered || showAllGrid) {
      event.stopPropagation();
      handleResetFilters();
      setShowAllGrid(false);
    }
  };

  const firstUncompletedStation = pathway?.stations.find(
    station => !station.isTarget && !station.completed,
  );
  const primaryActionHref =
    selectedGoal?.kind === 'chapter'
      ? pathway?.targetLessonId
        ? `/courses/${selectedGoal.courseId}/lessons/${pathway.targetLessonId}`
        : `/courses/${selectedGoal.courseId}`
      : selectedGoal && selectedGoal.kind === 'quest' && selectedGoal.questId
        ? `/quests/${selectedGoal.questId}`
        : selectedGoal
          ? `/courses/${selectedGoal.courseId}/lessons/${selectedGoal.lessonId}`
          : '#';
  const primaryActionLabel =
    selectedGoal?.kind === 'chapter'
      ? pathway && pathway.remainingCount < pathway.stations.length && pathway.remainingCount > 0
        ? `Tiếp tục Chương ${selectedGoal.chapterIndex ?? ''}`.trim()
        : `Bắt đầu học Chương ${selectedGoal.chapterIndex ?? ''}`.trim()
      : selectedGoal?.kind === 'quest'
        ? 'Bắt đầu Nhiệm vụ 4 mốc'
        : 'Mở bài học chia chặng';

  const activeTetherSlot =
    hoveredSlotIdx !== null && !selectedGoal && !isGridOpen
      ? FLOATING_SLOTS[hoveredSlotIdx]
      : undefined;
  const tetherX = activeTetherSlot ? Number.parseFloat(activeTetherSlot.left) : 0;
  const tetherY = activeTetherSlot ? Number.parseFloat(activeTetherSlot.top) : 0;

  return (
    <section
      aria-labelledby={headingId}
      data-cosmic-portal="true"
      onKeyDown={handleKeyDown}
      className="space-y-5"
    >
      {/* Open-Sky Cosmic Stage: transparent stage so full-bleed ObservatoryCanvas electron orbits sweep unobstructed across both sides */}
      <div
        ref={stageRef}
        data-stage-paused={stagePaused ? 'true' : 'false'}
        className="relative isolate py-2 lg:flex lg:min-h-[640px] lg:items-start lg:justify-center lg:pb-10 lg:pt-20"
      >
        <StarlightBurst triggerKey={burstKey} />

        {activeTetherSlot ? (
          <svg
            aria-hidden="true"
            data-optical-tether="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none hidden lg:absolute lg:inset-0 lg:z-15 lg:block h-full w-full"
          >
            <line
              x1="50"
              y1="50"
              x2={tetherX}
              y2={tetherY}
              stroke="var(--hus-accent)"
              strokeOpacity="0.18"
              strokeWidth="0.6"
            />
            <line
              x1="50"
              y1="50"
              x2={tetherX}
              y2={tetherY}
              stroke="var(--hus-starlight)"
              strokeOpacity="0.85"
              strokeWidth="0.22"
              strokeDasharray="0.8 0.7"
            />
            <circle cx={tetherX} cy={tetherY} r="0.7" fill="var(--hus-starlight)" fillOpacity="0.9" />
          </svg>
        ) : null}

        {/* Layer 1 (Desktop): 8 Chapter-First Goal Cards floating on the open-sky electron orbits behind & around the central search nucleus */}
        <div
          aria-hidden={isGridOpen}
          className="pointer-events-none hidden lg:block lg:absolute lg:inset-0 lg:z-10"
        >
          {floatingGoals.map((item, idx) => {
            const slot = FLOATING_SLOTS[idx];
            if (!slot) return null;
            const selected = selectedGoalId === item.id;
            const hideInnerOnExpand = selectedGoal !== null && slot.depth === 'far';
            const chapterDoneCount =
              item.kind === 'chapter'
                ? getChapterProgressCount(item, completedLessonSet, completedQuestSet, quests)
                : 0;
            const completed = isGoalCompleted(
              item,
              completedLessonSet,
              completedQuestSet,
              quests,
            );
            const settleStyle: CSSProperties = {
              animationDelay: `${Math.min(idx, 6) * 20}ms`,
            };

            return (
              <div
                key={item.id}
                style={{ left: slot.left, top: slot.top }}
                className={`absolute w-[244px] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 hover:z-30 focus-within:z-30 ${
                  hideInnerOnExpand ? 'lg:pointer-events-none lg:opacity-0' : 'lg:pointer-events-auto'
                }`}
              >
                <div className="hus-cosmic-card-settle" style={settleStyle}>
                  <button
                    type="button"
                    data-floating-goal="true"
                    tabIndex={isGridOpen || hideInnerOnExpand ? -1 : 0}
                    aria-hidden={hideInnerOnExpand}
                    aria-pressed={selected}
                    onClick={() => handleSelectGoal(item)}
                    onMouseEnter={() => setHoveredSlotIdx(idx)}
                    onMouseLeave={() => setHoveredSlotIdx(prev => (prev === idx ? null : prev))}
                    onFocus={() => setHoveredSlotIdx(idx)}
                    onBlur={() => setHoveredSlotIdx(prev => (prev === idx ? null : prev))}
                    className="group block w-full rounded-[var(--radius-lg)] text-left focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span
                      className={`hus-cosmic-float-${idx % 3} relative flex w-full flex-col gap-2 rounded-[var(--radius-lg)] border p-3.5 shadow-[var(--hus-shadow-card)] ${
                        selected
                          ? 'z-30 scale-[1.03] border-starlight bg-warning-subtle opacity-100 ring-1 ring-starlight/45'
                          : `hus-cosmic-depth-${slot.depth} border-border-strong bg-surface/96 group-hover:border-accent/60 group-hover:bg-surface group-hover:opacity-100`
                      }`}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-1.5">
                        <GoalCardBadges item={item} chapterDoneCount={chapterDoneCount} />
                        {completed ? (
                          <span
                            className="inline-flex items-center text-success"
                            title="Đã hoàn thành"
                          >
                            <CheckCircleIcon width={14} height={14} />
                            <span className="sr-only">Đã hoàn thành</span>
                          </span>
                        ) : null}
                      </span>

                      <span className="line-clamp-2 text-xs font-semibold leading-snug text-ink">
                        {item.title}
                      </span>

                      <span className="flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <ClockIcon width={12} height={12} />
                          <span>
                            {item.kind === 'chapter'
                              ? `Chương ${item.chapterIndex ?? 1} · ~${item.estimatedMinutes} phút`
                              : `~${item.estimatedMinutes} phút`}
                          </span>
                        </span>
                        <span className="font-medium text-accent">
                          {selected
                            ? 'Đang mở'
                            : item.kind === 'chapter'
                              ? 'Học theo chương →'
                              : 'Mở trạm →'}
                        </span>
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Layer 2: Central Knowledge Picker + Chapter Roadmap Hub (zero backdrop-blur GPU drain) */}
        <div
          className={`relative z-20 mx-auto w-full rounded-[var(--radius-xl)] border border-accent/35 bg-surface/96 p-4 shadow-[0_18px_44px_-16px_rgb(26_86_219/0.22)] sm:p-6 ${
            selectedGoal ? 'max-w-4xl lg:max-w-[52rem]' : 'max-w-xl lg:max-w-[37rem]'
          }`}
        >
          <div className="mx-auto max-w-[34rem]">
          <h2
            id={headingId}
            className="text-center font-display text-2xl font-medium text-ink sm:text-3xl"
          >
            Hôm nay bạn muốn chinh phục kiến thức nào?
          </h2>
          <p className="mt-1.5 text-center text-xs leading-relaxed text-ink-secondary sm:text-sm">
            Chưa biết học gì trước? Chọn ngay một Chương nền tảng đang bay quanh quỹ đạo để học tuần
            tự từ đầu, hoặc tìm mục tiêu cụ thể.
          </p>

          <div className="mt-4">
            <SearchInput
              id="cosmic-goal-search"
              value={query}
              onChange={handleQueryChange}
              label="Tìm kiếm mục tiêu kiến thức"
              placeholder="Tìm chương học (vd: Chương 1, Cơ học, Mảng) hoặc kiến thức cụ thể (đệ quy, thuyết MO…)"
            />
          </div>

          <div className="mt-3.5 space-y-2">
            {/* Subject filter pills */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Lọc theo lĩnh vực"
            >
              <button
                type="button"
                aria-pressed={selectedSubjectId === 'all'}
                onClick={() => handleSelectSubject('all')}
                className={`min-h-[32px] rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  selectedSubjectId === 'all'
                    ? 'border-accent bg-accent-subtle text-accent-ink'
                    : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
                }`}
              >
                Tất cả lĩnh vực
              </button>
              {subjects.map(subject => {
                const active = selectedSubjectId === subject.id;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectSubject(subject.id)}
                    className={`min-h-[32px] rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                      active
                        ? 'border-accent bg-accent-subtle text-accent-ink'
                        : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
                    }`}
                  >
                    {subject.title}
                  </button>
                );
              })}
            </div>

            {/* Course filter pills */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Lọc theo học phần"
            >
              <button
                type="button"
                aria-pressed={selectedCourseId === 'all'}
                onClick={() => handleSelectCourse('all')}
                className={`min-h-[32px] rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  selectedCourseId === 'all'
                    ? 'border-starlight/60 bg-warning-subtle/80 text-ink'
                    : 'border-border bg-surface-subtle/60 text-ink-secondary hover:border-border-strong hover:text-ink'
                }`}
              >
                Tất cả môn
              </button>
              {availableCourses.map(course => {
                const active = selectedCourseId === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectCourse(course.id)}
                    className={`min-h-[32px] rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors duration-200 ${
                      active
                        ? 'border-starlight/60 bg-warning-subtle/80 text-ink'
                        : 'border-border bg-surface-subtle/60 text-ink-secondary hover:border-border-strong hover:text-ink'
                    }`}
                  >
                    {course.academicCode ?? course.id}
                  </button>
                );
              })}
            </div>

            {/* Always-present Sequential Chapter Roadmap Strip inside Central Knowledge Picker */}
            {activeRoadmapCourse && roadmapChapters.length > 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border/80 bg-surface-subtle/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold text-ink">
                      Lộ trình theo chương ·{' '}
                      <span className="font-mono text-accent">
                        {activeRoadmapCourse.academicCode ?? activeRoadmapCourse.id}
                      </span>
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      (Bấm mã môn ở trên để đổi môn)
                    </span>
                  </div>
                  <Link
                    to={`/courses/${activeRoadmapCourse.id}`}
                    className="text-xs font-medium text-accent no-underline hover:underline"
                  >
                    Mở sơ đồ cả môn →
                  </Link>
                </div>

                <div
                  key={activeRoadmapCourse.id}
                  role="group"
                  aria-label="Chọn chương theo thứ tự"
                  className="hus-content-swap mt-2 flex flex-wrap items-center gap-1.5"
                >
                  {roadmapChapters.map((ch, idx) => {
                    const chapterGoalId = `chapter:${ch.id}`;
                    const active = selectedGoalId === chapterGoalId;
                    const cleanTitle = cleanChapterTitle(ch.title);
                    return (
                      <span key={ch.id} className="inline-flex max-w-full items-center gap-1.5">
                        <button
                          type="button"
                          title={ch.title}
                          aria-label={`Chương ${idx + 1}: ${ch.title}`}
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedGoalId(chapterGoalId);
                            setBurstKey(prev => prev + 1);
                          }}
                          className={`inline-flex min-h-[30px] max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                            active
                              ? 'border-accent bg-accent-subtle text-accent-ink'
                              : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
                          }`}
                        >
                          <span className="shrink-0 font-mono font-semibold">Ch.{idx + 1}</span>
                          <span className="max-w-[10.5rem] truncate">{cleanTitle}</span>
                        </button>
                        {idx < roadmapChapters.length - 1 ? (
                          <span aria-hidden="true" className="text-[11px] text-ink-muted">
                            →
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Bottom bar inside nucleus: kind pills + open-all toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 pt-2.5 text-xs">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Lọc theo hình thức học"
              >
                {KIND_OPTIONS.map(option => {
                  const active = selectedKind === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleSelectKind(option.id)}
                      className={`min-h-[30px] rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                        active
                          ? 'border-accent bg-accent-solid text-white'
                          : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-expanded={isGridOpen}
                onClick={() => setShowAllGrid(prev => !prev)}
                className="min-h-[30px] font-medium text-accent hover:underline"
              >
                {isGridOpen ? 'Thu gọn danh sách' : `Mở tất cả (${matched.length})`}
              </button>
            </div>
          </div>
          </div>

          {/* Docked Selected Goal Station Pathway Panel inside the Central Knowledge Picker Hub */}
          {selectedGoal && pathway ? (
            <div className="hus-panel-enter mt-4 border-t border-starlight/45 pt-4">
              <div
                role="region"
                aria-label="Lộ trình trạm kiến thức đã chọn"
                className="min-w-0 rounded-[var(--radius-lg)] border border-starlight/50 bg-surface-subtle/45 p-3.5 sm:p-4"
              >
                <div key={selectedGoal.id} className="hus-content-swap space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent" mono>
                          {selectedGoal.courseCode}
                        </Badge>
                        {selectedGoal.kind === 'chapter' ? (
                          <Badge tone="success">
                            Lộ trình theo chương (
                            {selectedGoal.lessonIds?.length ?? pathway.stations.length} bài)
                          </Badge>
                        ) : selectedGoal.kind === 'quest' ? (
                          <Badge tone="warning">Nhiệm vụ 4 mốc</Badge>
                        ) : (
                          <Badge tone="neutral">Bài lẻ</Badge>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-medium text-ink sm:text-xl">
                        {selectedGoal.title}
                      </h3>
                      <p className="text-xs text-ink-secondary sm:text-sm">
                        {selectedGoal.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGoalId(null)}
                      className="min-h-[34px] shrink-0 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink"
                    >
                      Đóng lộ trình
                    </button>
                  </div>

                  <GuidingBeacon
                    state="act"
                    stepLabel={
                      selectedGoal.kind === 'chapter'
                        ? pathway.remainingCount > 0
                          ? `Còn ${pathway.remainingCount}/${pathway.stations.length} bài`
                          : 'Đã hoàn thành chương'
                        : pathway.remainingCount > 0
                          ? `Còn ${pathway.remainingCount} trạm`
                          : 'Đã hoàn thành chuỗi trạm'
                    }
                    message={
                      selectedGoal.kind === 'chapter'
                        ? `Đi lần lượt từ bài mở đầu đến cuối "${selectedGoal.title}" — lộ trình chuẩn dành cho người mới bắt đầu.`
                        : selectedGoal.kind === 'quest'
                          ? `Hoàn thành 4 mốc lắp ráp để làm chủ "${selectedGoal.title}" trong khoảng ${selectedGoal.estimatedMinutes} phút.`
                          : `Đi qua ${pathway.stations.length} trạm nền tảng để mở khóa trọn vẹn "${selectedGoal.title}".`
                    }
                  />

                  {/* Directed 3-Stage Graph: Cần học gì trước -> Chương/Bài đang chọn -> Tiếp theo học gì */}
                  {neighborhoodFlow ? (
                    <LearningFlowNeighborhoodGraph
                      flow={neighborhoodFlow}
                      onSelectGoalId={nextGoalId => {
                        setSelectedGoalId(nextGoalId);
                        setBurstKey(prev => prev + 1);
                      }}
                      ariaLabel="Sơ đồ cần học trước và học tiếp theo"
                    />
                  ) : null}

                  {/* Station chain */}
                  <ol
                    className="flex flex-wrap items-center gap-2"
                    aria-label="Chuỗi trạm kiến thức"
                  >
                    {pathway.stations.map((station, index) => (
                      <li
                        key={station.lessonId}
                        className="flex min-w-0 max-w-full items-center gap-2"
                      >
                        <Link
                          to={
                            station.questId && selectedGoal.kind !== 'chapter'
                              ? `/quests/${station.questId}`
                              : `/courses/${selectedGoal.courseId}/lessons/${station.lessonId}`
                          }
                          className={`flex min-w-0 max-w-full items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs no-underline transition-colors ${
                            station.isTarget
                              ? 'border-starlight bg-warning-subtle/80 font-semibold text-ink ring-1 ring-starlight/40 hover:border-accent/60'
                              : station.completed
                                ? 'border-success/40 bg-success-subtle text-success hover:border-success'
                                : 'border-border bg-surface text-ink-secondary hover:border-accent/50 hover:text-ink'
                          }`}
                        >
                          <span className="shrink-0 font-mono text-[11px]" aria-hidden="true">
                            {station.completed ? '✓' : station.isTarget ? '★' : `${index + 1}`}
                          </span>
                          <span className="truncate">{station.title}</span>
                        </Link>
                        {index < pathway.stations.length - 1 ? (
                          <ArrowRightIcon
                            width={13}
                            height={13}
                            className="shrink-0 text-ink-muted"
                          />
                        ) : null}
                      </li>
                    ))}
                  </ol>

                  {/* Pathway actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      to={primaryActionHref}
                      className="hus-btn hus-btn-primary min-h-[42px] px-4"
                    >
                      <span>{primaryActionLabel}</span>
                      <ArrowRightIcon width={15} height={15} />
                    </Link>

                    {selectedGoal.kind === 'chapter' ? (
                      <Link
                        to={`/courses/${selectedGoal.courseId}?chapter=${encodeURIComponent(selectedGoal.chapterId ?? '')}`}
                        className="hus-btn hus-btn-secondary min-h-[42px] px-3.5 text-xs sm:text-sm"
                      >
                        Xem Sơ đồ bài học của chương
                      </Link>
                    ) : firstUncompletedStation ? (
                      <Link
                        to={
                          firstUncompletedStation.questId
                            ? `/quests/${firstUncompletedStation.questId}`
                            : `/courses/${selectedGoal.courseId}/lessons/${firstUncompletedStation.lessonId}`
                        }
                        className="hus-btn hus-btn-secondary min-h-[42px] max-w-full px-3.5 text-xs sm:text-sm"
                      >
                        <span className="truncate">
                          Đi từ trạm nền tảng: {firstUncompletedStation.title}
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Layer 1 (Mobile / Tablet): compact horizontal orbit cards inside the cosmic box */}
        {!isGridOpen && floatingGoals.length > 0 ? (
          <div className="relative z-10 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 lg:hidden">
            {floatingGoals.slice(0, 6).map(item => {
              const selected = selectedGoalId === item.id;
              const chapterDoneCount =
                item.kind === 'chapter'
                  ? getChapterProgressCount(item, completedLessonSet, completedQuestSet, quests)
                  : 0;
              const completed = isGoalCompleted(
                item,
                completedLessonSet,
                completedQuestSet,
                quests,
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  data-floating-goal="true"
                  aria-pressed={selected}
                  onClick={() => handleSelectGoal(item)}
                  className={`flex w-[228px] shrink-0 snap-start flex-col justify-between gap-2 rounded-[var(--radius-lg)] border p-3.5 text-left transition-colors duration-200 ${
                    selected
                      ? 'border-starlight bg-warning-subtle/85 ring-1 ring-starlight/40'
                      : 'border-border-strong/80 bg-surface/92 hover:border-accent/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <GoalCardBadges item={item} chapterDoneCount={chapterDoneCount} />
                    {completed ? (
                      <span className="inline-flex items-center text-success" title="Đã hoàn thành">
                        <CheckCircleIcon width={14} height={14} />
                        <span className="sr-only">Đã hoàn thành</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <ClockIcon width={12} height={12} />
                      <span>
                        {item.kind === 'chapter'
                          ? `Chương ${item.chapterIndex ?? 1} · ~${item.estimatedMinutes} phút`
                          : `~${item.estimatedMinutes} phút`}
                      </span>
                    </span>
                    <span className="font-medium text-accent">
                      {item.kind === 'chapter' ? 'Học theo chương →' : 'Mở trạm →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Expandable / Filtered Constellation Grid */}
      {isGridOpen ? (
        <div className="hus-panel-enter mx-auto max-w-6xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <span>
              Tìm thấy <strong className="font-mono text-ink">{matched.length}</strong> mục tiêu
              phù hợp
            </span>
            {isFiltered ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="font-medium text-accent hover:underline"
              >
                Đặt lại bộ lọc
              </button>
            ) : null}
          </div>

          {visibleGoals.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleGoals.map((item, idx) => {
                  const selected = selectedGoalId === item.id;
                  const chapterDoneCount =
                    item.kind === 'chapter'
                      ? getChapterProgressCount(item, completedLessonSet, completedQuestSet, quests)
                      : 0;
                  const completed = isGoalCompleted(
                    item,
                    completedLessonSet,
                    completedQuestSet,
                    quests,
                  );
                  const cardStyle: CSSProperties = {
                    animationDelay: `${Math.min(idx % PAGE_SIZE, 6) * 18}ms`,
                  };

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectGoal(item)}
                      style={cardStyle}
                      className={`hus-cosmic-card-settle group flex min-w-0 flex-col justify-between rounded-[var(--radius-lg)] border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
                        selected
                          ? 'border-starlight bg-warning-subtle/45 ring-1 ring-starlight/40'
                          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-subtle/60'
                      }`}
                    >
                      <div className="min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <GoalCardBadges item={item} chapterDoneCount={chapterDoneCount} />
                          {completed ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-success"
                              title="Đã hoàn thành"
                            >
                              <CheckCircleIcon width={15} height={15} />
                              <span className="sr-only">Đã hoàn thành</span>
                            </span>
                          ) : null}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
                            {item.title}
                          </h3>
                          <p className="line-clamp-2 text-xs leading-relaxed text-ink-secondary">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <ClockIcon width={13} height={13} />
                          <span>
                            {item.kind === 'chapter'
                              ? `Chương ${item.chapterIndex ?? 1} · ~${item.estimatedMinutes} phút`
                              : `~${item.estimatedMinutes} phút`}
                          </span>
                        </span>
                        <span className="font-medium text-accent">
                          {selected
                            ? 'Đang xem lộ trình'
                            : item.kind === 'chapter'
                              ? 'Học theo chương →'
                              : 'Xem trạm →'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {matched.length > visibleLimit ? (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit(prev => prev + PAGE_SIZE)}
                    className="hus-btn hus-btn-secondary min-h-[40px] px-5 text-xs sm:text-sm"
                  >
                    Xem thêm mục tiêu (+{PAGE_SIZE})
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle/50 p-6 text-center">
              <p className="text-sm font-medium text-ink">
                Chưa tìm thấy mục tiêu khớp với bộ lọc hiện tại.
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                Thử từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ chòm sao kiến thức.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="hus-btn hus-btn-secondary mt-4 min-h-[38px] px-4 text-xs"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
