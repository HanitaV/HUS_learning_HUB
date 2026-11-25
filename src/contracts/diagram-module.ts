import type { ComponentType } from 'react';
import type { DiagramStepSpec } from '../domain/semi-essay';

export interface DiagramStepResult {
  readonly correct: boolean;
  readonly summary: string;
}

export interface DiagramRendererProps<TSpec extends DiagramStepSpec = DiagramStepSpec> {
  readonly spec: TSpec;
  readonly completed: boolean;
  readonly fadeLevel: 0 | 1 | 2;
  readonly hideSolutionOverlay?: boolean | undefined;
  readonly draftKey?: string | undefined;
  readonly onEvaluated: (result: DiagramStepResult) => void;
}

export interface DiagramModuleDescriptor {
  readonly kind: DiagramStepSpec['kind'];
  readonly label: string;
  readonly load: () => Promise<{ readonly default: ComponentType<DiagramRendererProps> }>;
}
