export interface Plot2dPoint {
  readonly x: number;
  readonly y: number;
  readonly label?: string | undefined;
  readonly labelOffset?: { readonly dx: number; readonly dy: number } | undefined;
}

export interface Plot2dPathSpec {
  readonly id: string;
  readonly label?: string | undefined;
  readonly points: readonly Plot2dPoint[];
  readonly smooth?: boolean | undefined;
  readonly dashed?: boolean | undefined;
  readonly closed?: boolean | undefined;
  readonly showArrow?: boolean | undefined;
  readonly tone?: 'accent' | 'ink' | 'warning' | 'success' | undefined;
  readonly shadeUnder?: boolean | undefined;
  readonly shadeClosed?: boolean | undefined;
}

export interface Plot2dFigureSpec {
  readonly kind: 'plot-2d';
  readonly alt: string;
  readonly caption?: string | undefined;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly xMin?: number | undefined;
  readonly xMax: number;
  readonly yMin?: number | undefined;
  readonly yMax: number;
  readonly paths: readonly Plot2dPathSpec[];
  readonly markers?: readonly Plot2dPoint[] | undefined;
}

export type PhysicsSchematicScene =
  | 'projectile-curvature'
  | 'rough-incline-launch'
  | 'incline-pulley'
  | 'conical-pendulum'
  | 'self-hoist'
  | 'movable-pulley'
  | 'ring-rope'
  | 'accelerating-wedge'
  | 'cart-scale-incline'
  | 'monkey-pulley'
  | 'simple-pendulum'
  | 'ballistic-pendulum'
  | 'vertical-loop-track'
  | 'orthogonal-2d-scattering'
  | 'rolling-cylinder-incline'
  | 'coaxial-disks-clutch'
  | 'kepler-ellipse'
  | 'free-expansion-chamber'
  | 'carnot-engine-flow';

export interface PhysicsSchematicFigureSpec {
  readonly kind: 'physics-schematic';
  readonly scene: PhysicsSchematicScene;
  readonly alt: string;
  readonly caption?: string | undefined;
  readonly labels?: Readonly<Record<string, string>> | undefined;
}

export type ProblemFigureSpec = Plot2dFigureSpec | PhysicsSchematicFigureSpec;
