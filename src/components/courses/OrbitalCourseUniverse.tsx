import { memo, useRef, useState, type KeyboardEvent, type TouchEvent, type WheelEvent } from 'react';
import { Link } from 'react-router';
import { DEFAULT_ORBIT_PAGE_SIZE, paginateItems } from '../../core/courses/search';
import type { PeriodicElement } from '../../core/learning/elements';
import type { Course, Subject } from '../../domain/learning';
import { Badge } from '../ui/Badge';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/Icons';
import { SearchInput } from '../ui/SearchInput';
import { AtomicCourseEmblem } from './AtomicCourseEmblem';

export interface OrbitalCourseItem {
  readonly course: Course;
  readonly subject?: Subject | undefined;
  readonly lessonCount: number;
  readonly progressPercent?: number | undefined;
  readonly matchedElement?: PeriodicElement | null | undefined;
}

export interface OrbitalCourseUniverseProps {
  readonly items: readonly OrbitalCourseItem[];
  readonly matchedItems: readonly OrbitalCourseItem[];
  readonly totalCount: number;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly onSearchKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly emptyAction?: (() => void) | undefined;
  readonly orbitPageSize?: number | undefined;
}

/**
 * Balanced orbital angles (in degrees) around the central search nucleus
 * so course atoms never overlap each other or the center search core.
 */
function getOrbitPosition(
  index: number,
  count: number,
  singleSide: 'left' | 'right' = 'right',
): { readonly leftPct: number; readonly topPct: number } {
  const presets: Record<number, readonly number[]> = {
    1: [singleSide === 'left' ? 180 : 0],
    2: [180, 0],
    3: [-90, 28, 152],
    4: [-148, -32, 32, 148],
    5: [-90, -24, 34, 146, 204],
    6: [-90, -28, 28, 90, 152, -152],
  };

  const angles = presets[count];
  const angleDeg =
    angles && angles[index] !== undefined
      ? angles[index]
      : -90 + (index * 360) / Math.max(1, count);

  const rad = (angleDeg * Math.PI) / 180;
  // Slightly wider ellipse horizontally to match 16:10 desktop canvas
  const rx = count <= 2 ? 34 : 36.5;
  const ry = count <= 2 ? 0 : 37.5;

  return {
    leftPct: 50 + Math.cos(rad) * rx,
    topPct: 50 + Math.sin(rad) * ry,
  };
}

function getFlySide(leftPct: number, baseIndex: number): 'left' | 'right' {
  if (leftPct < 49) return 'left';
  if (leftPct > 51) return 'right';
  return baseIndex % 2 === 0 ? 'left' : 'right';
}

/**
 * Floating Quantum Orbital Course Universe for /courses.
 * Places the live search box inside the glowing central nucleus while courses float
 * smoothly around it as interactive atomic nodes. When filtering, unmatched nodes
 * fly smoothly toward the left or right while matched nodes glide into flanking
 * left/right orbital slots; when nothing matches, the search nucleus glides upward
 * to reveal a clear "Không tìm thấy" state.
 */
export const OrbitalCourseUniverse = memo(function OrbitalCourseUniverse({
  items,
  matchedItems,
  totalCount,
  search,
  onSearchChange,
  onSearchKeyDown,
  emptyAction,
  orbitPageSize = DEFAULT_ORBIT_PAGE_SIZE,
}: OrbitalCourseUniverseProps) {
  const pageResetKey = `${search}\0${matchedItems.length}`;
  const [orbitPageState, setOrbitPageState] = useState<{
    readonly key: string;
    readonly page: number;
    readonly direction: 'next' | 'prev' | 'none';
  }>({ key: pageResetKey, page: 0, direction: 'none' });
  const swipeWheelSumRef = useRef(0);
  const swipeWheelTimerRef = useRef(0);
  const touchStartRef = useRef<{ readonly x: number; readonly y: number } | null>(null);

  // Derive page synchronously so searching from page 2 or matching courses on another page
  // never triggers a stale frame + secondary useEffect re-render.
  const isCurrentKey = orbitPageState.key === pageResetKey;
  const orbitPage = isCurrentKey ? orbitPageState.page : 0;
  const pageDirection = isCurrentKey ? orbitPageState.direction : 'none';
  const setOrbitPage = (updater: (page: number) => number) => {
    setOrbitPageState(prev => {
      const current = prev.key === pageResetKey ? prev.page : 0;
      const next = updater(current);
      if (next === current && prev.key === pageResetKey) return prev;
      const direction = next > current ? 'next' : next < current ? 'prev' : 'none';
      return { key: pageResetKey, page: next, direction };
    });
  };

  const pageWindow = paginateItems(matchedItems, orbitPage, orbitPageSize);

  const handleOrbitWheel = (event: WheelEvent<HTMLElement>) => {
    if (pageWindow.pageCount <= 1 || event.ctrlKey || event.metaKey) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.6) return;
    swipeWheelSumRef.current += event.deltaX;
    window.clearTimeout(swipeWheelTimerRef.current);
    swipeWheelTimerRef.current = window.setTimeout(() => {
      swipeWheelSumRef.current = 0;
    }, 260);
    if (swipeWheelSumRef.current >= 90 && pageWindow.hasNext) {
      swipeWheelSumRef.current = 0;
      setOrbitPage(p => Math.min(pageWindow.pageCount - 1, p + 1));
    } else if (swipeWheelSumRef.current <= -90 && pageWindow.hasPrev) {
      swipeWheelSumRef.current = 0;
      setOrbitPage(p => Math.max(0, p - 1));
    }
  };

  const handleOrbitTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (pageWindow.pageCount <= 1 || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleOrbitTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || pageWindow.pageCount <= 1) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && pageWindow.hasNext) {
        setOrbitPage(p => Math.min(pageWindow.pageCount - 1, p + 1));
      } else if (dx > 0 && pageWindow.hasPrev) {
        setOrbitPage(p => Math.max(0, p - 1));
      }
    }
  };
  const matchedCount = matchedItems.length;
  const isEmpty = matchedCount === 0;
  const isFiltered = matchedCount < items.length;

  // Keep full-pool directional fly-out animation for compact catalogues (<= orbitPageSize),
  // and switch to O(1) bounded window rendering automatically for large catalogues.
  const useCompactPool = items.length <= orbitPageSize;
  const visiblePool = useCompactPool ? items : pageWindow.items;
  const visibleMatchedIds = new Set(pageWindow.items.map(item => item.course.id));
  const matchedOrder = new Map<string, number>();
  pageWindow.items.forEach((item, idx) => {
    matchedOrder.set(item.course.id, idx);
  });
  const activeOrbitCount = pageWindow.items.length;

  return (
    <section
      data-orbital-universe="true"
      aria-label="Bản đồ nguyên tử học phần"
      onWheel={handleOrbitWheel}
      onTouchStart={handleOrbitTouchStart}
      onTouchEnd={handleOrbitTouchEnd}
      className="hus-card-surface relative isolate overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-8 lg:min-h-[680px] lg:p-0"
    >
      {/* Atmospheric orbital field SVG background */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-0 overflow-hidden select-none transition-opacity duration-500 ease-[var(--hus-ease)] ${
          isEmpty ? 'opacity-55' : 'opacity-100'
        }`}
      >
        <svg
          viewBox="0 0 1120 680"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
        >
          <defs>
            <radialGradient id="hus-universe-core" cx="50%" cy="50%" r="42%">
              <stop offset="0%" stopColor="var(--hus-glow-core)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="hus-universe-warm" cx="76%" cy="22%" r="28%">
              <stop offset="0%" stopColor="var(--hus-glow-warm)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <circle cx="560" cy="340" r="390" fill="url(#hus-universe-core)" />
          <circle cx="850" cy="150" r="210" fill="url(#hus-universe-warm)" />

          {/* Meridian coordinate axes */}
          <line
            x1="560"
            y1="24"
            x2="560"
            y2="656"
            stroke="var(--hus-orbit)"
            strokeWidth="1"
            strokeDasharray="3 8"
          />
          <line
            x1="32"
            y1="340"
            x2="1088"
            y2="340"
            stroke="var(--hus-orbit)"
            strokeWidth="1"
            strokeDasharray="3 8"
          />

          {/* Primary elliptical orbit track where desktop course atoms float */}
          <ellipse
            cx="560"
            cy="340"
            rx="408"
            ry="255"
            stroke="var(--hus-orbit-strong)"
            strokeWidth="1.2"
            strokeDasharray="5 7"
          />

          {/* Inner nucleus halo orbit */}
          <g className="hus-orbit-spin-slow">
            <circle
              cx="560"
              cy="340"
              r="182"
              stroke="var(--hus-orbit)"
              strokeWidth="1"
            />
            <circle cx="742" cy="340" r="3" fill="var(--hus-accent)" fillOpacity="0.65" />
            <circle cx="378" cy="340" r="2.5" fill="var(--hus-starlight)" fillOpacity="0.75" />
          </g>

          {/* Harmonic inclined orbital planes */}
          <ellipse
            cx="560"
            cy="340"
            rx="468"
            ry="184"
            transform="rotate(-14 560 340)"
            stroke="var(--hus-orbit)"
            strokeWidth="1"
          />
          <ellipse
            cx="560"
            cy="340"
            rx="442"
            ry="164"
            transform="rotate(17 560 340)"
            stroke="var(--hus-orbit)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />

          {/* Subtle starlight background dust */}
          <circle cx="148" cy="108" r="2" fill="var(--hus-starlight)" fillOpacity="0.6" className="hus-star-node" />
          <circle cx="972" cy="116" r="2.2" fill="var(--hus-starlight)" fillOpacity="0.65" className="hus-star-node" />
          <circle cx="990" cy="562" r="2" fill="var(--hus-accent)" fillOpacity="0.5" />
          <circle cx="130" cy="554" r="1.8" fill="var(--hus-starlight)" fillOpacity="0.55" />
        </svg>
      </div>

      {/* Central Search Nucleus — glides upward when no courses match */}
      <div
        className={`relative z-20 mx-auto w-full max-w-md transition-[top,transform] duration-500 ease-[var(--hus-ease)] lg:absolute lg:left-1/2 lg:w-[22.5rem] lg:-translate-x-1/2 lg:-translate-y-1/2 ${
          isEmpty ? 'lg:top-[32%]' : 'lg:top-1/2'
        }`}
      >
        <div className="rounded-[var(--radius-xl)] border border-accent/30 bg-surface/96 p-4 shadow-[0_12px_36px_-14px_rgb(26_86_219/0.22)] sm:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-accent"
              />
              Hạt nhân tìm kiếm
            </span>
            <span className="font-mono text-xs tabular-nums text-ink-muted">
              {matchedCount}/{totalCount} học phần
            </span>
          </div>

          <SearchInput
            id="catalog-search"
            value={search}
            onChange={onSearchChange}
            {...(onSearchKeyDown ? { onKeyDown: onSearchKeyDown } : {})}
            placeholder="Tìm học phần, bài giảng (ví dụ: khong thu nguyen)…"
            label="Tìm kiếm trong danh mục học phần"
          />

          <p className="mt-2 text-center text-xs text-ink-muted">
            {isEmpty
              ? 'Thử nhập từ khóa khác hoặc đặt lại bộ lọc bên dưới'
              : pageWindow.pageCount > 1
                ? `Quỹ đạo hiển thị ${activeOrbitCount} / ${matchedCount} học phần phù hợp nhất`
                : 'Chọn một nguyên tử học phần đang quay quanh để mở các tầng chương'}
          </p>

          {pageWindow.pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
              <button
                type="button"
                onClick={() => setOrbitPage(p => Math.max(0, p - 1))}
                disabled={!pageWindow.hasPrev}
                aria-label="Quỹ đạo trước"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-canvas/80 px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeftIcon width={14} height={14} />
                <span>Trước</span>
              </button>
              <span className="font-mono text-xs tabular-nums text-ink-muted">
                Quỹ đạo {pageWindow.page + 1}/{pageWindow.pageCount}
              </span>
              <button
                type="button"
                onClick={() => setOrbitPage(p => Math.min(pageWindow.pageCount - 1, p + 1))}
                disabled={!pageWindow.hasNext}
                aria-label="Quỹ đạo tiếp theo"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-canvas/80 px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Sau</span>
                <ChevronRightIcon width={14} height={14} />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Orbiting Course Atoms — unmatched nodes fly smoothly left/right, matched nodes glide into flanking slots */}
      <div
        className={`relative z-10 lg:mt-0 lg:block lg:h-[680px] ${
          isEmpty ? 'max-lg:hidden' : 'mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2'
        }`}
      >
        {visiblePool.map(({ course, subject, lessonCount, progressPercent, matchedElement }, baseIndex) => {
          const isMatched = visibleMatchedIds.has(course.id);
          const basePos = getOrbitPosition(baseIndex, Math.max(1, visiblePool.length));
          const flySide = getFlySide(basePos.leftPct, baseIndex);
          const matchedIndex = matchedOrder.get(course.id);
          const pos =
            isMatched && matchedIndex !== undefined
              ? getOrbitPosition(matchedIndex, Math.max(1, activeOrbitCount), flySide)
              : basePos;
          const code = course.academicCode ?? course.id.toUpperCase();
          const isAvailable = course.status === 'available';
          const floatClass = `hus-float-node-${baseIndex % 3}`;
          const enterClass =
            pageDirection === 'next'
              ? 'hus-orbital-page-next'
              : pageDirection === 'prev'
                ? 'hus-orbital-page-prev'
                : 'hus-orbital-card-enter';

          return (
            <div
              key={course.id}
              data-matched={isMatched ? 'true' : 'false'}
              data-filtered={isFiltered ? 'true' : 'false'}
              data-side={flySide}
              aria-hidden={!isMatched}
              className={`hus-orbital-slot ${isMatched ? '' : 'max-lg:hidden'}`}
              style={{
                left: `${pos.leftPct.toFixed(2)}%`,
                top: `${pos.topPct.toFixed(2)}%`,
              }}
            >
              <div
                className={floatClass}
                style={{ animationDelay: `${baseIndex * 0.45}s` }}
              >
                <Link
                  key={`${course.id}-p${pageWindow.page}-${pageDirection}`}
                  to={`/courses/${course.id}`}
                  tabIndex={isMatched ? 0 : -1}
                  title={
                    matchedElement
                      ? `Nguyên tố ${matchedElement.nameVi} (${matchedElement.symbol}, Z = ${matchedElement.atomicNumber}): ${matchedElement.funFact}`
                      : undefined
                  }
                  style={
                    pageDirection !== 'none'
                      ? { animationDelay: `${baseIndex * 35}ms` }
                      : undefined
                  }
                  className={`${enterClass} group relative flex items-center gap-3.5 rounded-[var(--radius-xl)] border bg-surface/96 px-4 py-3.5 no-underline transition-[border-color,box-shadow,transform,background-color] duration-300 ease-[var(--hus-ease)] hover:scale-[1.03] hover:border-accent hover:bg-surface active:scale-[0.98] ${
                    isAvailable
                      ? 'border-accent/40 shadow-[0_8px_28px_-14px_rgb(26_86_219/0.35)]'
                      : 'border-border shadow-[var(--hus-shadow-card)]'
                  }`}
                >
                  {/* Top-left Periodic Element Stamp when course shells match a real element */}
                  {matchedElement ? (
                    <span
                      aria-label={`Nguyên tố ${matchedElement.nameVi} (${matchedElement.symbol}, Z = ${matchedElement.atomicNumber})`}
                      className="absolute -left-2 -top-2.5 z-10 inline-flex items-baseline gap-1 rounded-[var(--radius-sm)] border border-starlight/50 bg-surface px-1.5 py-0.5 font-mono text-xs font-semibold leading-none text-starlight shadow-xs"
                    >
                      <span>{matchedElement.atomicNumber}</span>
                      <span className="font-display text-sm text-ink">{matchedElement.symbol}</span>
                    </span>
                  ) : null}

                  <AtomicCourseEmblem
                    shellCount={course.chapterIds.length}
                    electronCount={lessonCount}
                    isActive={isAvailable}
                    progressPercent={progressPercent}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="accent" mono>
                        {code}
                      </Badge>
                      {isAvailable ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-success"
                          title="Có nội dung học"
                          aria-label="Có nội dung học"
                        />
                      ) : null}
                    </div>

                    <h3 className="mt-1.5 line-clamp-2 font-display text-base font-medium leading-snug text-ink transition-colors duration-200 group-hover:text-accent">
                      {course.title}
                    </h3>

                    <p className="mt-0.5 truncate text-xs text-ink-muted tabular-nums">
                      {subject ? `${subject.title} · ` : ''}
                      {lessonCount > 0
                        ? `${course.chapterIds.length} tầng · ${lessonCount} bài`
                        : `${course.resourceIds.length} tài liệu`}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State revealed directly beneath the elevated Search Nucleus */}
      <div
        role="status"
        aria-live="polite"
        aria-hidden={!isEmpty}
        className={`relative z-20 mx-auto max-w-md text-center transition-[opacity,transform] duration-400 ease-[var(--hus-ease)] lg:absolute lg:left-1/2 lg:top-[53%] lg:w-[24rem] lg:-translate-x-1/2 ${
          isEmpty
            ? 'mt-6 translate-y-0 opacity-100 lg:mt-0'
            : 'pointer-events-none hidden translate-y-4 opacity-0 lg:block'
        }`}
      >
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface/94 px-6 py-5 shadow-[var(--hus-shadow-card)] backdrop-blur-md">
          <p className="font-display text-xl font-medium text-ink">Không tìm thấy</p>
          <p className="mt-1.5 text-sm text-ink-secondary">
            {search.trim()
              ? `Không có học phần nào khớp với “${search.trim()}”.`
              : 'Không có học phần nào khớp với bộ lọc hiện tại.'}
          </p>
          {emptyAction ? (
            <button
              type="button"
              onClick={emptyAction}
              tabIndex={isEmpty ? 0 : -1}
              className="hus-btn hus-btn-secondary mt-4 text-xs"
            >
              Đặt lại bộ lọc
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
});
