export interface MicroSelfCheck {
  readonly id: string;
  readonly promptMarkdown: string;
  readonly answerMarkdown: string;
}

export type MicroLessonCardRole = 'intro' | 'explain' | 'code' | 'practice' | 'deep-dive';

export interface MicroLessonCard {
  readonly id: string;
  readonly index: number;
  readonly headingId: string;
  readonly title: string;
  readonly bodyMarkdown: string;
  readonly deepDiveTitle?: string;
  readonly deepDiveMarkdown?: string;
  readonly selfChecks: readonly MicroSelfCheck[];
  readonly isDeepDiveCard: boolean;
  readonly role?: MicroLessonCardRole;
}

export interface ParsedMicroLesson {
  readonly title: string;
  readonly cards: readonly MicroLessonCard[];
  readonly attributionFooter?: string;
}
