import type { EntityId } from './learning';
import type { CodeLanguage } from './code-lab';

export interface ParsonsBlock {
  readonly id: string;
  readonly code: string;
  readonly expectedIndent: number;
  readonly isDistractor?: boolean;
  readonly distractorReason?: string;
}

export interface ParsonsExercise {
  readonly id: EntityId;
  readonly courseId: EntityId;
  readonly lessonId?: EntityId;
  readonly title: string;
  readonly language: CodeLanguage;
  readonly prompt: string;
  readonly blocks: readonly ParsonsBlock[];
  /** Ordered IDs of the non-distractor blocks in their expected sequence. */
  readonly solutionOrder: readonly string[];
}

export interface ParsonsPlacement {
  readonly blockId: string;
  readonly indent: number;
}

export interface ParsonsLineFeedback {
  readonly blockId: string;
  readonly code: string;
  readonly status: 'correct' | 'wrong-indent' | 'wrong-order' | 'distractor';
  readonly message: string;
}

export interface ParsonsGradeResult {
  readonly passed: boolean;
  readonly correctCount: number;
  readonly expectedCount: number;
  readonly missingBlockIds: readonly string[];
  readonly lineFeedback: readonly ParsonsLineFeedback[];
}

export interface ProofBlockItem {
  readonly id: string;
  /** KaTeX-ready Markdown/LaTeX statement. */
  readonly text: string;
  readonly role?: 'assumption' | 'step' | 'conclusion' | 'distractor';
  /** IDs of blocks that must appear strictly before this block in a valid proof. */
  readonly prerequisiteIds: readonly string[];
  readonly isDistractor?: boolean;
  readonly distractorReason?: string;
}

export interface ProofBlocksExercise {
  readonly id: EntityId;
  readonly courseId: EntityId;
  readonly lessonId?: EntityId;
  readonly title: string;
  readonly theoremStatement: string;
  readonly hint: string;
  readonly blocks: readonly ProofBlockItem[];
}

export interface ProofStepDiagnostic {
  readonly blockId: string;
  readonly status: 'valid' | 'missing-prereq' | 'distractor' | 'duplicate';
  readonly missingPrereqIds: readonly string[];
  readonly message: string;
}

export interface ProofGradeResult {
  readonly passed: boolean;
  readonly requiredCount: number;
  readonly validCount: number;
  readonly missingRequiredIds: readonly string[];
  readonly diagnostics: readonly ProofStepDiagnostic[];
}
