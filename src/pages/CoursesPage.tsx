import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { preloadCataloguePage } from '../app/route-transition';
import { searchContent, type SearchEntry } from '../core/learning/search';
import { searchEntries } from '../infrastructure/content/search';
import type { Course, EntityId } from '../domain/learning';
import {
  DEFAULT_LIST_PAGE_SIZE,
  filterCourses,
  getCourseSubject,
  recommendCoursesLayout,
  type CoursesLayoutMode,
} from '../core/courses/search';
import { courseLessons } from '../core/learning/content';
import { matchRealElement } from '../core/learning/elements';
import { courseEffectiveProgress } from '../core/learning/progress';
import { resolveCourseConventionCanon } from '../content/curriculum-canons';
import {
  courseRegistry,
  getSubjectModule,
  subjectList,
} from '../infrastructure/content/catalogue';
import { learningContent } from '../infrastructure/content/learning';
import { useLearningProgress } from '../app/useLearningProgress';
import { CourseCard } from '../components/courses/CourseCard';
import {
  OrbitalCourseUniverse,
  type OrbitalCourseItem,
} from '../components/courses/OrbitalCourseUniverse';
import { Badge } from '../components/ui/Badge';
import { SelectableCheckIndicator } from '../components/ui/BrandIdentity';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { ChevronRightIcon, GridIcon, ListIcon } from '../components/ui/Icons';
import { ObservatoryHeader } from '../components/ui/ObservatoryHeader';
import { SearchHighlight, extractMatchSnippet } from '../components/ui/SearchHighlight';
import { SearchInput } from '../components/ui/SearchInput';

type StatusFilter = Course['status'] | 'all';

const KIND_LABELS: Record<SearchEntry['kind'], string> = {
  lesson: 'Bài học',
  chapter: 'Chương',
  topic: 'Chủ đề',
  resource: 'Tài liệu',
  course: 'Học phần',
  subject: 'Môn học',
};

const KIND_ORDER: readonly SearchEntry['kind'][] = [
  'lesson',
  'chapter',
  'topic',
  'resource',
  'course',
  'subject',
];

const INITIAL_CONTENT_GROUP_LIMIT = 12;

export default function CoursesPage() {
  const location = useLocation();
  const allCourses = courseRegistry.list();
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useState<CoursesLayoutMode>(() =>
    recommendCoursesLayout(allCourses.length),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [listVisibleCount, setListVisibleCount] = useState(DEFAULT_LIST_PAGE_SIZE);
  const { progress } = useLearningProgress();
  const resultsContainerRef = useRef<HTMLElement | null>(null);

  // Warm the Home (CataloguePage) chunk silently so two-step upward return is instantaneous
  useEffect(() => {
    const id = window.setTimeout(() => {
      void preloadCataloguePage();
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  // When arriving via Landing Page pull-up CTA, center the Orbital Atom Universe & Search Nucleus
  // synchronously before the View Transition snapshot paints, then focus the central search box.
  useLayoutEffect(() => {
    const state = location.state as { readonly focusOrbitalSearch?: boolean } | null;
    if (!state?.focusOrbitalSearch) return;
    const universe = document.querySelector<HTMLElement>('[data-orbital-universe="true"]');
    if (universe) {
      const rect = universe.getBoundingClientRect();
      const targetTop = Math.max(
        0,
        window.scrollY + rect.top - Math.max(0, (window.innerHeight - rect.height) / 2),
      );
      window.scrollTo({ top: targetTop, behavior: 'instant' });
    }
    const input = document.getElementById('catalog-search');
    if (input instanceof HTMLInputElement) {
      input.focus({ preventScroll: true });
    }
  }, [location.state]);

  const urlSearch = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(urlSearch);
  const lastSyncedUrlSearchRef = useRef(urlSearch);
  const selectedSubject = (searchParams.get('subject') ?? 'all') as EntityId | 'all';

  // Sync external URL ?q= changes (e.g. header search, back/forward) into local search state.
  useEffect(() => {
    if (urlSearch !== lastSyncedUrlSearchRef.current) {
      lastSyncedUrlSearchRef.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  // Debounce local search -> URL ?q= so IME/Telex typing never thrashes history.replaceState.
  useEffect(() => {
    const targetUrlQ = search.trim() ? search : '';
    if (targetUrlQ === lastSyncedUrlSearchRef.current) return;

    const timer = window.setTimeout(() => {
      lastSyncedUrlSearchRef.current = targetUrlQ;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (targetUrlQ.trim()) {
            next.set('q', targetUrlQ);
          } else {
            next.delete('q');
          }
          return next;
        },
        { replace: true },
      );
    }, 240);

    return () => window.clearTimeout(timer);
  }, [search, setSearchParams]);

  const filteredCourses = useMemo(
    () =>
      filterCourses(allCourses, subjectList, {
        search,
        subjectId: selectedSubject,
        status: statusFilter,
      }),
    [allCourses, search, selectedSubject, statusFilter],
  );

  // Reset progressive list window whenever filters or search change.
  useEffect(() => {
    setListVisibleCount(DEFAULT_LIST_PAGE_SIZE);
  }, [search, selectedSubject, statusFilter]);

  const allOrbitalItems = useMemo<readonly OrbitalCourseItem[]>(
    () =>
      allCourses.map(course => {
        const lessons = courseLessons(learningContent, course);
        const pct =
          lessons.length > 0
            ? courseEffectiveProgress(course, lessons, progress)
            : undefined;
        const shellLessonCounts = course.chapterIds
          .flatMap(id => learningContent.chapters.filter(ch => ch.id === id))
          .map(ch =>
            ch.topicIds.reduce(
              (sum, topicId) =>
                sum + (learningContent.topics.find(t => t.id === topicId)?.lessonIds.length ?? 0),
              0,
            ),
          );
        const tone = getSubjectModule(course.subjectId)?.visualTheme?.tone ?? 'sapphire';
        const canon = resolveCourseConventionCanon({
          courseId: course.id,
          academicCode: course.academicCode,
          subjectId: course.subjectId,
          courseTitle: course.title,
        });
        return {
          course,
          subject: getCourseSubject(course, subjectList),
          lessonCount: lessons.length,
          progressPercent: pct,
          matchedElement: matchRealElement(shellLessonCounts),
          disciplineTone: tone,
          studyBadge: canon.studyGuide?.badgeLabel,
        };
      }),
    [allCourses, progress],
  );

  // Preserve relevance-ranked order from filterCourses for both orbital and list modes.
  const orbitalItems = useMemo<readonly OrbitalCourseItem[]>(() => {
    const byId = new Map(allOrbitalItems.map(item => [item.course.id, item]));
    return filteredCourses
      .map(course => byId.get(course.id))
      .filter((item): item is OrbitalCourseItem => item !== undefined);
  }, [allOrbitalItems, filteredCourses]);

  const visibleListItems = useMemo(
    () => orbitalItems.slice(0, listVisibleCount),
    [orbitalItems, listVisibleCount],
  );
  const remainingListCount = Math.max(0, orbitalItems.length - visibleListItems.length);

  const deferredSearch = useDeferredValue(search);
  const contentFilterKey = `${deferredSearch}\0${selectedSubject}\0${statusFilter}`;
  const [groupLimitsState, setGroupLimitsState] = useState<{
    readonly key: string;
    readonly limits: Readonly<Record<string, number>>;
  }>({ key: contentFilterKey, limits: {} });
  const groupLimits = groupLimitsState.key === contentFilterKey ? groupLimitsState.limits : {};

  const expandContentGroup = (kind: SearchEntry['kind']) => {
    setGroupLimitsState(prev => {
      const base = prev.key === contentFilterKey ? prev.limits : {};
      const current = base[kind] ?? INITIAL_CONTENT_GROUP_LIMIT;
      return {
        key: contentFilterKey,
        limits: { ...base, [kind]: current + INITIAL_CONTENT_GROUP_LIMIT * 2 },
      };
    });
  };

  const contentResults = useMemo(() => {
    if (!deferredSearch.trim()) return [];
    return searchContent(searchEntries, deferredSearch).filter(
      entry =>
        (selectedSubject === 'all' || entry.subjectId === selectedSubject) &&
        (statusFilter === 'all' || courseRegistry.get(entry.courseId)?.status === statusFilter),
    );
  }, [deferredSearch, selectedSubject, statusFilter]);

  const groupedContentResults = useMemo(() => {
    const groups: { readonly kind: SearchEntry['kind']; readonly items: readonly SearchEntry[] }[] = [];
    for (const kind of KIND_ORDER) {
      const items = contentResults.filter(entry => entry.kind === kind);
      if (items.length > 0) groups.push({ kind, items });
    }
    return groups;
  }, [contentResults]);

  const updateSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const updateSubject = (subjectId: EntityId | 'all') => {
    const next = new URLSearchParams(searchParams);
    if (subjectId === 'all') {
      next.delete('subject');
    } else {
      next.set('subject', subjectId);
    }
    setSearchParams(next, { replace: true });
  };

  const resetFilters = useCallback(() => {
    lastSyncedUrlSearchRef.current = '';
    setSearch('');
    setStatusFilter('all');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && resultsContainerRef.current) {
      const firstResult = resultsContainerRef.current.querySelector<HTMLAnchorElement>('a[href]');
      if (firstResult) {
        event.preventDefault();
        firstResult.focus();
      }
    }
  }, []);

  const handleResultsKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const container = resultsContainerRef.current;
    if (!container) return;
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
    if (links.length === 0) return;
    const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (currentIndex === -1) return;

    event.preventDefault();
    if (event.key === 'ArrowDown') {
      links[(currentIndex + 1) % links.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      links[(currentIndex - 1 + links.length) % links.length]?.focus();
    } else if (event.key === 'Home') {
      links[0]?.focus();
    } else if (event.key === 'End') {
      links[links.length - 1]?.focus();
    }
  };

  return (
    <div className="space-y-6">
      <div data-courses-header="true">
        <ObservatoryHeader
          breadcrumbs={<Breadcrumbs items={[{ label: 'Tổng quan', to: '/' }, { label: 'Học phần' }]} />}
          title="Danh mục học phần"
          description="Bản đồ nguyên tử học phần: tìm kiếm tại hạt nhân trung tâm và chọn các môn học đang chuyển động quanh quỹ đạo."
          aside={
            <div className="inline-flex items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-canvas/80 px-4 py-2.5 text-xs">
              <div>
                <span className="block font-mono text-base font-semibold tabular-nums text-ink">
                  {allCourses.length}
                </span>
                <span className="text-ink-muted">Nguyên tử</span>
              </div>
              <span aria-hidden="true" className="h-7 w-px bg-border" />
              <div>
                <span className="block font-mono text-base font-semibold tabular-nums text-ink">
                  {subjectList.length}
                </span>
                <span className="text-ink-muted">Lĩnh vực</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Subject filter pills + status + orbit/list mode switch */}
      <section
        aria-label="Bộ lọc học phần"
        className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-surface/85 px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5"
      >
        <div
          className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5 sm:flex-wrap"
          role="group"
          aria-label="Lọc theo lĩnh vực"
        >
          <button
            type="button"
            onClick={() => updateSubject('all')}
            aria-pressed={selectedSubject === 'all'}
            className={`min-h-[36px] shrink-0 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98] ${
              selectedSubject === 'all'
                ? 'border-accent bg-accent-subtle text-accent-ink'
                : 'border-border bg-canvas/70 text-ink-secondary hover:border-border-strong hover:text-ink'
            }`}
          >
            Tất cả lĩnh vực ({allCourses.length})
          </button>
          {subjectList.map(subject => {
            const isSelected = selectedSubject === subject.id;
            const count = allCourses.filter(course => course.subjectId === subject.id).length;
            const tone = getSubjectModule(subject.id)?.visualTheme?.tone ?? 'sapphire';
            return (
              <button
                key={subject.id}
                type="button"
                data-discipline={tone}
                onClick={() => updateSubject(subject.id)}
                aria-pressed={isSelected}
                className="group hus-disc-tile inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98]"
              >
                <SelectableCheckIndicator checked={isSelected} tone={tone} />
                <span>
                  {subject.title} ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
            <span>Trạng thái</span>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as StatusFilter)}
              className="min-h-[38px] rounded-[var(--radius-md)] border border-border bg-canvas/70 px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="available">Có nội dung học</option>
              <option value="metadata-only">Chỉ có thông tin học phần</option>
            </select>
          </label>

          <div
            role="group"
            aria-label="Chế độ hiển thị"
            className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-subtle p-1"
          >
            <button
              type="button"
              onClick={() => setLayout('orbit')}
              aria-pressed={layout === 'orbit'}
              aria-label="Hiển thị bản đồ nguyên tử"
              title="Bản đồ nguyên tử"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-200 ${
                layout === 'orbit'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <GridIcon width={15} height={15} />
            </button>
            <button
              type="button"
              onClick={() => setLayout('list')}
              aria-pressed={layout === 'list'}
              aria-label="Hiển thị dạng danh sách"
              title="Danh sách"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-200 ${
                layout === 'list'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <ListIcon width={15} height={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Main View: Floating Orbital Atom Universe OR Clean List Mode */}
      {layout === 'orbit' ? (
        <OrbitalCourseUniverse
          items={allOrbitalItems}
          matchedItems={orbitalItems}
          totalCount={allCourses.length}
          search={search}
          onSearchChange={updateSearch}
          onSearchKeyDown={handleSearchKeyDown}
          emptyAction={resetFilters}
        />
      ) : (
        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              id="catalog-search"
              value={search}
              onChange={updateSearch}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm học phần, bài giảng, thuật ngữ (ví dụ: khong thu nguyen)…"
              label="Tìm kiếm trong danh mục học phần"
              className="w-full sm:max-w-md max-sm:[&_input]:text-base"
            />
            <p className="text-xs font-medium text-ink-muted tabular-nums">
              Hiển thị {visibleListItems.length} trên {filteredCourses.length} học phần khớp (tổng{' '}
              {allCourses.length})
            </p>
          </div>

          {filteredCourses.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleListItems.map(
                  ({
                    course,
                    subject,
                    lessonCount,
                    progressPercent,
                    disciplineTone,
                    studyBadge,
                  }) => {
                    const canon = resolveCourseConventionCanon({
                      courseId: course.id,
                      academicCode: course.academicCode,
                      subjectId: course.subjectId,
                      courseTitle: course.title,
                    });
                    return (
                      <CourseCard
                        key={course.id}
                        course={course}
                        subject={subject}
                        layout="grid"
                        lessonCount={lessonCount}
                        progressPercent={progressPercent}
                        disciplineTone={disciplineTone}
                        studyBadge={studyBadge}
                        studyHeadline={canon.studyGuide?.headline}
                      />
                    );
                  },
                )}
              </div>
              {remainingListCount > 0 ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setListVisibleCount(count => count + DEFAULT_LIST_PAGE_SIZE)}
                    className="hus-btn hus-btn-secondary text-xs"
                  >
                    Xem thêm học phần (còn {remainingListCount})
                  </button>
                </div>
              ) : null}
            </div>
          ) : contentResults.length > 0 ? (
            <p className="rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 px-4 py-3 text-sm text-ink-secondary">
              Không có tiêu đề học phần nào khớp trực tiếp với “{search.trim()}”, nhưng đã tìm thấy{' '}
              <span className="font-mono font-semibold text-ink">{contentResults.length}</span> kết
              quả trong nội dung học liệu bên dưới.
            </p>
          ) : (
            <EmptyState
              title="Không có học phần nào khớp với bộ lọc hiện tại"
              description="Hiện tại danh mục chỉ chứa các học phần đã được xác minh thông tin nguồn. Bạn có thể đặt lại bộ lọc để xem toàn bộ học phần hiện có."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="hus-btn hus-btn-secondary"
                >
                  Đặt lại bộ lọc
                </button>
              }
            />
          )}
        </section>
      )}

      {/* Categorized full-text & hierarchy search results */}
      {deferredSearch.trim() ? (
        <section
          ref={resultsContainerRef}
          onKeyDown={handleResultsKeyDown}
          aria-label="Kết quả học liệu"
          aria-live="polite"
          className="space-y-5 pt-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="heading-section">
              Kết quả học liệu cho “{deferredSearch.trim()}”
            </h2>
            <span className="font-mono text-xs tabular-nums text-ink-muted">
              {contentResults.length} kết quả
            </span>
          </div>

          {groupedContentResults.length > 0 ? (
            <div className="space-y-6">
              {groupedContentResults.map(({ kind, items }) => {
                const visibleLimit = groupLimits[kind] ?? INITIAL_CONTENT_GROUP_LIMIT;
                const visibleItems = items.slice(0, visibleLimit);
                const remainingCount = Math.max(0, items.length - visibleItems.length);
                return (
                  <div key={kind} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-ink-muted">
                        {KIND_LABELS[kind]}
                      </h3>
                      <span className="font-mono text-xs tabular-nums text-ink-muted">
                        ({items.length})
                      </span>
                    </div>
                    <ul className="hus-card-surface overflow-hidden divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface">
                      {visibleItems.map(entry => {
                        const course = courseRegistry.get(entry.courseId);
                        const snippet = extractMatchSnippet(entry.text, deferredSearch);
                        return (
                          <li key={`${entry.courseId}-${entry.kind}-${entry.id}`}>
                            <Link
                              to={entry.to}
                              className="group flex min-h-[48px] items-start justify-between gap-4 px-4 py-3 no-underline transition-colors duration-200 hover:bg-surface-subtle/70"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-sm font-medium text-ink group-hover:text-accent">
                                  <span className="sr-only">{KIND_LABELS[entry.kind]}: </span>
                                  <SearchHighlight text={entry.title} query={deferredSearch} />
                                </p>
                                {snippet ? (
                                  <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                                    <SearchHighlight text={snippet} query={deferredSearch} />
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                                {course?.academicCode ? (
                                  <Badge tone="neutral" mono>
                                    {course.academicCode}
                                  </Badge>
                                ) : null}
                                <ChevronRightIcon
                                  width={15}
                                  height={15}
                                  className="text-ink-muted group-hover:text-accent"
                                />
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {remainingCount > 0 ? (
                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => expandContentGroup(kind)}
                          className="hus-btn hus-btn-secondary text-xs"
                        >
                          Xem thêm {KIND_LABELS[kind].toLowerCase()} (còn {remainingCount})
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 px-4 py-3 text-sm text-ink-secondary">
              Không tìm thấy bài học, chương hay tài liệu nào khớp với “{deferredSearch.trim()}”. Thử tìm
              với từ khóa ngắn hơn hoặc đặt lại bộ lọc lĩnh vực.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
