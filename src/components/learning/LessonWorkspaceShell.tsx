import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import type { DisciplineTone } from '../../contracts/subject-module';
import type { CourseStudyGuide } from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MenuIcon,
  SparkLightbulbIcon,
} from '../ui/Icons';

export interface LessonNavItem {
  readonly id: EntityId;
  readonly title: string;
  readonly to: string;
  readonly completed?: boolean;
}

export interface ChapterNavGroup {
  readonly id: EntityId;
  readonly title: string;
  readonly lessons: readonly LessonNavItem[];
}

export interface OutlineHeading {
  readonly id: string;
  readonly label: string;
  readonly level?: 2 | 3;
}

export interface LessonWorkspaceShellProps {
  readonly courseTitle: string;
  readonly courseUrl: string;
  readonly chapters: readonly ChapterNavGroup[];
  readonly currentLessonId?: EntityId;
  readonly outline?: readonly OutlineHeading[];
  readonly contextExtra?: ReactNode;
  readonly disciplineTone?: DisciplineTone | undefined;
  readonly courseCode?: string | undefined;
  readonly studyGuide?: CourseStudyGuide | undefined;
  readonly previousLesson?: { readonly title: string; readonly to: string } | undefined;
  readonly nextLesson?: { readonly title: string; readonly to: string } | undefined;
  readonly children: ReactNode;
}

function scrollToHeading(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  target.focus({ preventScroll: true });
}

export function LessonWorkspaceShell({
  courseTitle,
  courseUrl,
  chapters,
  currentLessonId,
  outline = [],
  contextExtra,
  disciplineTone,
  courseCode,
  studyGuide,
  previousLesson,
  nextLesson,
  children,
}: LessonWorkspaceShellProps) {
  const hasContextPanel = outline.length > 0 || Boolean(contextExtra);
  const allLessons = chapters.flatMap(chapter => chapter.lessons);
  const completedCount = allLessons.filter(lesson => lesson.completed).length;
  const currentIndex = currentLessonId
    ? allLessons.findIndex(lesson => lesson.id === currentLessonId)
    : -1;
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [currentLessonId]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  useEffect(() => {
    setActiveHeadingId(outline[0]?.id ?? null);
    if (outline.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const elements = outline
      .map(item => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(entry => entry.isIntersecting);
        if (visible?.target.id) {
          setActiveHeadingId(visible.target.id);
        }
      },
      { rootMargin: '-88px 0px -65% 0px', threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [outline]);

  const syllabusNav =
    chapters.length === 0 ? (
      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        Chưa có danh sách chương và bài học nào được chuyển đổi.
      </p>
    ) : (
      <nav aria-label="Danh sách bài học trong học phần" className="mt-4 space-y-5">
        {chapters.map(chapter => (
          <div key={chapter.id}>
            <p className="text-xs font-semibold text-ink">{chapter.title}</p>
            <ul className="mt-2 space-y-1">
              {chapter.lessons.map(lesson => {
                const isCurrent = lesson.id === currentLessonId;
                return (
                  <li key={lesson.id}>
                    <Link
                      to={lesson.to}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex min-h-[38px] items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs no-underline transition-colors duration-200 ${
                        isCurrent
                          ? 'bg-accent-subtle font-semibold text-accent-ink'
                          : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                      }`}
                    >
                      <span className="line-clamp-2 leading-snug">{lesson.title}</span>
                      {lesson.completed ? (
                        <CheckCircleIcon
                          width={14}
                          height={14}
                          className="shrink-0 text-success"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    );

  return (
    <div className="space-y-4">
      {/* Compact Lesson Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-lg)] border border-border-strong bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent sm:text-sm"
        >
          <MenuIcon width={16} height={16} />
          <span>Mục lục học phần</span>
          {allLessons.length > 0 ? (
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-xs text-ink-muted tabular-nums">
              {completedCount}/{allLessons.length}
            </span>
          ) : null}
        </button>

        {studyGuide ? (
          <details data-discipline={disciplineTone ?? 'sapphire'} className="group relative max-w-full">
            <summary className="hus-disc-pill inline-flex min-h-[38px] max-w-full cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-lg)] border px-3 py-1.5 text-xs font-medium transition-colors hover:border-[var(--disc-border-strong)]">
              <SparkLightbulbIcon width={14} height={14} className="shrink-0" />
              <span className="truncate sm:whitespace-normal">
                Lưu ý học {courseCode ?? 'môn này'}: {studyGuide.badgeLabel}
              </span>
            </summary>
            <div className="mt-2 rounded-[var(--radius-lg)] border border-[var(--disc-border-strong)] bg-surface p-3.5 text-xs leading-relaxed text-ink-secondary shadow-md sm:absolute sm:right-0 sm:z-30 sm:w-[26rem] sm:max-w-md">
              <p className="font-medium text-ink">{studyGuide.headline}</p>
              <p className="mt-2 border-t border-border pt-2">
                <strong className="font-semibold text-ink">Tránh lỗi:</strong>{' '}
                {studyGuide.commonPitfall}
              </p>
            </div>
          </details>
        ) : null}
      </div>

      {/* Spacious main reading grid */}
      <div
        className={
          hasContextPanel
            ? 'grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_14.5rem] lg:gap-8'
            : 'grid grid-cols-1 gap-6'
        }
      >
        {/* Main observatory reading paper */}
        <article
          className={`hus-card-surface min-w-0 rounded-[var(--radius-xl)] border border-border bg-surface px-4 py-5 sm:px-9 sm:py-9 ${
            allLessons.length > 0 ? 'pb-20 md:pb-9' : ''
          }`}
        >
          {outline.length > 0 ? (
            <details className="group mb-6 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 xl:hidden">
              <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2 text-xs font-semibold text-ink">
                <span>Trong bài này ({outline.length} mục)</span>
                <ChevronDownIcon
                  width={15}
                  height={15}
                  className="shrink-0 text-ink-muted transition-transform duration-300 ease-[var(--hus-ease)] group-open:rotate-180"
                />
              </summary>
              <nav aria-label="Mục lục bài học" className="border-t border-border px-3 py-2.5">
                <ul className="space-y-1 text-xs">
                  {outline.map(item => (
                    <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                      <button
                        type="button"
                        onClick={() => scrollToHeading(item.id)}
                        className="block min-h-[36px] w-full rounded-[var(--radius-sm)] px-2 py-1 text-left text-ink-secondary transition-colors hover:bg-surface hover:text-accent"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          ) : null}

          <div className="academic-prose mx-auto">{children}</div>
        </article>

        {/* Optional contextual right TOC rail */}
        {hasContextPanel ? (
          <aside
            aria-label="Thông tin bổ trợ bài học"
            className="hidden space-y-5 xl:sticky xl:top-24 xl:block xl:self-start"
          >
            {outline.length > 0 ? (
              <nav
                aria-label="Mục lục bài học"
                className="rounded-[var(--radius-lg)] border border-border bg-surface/80 p-3.5"
              >
                <p className="text-xs font-semibold text-ink-muted">Trong bài này</p>
                <ul className="mt-3 space-y-1 text-xs">
                  {outline.map(item => {
                    const isActive = activeHeadingId === item.id;
                    return (
                      <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                        <button
                          type="button"
                          aria-current={isActive ? 'location' : undefined}
                          onClick={() => {
                            setActiveHeadingId(item.id);
                            scrollToHeading(item.id);
                          }}
                          className={`block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left leading-snug transition-colors duration-200 ${
                            isActive
                              ? 'bg-accent-subtle font-medium text-accent-ink'
                              : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : null}
            {contextExtra}
          </aside>
        ) : null}
      </div>

      {/* Slide-over Syllabus Drawer (portaled to body to escape .hus-vt-page stacking context) */}
      {drawerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex justify-start bg-ink/35 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-label="Mục lục học phần"
              onClick={() => setDrawerOpen(false)}
            >
              <div
                className="hus-drawer-panel flex h-full w-[min(22rem,88vw)] flex-col rounded-r-[var(--radius-xl)] border border-border bg-surface shadow-2xl"
                onClick={event => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      to={courseUrl}
                      onClick={() => setDrawerOpen(false)}
                      className="block text-sm font-semibold text-ink no-underline hover:text-accent"
                    >
                      {courseTitle}
                    </Link>
                    {allLessons.length > 0 ? (
                      <span className="inline-flex rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-xs tabular-nums text-ink-muted">
                        {completedCount}/{allLessons.length} hoàn thành
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng mục lục học phần"
                    onClick={() => setDrawerOpen(false)}
                    className="inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-subtle text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
                  >
                    <CloseIcon width={16} height={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">{syllabusNav}</div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Mobile Sticky Bottom Lesson Quick-Bar (portaled to body) */}
      {allLessons.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <nav
              aria-label="Thanh chuyển bài nhanh trên điện thoại"
              className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/96 px-3 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md md:hidden"
            >
              <div className="mx-auto flex max-w-lg items-center justify-between gap-2 pb-1.5">
                {previousLesson ? (
                  <Link
                    to={previousLesson.to}
                    aria-label={`Bài trước trên thanh nhanh: ${previousLesson.title}`}
                    className="inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-border bg-canvas px-2 py-1.5 text-xs font-medium text-ink no-underline transition-colors hover:border-accent hover:text-accent"
                  >
                    <ChevronLeftIcon width={15} height={15} className="shrink-0" />
                    <span className="truncate">Bài trước</span>
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-border/50 bg-surface-subtle/50 px-2 py-1.5 text-xs font-medium text-ink-muted/60"
                  >
                    <ChevronLeftIcon width={15} height={15} className="shrink-0" />
                    <span className="truncate">Bài trước</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  <MenuIcon width={15} height={15} />
                  <span className="font-mono tabular-nums">
                    Mục lục (
                    {currentIndex >= 0
                      ? `${currentIndex + 1}/${allLessons.length}`
                      : `${completedCount}/${allLessons.length}`}
                    )
                  </span>
                </button>

                {nextLesson ? (
                  <Link
                    to={nextLesson.to}
                    aria-label={`Bài tiếp trên thanh nhanh: ${nextLesson.title}`}
                    className="inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-border bg-canvas px-2 py-1.5 text-xs font-medium text-ink no-underline transition-colors hover:border-accent hover:text-accent"
                  >
                    <span className="truncate">Bài tiếp</span>
                    <ChevronRightIcon width={15} height={15} className="shrink-0" />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-border/50 bg-surface-subtle/50 px-2 py-1.5 text-xs font-medium text-ink-muted/60"
                  >
                    <span className="truncate">Bài tiếp</span>
                    <ChevronRightIcon width={15} height={15} className="shrink-0" />
                  </span>
                )}
              </div>
            </nav>,
            document.body,
          )
        : null}
    </div>
  );
}
