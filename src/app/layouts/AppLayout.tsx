import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { SmallScreenNoticeModal } from '../../components/ui/SmallScreenNoticeModal';
import { WebMcpNoticeToast, WEBMCP_CHROME_FLAG_URL } from '../../components/ui/WebMcpNoticeToast';
import { WebMcpOnboardingModal } from '../../components/ui/WebMcpOnboardingModal';
import {
  WEBMCP_ORIGIN_TRIAL_INFO,
  detectWebMcpSupport,
} from '../../infrastructure/ai/webmcp-essay-bridge';
import {
  acknowledgeAiOnboarding,
  hasAcknowledgedAiOnboarding,
} from '../../infrastructure/preferences/notice';
import { groupCoursesBySubject } from '../../core/courses/search';
import { courseRegistry, subjectList } from '../../infrastructure/content/catalogue';
import {
  navigateSmooth,
  preloadCataloguePage,
  preloadCoursesPage,
  preloadExamPracticePage,
} from '../route-transition';
import { useWorkspaceGestures } from '../useWorkspaceGestures';
import { useWorkspacePreferences } from '../useWorkspacePreferences';
import { WebMcpGuideContext } from '../WebMcpGuideContext';
import {
  AlertCircleIcon,
  BookOpenIcon,
  ChartBarIcon,
  ClipboardCheckIcon,
  CloseIcon,
  FolderIcon,
  HomeIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from '../../components/ui/Icons';

const PRIMARY_NAV = [
  { to: '/', label: 'Tổng quan', icon: HomeIcon, end: true },
  { to: '/courses', label: 'Học phần', icon: BookOpenIcon, end: false },
  { to: '/exams', label: 'Luyện đề', icon: ClipboardCheckIcon, end: false },
  { to: '/progress', label: 'Tiến độ', icon: ChartBarIcon, end: false },
] as const;

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent-solid text-white transition-transform duration-300 ease-[var(--hus-ease)] group-hover:scale-[1.04]"
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.2" />
        <ellipse
          cx="16"
          cy="16"
          rx="12"
          ry="4.8"
          transform="rotate(-28 16 16)"
          stroke="currentColor"
          strokeOpacity="0.72"
          strokeWidth="1.2"
        />
        <circle cx="24.8" cy="11.2" r="1.65" fill="currentColor" />
        <path
          d="M11 10.5v11M21 10.5v11M11 16h10"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function AppLayout() {
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, cycleTheme } = useWorkspacePreferences();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [smallScreenOpen, setSmallScreenOpen] = useState(false);
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

  const effectiveGuideOpen = guideOpen && !smallScreenOpen;
  const guideContextValue = useMemo(
    () => ({ isGuideOpen: effectiveGuideOpen, openGuide, closeGuide }),
    [effectiveGuideOpen, openGuide, closeGuide],
  );
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeDrawerButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerPanelRef = useRef<HTMLElement | null>(null);
  const globalSearchRef = useRef<HTMLInputElement | null>(null);
  const disclaimerRef = useRef<HTMLDivElement | null>(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

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

  // Move focus to main content on route changes, reset scroll (unless targeting centered search or scroll portal), and close mobile sheet.
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

  // Mobile sheet focus trap, Escape-to-close, body scroll lock, and focus restoration.
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
          'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
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

  const isLessonRoute = pathname.includes('/lessons/');
  const isChapterExamRoute = /\/chapters\/[^/]+\/exam\/?$/.test(pathname);
  const isLandingRoute = pathname === '/';
  const containerWidth = isLessonRoute ? 'max-w-7xl' : 'max-w-6xl';

  const handleGlobalSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = globalQuery.trim();
    if (trimmed) {
      navigate(`/courses?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/courses');
    }
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
      <div className="hus-vt-nav sticky top-0 z-30 px-3 pt-2.5 sm:px-6 sm:pt-3">
        <header
          className={`hus-header-bar mx-auto w-full rounded-[var(--radius-xl)] border border-border bg-surface/96 transition-colors duration-300 ease-[var(--hus-ease)] ${containerWidth}`}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-3 sm:h-15 sm:px-4">
            {/* Left: Brand & Primary Navigation */}
            <div className="flex min-w-0 items-center gap-5">
              <Link
                to="/"
                className="group flex shrink-0 items-center gap-2.5 text-ink no-underline"
              >
                <BrandMark />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-ink">
                    HUS Learning Hub
                  </span>
                  <span className="hidden text-xs text-ink-muted sm:block">
                    ĐHKHTN · ĐHQGHN
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
                              !(item.to === '/courses' && (activeSubjectParam !== null || isChapterExamRoute));
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

            {/* Right: Search + Utilities */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <form
                onSubmit={handleGlobalSearch}
                role="search"
                aria-label="Tìm kiếm học phần"
                className="relative hidden w-44 md:block lg:w-48 xl:w-60"
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

              <Link
                to="/courses"
                aria-label="Tìm kiếm học phần"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-canvas/80 text-ink-secondary transition-colors duration-300 ease-[var(--hus-ease)] hover:border-border-strong hover:bg-surface-subtle hover:text-ink active:scale-95 md:hidden"
              >
                <SearchIcon width={16} height={16} />
              </Link>

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
                      : 'border-transparent bg-transparent text-ink-muted/75 hover:border-border hover:bg-surface-subtle hover:text-ink-secondary'
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
                    <p className="mt-1.5 border-t border-border/80 pt-1.5 text-[11px] text-ink-muted">
                      Website được thiết kế tối ưu cho màn hình lớn.
                    </p>
                    {!detectWebMcpSupport().available ? (
                      <p className="mt-1.5 border-t border-border/80 pt-1.5 text-[11px] text-warning">
                        <strong>WebMCP chưa hoạt động mặc định:</strong> Origin Trial hỗ trợ đến
                        Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone} (
                        {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}); nếu không tự bật, hãy kích hoạt
                        cờ <code className="font-mono">{WEBMCP_CHROME_FLAG_URL}</code>.
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

              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Mở thanh điều hướng"
                aria-expanded={drawerOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-canvas/80 text-ink transition-colors duration-300 ease-[var(--hus-ease)] hover:border-border-strong hover:bg-surface-subtle active:scale-95 lg:hidden"
              >
                <MenuIcon width={17} height={17} />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Full-height mobile navigation sheet with staggered entrance */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Điều hướng"
        >
          <div
            ref={drawerPanelRef as React.RefObject<HTMLDivElement>}
            className="hus-sheet fixed inset-0 flex flex-col bg-canvas/96 backdrop-blur-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
              <Link to="/" className="group flex items-center gap-2.5 text-ink no-underline">
                <BrandMark />
                <span className="text-sm font-semibold text-ink">HUS Learning Hub</span>
              </Link>
              <button
                ref={closeDrawerButtonRef}
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  menuButtonRef.current?.focus();
                }}
                aria-label="Đóng thanh điều hướng"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-ink hover:bg-surface-subtle active:scale-95"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              <nav aria-label="Điều hướng di động" className="space-y-1">
                {[
                  ...PRIMARY_NAV,
                  { to: '/settings', label: 'Cài đặt', icon: SettingsIcon, end: false },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
                      className={({ isActive }) => {
                        const highlight =
                          item.to === '/exams'
                            ? isActive || isChapterExamRoute
                            : isActive &&
                              !(item.to === '/courses' && (activeSubjectParam !== null || isChapterExamRoute));
                        return `hus-sheet-item flex min-h-[48px] items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 text-base font-medium no-underline transition-colors ${
                          highlight
                            ? 'bg-accent-subtle text-accent-ink'
                            : 'text-ink hover:bg-surface-subtle'
                        }`;
                      }}
                    >
                      <Icon width={18} height={18} className="shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-8 border-t border-border pt-6">
                <p className="px-3.5 text-xs font-medium text-ink-muted">Lĩnh vực học tập</p>
                <nav aria-label="Lĩnh vực học tập" className="mt-3 space-y-1">
                  {subjectGroups.map(({ subject, courses }, index) => {
                    const isSelected = activeSubjectParam === subject.id;
                    return (
                      <Link
                        key={subject.id}
                        to={`/courses?subject=${encodeURIComponent(subject.id)}`}
                        aria-current={isSelected ? 'page' : undefined}
                        style={{ animationDelay: `${Math.min((index + 5) * 50, 380)}ms` }}
                        className={`hus-sheet-item flex min-h-[44px] items-center justify-between gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-sm no-underline transition-colors ${
                          isSelected
                            ? 'bg-accent-subtle font-medium text-accent-ink'
                            : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FolderIcon width={16} height={16} className="shrink-0 text-ink-muted" />
                          <span className="truncate">{subject.title}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                          {courses.length}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="border-t border-border px-4 py-4 text-xs text-ink-muted sm:px-6">
              Không gian học tập mở · Trường ĐH Khoa học Tự nhiên, ĐHQGHN
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
            ? 'w-full pb-16 pt-2 sm:pb-24 sm:pt-4'
            : `mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 ${containerWidth}`
        }`}
      >
        <Suspense fallback={<PageSkeleton label="Đang tải nội dung…" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Two-step boundary pull confirmation pill (touchpad & touchscreen across all pages) */}
      {armedPrompt ? (
        <div
          role="status"
          aria-live="polite"
          data-gesture-prompt={armedPrompt.edge}
          className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
            armedPrompt.edge === 'top' ? 'top-20 sm:top-24' : 'bottom-5 sm:bottom-7'
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

      {/* Restrained Atmospheric Observatory footer */}
      <footer className="mt-10 border-t border-border bg-surface/55">
        <div
          className={`mx-auto flex w-full flex-col gap-3 px-4 py-6 text-xs text-ink-muted sm:px-6 ${containerWidth}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-ink">
              HUS Learning Hub · Trường Đại học Khoa học Tự nhiên, ĐHQGHN
            </p>
            <nav
              aria-label="Điều hướng chân trang"
              className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
            >
              <Link to="/courses" className="text-ink-secondary no-underline hover:text-ink hover:underline">
                Học phần
              </Link>
              <Link to="/exams" className="text-ink-secondary no-underline hover:text-ink hover:underline">
                Luyện đề
              </Link>
              <Link to="/progress" className="text-ink-secondary no-underline hover:text-ink hover:underline">
                Tiến độ
              </Link>
              <Link to="/settings" className="text-ink-secondary no-underline hover:text-ink hover:underline">
                Cài đặt
              </Link>
            </nav>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-muted/85">
            Lưu ý: Học liệu tổng hợp tham khảo (không phải tài liệu chính thức), không thể thay thế giảng viên trên lớp và giáo trình.
          </p>
        </div>
      </footer>

      <WebMcpNoticeToast />
      <WebMcpOnboardingModal open={effectiveGuideOpen} onClose={closeGuide} />
      <SmallScreenNoticeModal onOpenChange={setSmallScreenOpen} />
    </div>
    </WebMcpGuideContext.Provider>
  );
}
