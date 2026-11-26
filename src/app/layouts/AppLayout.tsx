import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { Course, EntityId } from '../../domain/learning';
import type { LearningContent } from '../../domain/workspace';
import { normalizeVietnamese, groupCoursesBySubject } from '../../core/courses/search';
import { completedCourseLessonIds, courseEffectiveProgress } from '../../core/learning/progress';
import { courseLessons } from '../../core/learning/content';
import {
  WEBMCP_ORIGIN_TRIAL_INFO,
  detectWebMcpSupport,
} from '../../infrastructure/ai/webmcp-essay-bridge';
import {
  courseRegistry,
  getSubjectModule,
  subjectList,
} from '../../infrastructure/content/catalogue';
import {
  acknowledgeAiOnboarding,
  hasAcknowledgedAiOnboarding,
} from '../../infrastructure/preferences/notice';
import {
  navigateSmooth,
  preloadCataloguePage,
  preloadCoursesPage,
  preloadExamPracticePage,
} from '../route-transition';
import { useLearningProgress } from '../useLearningProgress';
import { useWorkspaceGestures } from '../useWorkspaceGestures';
import { useWorkspacePreferences } from '../useWorkspacePreferences';
import { WebMcpGuideContext } from '../WebMcpGuideContext';
import { DisciplineEmblem, HusBrandCrest } from '../../components/ui/BrandIdentity';
import {
  AlertCircleIcon,
  BookOpenIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  CloseIcon,
  HomeIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from '../../components/ui/Icons';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { WebMcpNoticeToast, WEBMCP_CHROME_FLAG_URL } from '../../components/ui/WebMcpNoticeToast';
import { WebMcpOnboardingModal } from '../../components/ui/WebMcpOnboardingModal';

const PRIMARY_NAV = [
  { to: '/', label: 'Tổng quan', icon: HomeIcon, end: true },
  { to: '/courses', label: 'Học phần', icon: BookOpenIcon, end: false },
  { to: '/exams', label: 'Luyện đề', icon: ClipboardCheckIcon, end: false },
  { to: '/progress', label: 'Tiến độ', icon: ChartBarIcon, end: false },
] as const;

export function AppLayout() {
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, cycleTheme } = useWorkspacePreferences();
  const { progress } = useLearningProgress();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuery, setDrawerQuery] = useState('');
  const [drawerContent, setDrawerContent] = useState<LearningContent | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(() => !hasAcknowledgedAiOnboarding());
  const [globalQuery, setGlobalQuery] = useState('');

  const openGuide = useCallback(() => {
    setDisclaimerOpen(false);
    setGuideOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    acknowledgeAiOnboarding();
    setGuideOpen(false);
  }, []);

  const guideContextValue = useMemo(
    () => ({ isGuideOpen: guideOpen, openGuide, closeGuide }),
    [guideOpen, openGuide, closeGuide],
  );
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeDrawerButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement | null>(null);
  const globalSearchRef = useRef<HTMLInputElement | null>(null);
  const disclaimerRef = useRef<HTMLDivElement | null>(null);

  const warmDrawerContent = useCallback(() => {
    if (drawerContent !== null) return;
    void import('../../infrastructure/content/learning').then(mod => {
      setDrawerContent(mod.learningContent);
    });
  }, [drawerContent]);

  const openDrawer = useCallback(() => {
    warmDrawerContent();
    setDrawerOpen(true);
  }, [warmDrawerContent]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (drawerOpen && drawerContent === null) {
      warmDrawerContent();
    }
  }, [drawerOpen, drawerContent, warmDrawerContent]);

  useEffect(() => {
    if (!disclaimerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (disclaimerRef.current && !disclaimerRef.current.contains(event.target as Node)) {
        setDisclaimerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDisclaimerOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [disclaimerOpen]);

  const { armedPrompt, confirmNow } = useWorkspaceGestures({
    drawerOpen,
    onOpenDrawer: openDrawer,
    onCloseDrawer: closeDrawer,
  });

  const subjectGroups = useMemo(
    () => groupCoursesBySubject(courseRegistry.list(), subjectList),
    [],
  );

  // Sync top bar search with /courses?q=...
  useEffect(() => {
    if (pathname === '/courses') {
      setGlobalQuery(new URLSearchParams(search).get('q') ?? '');
    }
  }, [pathname, search]);

  // Quick '/' keyboard shortcut to focus header search on desktop.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const searchInput = globalSearchRef.current;
      if (searchInput && searchInput.offsetParent !== null) {
        event.preventDefault();
        searchInput.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Move focus to main content on route changes, reset scroll (unless targeting centered search or scroll portal), and close drawer.
  useEffect(() => {
    setDrawerOpen(false);
    setDisclaimerOpen(false);
    const preserveCustomScroll = Boolean(
      state &&
        typeof state === 'object' &&
        (('focusOrbitalSearch' in state && state.focusOrbitalSearch) ||
          ('fromScrollPortal' in state && state.fromScrollPortal === 'courses')),
    );
    if (!preserveCustomScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
  }, [pathname, state]);

  // Slide-over drawer focus trap, Escape-to-close, body scroll lock, and focus restoration.
  useEffect(() => {
    if (!drawerOpen) return;
    closeDrawerButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key === 'Tab' && drawerPanelRef.current) {
        const focusable = drawerPanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const activeSubjectParam = useMemo(() => {
    if (pathname !== '/courses') return null;
    return new URLSearchParams(search).get('subject');
  }, [pathname, search]);

  const activeCourseIdFromPath = useMemo(() => {
    const match = /^\/courses\/([^/]+)/.exec(pathname);
    return match?.[1] ?? null;
  }, [pathname]);

  const activeLessonIdFromPath = useMemo(() => {
    const match = /^\/courses\/[^/]+\/lessons\/([^/]+)/.exec(pathname);
    return match?.[1] ?? null;
  }, [pathname]);

  const isLessonRoute = pathname.includes('/lessons/');
  const isChapterExamRoute = /\/chapters\/[^/]+\/exam\/?$/.test(pathname);
  const isLandingRoute = pathname === '/';
  const containerWidth = isLessonRoute ? 'max-w-7xl' : 'max-w-6xl';

  const normalizedDrawerQuery = useMemo(
    () => normalizeVietnamese(drawerQuery.trim()),
    [drawerQuery],
  );

  const handleGlobalSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = globalQuery.trim();
    if (trimmed) {
      navigate(`/courses?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/courses');
    }
  };

  const renderDrawerCourseTree = (course: Course, tone: 'sapphire' | 'emerald' | 'amber' | 'violet') => {
    const code = course.academicCode ?? course.id.toUpperCase();
    const isCurrentCourse = activeCourseIdFromPath === course.id;
    const chapters = drawerContent
      ? course.chapterIds
          .map(chId => drawerContent.chapters.find(ch => ch.id === chId))
          .filter(ch => ch !== undefined)
      : [];
    const allCourseLessons = drawerContent ? courseLessons(drawerContent, course) : [];
    const completedIds = drawerContent
      ? new Set(completedCourseLessonIds(course, allCourseLessons, progress))
      : new Set<EntityId>();
    const progressPct =
      drawerContent && allCourseLessons.length > 0
        ? courseEffectiveProgress(course, allCourseLessons, progress)
        : 0;

    const courseHeaderMatches =
      !normalizedDrawerQuery ||
      normalizeVietnamese(course.title).includes(normalizedDrawerQuery) ||
      normalizeVietnamese(code).includes(normalizedDrawerQuery);

    const filteredChapters = chapters
      .map((chapter, chIdx) => {
        const lessonsInChapter = chapter.topicIds.flatMap(topicId => {
          const topic = drawerContent?.topics.find(t => t.id === topicId);
          return (topic?.lessonIds ?? [])
            .map(lId => drawerContent?.lessons.find(l => l.id === lId))
            .filter(l => l !== undefined);
        });
        if (!normalizedDrawerQuery || courseHeaderMatches) {
          return { chapter, chIdx, lessons: lessonsInChapter };
        }
        const chapterMatches = normalizeVietnamese(chapter.title).includes(normalizedDrawerQuery);
        if (chapterMatches) {
          return { chapter, chIdx, lessons: lessonsInChapter };
        }
        return {
          chapter,
          chIdx,
          lessons: lessonsInChapter.filter(l =>
            normalizeVietnamese(l.title).includes(normalizedDrawerQuery),
          ),
        };
      })
      .filter(item => !normalizedDrawerQuery || courseHeaderMatches || item.lessons.length > 0);

    if (normalizedDrawerQuery && !courseHeaderMatches && filteredChapters.length === 0) {
      return null;
    }

    const shouldAutoOpen = isCurrentCourse || Boolean(normalizedDrawerQuery);

    return (
      <details
        key={course.id}
        open={shouldAutoOpen || undefined}
        data-discipline={tone}
        className="group/course rounded-[var(--radius-lg)] border border-[var(--disc-border)] bg-[var(--disc-surface)] transition-colors"
      >
        <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-2.5 px-3 py-2.5 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-[var(--radius-sm)] bg-[var(--disc-solid)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                {code}
              </span>
              {allCourseLessons.length > 0 ? (
                <span className="font-mono text-[11px] tabular-nums text-[var(--disc-ink-muted)]">
                  {completedIds.size}/{allCourseLessons.length} bài
                  {progressPct > 0 ? ` · ${progressPct}%` : ''}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--disc-ink)]">
              {course.title}
            </p>
          </div>
          <ChevronDownIcon
            width={15}
            height={15}
            className="shrink-0 text-[var(--disc-ink-muted)] transition-transform duration-200 group-open/course:rotate-180"
          />
        </summary>

        <div className="space-y-2.5 border-t border-[var(--disc-border)] bg-surface/92 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--disc-accent)] no-underline hover:underline"
            >
              <span>Trang tổng quan &amp; lưu ý cách học</span>
              <ChevronRightIcon width={13} height={13} />
            </Link>
            <Link
              to={`/exams?course=${encodeURIComponent(course.id)}`}
              className="font-mono text-[11px] font-medium text-ink-muted no-underline hover:text-ink hover:underline"
            >
              Đề A4
            </Link>
          </div>

          {filteredChapters.length > 0 ? (
            <div className="space-y-2">
              {filteredChapters.map(({ chapter, chIdx, lessons }) => {
                const containsActiveLesson = lessons.some(l => l.id === activeLessonIdFromPath);
                return (
                  <details
                    key={chapter.id}
                    open={containsActiveLesson || Boolean(normalizedDrawerQuery) || chIdx === 0 || undefined}
                    className="group/chapter rounded-[var(--radius-md)] border border-border/80 bg-canvas/70"
                  >
                    <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold text-ink">
                      <span className="truncate">
                        Ch.{chIdx + 1} · {chapter.title}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-normal tabular-nums text-ink-muted">
                        {lessons.length}
                      </span>
                    </summary>
                    <ul className="space-y-0.5 border-t border-border/70 px-1.5 py-1.5">
                      {lessons.map(lesson => {
                        const isActiveLesson = lesson.id === activeLessonIdFromPath;
                        const isDone = completedIds.has(lesson.id);
                        return (
                          <li key={lesson.id}>
                            <Link
                              to={`/courses/${course.id}/lessons/${lesson.id}`}
                              aria-current={isActiveLesson ? 'page' : undefined}
                              className={`flex min-h-[36px] items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs no-underline transition-colors ${
                                isActiveLesson
                                  ? 'bg-accent-subtle font-semibold text-accent-ink'
                                  : 'text-ink-secondary hover:bg-surface hover:text-ink'
                              }`}
                            >
                              <span className="line-clamp-2 leading-snug">{lesson.title}</span>
                              {isDone ? (
                                <CheckCircleIcon
                                  width={13}
                                  height={13}
                                  className="shrink-0 text-success"
                                />
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </div>
          ) : drawerContent === null ? (
            <p className="py-1 text-xs text-ink-muted">Đang tải danh sách chương bài…</p>
          ) : null}
        </div>
      </details>
    );
  };

  return (
    <WebMcpGuideContext.Provider value={guideContextValue}>
      <div className="flex min-h-dvh flex-col bg-canvas text-ink">
        <a
          className="skip-link"
          href="#main-content"
          onClick={event => {
            event.preventDefault();
            document.getElementById('main-content')?.focus();
          }}
        >
          Đến nội dung chính
        </a>

        {/* Floating translucent Atmospheric Observatory navigation bar */}
        <div className="hus-vt-nav sticky top-0 z-30 px-2.5 pt-2 sm:px-6 sm:pt-3">
          <header
            className={`hus-header-bar mx-auto w-full rounded-[var(--radius-xl)] border border-border bg-surface/96 transition-colors duration-300 ease-[var(--hus-ease)] ${containerWidth}`}
          >
            <div className="flex h-14 items-center justify-between gap-2.5 px-3 sm:h-15 sm:px-4">
              {/* Left: Quad-Discipline Brand Lockup & Primary Navigation */}
              <div className="flex min-w-0 items-center gap-4 xl:gap-5">
                <Link
                  to="/"
                  className="group flex min-w-0 shrink-0 items-center gap-2.5 text-ink no-underline"
                >
                  <HusBrandCrest size="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold tracking-[-0.01em] text-ink">
                      <span>HUS Learning Hub</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                      <span className="truncate">Toán · Lý · Hóa · Tin</span>
                      <span aria-hidden="true" className="hidden sm:inline">
                        ·
                      </span>
                      <span className="hidden sm:inline">ĐHKHTN</span>
                    </span>
                  </span>
                </Link>

                <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
                  {PRIMARY_NAV.map(item => {
                    const Icon = item.icon;
                    const preloadTarget =
                      item.to === '/courses'
                        ? preloadCoursesPage
                        : item.to === '/exams'
                          ? preloadExamPracticePage
                          : item.to === '/'
                            ? preloadCataloguePage
                            : undefined;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onMouseEnter={preloadTarget ? () => void preloadTarget() : undefined}
                        onFocus={preloadTarget ? () => void preloadTarget() : undefined}
                        onClick={
                          preloadTarget
                            ? event => {
                                if (
                                  event.metaKey ||
                                  event.ctrlKey ||
                                  event.shiftKey ||
                                  event.altKey ||
                                  event.button !== 0 ||
                                  pathname === item.to
                                ) {
                                  return;
                                }
                                event.preventDefault();
                                void navigateSmooth(navigate, item.to, preloadTarget);
                              }
                            : undefined
                        }
                        className={({ isActive }) => {
                          const highlight =
                            item.to === '/exams'
                              ? isActive || isChapterExamRoute
                              : isActive &&
                                !(
                                  item.to === '/courses' &&
                                  (activeSubjectParam !== null || isChapterExamRoute)
                                );
                          return `inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm font-medium no-underline transition-colors duration-300 ease-[var(--hus-ease)] ${
                            highlight
                              ? 'bg-accent-subtle text-accent-ink'
                              : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                          }`;
                        }}
                      >
                        <Icon width={15} height={15} className="hidden shrink-0 xl:block" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              {/* Right: Search + Utilities + Universal 3-Bar Curriculum Drawer Button */}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <form
                  onSubmit={handleGlobalSearch}
                  role="search"
                  aria-label="Tìm kiếm học phần"
                  className="relative hidden w-44 md:block lg:w-48 xl:w-56"
                >
                  <SearchIcon
                    width={15}
                    height={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    ref={globalSearchRef}
                    type="search"
                    value={globalQuery}
                    onChange={event => setGlobalQuery(event.target.value)}
                    placeholder="Tìm học phần, bài học…"
                    aria-label="Tìm kiếm học phần"
                    className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-canvas/80 pl-9 pr-8 text-sm text-ink placeholder:text-ink-muted transition-[border-color,background-color] duration-300 ease-[var(--hus-ease)] hover:border-border-strong focus:border-accent focus:bg-surface focus:outline-none"
                  />
                  {globalQuery.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalQuery('');
                        globalSearchRef.current?.focus();
                      }}
                      aria-label="Xóa từ khóa tìm kiếm"
                      className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted hover:bg-surface-subtle hover:text-ink"
                    >
                      <CloseIcon width={13} height={13} />
                    </button>
                  ) : (
                    <kbd
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-0.5 font-mono text-xs leading-none text-ink-muted lg:inline-block"
                    >
                      /
                    </kbd>
                  )}
                </form>

                <div ref={disclaimerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDisclaimerOpen(prev => !prev)}
                    aria-label="Lưu ý về nguồn nội dung"
                    aria-expanded={disclaimerOpen}
                    aria-haspopup="dialog"
                    title="Lưu ý về nguồn nội dung"
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border transition-colors duration-300 ease-[var(--hus-ease)] active:scale-95 ${
                      disclaimerOpen
                        ? 'border-warning/40 bg-warning-subtle text-warning'
                        : 'border-transparent bg-transparent text-ink-muted/80 hover:border-border hover:bg-surface-subtle hover:text-ink-secondary'
                    }`}
                  >
                    <AlertCircleIcon width={15} height={15} />
                  </button>
                  {disclaimerOpen ? (
                    <div
                      role="note"
                      aria-label="Thông tin lưu ý về nội dung"
                      className="hus-panel-enter absolute right-0 top-11 z-40 w-72 rounded-[var(--radius-lg)] border border-border-strong bg-surface p-3.5 text-xs leading-relaxed text-ink-secondary shadow-[var(--hus-shadow-nav)] sm:w-80"
                    >
                      <p className="font-semibold text-ink">Lưu ý về học liệu</p>
                      <p className="mt-1">
                        Toàn bộ nội dung trên website không phải tài liệu chính thức mà được tổng hợp
                        từ nhiều nguồn tham khảo, không thể thay thế giảng viên trên lớp và giáo
                        trình.
                      </p>
                      {!detectWebMcpSupport().available ? (
                        <p className="mt-1.5 border-t border-border/80 pt-1.5 text-[11px] text-warning">
                          <strong>WebMCP chưa hoạt động mặc định:</strong> Origin Trial hỗ trợ đến
                          Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone} (
                          {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}); nếu không tự bật, hãy kích
                          hoạt cờ <code className="font-mono">{WEBMCP_CHROME_FLAG_URL}</code>.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={openGuide}
                        className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-border bg-canvas/80 px-2.5 py-1.5 text-[11px] font-medium text-accent-ink transition-colors hover:border-accent hover:bg-accent-subtle"
                      >
                        Hướng dẫn dùng WebMCP &amp; Gói AI
                      </button>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={cycleTheme}
                  aria-label={
                    resolvedTheme === 'dark'
                      ? 'Chuyển sang giao diện sáng'
                      : 'Chuyển sang giao diện tối'
                  }
                  title={resolvedTheme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-canvas/80 text-ink-secondary transition-colors duration-300 ease-[var(--hus-ease)] hover:border-border-strong hover:bg-surface-subtle hover:text-ink active:scale-95"
                >
                  {resolvedTheme === 'dark' ? (
                    <SunIcon width={16} height={16} />
                  ) : (
                    <MoonIcon width={16} height={16} />
                  )}
                </button>

                <NavLink
                  to="/settings"
                  aria-label="Cài đặt"
                  title="Cài đặt"
                  className={({ isActive }) =>
                    `hidden h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border transition-colors duration-300 ease-[var(--hus-ease)] active:scale-95 lg:inline-flex ${
                      isActive
                        ? 'border-accent bg-accent-subtle text-accent-ink'
                        : 'border-border bg-canvas/80 text-ink-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-ink'
                    }`
                  }
                >
                  <SettingsIcon width={16} height={16} />
                </NavLink>

                {/* Universal 3-Bar Corner Curriculum Drawer Trigger (Mobile & Desktop) */}
                <button
                  ref={menuButtonRef}
                  type="button"
                  onMouseEnter={warmDrawerContent}
                  onFocus={warmDrawerContent}
                  onClick={openDrawer}
                  aria-label="Mở thanh điều hướng"
                  aria-expanded={drawerOpen}
                  title="Mở danh mục môn học & chương bài"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong bg-canvas/90 px-2.5 text-xs font-medium text-ink transition-colors duration-300 ease-[var(--hus-ease)] hover:border-accent hover:bg-accent-subtle hover:text-accent-ink active:scale-95"
                >
                  <MenuIcon width={17} height={17} />
                  <span className="hidden sm:inline">Danh mục</span>
                </button>
              </div>
            </div>
          </header>
        </div>

        {/* Universal Slide-Over Curriculum & Navigation Drawer (houses the full long course/chapter/lesson list) */}
        {drawerOpen ? (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng"
            onClick={event => {
              if (event.target === event.currentTarget) {
                setDrawerOpen(false);
                menuButtonRef.current?.focus();
              }
            }}
          >
            <div
              ref={drawerPanelRef}
              className="hus-drawer-panel flex h-full w-full max-w-[27rem] flex-col border-l border-border bg-canvas shadow-[var(--hus-shadow-sheet)]"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-5">
                <Link to="/" className="group flex items-center gap-2.5 text-ink no-underline">
                  <HusBrandCrest size="sm" />
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-ink">HUS Learning Hub</span>
                    <span className="block text-[11px] text-ink-muted">
                      Cây danh mục 4 khối ngành · ĐHKHTN
                    </span>
                  </span>
                </Link>
                <button
                  ref={closeDrawerButtonRef}
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                  aria-label="Đóng thanh điều hướng"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-subtle text-ink hover:bg-surface-hover active:scale-95"
                >
                  <CloseIcon width={18} height={18} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-5">
                {/* Instant curriculum tree filter */}
                <div className="relative">
                  <SearchIcon
                    width={15}
                    height={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    type="search"
                    value={drawerQuery}
                    onChange={event => setDrawerQuery(event.target.value)}
                    placeholder="Tìm nhanh môn, chương hoặc bài học…"
                    aria-label="Lọc nhanh cây danh mục trong ngăn kéo"
                    className="min-h-[42px] w-full rounded-[var(--radius-lg)] border border-border bg-surface pl-9 pr-8 text-base text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:text-sm"
                  />
                  {drawerQuery ? (
                    <button
                      type="button"
                      onClick={() => setDrawerQuery('')}
                      aria-label="Xóa lọc danh mục"
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted hover:bg-surface-subtle hover:text-ink"
                    >
                      <CloseIcon width={14} height={14} />
                    </button>
                  ) : null}
                </div>

                {/* Quick workspace routes */}
                {!normalizedDrawerQuery ? (
                  <nav aria-label="Điều hướng di động" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {[
                      ...PRIMARY_NAV,
                      { to: '/settings', label: 'Cài đặt', icon: SettingsIcon, end: false },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) => {
                            const highlight =
                              item.to === '/exams'
                                ? isActive || isChapterExamRoute
                                : isActive &&
                                  !(
                                    item.to === '/courses' &&
                                    (activeSubjectParam !== null || isChapterExamRoute)
                                  );
                            return `flex min-h-[42px] items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-semibold no-underline transition-colors ${
                              highlight
                                ? 'border-accent bg-accent-subtle text-accent-ink'
                                : 'border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-subtle'
                            }`;
                          }}
                        >
                          <Icon width={15} height={15} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </nav>
                ) : null}

                {/* Hierarchical 4-Discipline Course -> Chapter -> Lesson Directory ("Cột dài") */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                    <p className="text-xs font-semibold text-ink">
                      Danh mục môn học &amp; chương bài
                    </p>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {courseRegistry.list().length} học phần
                    </span>
                  </div>

                  <nav aria-label="Cây danh mục học phần và bài học" className="space-y-4">
                    {subjectGroups.map(({ subject, courses }) => {
                      const mod = getSubjectModule(subject.id);
                      const tone = mod?.visualTheme?.tone ?? 'sapphire';
                      const emblemKind = mod?.visualTheme?.emblemKind;
                      const renderedCourses = courses
                        .map(course => renderDrawerCourseTree(course, tone))
                        .filter(node => node !== null);

                      if (normalizedDrawerQuery && renderedCourses.length === 0) {
                        return null;
                      }

                      return (
                        <div key={subject.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2 px-1">
                            <Link
                              to={`/courses?subject=${encodeURIComponent(subject.id)}`}
                              className="inline-flex items-center gap-2 text-xs font-semibold text-ink no-underline hover:text-accent"
                            >
                              <DisciplineEmblem kind={emblemKind} tone={tone} size="sm" />
                              <span>{subject.title}</span>
                            </Link>
                            <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                              {courses.length} môn
                            </span>
                          </div>
                          <div className="space-y-2">{renderedCourses}</div>
                        </div>
                      );
                    })}
                  </nav>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-surface px-4 py-3 text-[11px] text-ink-muted sm:px-5">
                Đài quan sát tri thức mở · Trường ĐH Khoa học Tự nhiên, ĐHQGHN
              </div>
            </div>
          </div>
        ) : null}

        {/* Main content container */}
        <main
          id="main-content"
          tabIndex={-1}
          className={`hus-vt-page flex-1 scroll-mt-20 focus:outline-none ${
            isLandingRoute
              ? 'w-full pb-12 pt-1.5 sm:pb-24 sm:pt-4'
              : `mx-auto w-full px-3.5 py-6 sm:px-6 sm:py-10 ${containerWidth}`
          }`}
        >
          <Suspense fallback={<PageSkeleton label="Đang tải nội dung…" />}>
            <Outlet />
          </Suspense>
        </main>

        {/* Two-step boundary pull confirmation pill (elevated above mobile bottom bar on phones) */}
        {armedPrompt ? (
          <div
            role="status"
            aria-live="polite"
            data-gesture-prompt={armedPrompt.edge}
            className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
              armedPrompt.edge === 'top' ? 'top-20 sm:top-24' : 'bottom-20 md:bottom-7'
            }`}
          >
            <button
              type="button"
              onClick={confirmNow}
              className="hus-gesture-pill pointer-events-auto inline-flex min-h-[40px] items-center gap-2 rounded-full border border-accent/40 bg-surface/94 px-4 py-2 text-xs font-medium text-ink shadow-[var(--hus-shadow-nav)] backdrop-blur-xl transition-colors hover:border-accent hover:text-accent active:scale-[0.98]"
            >
              <span aria-hidden="true" className="font-mono text-accent">
                {armedPrompt.edge === 'top' ? '↑' : '↓'}
              </span>
              <span>
                {armedPrompt.edge === 'top'
                  ? `Vuốt / cuộn lên lần nữa để sang ${armedPrompt.target.label}`
                  : `Vuốt / cuộn xuống lần nữa để sang ${armedPrompt.target.label}`}
              </span>
            </button>
          </div>
        ) : null}

        {/* Signature Quad-Discipline Brand Colophon Footer */}
        <footer className="mt-8 border-t border-border bg-surface/75 pb-20 md:mt-12 md:pb-0">
          <div
            className={`mx-auto flex w-full flex-col gap-5 px-4 py-7 text-xs text-ink-muted sm:px-6 ${containerWidth}`}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3.5">
                <HusBrandCrest size="md" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    HUS Learning Hub · Đài quan sát Khoa học Tự nhiên
                  </p>
                  <p className="max-w-xl text-xs leading-relaxed text-ink-secondary">
                    Không gian tự học mở cho sinh viên Trường Đại học Khoa học Tự nhiên, ĐHQGHN —
                    tích hợp lộ trình 4 khối ngành, định hướng phương pháp học đặc thù và luyện đề
                    tự luận giấy A4 lưu cục bộ.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {subjectGroups.map(({ subject }) => {
                  const mod = getSubjectModule(subject.id);
                  const tone = mod?.visualTheme?.tone ?? 'sapphire';
                  return (
                    <Link
                      key={subject.id}
                      to={`/courses?subject=${encodeURIComponent(subject.id)}`}
                      data-discipline={tone}
                      className="hus-disc-pill inline-flex min-h-[30px] items-center rounded-full border px-3 py-1 text-xs font-medium no-underline transition-opacity hover:opacity-85"
                    >
                      {subject.title}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Lưu ý: Học liệu tổng hợp tham khảo (không phải tài liệu chính thức), không thể thay
                thế giảng viên trên lớp và giáo trình.
              </p>
              <nav
                aria-label="Điều hướng chân trang"
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
              >
                <Link
                  to="/courses"
                  className="text-ink-secondary no-underline hover:text-ink hover:underline"
                >
                  Học phần
                </Link>
                <Link
                  to="/exams"
                  className="text-ink-secondary no-underline hover:text-ink hover:underline"
                >
                  Luyện đề
                </Link>
                <Link
                  to="/progress"
                  className="text-ink-secondary no-underline hover:text-ink hover:underline"
                >
                  Tiến độ
                </Link>
                <Link
                  to="/settings"
                  className="text-ink-secondary no-underline hover:text-ink hover:underline"
                >
                  Cài đặt
                </Link>
              </nav>
            </div>
          </div>
        </footer>

        {/* Mobile First-Class Thumb-Zone Bottom Tab Bar (< 768px, hidden on LessonPage where dedicated lesson bar appears) */}
        {!isLessonRoute ? (
          <nav
            aria-label="Thanh điều hướng nhanh trên điện thoại"
            data-mobile-bottom-nav="true"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/96 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md md:hidden"
          >
            <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5">
              {PRIMARY_NAV.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => {
                      const highlight =
                        item.to === '/exams'
                          ? isActive || isChapterExamRoute
                          : isActive &&
                            !(
                              item.to === '/courses' &&
                              (activeSubjectParam !== null || isChapterExamRoute)
                            );
                      return `flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1 text-[11px] font-medium no-underline transition-colors ${
                        highlight
                          ? 'bg-accent-subtle/80 font-semibold text-accent-ink'
                          : 'text-ink-muted hover:text-ink'
                      }`;
                    }}
                  >
                    <Icon width={17} height={17} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}

              <button
                type="button"
                onClick={openDrawer}
                aria-label="Mở cây danh mục môn học"
                aria-expanded={drawerOpen}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1 text-[11px] font-medium transition-colors ${
                  drawerOpen
                    ? 'bg-accent-subtle/80 font-semibold text-accent-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <MenuIcon width={17} height={17} />
                <span className="truncate">Mục lục</span>
              </button>
            </div>
          </nav>
        ) : null}

        <WebMcpNoticeToast />
        <WebMcpOnboardingModal open={guideOpen} onClose={closeGuide} />
      </div>
    </WebMcpGuideContext.Provider>
  );
}
