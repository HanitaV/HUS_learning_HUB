import { describe, expect, it } from 'vitest';
import type { FbdForceDef, FbdStepSpec } from '../../src/domain/semi-essay';
import { gradeFbdStep, normalizeAngle, shortestAngleDiff, snapAngle } from '../../src/core/learning/fbd';

const catalog: Readonly<Record<string, FbdForceDef>> = {
  P: { id: 'P', label: 'P', name: 'Trọng lực', missing: 'Thiếu trọng lực P.', extra: 'Thừa P.' },
  N: { id: 'N', label: 'N', name: 'Phản lực', missing: 'Thiếu phản lực N.', extra: 'Thừa N.' },
  T: { id: 'T', label: 'T', name: 'Lực căng dây', missing: 'Thiếu lực căng T.', extra: 'Thừa T.' },
  Fms: { id: 'Fms', label: 'F', subscript: 'ms', name: 'Lực ma sát', missing: 'Thiếu ma sát.', extra: 'Thừa ma sát.' },
  Fdi: { id: 'Fdi', label: 'F', subscript: 'đ', name: 'Lực đẩy ảo', missing: '', extra: 'Không có lực đẩy theo chiều chuyển động.' },
};

const spec: FbdStepSpec = {
  kind: 'fbd',
  forceCatalog: catalog,
  bodies: [
    {
      id: 'A',
      label: 'Vật A',
      surfaceAngle: 30,
      palette: ['P', 'N', 'T', 'Fms', 'Fdi'],
      expected: [
        { type: 'P', angle: 270 },
        { type: 'N', angle: 120 },
        { type: 'T', angle: 0 },
      ],
      toleranceDeg: 12,
    },
  ],
};

describe('FBD core angle math & diagnostic grading', () => {
  it('handles 0/360 degree wrap-around accurately', () => {
    expect(normalizeAngle(-5)).toBe(355);
    expect(shortestAngleDiff(355, 0)).toBe(5);
    expect(shortestAngleDiff(10, 350)).toBe(20);
    expect(snapAngle(358, 5, [0, 90, 180, 270])).toBe(0);
  });

  it('passes when all expected forces match including wrap-around tolerance', () => {
    const res = gradeFbdStep(
      {
        A: [
          { id: '1', type: 'P', angle: 270 },
          { id: '2', type: 'N', angle: 118 },
          { id: '3', type: 'T', angle: 355 },
        ],
      },
      spec,
    );
    expect(res.correct).toBe(true);
    expect(res.bodies[0]!.issues).toHaveLength(0);
  });

  it('diagnoses wrong direction, missing force, and phantom extra force', () => {
    const res = gradeFbdStep(
      {
        A: [
          { id: '1', type: 'P', angle: 90 }, // wrong direction
          { id: '2', type: 'T', angle: 0 },
          { id: '3', type: 'Fdi', angle: 30 }, // phantom extra
        ],
      },
      spec,
    );
    expect(res.correct).toBe(false);
    const kinds = res.bodies[0]!.issues.map(i => i.kind);
    expect(kinds).toContain('wrong-direction');
    expect(kinds).toContain('missing');
    expect(kinds).toContain('extra');
    expect(res.bodies[0]!.issues.find(i => i.kind === 'extra')?.message).toContain('lực đẩy');
  });

  it('grades extended rigid-body FBD specs with pivot and applicationOffset cleanly', () => {
    const extendedSpec: FbdStepSpec = {
      kind: 'fbd',
      forceCatalog: catalog,
      bodies: [
        {
          id: 'cylinder',
          label: 'Trụ đặc',
          surfaceAngle: 30,
          extendedMode: true,
          pivot: { x: 0, y: 0, label: 'O' },
          leverArmHint: 'Chỉ lực ma sát nghỉ F_ms tiếp tuyến với vành trụ mới gây mômen quanh tâm O.',
          palette: ['P', 'N', 'Fms', 'Fdi'],
          expected: [
            { type: 'P', angle: 270, applicationOffset: { x: 0, y: 0 } },
            { type: 'N', angle: 120, applicationOffset: { x: 22, y: 38 } },
            { type: 'Fms', angle: 30, applicationOffset: { x: 22, y: 38 } },
          ],
          toleranceDeg: 10,
        },
      ],
    };

    const passRes = gradeFbdStep(
      {
        cylinder: [
          { id: '1', type: 'P', angle: 270 },
          { id: '2', type: 'N', angle: 120 },
          { id: '3', type: 'Fms', angle: 30 },
        ],
      },
      extendedSpec,
    );
    expect(passRes.correct).toBe(true);
    expect(passRes.bodies[0]!.matchedCount).toBe(3);
    expect(passRes.bodies[0]!.issues).toHaveLength(0);

    const failRes = gradeFbdStep(
      {
        cylinder: [
          { id: '1', type: 'P', angle: 270 },
          { id: '2', type: 'N', angle: 120 },
          { id: '3', type: 'Fms', angle: 210 }, // opposite friction direction
        ],
      },
      extendedSpec,
    );
    expect(failRes.correct).toBe(false);
    expect(failRes.bodies[0]!.issues.map(i => i.kind)).toEqual(['wrong-direction']);
  });
});
