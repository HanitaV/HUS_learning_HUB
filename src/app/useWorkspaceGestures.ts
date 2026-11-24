import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  BOUNDARY_ARM_WINDOW_MS,
  advanceBoundaryConfirm,
  resolveBoundaryTargets,
  type ArmedBoundaryState,
  type BoundaryEdge,
  type RouteGestureTarget,
} from '../core/navigation/gestures';
import { navigateSmooth, preloadCataloguePage, preloadCoursesPage } from './route-transition';

export interface ArmedBoundaryPrompt {
  readonly edge: BoundaryEdge;
  readonly target: RouteGestureTarget;
}

export interface UseWorkspaceGesturesOptions {
  readonly drawerOpen: boolean;
  readonly onOpenDrawer: () => void;
  readonly onCloseDrawer: () => void;
}

function getPreloaderForRoute(to: string): (() => Promise<unknown>) | undefined {
  if (to === '/') return preloadCataloguePage;
  if (to === '/courses') return preloadCoursesPage;
  return undefined;
}

function isInteractiveInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[role="dialog"]'));
}

function isInsideHorizontalScroller(target: EventTarget | null): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== document.body) {
    if (node.scrollWidth > node.clientWidth + 4) {
      const style = window.getComputedStyle(node);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function isAtTopEdge(): boolean {
  const scrollTop = Math.max(window.scrollY, document.documentElement.scrollTop);
  return scrollTop <= 12;
}

function isAtBottomEdge(): boolean {
  const doc = document.documentElement;
  const scrollTop = Math.max(window.scrollY, doc.scrollTop);
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return scrollTop + viewportHeight >= doc.scrollHeight - 28;
}

/**
 * Global touchpad + mobile touchscreen gesture controller:
 * - Two-step confirm boundary pull (top/bottom) across all workspace pages
 * - Horizontal swipe prev/next lesson (touchpad 2-finger swipe & mobile touch swipe)
 * - Mobile left-edge swipe to open navigation drawer & swipe-left to close it
 */
export function useWorkspaceGestures({
  drawerOpen,
  onOpenDrawer,
  onCloseDrawer,
}: UseWorkspaceGesturesOptions) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [armedPrompt, setArmedPrompt] = useState<ArmedBoundaryPrompt | null>(null);

  const armedRef = useRef<ArmedBoundaryState | null>(null);
  const navigatingRef = useRef(false);
  const dismissTimerRef = useRef(0);

  const clearArmed = useCallback(() => {
    window.clearTimeout(dismissTimerRef.current);
    armedRef.current = null;
    setArmedPrompt(null);
  }, []);

  const executeBoundaryNavigation = useCallback(
    (edge: BoundaryEdge, target: RouteGestureTarget) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      clearArmed();
      void navigateSmooth(navigate, target.to, getPreloaderForRoute(target.to), {
        direction: edge === 'bottom' ? 'pull-up' : 'pull-down',
      });
    },
    [clearArmed, navigate],
  );

  // Reset gesture state on every route change.
  useEffect(() => {
    navigatingRef.current = false;
    clearArmed();
  }, [pathname, clearArmed]);

  useEffect(() => {
    const targets = resolveBoundaryTargets(pathname);
    const readyAt = Date.now() + 650;

    let wheelVerticalSum = 0;
    let wheelVerticalEdge: BoundaryEdge | null = null;
    let wheelHorizontalSum = 0;
    let wheelResetTimer = 0;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartedAtTop = false;
    let touchStartedAtBottom = false;
    let touchStartedAtLeftEdge = false;
    let touchInsideHScroll = false;
    let touchConsumed = false;

    const handleBoundaryImpulse = (edge: BoundaryEdge, bypassGap: boolean) => {
      if (navigatingRef.current || Date.now() < readyAt) return;
      const target = edge === 'top' ? targets.top : targets.bottom;
      if (!target) return;

      const result = advanceBoundaryConfirm(armedRef.current, edge, Date.now(), { bypassGap });
      if (result.action === 'arm') {
        armedRef.current = result.armed;
        setArmedPrompt({ edge, target });
        // Silently warm the target route chunk while armed so step 2 is instant.
        const preload = getPreloaderForRoute(target.to);
        if (preload) void preload();
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = window.setTimeout(() => {
          armedRef.current = null;
          setArmedPrompt(null);
        }, BOUNDARY_ARM_WINDOW_MS);
      } else if (result.action === 'confirm') {
        executeBoundaryNavigation(edge, target);
      }
    };

    const triggerLessonHorizontalNav = (direction: 'prev' | 'next') => {
      if (navigatingRef.current || Date.now() < readyAt) return;
      const anchor = document.querySelector<HTMLAnchorElement>(`a[data-lesson-nav="${direction}"]`);
      if (!anchor) return;
      const rawHref = anchor.getAttribute('href') ?? '';
      const routePath = rawHref.startsWith('#') ? rawHref.slice(1) : rawHref;
      if (!routePath) return;
      navigatingRef.current = true;
      clearArmed();
      void navigateSmooth(navigate, routePath, undefined, { direction: 'glide' });
    };

    const onWheel = (event: WheelEvent) => {
      if (drawerOpen || navigatingRef.current || Date.now() < readyAt) return;
      if (event.ctrlKey || event.metaKey || isInteractiveInput(event.target)) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      // Laptop touchpad two-finger horizontal swipe on Lesson pages (skip horizontal scrollers)
      if (absX > absY * 1.8 && absX >= 8 && !isInsideHorizontalScroller(event.target)) {
        wheelHorizontalSum += event.deltaX;
        window.clearTimeout(wheelResetTimer);
        wheelResetTimer = window.setTimeout(() => {
          wheelHorizontalSum = 0;
        }, 260);

        if (wheelHorizontalSum >= 120) {
          wheelHorizontalSum = 0;
          triggerLessonHorizontalNav('next');
        } else if (wheelHorizontalSum <= -120) {
          wheelHorizontalSum = 0;
          triggerLessonHorizontalNav('prev');
        }
        return;
      }

      if (absY < 4 || absX > absY) return;

      const edge: BoundaryEdge | null =
        event.deltaY < 0 && isAtTopEdge()
          ? 'top'
          : event.deltaY > 0 && isAtBottomEdge()
            ? 'bottom'
            : null;

      if (!edge) {
        wheelVerticalSum = 0;
        wheelVerticalEdge = null;
        return;
      }

      if (wheelVerticalEdge !== edge) {
        wheelVerticalEdge = edge;
        wheelVerticalSum = 0;
      }

      wheelVerticalSum += absY;
      window.clearTimeout(wheelResetTimer);
      wheelResetTimer = window.setTimeout(() => {
        wheelVerticalSum = 0;
        wheelVerticalEdge = null;
      }, 280);

      if (wheelVerticalSum >= 56) {
        wheelVerticalSum = 0;
        handleBoundaryImpulse(edge, false);
      }
    };

    const onScroll = () => {
      if (!armedRef.current) return;
      if (armedRef.current.edge === 'top' && !isAtTopEdge()) {
        clearArmed();
      } else if (armedRef.current.edge === 'bottom' && !isAtBottomEdge()) {
        clearArmed();
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartedAtTop = isAtTopEdge();
      touchStartedAtBottom = isAtBottomEdge();
      touchStartedAtLeftEdge = touch.clientX <= 28 && window.innerWidth < 1024;
      touchInsideHScroll = isInsideHorizontalScroller(event.target);
      touchConsumed = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (touchConsumed || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Mobile drawer open/close edge swipe
      if (drawerOpen) {
        if (dx <= -64 && absX > absY * 1.4) {
          touchConsumed = true;
          onCloseDrawer();
        }
        return;
      }

      if (isInteractiveInput(event.target)) return;

      if (touchStartedAtLeftEdge && dx >= 64 && absX > absY * 1.5) {
        touchConsumed = true;
        onOpenDrawer();
        return;
      }

      // Horizontal swipe on Lesson pages (skip horizontal scrollers)
      if (!touchInsideHScroll && absX >= 80 && absX > absY * 1.6) {
        touchConsumed = true;
        triggerLessonHorizontalNav(dx < 0 ? 'next' : 'prev');
        return;
      }

      // Vertical boundary two-step pull (top/bottom)
      if (absY >= 52 && absY > absX * 1.35) {
        if (dy > 0 && touchStartedAtTop && isAtTopEdge()) {
          touchConsumed = true;
          handleBoundaryImpulse('top', true);
        } else if (dy < 0 && touchStartedAtBottom && isAtBottomEdge()) {
          touchConsumed = true;
          handleBoundaryImpulse('bottom', true);
        }
      }
    };

    const onTouchEnd = () => {
      touchConsumed = false;
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(wheelResetTimer);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pathname, drawerOpen, navigate, onOpenDrawer, onCloseDrawer, clearArmed, executeBoundaryNavigation]);

  const confirmNow = useCallback(() => {
    if (!armedPrompt) return;
    executeBoundaryNavigation(armedPrompt.edge, armedPrompt.target);
  }, [armedPrompt, executeBoundaryNavigation]);

  return {
    armedPrompt,
    confirmNow,
    dismissPrompt: clearArmed,
  };
}
