import { startTransition } from 'react';
import { flushSync } from 'react-dom';
import type { NavigateFunction, NavigateOptions, To } from 'react-router';

let cataloguePagePromise: Promise<typeof import('../pages/CataloguePage')> | null = null;
let coursesPagePromise: Promise<typeof import('../pages/CoursesPage')> | null = null;
let examPracticePagePromise: Promise<typeof import('../pages/ExamPracticePage')> | null = null;

/**
 * Silently preloads the lazy CataloguePage (Home) chunk so returning from /courses
 * renders instantaneously without flashing a Suspense loading skeleton.
 */
export function preloadCataloguePage(): Promise<typeof import('../pages/CataloguePage')> {
  if (!cataloguePagePromise) {
    cataloguePagePromise = import('../pages/CataloguePage').catch(err => {
      cataloguePagePromise = null;
      throw err;
    });
  }
  return cataloguePagePromise;
}

/**
 * Silently preloads the lazy CoursesPage chunk so navigating to /courses
 * renders instantaneously without flashing a Suspense loading skeleton.
 */
export function preloadCoursesPage(): Promise<typeof import('../pages/CoursesPage')> {
  if (!coursesPagePromise) {
    coursesPagePromise = import('../pages/CoursesPage').catch(err => {
      coursesPagePromise = null;
      throw err;
    });
  }
  return coursesPagePromise;
}

export function preloadExamPracticePage(): Promise<typeof import('../pages/ExamPracticePage')> {
  if (!examPracticePagePromise) {
    examPracticePagePromise = import('../pages/ExamPracticePage').catch(err => {
      examPracticePagePromise = null;
      throw err;
    });
  }
  return examPracticePagePromise;
}

type DocumentWithViewTransition = Document & {
  readonly startViewTransition?: (update: () => void) => { readonly finished: Promise<void> };
};

export interface SmoothNavigateOptions {
  readonly state?: NavigateOptions['state'];
  readonly direction?: 'glide' | 'pull-up' | 'pull-down';
}

/**
 * Navigates cleanly after ensuring the target route chunk is already in memory,
 * using the native View Transition API when available and motion is permitted.
 */
export async function navigateSmooth(
  navigate: NavigateFunction,
  to: To,
  preload?: () => Promise<unknown>,
  options?: SmoothNavigateOptions,
): Promise<void> {
  if (preload) {
    try {
      await preload();
    } catch {
      // Let React Router + ErrorBoundary handle genuine network failures gracefully.
    }
  }

  const navOptions: NavigateOptions | undefined =
    options?.state !== undefined ? { state: options.state } : undefined;
  const doc = typeof document !== 'undefined' ? (document as DocumentWithViewTransition) : null;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (doc?.startViewTransition && !reducedMotion) {
    const root = doc.documentElement;
    if (options?.direction) {
      root.dataset.vt = options.direction;
    }
    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        navigate(to, navOptions);
      });
    });
    void transition.finished.finally(() => {
      if (options?.direction && root.dataset.vt === options.direction) {
        delete root.dataset.vt;
      }
    });
    return;
  }

  startTransition(() => {
    navigate(to, navOptions);
  });
}
