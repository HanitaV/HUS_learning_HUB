export type BoundaryEdge = 'top' | 'bottom';

export interface RouteGestureTarget {
  readonly to: string;
  readonly label: string;
}

export interface RouteBoundaryTargets {
  readonly top?: RouteGestureTarget;
  readonly bottom?: RouteGestureTarget;
}

export interface ArmedBoundaryState {
  readonly edge: BoundaryEdge;
  readonly armedAt: number;
}

export type BoundaryConfirmResult =
  | { readonly action: 'arm'; readonly armed: ArmedBoundaryState }
  | { readonly action: 'ignore'; readonly armed: ArmedBoundaryState }
  | { readonly action: 'confirm' };

/** How long a first boundary pull stays armed waiting for the confirmation gesture. */
export const BOUNDARY_ARM_WINDOW_MS = 2600;

/** Minimum gap between 1st arm gesture and 2nd confirm gesture to absorb touchpad inertia. */
export const BOUNDARY_CONFIRM_MIN_GAP_MS = 260;

const PRIMARY_ROUTE_CHAIN: readonly RouteGestureTarget[] = [
  { to: '/', label: 'Tổng quan' },
  { to: '/courses', label: 'Học phần' },
  { to: '/progress', label: 'Tiến độ' },
  { to: '/settings', label: 'Cài đặt' },
];

/**
 * Resolves the top (previous / parent) and bottom (next) route targets
 * for two-step boundary pull navigation across all workspace pages.
 */
export function resolveBoundaryTargets(pathname: string): RouteBoundaryTargets {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const primaryIndex = PRIMARY_ROUTE_CHAIN.findIndex(item => item.to === normalized);
  if (primaryIndex !== -1) {
    const top = primaryIndex > 0 ? PRIMARY_ROUTE_CHAIN[primaryIndex - 1] : undefined;
    const bottom =
      primaryIndex + 1 < PRIMARY_ROUTE_CHAIN.length
        ? PRIMARY_ROUTE_CHAIN[primaryIndex + 1]
        : undefined;
    return {
      ...(top ? { top } : {}),
      ...(bottom ? { bottom } : {}),
    };
  }

  const lessonMatch = /^\/courses\/([^/]+)\/lessons\/[^/]+$/.exec(normalized);
  if (lessonMatch?.[1]) {
    return {
      top: { to: `/courses/${lessonMatch[1]}`, label: 'Trang học phần' },
    };
  }

  const courseMatch = /^\/courses\/([^/]+)$/.exec(normalized);
  if (courseMatch?.[1]) {
    return {
      top: { to: '/courses', label: 'Danh mục học phần' },
    };
  }

  const questMatch = /^\/quests\/[^/]+$/.exec(normalized);
  if (questMatch) {
    return {
      top: { to: '/', label: 'Vũ trụ Mục tiêu' },
    };
  }

  return {};
}

/**
 * Pure two-step boundary confirmation state machine:
 * - 1st pull arms the boundary target (shows confirmation hint)
 * - Events within BOUNDARY_CONFIRM_MIN_GAP_MS are ignored (absorbs laptop touchpad inertia)
 * - 2nd pull within BOUNDARY_ARM_WINDOW_MS confirms navigation
 */
export function advanceBoundaryConfirm(
  current: ArmedBoundaryState | null,
  edge: BoundaryEdge,
  now: number,
  options?: { readonly bypassGap?: boolean },
): BoundaryConfirmResult {
  if (current && current.edge === edge) {
    const elapsed = now - current.armedAt;
    if (elapsed <= BOUNDARY_ARM_WINDOW_MS) {
      if (options?.bypassGap || elapsed >= BOUNDARY_CONFIRM_MIN_GAP_MS) {
        return { action: 'confirm' };
      }
      return { action: 'ignore', armed: current };
    }
  }

  return {
    action: 'arm',
    armed: { edge, armedAt: now },
  };
}
