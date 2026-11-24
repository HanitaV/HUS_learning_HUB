import type { CodeLanguage } from './code-lab';
import type { EntityId } from './learning';
import type { DiagramStepSpec } from './semi-essay';

export interface ConceptProbeChoice {
  readonly id: string;
  readonly label: string;
  readonly rationale: string;
}

export interface ConceptProbeInteraction {
  readonly kind: 'concept-probe';
  readonly prompt: string;
  readonly choices: readonly ConceptProbeChoice[];
  readonly answerId: string;
}

export interface CodeSlotOption {
  readonly id: string;
  readonly code: string;
  readonly feedback: string;
}

export interface CodeSlotSpec {
  readonly id: string;
  readonly placeholder: string;
  readonly options: readonly CodeSlotOption[];
  readonly correctOptionId: string;
}

export interface CodeSlotBuilderInteraction {
  readonly kind: 'code-slot-builder';
  readonly language: CodeLanguage;
  /** Template source containing `{{slotId}}` tokens for each slot in `slots`. */
  readonly codeTemplate: string;
  readonly slots: readonly CodeSlotSpec[];
  readonly simulatedOutput: string;
}

export type MoGuidedMode = 'select-ordering' | 'fill-electrons' | 'count-bo';

export type MoSlotMap = Readonly<
  Record<
    's2s' | 's2s_star' | 's2p' | 'p2p_1' | 'p2p_2' | 'p2p_star_1' | 'p2p_star_2' | 's2p_star',
    0 | 1 | 2
  >
>;

export interface MoGuidedCanvasInteraction {
  readonly kind: 'mo-guided-canvas';
  readonly mode: MoGuidedMode;
  readonly moleculeLabel: string;
  readonly atomicNumber: number;
  readonly totalValenceElectrons: number;
  readonly expectedOrdering: 'type-1' | 'type-2';
  readonly expectedBondOrder: number;
  readonly expectedMagnetism: 'paramagnetic' | 'diamagnetic';
}

export interface DiagramGuidedInteraction {
  readonly kind: 'diagram-guided';
  readonly diagramKind: DiagramStepSpec['kind'];
  readonly spec: DiagramStepSpec;
}

export interface StepChainOption {
  readonly id: string;
  readonly labelLatex: string;
  readonly feedback: string;
}

export interface StepChainSlot {
  readonly id: string;
  readonly stepLabel: string;
  readonly options: readonly StepChainOption[];
  readonly correctOptionId: string;
}

export interface StepChainBuilderInteraction {
  readonly kind: 'step-chain-builder';
  readonly contextLatex?: string;
  readonly slots: readonly StepChainSlot[];
}

export interface NumericLimitingQuestion {
  readonly prompt: string;
  readonly choices: readonly ConceptProbeChoice[];
  readonly answerId: string;
}

export interface NumericCheckInteraction {
  readonly kind: 'numeric-check';
  readonly label: string;
  readonly symbolLatex: string;
  readonly expected: number;
  readonly tolerance: number;
  readonly unit: string;
  readonly limitingQuestion?: NumericLimitingQuestion;
}

export type QuestStageInteraction =
  | ConceptProbeInteraction
  | CodeSlotBuilderInteraction
  | MoGuidedCanvasInteraction
  | DiagramGuidedInteraction
  | StepChainBuilderInteraction
  | NumericCheckInteraction;

export interface SkillQuestMilestone {
  readonly id: string;
  readonly tag: string;
  readonly title: string;
  readonly coachActPrompt: string;
  readonly coachAdvancePrompt: string;
  readonly coreMarkdown: string;
  readonly deepDiveMarkdown: string;
  readonly interaction: QuestStageInteraction;
}

export interface SkillQuest {
  readonly id: EntityId;
  readonly courseId: EntityId;
  readonly subjectId: EntityId;
  readonly lessonId: EntityId;
  readonly title: string;
  readonly subtitle: string;
  readonly categoryLabel: string;
  readonly estimatedMinutes: number;
  readonly codeLabProblemId?: EntityId;
  readonly codeLabPrefill?: Readonly<Partial<Record<CodeLanguage, string>>>;
  readonly milestones: readonly SkillQuestMilestone[];
}

export type QuestInteractionAnswer =
  | { readonly kind: 'concept-probe'; readonly choiceId: string }
  | {
      readonly kind: 'code-slot-builder';
      readonly selectedBySlotId: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: 'mo-guided-canvas';
      readonly chosenOrdering?: 'type-1' | 'type-2';
      readonly slotCounts?: MoSlotMap;
      readonly bondOrderInput?: string;
      readonly chosenMagnetism?: 'paramagnetic' | 'diamagnetic';
    }
  | {
      readonly kind: 'diagram-guided';
      readonly diagramPassed: boolean;
      readonly diagramSummary?: string;
    }
  | {
      readonly kind: 'step-chain-builder';
      readonly selectedBySlotId: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: 'numeric-check';
      readonly rawValue: string;
      readonly limitingChoiceId?: string;
    };

export interface QuestEvaluationResult {
  readonly correct: boolean;
  readonly feedback: string;
}

export interface QuestProgressState {
  readonly schemaVersion: 1;
  /** Maps questId -> number of consecutive milestones completed (0..milestones.length). */
  readonly milestoneProgress: Readonly<Record<string, number>>;
  readonly completedQuestIds: readonly string[];
}
