export type Che1080Difficulty = 'basic' | 'standard' | 'advanced';

export type Che1080VisualHint = 'mo-diagram' | 'vb-hybridization' | 'thermo-diagram' | 'none';

export interface Che1080BankExercise {
  readonly id: string;
  readonly code: string;
  readonly source: string;
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  readonly formTitle: string;
  readonly subTypeTitle: string;
  readonly isRecent: boolean;
  readonly difficulty: Che1080Difficulty;
  readonly visualHint: Che1080VisualHint;
  /** Clean Markdown + KaTeX statement ready for rendering. */
  readonly prompt: string;
  readonly note?: string;
  /** Step-by-step solution items extracted from \hg{\item ...}. */
  readonly solutionSteps: readonly string[];
  /** Final answer string extracted from the 2nd argument of \hg{...}{...}. */
  readonly finalAnswer: string;
  /** Source file path under docs/HUS-learning-resource/CHE1080_bai_tap_latex/. */
  readonly sourceFile: string;
}
