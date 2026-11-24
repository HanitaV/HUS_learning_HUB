import type { Provenance } from './learning';

export interface TheoryAnchor {
  readonly id: string;
  readonly title: string;
  readonly formula?: string;
  readonly summary: string;
  readonly conditions: readonly string[];
  readonly lessonHeadingId?: string;
}

export interface GivenQuantity {
  readonly symbolLatex: string;
  readonly value: string;
  readonly unit?: string;
  readonly label: string;
}

export interface FbdForceDef {
  readonly id: string;
  readonly label: string;
  readonly subscript?: string;
  readonly name: string;
  readonly missing: string;
  readonly extra: string;
}

export interface FbdExpectedArrow {
  readonly type: string;
  readonly angle: number;
  /** Optional force application point offset in normalized SVG coordinates relative to body center (e.g. -40..40). */
  readonly applicationOffset?: { readonly x: number; readonly y: number };
}

export interface FbdBodySpec {
  readonly id: string;
  readonly label: string;
  /** Optional inclined plane angle in degrees (counter-clockwise from +x). */
  readonly surfaceAngle?: number;
  /** Optional rope attachment angle in degrees. */
  readonly ropeAngle?: number;
  /** Optional rigid-body extended FBD mode (torque / lever arm visualization). */
  readonly extendedMode?: boolean;
  /** Optional pivot point in normalized SVG coordinates relative to body center (e.g. -40..40). */
  readonly pivot?: { readonly x: number; readonly y: number; readonly label?: string };
  /** Optional hint explaining the lever arm or torque axis. */
  readonly leverArmHint?: string;
  readonly palette: readonly string[];
  readonly expected: readonly FbdExpectedArrow[];
  readonly toleranceDeg?: number;
}

export interface FbdStepSpec {
  readonly kind: 'fbd';
  readonly note?: string;
  readonly bodies: readonly FbdBodySpec[];
  readonly forceCatalog: Readonly<Record<string, FbdForceDef>>;
}

export type HeatmapInteractionMode = 'select-cells' | 'place-flow' | 'paint-state';

export type HeatmapThermalTrend = 'warming' | 'steady' | 'cooling';

export interface HeatmapFlowPoint {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly label: string;
  /** Expected heat flow direction in degrees (0=right, 90=up, 180=left, 270=down). */
  readonly expectedAngle: number;
  readonly toleranceDeg?: number;
  readonly hint: string;
}

export interface HeatmapStepSpec {
  readonly kind: 'heatmap';
  readonly mode: HeatmapInteractionMode;
  readonly rows: number;
  readonly cols: number;
  /** Row-major matrix [row][col] of scalar values (e.g., temperature in °C). */
  readonly values: readonly (readonly number[])[];
  readonly unit: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly rowLabels?: readonly string[];
  readonly colLabels?: readonly string[];
  readonly note?: string;
  /** For 'select-cells': expected cell keys in 'r-c' format (0-indexed). */
  readonly expectedCells?: readonly string[];
  readonly cellRationale?: string;
  /** For 'place-flow': points where students set heat-flow vector direction. */
  readonly flowPoints?: readonly HeatmapFlowPoint[];
  /** For 'paint-state': expected thermal trend for specific 'r-c' cells. */
  readonly expectedTrends?: Readonly<Record<string, HeatmapThermalTrend>>;
  readonly trendRationale?: string;
}

export interface Curve2dPoint {
  readonly x: number;
  readonly y: number;
  readonly label?: string;
}

export interface Curve2dSegment {
  readonly id: string;
  readonly label: string;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly areaLabel?: string;
  readonly description?: string;
}

export interface Curve2dSignRow {
  readonly segmentId: string;
  readonly label: string;
  readonly expectedSigns: Readonly<Record<string, '+' | '-' | '0'>>;
  readonly hint: string;
}

export interface Curve2dStepSpec {
  readonly kind: 'curve-2d';
  readonly mode: 'select-regions' | 'sign-matrix';
  readonly xLabel: string;
  readonly yLabel: string;
  readonly xUnit: string;
  readonly yUnit: string;
  readonly xMax: number;
  readonly yMax: number;
  readonly points: readonly Curve2dPoint[];
  readonly segments: readonly Curve2dSegment[];
  readonly shadeUnderCurve?: boolean;
  readonly note?: string;
  /** For 'select-regions': expected segment IDs. */
  readonly expectedSegmentIds?: readonly string[];
  readonly regionRationale?: string;
  /** For 'sign-matrix': columns (e.g., ΔU, Q, A) and expected signs per segment. */
  readonly matrixColumns?: readonly { readonly id: string; readonly labelLatex: string }[];
  readonly signRows?: readonly Curve2dSignRow[];
}

export interface BalanceFlowBarSpec {
  readonly id: string;
  readonly label: string;
  readonly symbolLatex: string;
  /** Expected qualitative state: 'zero' (0), 'positive' (>0). */
  readonly expectedState: 'zero' | 'positive';
  readonly hint: string;
}

export interface BalanceFlowStepSpec {
  readonly kind: 'balance-flow';
  readonly systemLabel: string;
  readonly initialLabel: string;
  readonly finalLabel: string;
  readonly maxLevel?: number;
  readonly initialBars: readonly BalanceFlowBarSpec[];
  readonly finalBars: readonly BalanceFlowBarSpec[];
  readonly transferLabel: string;
  readonly transferSymbolLatex: string;
  readonly expectedTransferSign: '-' | '0' | '+';
  readonly transferHint: string;
  readonly requireConservation?: boolean;
  readonly note?: string;
}

export interface MoDiagramStepSpec {
  readonly kind: 'mo-diagram';
  readonly speciesLabel: string;
  readonly atomLeft: string;
  readonly atomRight: string;
  readonly expectedOrdering: 'type-1' | 'type-2';
  readonly expectedTotalElectrons: number;
  readonly expectedBondOrder: number;
  readonly expectedMagnetism: 'paramagnetic' | 'diamagnetic';
  readonly note?: string;
}

export interface ProbTreeBranchSpec {
  readonly id: string;
  readonly label: string;
  readonly symbolLatex: string;
  readonly expectedPrior: number;
  readonly priorTolerance?: number;
  readonly expectedConditional: number;
  readonly conditionalTolerance?: number;
  readonly hint: string;
}

export interface ProbTreeStepSpec {
  readonly kind: 'prob-tree';
  readonly rootLabel: string;
  readonly eventLabel: string;
  readonly eventSymbolLatex: string;
  readonly branches: readonly ProbTreeBranchSpec[];
  readonly note?: string;
}

export interface AlgoTraceCellSpec {
  readonly row: number;
  readonly col: number;
  readonly givenValue?: string;
  readonly expectedAnswers?: readonly string[];
  readonly numericExpected?: number;
  readonly numericTolerance?: number;
  readonly highlightTone?: 'accent' | 'warning' | 'neutral';
  readonly hint?: string;
}

export interface AlgoTraceStepSpec {
  readonly kind: 'algo-trace';
  readonly structureLabel: string;
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly cells: readonly AlgoTraceCellSpec[];
  readonly note?: string;
}

export interface ProofDagNodeSpec {
  readonly id: string;
  readonly text: string;
  readonly role?: 'assumption' | 'step' | 'conclusion' | 'distractor';
  readonly prerequisiteIds: readonly string[];
  readonly isDistractor?: boolean;
  readonly distractorReason?: string;
}

export interface ProofDagStepSpec {
  readonly kind: 'proof-dag';
  readonly theoremStatement: string;
  readonly blocks: readonly ProofDagNodeSpec[];
  readonly note?: string;
}

export interface ParsonsFlowLineSpec {
  readonly id: string;
  readonly code: string;
  readonly expectedIndent: number;
  readonly isDistractor?: boolean;
  readonly distractorReason?: string;
}

export interface ParsonsFlowStepSpec {
  readonly kind: 'parsons-flow';
  readonly language: 'java' | 'python';
  readonly blocks: readonly ParsonsFlowLineSpec[];
  readonly solutionOrder: readonly string[];
  readonly note?: string;
}

export type DiagramStepSpec =
  | FbdStepSpec
  | HeatmapStepSpec
  | Curve2dStepSpec
  | BalanceFlowStepSpec
  | MoDiagramStepSpec
  | ProbTreeStepSpec
  | AlgoTraceStepSpec
  | ProofDagStepSpec
  | ParsonsFlowStepSpec;

export interface ChoiceReasoningStep {
  readonly id: string;
  readonly kind: 'choice-reasoning';
  readonly title: string;
  readonly prompt: string;
  readonly theoryAnchorIds: readonly string[];
  readonly multiSelect?: boolean;
  readonly choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly rationale: string;
  }[];
  readonly answers: readonly string[];
  readonly hint?: string;
  readonly summaryTemplate: string;
}

export interface DiagramStep {
  readonly id: string;
  readonly kind: 'diagram';
  readonly title: string;
  readonly prompt: string;
  readonly theoryAnchorIds: readonly string[];
  readonly diagramKind: DiagramStepSpec['kind'];
  readonly spec: DiagramStepSpec;
  readonly hint?: string;
  readonly summaryTemplate: string;
}

export interface AxisProjectionRow {
  readonly forceId: string;
  readonly forceLatex: string;
  readonly expectedSign: '+' | '-' | '0';
  readonly expectedComponent: string;
  readonly componentOptions: readonly { readonly id: string; readonly latex: string }[];
  readonly hint: string;
}

export interface AxisProjectionAxis {
  readonly id: string;
  readonly label: string;
  readonly rhsLatex: string;
  readonly rows: readonly AxisProjectionRow[];
  readonly resultingEquationLatex: string;
}

export interface AxisProjectionStep {
  readonly id: string;
  readonly kind: 'axis-projection';
  readonly title: string;
  readonly prompt: string;
  readonly theoryAnchorIds: readonly string[];
  readonly contextNote?: string;
  readonly axes: readonly AxisProjectionAxis[];
  readonly hint?: string;
  readonly summaryTemplate: string;
}

export interface EquationTransformOperation {
  readonly id: string;
  readonly label: string;
  readonly resultLatex: string;
  readonly canceledLatex?: string;
  readonly optimal: boolean;
  readonly feedback: string;
}

export interface EquationTransformStage {
  readonly id: string;
  readonly prompt: string;
  readonly operations: readonly EquationTransformOperation[];
}

export interface EquationTransformStep {
  readonly id: string;
  readonly kind: 'equation-transform';
  readonly title: string;
  readonly prompt: string;
  readonly theoryAnchorIds: readonly string[];
  readonly initialEquations: readonly { readonly label: string; readonly latex: string }[];
  readonly goalLatex: string;
  readonly stages: readonly EquationTransformStage[];
  readonly hint?: string;
  readonly summaryTemplate: string;
}

export interface NumericUnitField {
  readonly id: string;
  readonly label: string;
  readonly symbolLatex: string;
  readonly expected: number;
  readonly tolerance: number;
  readonly toleranceMode: 'absolute' | 'relative';
  readonly unit: string;
  readonly formulaLatex?: string;
}

export interface LimitingCheckPrompt {
  readonly prompt: string;
  readonly choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly rationale: string;
  }[];
  readonly answerId: string;
}

export interface NumericUnitStep {
  readonly id: string;
  readonly kind: 'numeric-unit';
  readonly title: string;
  readonly prompt: string;
  readonly theoryAnchorIds: readonly string[];
  readonly limitingCheck?: LimitingCheckPrompt;
  readonly fields: readonly NumericUnitField[];
  readonly explanation: string;
  readonly hint?: string;
  readonly summaryTemplate: string;
}

export interface WrittenReasoningStep {
  readonly id: string;
  readonly kind: 'written-reasoning';
  readonly title: string;
  readonly prompt: string;
  readonly theoryAnchorIds: readonly string[];
  readonly hint?: string;
  readonly summaryTemplate: string;
  readonly modelAnswer: string;
  readonly rubric: readonly { readonly id: string; readonly prompt: string }[];
  readonly hints?: readonly string[];
}

export interface WrittenStepDraft {
  readonly selfReviewed: boolean;
  readonly response: string;
  readonly modelRevealed: boolean;
  readonly reviewedCriterionIds: readonly string[];
  readonly revision: string;
}

export type SemiEssayStep =
  | WrittenReasoningStep
  | ChoiceReasoningStep
  | DiagramStep
  | AxisProjectionStep
  | EquationTransformStep
  | NumericUnitStep;

export interface SemiEssayExercise {
  readonly id: string;
  readonly lessonId: string;
  readonly kind: 'semi-essay';
  readonly title: string;
  readonly prompt: string;
  readonly fadeLevel?: 0 | 1 | 2;
  readonly given: readonly GivenQuantity[];
  readonly theoryAnchors: readonly TheoryAnchor[];
  readonly steps: readonly SemiEssayStep[];
  readonly explanation?: string;
  readonly provenance?: Provenance;
}
