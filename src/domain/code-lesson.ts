/** React-free domain contracts for interactive coding-lesson animations and step-by-step code walkthroughs. */

export interface CodeWalkthroughStep {
  readonly id: string;
  readonly title: string;
  readonly explanation: string;
  readonly code: string;
  readonly highlightLines: readonly number[];
  readonly note?: string;
}

export interface CodeWalkthrough {
  readonly id: string;
  readonly title: string;
  readonly language: string;
  readonly fullCode: string;
  readonly steps: readonly CodeWalkthroughStep[];
}

export type LessonAnimationKind = 'array-ops' | 'linear-ds' | 'graph-tree' | 'oop-flow';

export type ArrayCellTone = 'default' | 'active' | 'compare' | 'swap' | 'done' | 'muted';

export interface ArrayCellItem {
  readonly label: string;
  readonly value?: number;
  readonly tone?: ArrayCellTone;
  readonly pointer?: string;
}

export interface ArrayOpsFrame {
  readonly kind: 'array-ops';
  readonly stepLabel: string;
  readonly caption: string;
  readonly items: readonly ArrayCellItem[];
  readonly auxiliaryLabel?: string;
  readonly auxiliaryValues?: readonly string[];
  readonly displayMode?: 'bars' | 'cells';
}

export type LinearDsLayout = 'stack' | 'queue' | 'linked-list' | 'array-list';

export interface LinearDsNode {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly tone?: 'default' | 'active' | 'new' | 'removed' | 'done';
  readonly pointer?: string;
}

export interface LinearDsFrame {
  readonly kind: 'linear-ds';
  readonly stepLabel: string;
  readonly caption: string;
  readonly layout: LinearDsLayout;
  readonly operationBadge?: string;
  readonly nodes: readonly LinearDsNode[];
  readonly auxiliaryText?: string;
}

export interface GraphTreeNode {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly sublabel?: string;
  readonly tone?: 'default' | 'current' | 'frontier' | 'visited' | 'path';
}

export interface GraphTreeEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly directed?: boolean;
  readonly tone?: 'default' | 'active' | 'path' | 'muted';
}

export interface GraphTreeFrame {
  readonly kind: 'graph-tree';
  readonly stepLabel: string;
  readonly caption: string;
  readonly nodes: readonly GraphTreeNode[];
  readonly edges: readonly GraphTreeEdge[];
  readonly frontierLabel?: string;
  readonly frontierItems?: readonly string[];
}

export interface OopFlowBox {
  readonly id: string;
  readonly title: string;
  readonly stereotype?: string;
  readonly lines: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly tone?: 'default' | 'active' | 'highlight' | 'done' | 'warning';
}

export interface OopFlowArrow {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style?: 'solid' | 'dashed';
  readonly tone?: 'default' | 'active' | 'warning';
}

export interface OopFlowFrame {
  readonly kind: 'oop-flow';
  readonly stepLabel: string;
  readonly caption: string;
  readonly boxes: readonly OopFlowBox[];
  readonly arrows: readonly OopFlowArrow[];
  readonly badge?: string;
}

export type LessonAnimationFrame =
  | ArrayOpsFrame
  | LinearDsFrame
  | GraphTreeFrame
  | OopFlowFrame;

export interface LessonAnimationSpec {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly kind: LessonAnimationKind;
  readonly frames: readonly LessonAnimationFrame[];
}
