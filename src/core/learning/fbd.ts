import type { FbdBodySpec, FbdForceDef, FbdStepSpec } from '../../domain/semi-essay';

export interface FbdDrawnArrow {
  readonly id: string;
  readonly type: string;
  readonly angle: number;
}

export interface FbdDiagnosticIssue {
  readonly kind: 'wrong-direction' | 'missing' | 'extra';
  readonly forceType: string;
  readonly message: string;
  readonly drawnAngle?: number;
  readonly expectedAngle?: number;
}

export interface FbdBodyGradeResult {
  readonly bodyId: string;
  readonly bodyLabel: string;
  readonly correct: boolean;
  readonly matchedCount: number;
  readonly expectedCount: number;
  readonly matchedForceTypes: readonly string[];
  readonly issues: readonly FbdDiagnosticIssue[];
}

export interface FbdStepGradeResult {
  readonly correct: boolean;
  readonly bodies: readonly FbdBodyGradeResult[];
}

export function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod === 0 ? 0 : mod;
}

export function shortestAngleDiff(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

export function snapAngle(
  deg: number,
  step = 5,
  magnets: readonly number[] = [],
  magnetThreshold = 4,
): number {
  const normalized = normalizeAngle(deg);
  for (const magnet of magnets) {
    if (shortestAngleDiff(normalized, magnet) <= magnetThreshold) {
      return normalizeAngle(magnet);
    }
  }
  return normalizeAngle(Math.round(normalized / step) * step);
}

export function gradeFbdBody(
  drawn: readonly FbdDrawnArrow[],
  body: FbdBodySpec,
  forceCatalog: Readonly<Record<string, FbdForceDef>>,
): FbdBodyGradeResult {
  const tol = body.toleranceDeg ?? 12;
  const remaining = drawn.map(arrow => ({ ...arrow, used: false }));
  const matchedForceTypes: string[] = [];
  const pendingExpected: { readonly type: string; readonly angle: number }[] = [];
  const issues: FbdDiagnosticIssue[] = [];

  for (const expected of body.expected) {
    const hit = remaining.find(
      item => !item.used && item.type === expected.type && shortestAngleDiff(item.angle, expected.angle) <= tol,
    );
    if (hit) {
      hit.used = true;
      matchedForceTypes.push(expected.type);
    } else {
      pendingExpected.push(expected);
    }
  }

  for (const expected of pendingExpected) {
    const wrongDir = remaining.find(item => !item.used && item.type === expected.type);
    const meta = forceCatalog[expected.type];
    const forceName = meta ? `${meta.name} (${meta.label}${meta.subscript ?? ''})` : expected.type;
    if (wrongDir) {
      wrongDir.used = true;
      const drawnNorm = Math.round(normalizeAngle(wrongDir.angle));
      const expectedNorm = Math.round(normalizeAngle(expected.angle));
      issues.push({
        kind: 'wrong-direction',
        forceType: expected.type,
        drawnAngle: drawnNorm,
        expectedAngle: expectedNorm,
        message: `Sai hướng: ${forceName} đang vẽ ở góc ${drawnNorm}°, cần kiểm tra lại phương/chiều tác dụng lên ${body.label}.`,
      });
    } else {
      issues.push({
        kind: 'missing',
        forceType: expected.type,
        expectedAngle: Math.round(normalizeAngle(expected.angle)),
        message: meta?.missing || `Thiếu lực ${forceName} tác dụng lên ${body.label}.`,
      });
    }
  }

  for (const leftover of remaining) {
    if (leftover.used) continue;
    const meta = forceCatalog[leftover.type];
    const forceName = meta ? `${meta.name} (${meta.label}${meta.subscript ?? ''})` : leftover.type;
    issues.push({
      kind: 'extra',
      forceType: leftover.type,
      drawnAngle: Math.round(normalizeAngle(leftover.angle)),
      message: meta?.extra || `Thừa lực ${forceName} trên ${body.label}.`,
    });
  }

  return {
    bodyId: body.id,
    bodyLabel: body.label,
    correct: issues.length === 0 && matchedForceTypes.length === body.expected.length,
    matchedCount: matchedForceTypes.length,
    expectedCount: body.expected.length,
    matchedForceTypes,
    issues,
  };
}

export function gradeFbdStep(
  drawnByBody: Readonly<Record<string, readonly FbdDrawnArrow[]>>,
  spec: FbdStepSpec,
): FbdStepGradeResult {
  const bodies = spec.bodies.map(body =>
    gradeFbdBody(drawnByBody[body.id] ?? [], body, spec.forceCatalog),
  );
  return {
    correct: bodies.every(b => b.correct),
    bodies,
  };
}
