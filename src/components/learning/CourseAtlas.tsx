import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Course, EntityId } from '../../domain/learning';
import type { SemiEssayExercise } from '../../domain/semi-essay';
import type { SkillQuest } from '../../domain/skill-quest';
import type { LearningContent } from '../../domain/workspace';
import { useLearningProgress } from '../../app/useLearningProgress';
import { normalizeVietnamese } from '../../core/courses/search';
import { courseLessons } from '../../core/learning/content';
import { completedCourseLessonIds, isPracticeOnlyCourse } from '../../core/learning/progress';
import { Badge } from '../ui/Badge';
import { CourseDependencyGraph } from './CourseDependencyGraph';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CloseIcon,
  SearchIcon,
} from '../ui/Icons';

export interface CourseAtlasProps {
  readonly course: Course;
  readonly content: LearningContent;
  readonly courseQuests?: readonly SkillQuest[] | undefined;
  readonly completedQuestIds?: readonly EntityId[] | undefined;
  readonly writtenExercises?: readonly SemiEssayExercise[] | undefined;
  readonly initialChapterId?: EntityId | null | undefined;
}

type AtlasView = 'graph' | 'list';

/**
 * Universal Atmospheric Observatory Course Atlas:
 * - Default `graph` view renders a left-to-right topological dependency graph (`CourseDependencyGraph`)
 *   showing both chapter-level and lesson-level prerequisite/progression flow with 4-milestone quests.
 * - `list` view renders an airy chapter constellation ribbon + open star-thread lesson stream.
 * - Scales cleanly across every VNU-HUS subject from 0 chapters (metadata-only) to 5–100+ lessons.
 */
export function CourseAtlas({
  course,
  content,
  courseQuests,
  completedQuestIds,
  writtenExercises,
  initialChapterId,
}: CourseAtlasProps) {
  const { progress } = useLearningProgress();
  const practiceOnly = isPracticeOnlyCourse(course);
  const allLessons = useMemo(() => courseLessons(content, course), [content, course]);
  const effectiveCompletedIds = useMemo(
    () => completedCourseLessonIds(course, allLessons, progress),
    [course, allLessons, progress],
  );
  const effectiveCompletedSet = useMemo(
    () => new Set(effectiveCompletedIds),
    [effectiveCompletedIds],
  );
  const hasChapters = course.chapterIds.length > 0;
  const validInitialChapterId =
    initialChapterId && course.chapterIds.includes(initialChapterId)
      ? initialChapterId
      : null;

  const [view, setView] = useState<AtlasView>('graph');
  const [selectedChapterId, setSelectedChapterId] = useState<EntityId | null>(
    validInitialChapterId,
  );
  const [prevInitialChapterId, setPrevInitialChapterId] = useState(initialChapterId);
  const [prevCourseId, setPrevCourseId] = useState(course.id);
  if (initialChapterId !== prevInitialChapterId || course.id !== prevCourseId) {
    setPrevInitialChapterId(initialChapterId);
    setPrevCourseId(course.id);
    if (initialChapterId !== undefined) {
      setSelectedChapterId(validInitialChapterId);
    } else if (course.id !== prevCourseId) {
      setSelectedChapterId(null);
    }
  }
  const [filterQuery, setFilterQuery] = useState('');
  const [hoveredLessonId, setHoveredLessonId] = useState<EntityId | null>(null);

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

  const writtenByLessonId = useMemo(() => {
    const map = new Map<EntityId, SemiEssayExercise[]>();
    for (const item of writtenExercises ?? []) {
      const existing = map.get(item.lessonId);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.lessonId, [item]);
      }
    }
    return map;
  }, [writtenExercises]);

  const isLessonMastered = useCallback(
    (lessonId: EntityId) => {
      if (effectiveCompletedSet.has(lessonId)) return true;
      const lessonQuests = questsByLessonId.get(lessonId);
      return lessonQuests ? lessonQuests.some(q => completedQuestSet.has(q.id)) : false;
    },
    [effectiveCompletedSet, questsByLessonId, completedQuestSet],
  );

  const chaptersData = useMemo(() => {
    return course.chapterIds
      .flatMap(id => content.chapters.filter(ch => ch.id === id))
      .map((chapter, chapterIndex) => {
        const topics = chapter.topicIds
          .map(id => content.topics.find(t => t.id === id))
          .filter(t => t !== undefined);
        const lessons = topics.flatMap(topic =>
          topic.lessonIds
            .map(id => content.lessons.find(l => l.id === id))
            .filter(l => l !== undefined)
            .map(lesson => {
              const prereqTopics = (topic.prerequisiteIds ?? [])
                .map(pid => content.topics.find(t => t.id === pid))
                .filter(t => t !== undefined);
              const prerequisiteLessonIds = prereqTopics
                .map(pt => pt.lessonIds[0])
                .filter((id): id is EntityId => id !== undefined);
              return {
                lesson,
                topic,
                prereqTopics,
                prerequisiteLessonIds,
              };
            }),
        );
        const completedCount = lessons.filter(({ lesson }) => isLessonMastered(lesson.id)).length;
        const exerciseCount = lessons.reduce((sum, item) => sum + item.lesson.exerciseIds.length, 0);
        return {
          chapter,
          index: chapterIndex,
          lessons,
          completedCount,
          exerciseCount,
        };
      });
  }, [course.chapterIds, content, isLessonMastered]);

  const totalExercises = useMemo(
    () => allLessons.reduce((sum, l) => sum + l.exerciseIds.length, 0),
    [allLessons],
  );

  const nextRecommendedLesson = useMemo(() => {
    const recent = progress.recentTopics.find(t => t.courseId === course.id);
    return (
      (recent ? allLessons.find(l => l.id === recent.lessonId) : undefined) ??
      allLessons.find(l => !isLessonMastered(l.id)) ??
      allLessons[0]
    );
  }, [allLessons, course.id, isLessonMastered, progress.recentTopics]);

  // Map lessonId -> prerequisiteLessonIds for soft hover resonance
  const prereqByLessonId = useMemo(() => {
    const map = new Map<EntityId, readonly EntityId[]>();
    for (const ch of chaptersData) {
      for (const item of ch.lessons) {
        map.set(item.lesson.id, item.prerequisiteLessonIds);
      }
    }
    return map;
  }, [chaptersData]);

  const hoveredPrereqIds = useMemo(
    () => (hoveredLessonId ? (prereqByLessonId.get(hoveredLessonId) ?? []) : []),
    [hoveredLessonId, prereqByLessonId],
  );

  const normalizedQuery = useMemo(() => normalizeVietnamese(filterQuery.trim()), [filterQuery]);

  const visibleChapters = useMemo(() => {
    const scoped =
      !normalizedQuery && selectedChapterId
        ? chaptersData.filter(ch => ch.chapter.id === selectedChapterId)
        : chaptersData;

    if (!normalizedQuery) return scoped;

    return scoped
      .map(ch => {
        const chapterMatches = normalizeVietnamese(ch.chapter.title).includes(normalizedQuery);
        if (chapterMatches) return ch;
        const matchingLessons = ch.lessons.filter(
          ({ lesson, topic }) =>
            normalizeVietnamese(lesson.title).includes(normalizedQuery) ||
            normalizeVietnamese(topic.title).includes(normalizedQuery),
        );
        return {
          ...ch,
          lessons: matchingLessons,
        };
      })
      .filter(ch => ch.lessons.length > 0);
  }, [chaptersData, selectedChapterId, normalizedQuery]);

  const matchedLessonCount = useMemo(
    () => visibleChapters.reduce((sum, ch) => sum + ch.lessons.length, 0),
    [visibleChapters],
  );

  const code = course.academicCode ?? course.id.toUpperCase();
  const selectedChapter = chaptersData.find(ch => ch.chapter.id === selectedChapterId) ?? null;

  // Responsive column count for chapter waypoints so 2-chapter and 7-chapter courses both feel balanced
  const waypointGridClass =
    chaptersData.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : chaptersData.length === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <section aria-labelledby="chapters-heading" className="relative space-y-7">
      {/* Open-Sky Atmospheric Header & Celestial Chapter Constellation (zero nested boxes) */}
      <div className="relative isolate pt-1">
        {/* Subtle zenith glow & celestial horizon arc floating directly on the open canvas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-56 overflow-hidden"
        >
          <div
            className="absolute -top-20 left-1/2 h-52 w-[min(52rem,100%)] -translate-x-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at center, var(--hus-glow-core) 0%, var(--hus-glow-warm) 50%, transparent 74%)',
            }}
          />
          <svg
            viewBox="0 0 1200 180"
            fill="none"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-2 h-44 w-full opacity-75"
          >
            <path
              d="M -40 165 Q 600 -25 1240 165"
              stroke="var(--hus-orbit)"
              strokeWidth="1.2"
              strokeDasharray="4 6"
            />
            <path
              d="M 100 175 Q 600 22 1100 175"
              stroke="var(--hus-orbit-strong)"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
            <circle cx="240" cy="78" r="2.2" fill="var(--hus-accent)" fillOpacity="0.55" />
            <circle cx="600" cy="48" r="2.6" fill="var(--hus-starlight)" fillOpacity="0.7" />
            <circle cx="960" cy="78" r="2.2" fill="var(--hus-accent)" fillOpacity="0.55" />
          </svg>
        </div>

        {/* Workspace Toolbar */}
        <div className="flex flex-col gap-4 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 id="chapters-heading" className="heading-section">
              Lộ trình chương và bài học
            </h2>
            <p className="text-sm text-ink-secondary">
              {hasChapters
                ? practiceOnly
                  ? `${chaptersData.length} chương · ${allLessons.length} trạm bài tập${totalExercises > 0 ? ` · ${totalExercises} câu luyện tập` : ''}. Bỏ qua học lý thuyết — chọn chương hoặc trạm để vào giải bài tập ngay.`
                  : `${chaptersData.length} chương · ${allLessons.length} bài chia chặng${(courseQuests?.length ?? 0) > 0 ? ` · ${courseQuests?.length ?? 0} nhiệm vụ 4 mốc` : ''}${totalExercises > 0 ? ` · ${totalExercises} bài tập` : ''}. Chọn chương hoặc chạm vào từng trạm để học tương tác.`
                : 'Học phần đang ở trạng thái thông tin gốc, chưa có chương bài học tích hợp.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {hasChapters && allLessons.length >= 6 ? (
              <div className="relative w-full sm:w-56">
                <SearchIcon
                  width={14}
                  height={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  type="search"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder="Lọc nhanh bài hoặc chương..."
                  aria-label={`Lọc nhanh bài học trong ${course.title}`}
                  className="min-h-[38px] w-full rounded-full border border-border bg-surface/95 py-1.5 pl-8 pr-8 text-xs text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:bg-surface focus:outline-none"
                />
                {filterQuery ? (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    aria-label="Xóa từ khóa lọc bài học"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-surface-hover hover:text-ink"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div
              role="group"
              aria-label="Chế độ xem học phần"
              className="inline-flex rounded-full border border-border bg-surface/95 p-1"
            >
              <button
                type="button"
                aria-pressed={view === 'graph'}
                onClick={() => setView('graph')}
                className={`min-h-[34px] rounded-full px-3.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  view === 'graph'
                    ? 'bg-accent-subtle text-accent-ink'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Sơ đồ liên kết
              </button>
              <button
                type="button"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                className={`min-h-[34px] rounded-full px-3.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  view === 'list'
                    ? 'bg-accent-subtle text-accent-ink'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Danh sách bài
              </button>
            </div>
          </div>
        </div>

        {/* Celestial Chapter Constellation Ribbon (List Mode with Chapters, when not searching) */}
        {view === 'list' && hasChapters && !normalizedQuery ? (
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={selectedChapterId === null}
                onClick={() => setSelectedChapterId(null)}
                className={`min-h-[34px] rounded-full border px-3.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  selectedChapterId === null
                    ? 'border-accent bg-accent-subtle text-accent-ink'
                    : 'border-border bg-surface/85 text-ink-secondary hover:border-border-strong hover:text-ink'
                }`}
              >
                Tất cả {chaptersData.length} chương ({allLessons.length} bài)
              </button>
              {selectedChapter ? (
                <span className="text-xs text-ink-muted">
                  Đang tập trung vào{' '}
                  <strong className="font-medium text-ink">
                    Chương {selectedChapter.index + 1}
                  </strong>
                </span>
              ) : null}
            </div>

            {/* Airy Floating Chapter Waypoints — every chapter name clearly readable, zero outer wrapper */}
            <div
              role="group"
              aria-label="Chọn chương học để lọc danh sách bài"
              className={`grid gap-2.5 ${waypointGridClass}`}
            >
              {chaptersData.map(item => {
                const isSelected = selectedChapterId === item.chapter.id;
                const isComplete =
                  item.lessons.length > 0 && item.completedCount === item.lessons.length;
                const chapterPct =
                  item.lessons.length > 0
                    ? Math.round((item.completedCount / item.lessons.length) * 100)
                    : 0;
                const containsNext =
                  nextRecommendedLesson !== undefined &&
                  item.lessons.some(l => l.lesson.id === nextRecommendedLesson.id);

                return (
                  <button
                    key={item.chapter.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setSelectedChapterId(prev =>
                        prev === item.chapter.id ? null : item.chapter.id,
                      )
                    }
                    className={`group relative flex flex-col justify-between rounded-[var(--radius-lg)] border px-4 py-3 text-left backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.99] ${
                      isSelected
                        ? 'border-accent bg-accent-subtle/65'
                        : 'border-border bg-surface/85 hover:border-border-strong hover:bg-surface'
                    }`}
                  >
                    <div className="w-full space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-2 font-mono font-medium text-ink-muted">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full transition-transform duration-200 group-hover:scale-125 ${
                              isComplete
                                ? 'bg-success'
                                : isSelected || containsNext
                                  ? 'bg-accent'
                                  : 'bg-border-strong'
                            }`}
                          />
                          <span className={isSelected ? 'text-accent-ink' : undefined}>
                            Chương {item.index + 1}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-ink-muted">
                          {item.completedCount}/{item.lessons.length} bài
                        </span>
                      </div>

                      <span
                        className={`block font-display text-[15px] font-medium leading-snug transition-colors ${
                          isSelected
                            ? 'text-accent-ink'
                            : 'text-ink group-hover:text-accent'
                        }`}
                      >
                        {item.chapter.title}
                      </span>
                    </div>

                    {/* Delicate horizon progress thread */}
                    <div
                      aria-hidden="true"
                      className="mt-2.5 h-[2px] w-full overflow-hidden rounded-full bg-border/75"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isComplete ? 'bg-success' : 'bg-accent'
                        }`}
                        style={{
                          width: `${chapterPct > 0 ? Math.max(chapterPct, 6) : isSelected ? 24 : 0}%`,
                          opacity: chapterPct > 0 ? 1 : isSelected ? 0.5 : 0,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Content Area: Interactive Dependency Graph or Star-Thread List */}
      {hasChapters ? (
        view === 'graph' && !normalizedQuery ? (
          <div className="space-y-4">
            <CourseDependencyGraph
              course={course}
              content={content}
              completedLessonIds={effectiveCompletedIds}
              completedQuestIds={completedQuestIds}
              courseQuests={courseQuests}
              writtenByLessonId={writtenByLessonId}
              nextRecommendedLessonId={nextRecommendedLesson?.id}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
            />

            {/* Chapter-end Written A4 & 3-10 Question Exam Station directly under Graph */}
            {(() => {
              const activeGraphChapter =
                selectedChapter ??
                (allLessons.length > 12 ? chaptersData[0] ?? null : chaptersData[0] ?? null);
              if (!activeGraphChapter) return null;
              const chWritten = activeGraphChapter.lessons.flatMap(
                ({ lesson }) => writtenByLessonId.get(lesson.id) ?? [],
              );
              return (
                <div
                  data-chapter-exam-station={activeGraphChapter.chapter.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-accent/35 bg-surface/95 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent" mono>
                        Cuối Chương {activeGraphChapter.index + 1}
                      </Badge>
                      {chWritten.length > 0 ? (
                        <Badge tone="neutral">{chWritten.length} tự luận giấy A4</Badge>
                      ) : null}
                      <span className="text-xs text-ink-muted">
                        Đề 3–10 câu tùy dạng bài &amp; độ dài
                      </span>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      Tổng kết Chương {activeGraphChapter.index + 1}: {activeGraphChapter.chapter.title}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {chWritten[0] ? (
                      <Link
                        to={`/courses/${course.id}/lessons/${chWritten[0].lessonId}/practice/${chWritten[0].id}`}
                        className="hus-btn hus-btn-secondary text-xs !no-underline"
                      >
                        <span>Luyện tự luận giấy A4</span>
                      </Link>
                    ) : null}
                    <Link
                      to={`/courses/${course.id}/chapters/${activeGraphChapter.chapter.id}/exam`}
                      className="hus-btn hus-btn-primary text-xs !no-underline"
                    >
                      <span>Kiểm tra cuối Chương {activeGraphChapter.index + 1} (3–10 câu)</span>
                      <ArrowRightIcon width={14} height={14} />
                    </Link>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : visibleChapters.length > 0 ? (
          <div className="space-y-10">
            {normalizedQuery ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
                <span>
                  Tìm thấy{' '}
                  <strong className="font-mono text-ink">{matchedLessonCount}</strong> bài học
                  khớp với &ldquo;{filterQuery.trim()}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterQuery('');
                    setSelectedChapterId(null);
                  }}
                  className="font-medium text-accent hover:underline"
                >
                  Hiển thị toàn bộ lộ trình
                </button>
              </div>
            ) : null}

            <ol className="space-y-12">
              {visibleChapters.map(item => {
                const isComplete =
                  item.lessons.length > 0 && item.completedCount === item.lessons.length;

                return (
                  <li key={item.chapter.id} className="space-y-4">
                    {/* Open Atmospheric Chapter Header — zero outer card wall, no eyebrow kicker */}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-border/85 pb-3.5">
                      <div className="flex min-w-0 items-baseline gap-3">
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold ${
                            isComplete
                              ? 'border-success/40 bg-success-subtle text-success'
                              : 'border-accent/30 bg-accent-subtle/75 text-accent-ink'
                          }`}
                        >
                          {String(item.index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="font-display text-xl font-medium tracking-[-0.015em] text-ink sm:text-2xl">
                          <span className="font-sans text-sm font-medium text-ink-muted">
                            Chương {item.index + 1} ·{' '}
                          </span>
                          {item.chapter.title}
                        </h3>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5 text-xs">
                        <Badge tone={isComplete ? 'success' : 'neutral'} mono>
                          {item.completedCount}/{item.lessons.length} bài
                        </Badge>
                        {item.exerciseCount > 0 ? (
                          <span className="hidden font-mono text-ink-muted sm:inline">
                            {item.exerciseCount} bài tập
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Floating Star-Thread Lesson Stream */}
                    <ol className="relative space-y-1.5 pl-6 sm:pl-8">
                      {/* Delicate vertical celestial star-thread */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-5 left-[0.55rem] top-5 w-px bg-gradient-to-b from-orbit-strong via-border to-orbit sm:left-[0.8rem]"
                      />

                      {item.lessons.map(({ lesson, prereqTopics }, lIdx) => {
                        const isCompleted = isLessonMastered(lesson.id);
                        const lessonQuests = questsByLessonId.get(lesson.id) ?? [];
                        const primaryQuest = lessonQuests[0];
                        const lessonWritten = writtenByLessonId.get(lesson.id) ?? [];
                        const primaryWritten = lessonWritten[0];
                        const isNext = nextRecommendedLesson?.id === lesson.id && !isCompleted;
                        const isPrereqHighlighted = hoveredPrereqIds.includes(lesson.id);
                        const isHovered = hoveredLessonId === lesson.id;

                        return (
                          <li key={lesson.id} className="relative">
                            {/* Celestial Star-Node aligned on the vertical thread */}
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none absolute -left-6 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-200 sm:-left-8 ${
                                isCompleted
                                  ? 'border-success/45 bg-success-subtle text-success'
                                  : isPrereqHighlighted
                                    ? 'scale-110 border-starlight bg-surface text-warning ring-4 ring-starlight/15'
                                    : isHovered || isNext
                                      ? 'scale-110 border-accent bg-accent-solid text-white ring-4 ring-accent/15'
                                      : 'border-border-strong bg-surface text-ink-muted'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircleIcon width={13} height={13} />
                              ) : (
                                <span className="font-mono text-[10px] font-semibold leading-none">
                                  {lIdx + 1}
                                </span>
                              )}
                            </span>

                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                              <Link
                                to={`/courses/${course.id}/lessons/${lesson.id}`}
                                aria-label={lesson.title}
                                onMouseEnter={() => setHoveredLessonId(lesson.id)}
                                onMouseLeave={() =>
                                  setHoveredLessonId(prev => (prev === lesson.id ? null : prev))
                                }
                                onFocus={() => setHoveredLessonId(lesson.id)}
                                onBlur={() =>
                                  setHoveredLessonId(prev => (prev === lesson.id ? null : prev))
                                }
                                className={`group flex min-h-[56px] flex-1 items-center justify-between gap-4 rounded-[var(--radius-lg)] border px-4 py-3 no-underline transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 ${
                                  isPrereqHighlighted
                                    ? 'border-starlight/50 bg-surface'
                                    : isNext
                                      ? 'border-accent/35 bg-surface/95 hover:border-accent/60'
                                      : 'border-transparent bg-surface/55 hover:border-border-strong hover:bg-surface'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                    <span className="font-mono text-xs text-ink-muted">
                                      Bài {item.index + 1}.{lIdx + 1}
                                    </span>
                                    <span className="text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
                                      {lesson.title}
                                    </span>
                                  </div>

                                  {prereqTopics.length > 0 ? (
                                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                                      Nền tảng: {prereqTopics.map(p => p.title).join(' · ')}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  {isPrereqHighlighted ? (
                                    <span className="hidden rounded-full border border-starlight/40 bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-warning sm:inline">
                                      Kiến thức nền
                                    </span>
                                  ) : null}
                                  {isNext ? <Badge tone="accent">Tiếp theo</Badge> : null}
                                  {lesson.exerciseIds.length > 0 ? (
                                    <span className="rounded-[var(--radius-sm)] border border-border bg-canvas/80 px-2 py-0.5 font-mono text-xs text-ink-muted">
                                      <span className="sm:hidden">{lesson.exerciseIds.length} BT</span>
                                      <span className="hidden sm:inline">
                                        {lesson.exerciseIds.length} bài tập
                                      </span>
                                    </span>
                                  ) : null}
                                  <ChevronRightIcon
                                    width={15}
                                    height={15}
                                    className="text-ink-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent"
                                  />
                                </div>
                              </Link>

                              {primaryWritten ? (
                                <Link
                                  to={`/courses/${course.id}/lessons/${lesson.id}/practice/${primaryWritten.id}`}
                                  aria-label={`Tự luận giấy A4: ${primaryWritten.title}`}
                                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-accent/45 bg-accent-subtle px-3 py-1.5 font-mono text-xs font-semibold text-accent-ink no-underline transition-colors hover:border-accent sm:self-center"
                                >
                                  <span>Tự luận A4</span>
                                </Link>
                              ) : null}

                              {primaryQuest ? (
                                <Link
                                  to={`/quests/${primaryQuest.id}`}
                                  aria-label={`Nhiệm vụ 4 mốc: ${primaryQuest.title}`}
                                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-starlight/55 bg-warning-subtle px-3 py-1.5 font-mono text-xs font-semibold text-warning no-underline transition-colors hover:border-starlight hover:bg-warning-subtle/90 sm:self-center"
                                >
                                  <span>⚡ Nhiệm vụ 4 mốc</span>
                                </Link>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>

                    {/* End-of-Chapter Exam Bar (3-10 questions) */}
                    {!normalizedQuery ? (
                      <div className="ml-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-accent/30 bg-surface/90 px-4 py-3 sm:ml-8">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge tone="accent" mono>
                            Tổng kết Chương {item.index + 1}
                          </Badge>
                          <span className="text-ink-secondary">
                            Đề 3–10 câu theo dạng bài (có tự luận giấy A4 kẻ ngang)
                          </span>
                        </div>
                        <Link
                          to={`/courses/${course.id}/chapters/${item.chapter.id}/exam`}
                          className="hus-btn hus-btn-primary min-h-[36px] px-3.5 py-1.5 text-xs !no-underline"
                        >
                          <span>Kiểm tra cuối Chương {item.index + 1}</span>
                          <ArrowRightIcon width={13} height={13} />
                        </Link>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          /* No lesson matches inline filter */
          <div className="rounded-[var(--radius-xl)] border border-border bg-surface/75 px-6 py-10 text-center">
            <p className="font-display text-lg font-medium text-ink">
              Không tìm thấy bài học phù hợp
            </p>
            <p className="mt-1.5 text-sm text-ink-secondary">
              Không có chương hoặc bài nào khớp với từ khóa &ldquo;{filterQuery.trim()}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterQuery('');
                setSelectedChapterId(null);
              }}
              className="hus-btn hus-btn-secondary mt-5 text-xs"
            >
              Hiển thị lại tất cả {allLessons.length} bài học
            </button>
          </div>
        )
      ) : (
        /* Serene Empty Horizon for Metadata-Only Courses */
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface/75 px-6 py-10 sm:px-8">
          <div className="max-w-2xl space-y-3">
            <h3 className="font-display text-xl font-medium text-ink">
              Lộ trình chương bài đang chờ tích hợp
            </h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Học phần <span className="font-mono font-medium text-ink">{code}</span> hiện mới lưu
              thông tin định danh. Các chương, bài giảng và nhiệm vụ tương tác sẽ hiển thị sau khi
              được tích hợp.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
