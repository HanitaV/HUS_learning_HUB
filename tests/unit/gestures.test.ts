import { describe, expect, it } from 'vitest';
import {
  BOUNDARY_ARM_WINDOW_MS,
  BOUNDARY_CONFIRM_MIN_GAP_MS,
  advanceBoundaryConfirm,
  resolveBoundaryTargets,
} from '../../src/core/navigation/gestures';

describe('workspace gesture routing and two-step confirmation', () => {
  it('resolves sequential top/bottom targets across primary pages and parent targets on detail pages', () => {
    expect(resolveBoundaryTargets('/')).toEqual({
      bottom: { to: '/courses', label: 'Học phần' },
    });
    expect(resolveBoundaryTargets('/courses')).toEqual({
      top: { to: '/', label: 'Tổng quan' },
      bottom: { to: '/exams', label: 'Luyện đề' },
    });
    expect(resolveBoundaryTargets('/exams')).toEqual({
      top: { to: '/courses', label: 'Học phần' },
      bottom: { to: '/progress', label: 'Tiến độ' },
    });
    expect(resolveBoundaryTargets('/resources')).toEqual({});
    expect(resolveBoundaryTargets('/progress')).toEqual({
      top: { to: '/exams', label: 'Luyện đề' },
      bottom: { to: '/settings', label: 'Cài đặt' },
    });
    expect(resolveBoundaryTargets('/settings')).toEqual({
      top: { to: '/progress', label: 'Tiến độ' },
    });
    expect(resolveBoundaryTargets('/courses/phy1159')).toEqual({
      top: { to: '/courses', label: 'Danh mục học phần' },
    });
    expect(resolveBoundaryTargets('/courses/phy1159/lessons/phy1159-t1-1')).toEqual({
      top: { to: '/courses/phy1159', label: 'Trang học phần' },
    });
    expect(resolveBoundaryTargets('/quests/quest-thcs4-recursion')).toEqual({
      top: { to: '/', label: 'Vũ trụ Mục tiêu' },
    });
    expect(resolveBoundaryTargets('/unknown-route')).toEqual({});
  });

  it('requires a second gesture after the inertia gap to confirm boundary navigation', () => {
    const first = advanceBoundaryConfirm(null, 'top', 1000);
    expect(first).toEqual({ action: 'arm', armed: { edge: 'top', armedAt: 1000 } });

    if (first.action !== 'arm') throw new Error('Expected arm');

    // Inertia event too soon is ignored
    const inertia = advanceBoundaryConfirm(first.armed, 'top', 1000 + BOUNDARY_CONFIRM_MIN_GAP_MS - 10);
    expect(inertia.action).toBe('ignore');

    // Distinct second gesture confirms
    const confirmed = advanceBoundaryConfirm(first.armed, 'top', 1000 + BOUNDARY_CONFIRM_MIN_GAP_MS + 20);
    expect(confirmed).toEqual({ action: 'confirm' });

    // Touch gesture with separate finger lift can bypass wheel inertia gap
    const touchConfirmed = advanceBoundaryConfirm(first.armed, 'top', 1050, { bypassGap: true });
    expect(touchConfirmed).toEqual({ action: 'confirm' });

    // Expired arm resets back to arming
    const expired = advanceBoundaryConfirm(first.armed, 'top', 1000 + BOUNDARY_ARM_WINDOW_MS + 50);
    expect(expired).toEqual({
      action: 'arm',
      armed: { edge: 'top', armedAt: 1000 + BOUNDARY_ARM_WINDOW_MS + 50 },
    });

    // Switching edge arms the new edge instead of confirming
    const opposite = advanceBoundaryConfirm(first.armed, 'bottom', 1000 + BOUNDARY_CONFIRM_MIN_GAP_MS + 20);
    expect(opposite).toEqual({
      action: 'arm',
      armed: { edge: 'bottom', armedAt: 1000 + BOUNDARY_CONFIRM_MIN_GAP_MS + 20 },
    });
  });
});
