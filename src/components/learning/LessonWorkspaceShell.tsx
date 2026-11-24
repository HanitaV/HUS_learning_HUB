import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { EntityId } from '../../domain/learning';
import { CheckCircleIcon, ChevronDownIcon } from '../ui/Icons';

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
  children,
}: LessonWorkspaceShellProps) {
  const hasContextPanel = outline.length > 0 || Boolean(contextExtra);
  const allLessons = chapters.flatMap(chapter => chapter.lessons);
  const completedCount = allLessons.filter(lesson => lesson.completed).length;
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(outline[0]?.id ?? null);

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
    <div
      className={`grid grid-cols-1 gap-6 lg:gap-8 ${
        hasContextPanel
          ? 'lg:grid-cols-[15.5rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)_13.5rem]'
          : 'lg:grid-cols-[15.5rem_minmax(0,1fr)]'
      }`}
    >
      {/* Mobile collapsible syllabus */}
      <details className="hus-card-surface group rounded-[var(--radius-xl)] border border-border bg-surface lg:hidden">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
          <span className="truncate">
            Mục lục học phần
            {allLessons.length > 0 ? (
              <span className="ml-2 font-mono text-xs font-normal text-ink-muted tabular-nums">
                {completedCount}/{allLessons.length}
              </span>
            ) : null}
          </span>
          <ChevronDownIcon
            width={16}
            height={16}
            className="shrink-0 text-ink-muted transition-transform duration-300 ease-[var(--hus-ease)] group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border px-4 pb-4 pt-3">
          <Link
            to={courseUrl}
            className="block text-xs font-semibold text-ink-muted no-underline hover:text-accent"
          >
            {courseTitle}
          </Link>
          {syllabusNav}
        </div>
      </details>

      {/* Desktop sticky left syllabus — quiet borderless rail */}
      <aside
        aria-label="Mục lục học phần"
        className="hidden pr-2 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
          <Link
            to={courseUrl}
            className="block text-xs font-semibold text-ink no-underline hover:text-accent"
          >
            {courseTitle}
          </Link>
          {allLessons.length > 0 ? (
            <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
              {completedCount}/{allLessons.length}
            </span>
          ) : null}
        </div>
        {syllabusNav}
      </aside>

      {/* Main observatory reading paper */}
      <article className="hus-card-surface min-w-0 rounded-[var(--radius-xl)] border border-border bg-surface px-5 py-7 sm:px-11 sm:py-10">
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
            <nav aria-label="Mục lục bài học" className="border-l border-border pl-4">
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
  );
}
