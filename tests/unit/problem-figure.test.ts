import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import ProblemFigure from '../../src/components/learning/ProblemFigure';
import type { PhysicsSchematicScene, ProblemFigureSpec } from '../../src/domain/problem-figure';

const ALL_SCENES: readonly PhysicsSchematicScene[] = [
  'projectile-curvature',
  'rough-incline-launch',
  'incline-pulley',
  'conical-pendulum',
  'self-hoist',
  'movable-pulley',
  'ring-rope',
  'accelerating-wedge',
  'cart-scale-incline',
  'monkey-pulley',
  'simple-pendulum',
  'ballistic-pendulum',
  'vertical-loop-track',
  'orthogonal-2d-scattering',
  'rolling-cylinder-incline',
  'coaxial-disks-clutch',
  'kepler-ellipse',
  'free-expansion-chamber',
  'carnot-engine-flow',
];

describe('ProblemFigure component (plot-2d & 19 physics schematic scenes)', () => {
  it('renders accessible theme-aware SVGs across plot-2d and all 19 physics schematic scenes', () => {
    const plotSpec: ProblemFigureSpec = {
      kind: 'plot-2d',
      alt: 'Đồ thị p-V chu trình nhiệt động lực học từ A sang B',
      caption: 'Hình 1: Chu trình đẳng áp - đẳng tích',
      xLabel: 'V (L)',
      yLabel: 'p (atm)',
      xMax: 10,
      yMax: 10,
      paths: [
        {
          id: 'p1',
          label: '(1)',
          showArrow: true,
          points: [
            { x: 2, y: 8, label: 'A' },
            { x: 8, y: 8 },
            { x: 8, y: 3, label: 'B' },
          ],
        },
      ],
    };

    const specs: readonly ProblemFigureSpec[] = [
      plotSpec,
      ...ALL_SCENES.map(
        (scene): ProblemFigureSpec => ({
          kind: 'physics-schematic',
          scene,
          alt: `Sơ đồ vật lý minh họa cảnh ${scene}`,
          labels: { m1: 'm_1', m2: 'm_2', angle: 'α = 30°' },
        }),
      ),
    ];

    for (const fig of specs) {
      const html = renderToStaticMarkup(
        createElement(MemoryRouter, null, createElement(ProblemFigure, { figure: fig })),
      );
      expect(html).toContain('<svg');
      expect(html).toContain('role="img"');
      expect(html).toMatch(/aria-label="[^"]+"/);
      expect(html).not.toMatch(/#000\b|#fff\b/i);
    }
  });
});
