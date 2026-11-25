import type { EntityId, Provenance } from './learning';
import type { MicroLessonCardRole } from './micro-lesson';
import type { GivenQuantity, TheoryAnchor } from './semi-essay';

export interface ReasoningScaffoldTemplate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly template: string;
}

export interface CourseConventionCanon {
  readonly courseId: EntityId;
  readonly academicCode: string;
  readonly subjectId: EntityId;
  readonly courseTitle: string;
  readonly notationRules: readonly string[];
  readonly forbiddenShortcutHints: readonly string[];
  readonly presentationCheckpoints?: readonly string[] | undefined;
  readonly reasoningScaffolds: readonly ReasoningScaffoldTemplate[];
}

export type StepCoachingLifecycleState =
  | 'unstarted'
  | 'drafted'
  | 'needs-revision'
  | 'revised-pending-recheck'
  | 'verified';

export interface LessonWebMcpContextPacket {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly course: {
    readonly id: EntityId;
    readonly code: string;
    readonly title: string;
    readonly practiceOnly: boolean;
    readonly notationRules: readonly string[];
    readonly forbiddenShortcutHints: readonly string[];
  };
  readonly syllabusHorizon: {
    readonly currentChapter: string;
    readonly currentLesson: string;
    readonly allowedPrerequisites: readonly string[];
    readonly unlearnedChaptersDoNotUse: readonly string[];
  };
  readonly activeLessonSection?: {
    readonly sectionTitle: string;
    readonly excerptMarkdown: string;
  } | undefined;
  readonly focusedExercise?: {
    readonly id: EntityId;
    readonly title: string;
    readonly kind: string;
    readonly prompt: string;
    readonly studentAttemptSummary?: string | undefined;
  } | undefined;
  readonly pedagogicalContract: readonly string[];
}

export type SyllabusRelation =
  | 'current-lesson'
  | 'direct-prerequisite'
  | 'earlier-syllabus'
  | 'later-syllabus';

export interface CurriculumChunk {
  readonly id: string;
  readonly courseId: EntityId;
  readonly chapterId: EntityId;
  readonly chapterTitle: string;
  readonly chapterIndex: number;
  readonly lessonId: EntityId;
  readonly lessonTitle: string;
  readonly headingId: string;
  readonly sectionTitle: string;
  readonly role?: MicroLessonCardRole | undefined;
  readonly bodyMarkdown: string;
  readonly formulas: readonly string[];
  readonly relationToTarget: SyllabusRelation;
  readonly provenance?: Provenance | undefined;
}

export interface CurriculumHorizon {
  readonly courseId: EntityId;
  readonly academicCode: string;
  readonly currentChapterId: EntityId;
  readonly currentChapterTitle: string;
  readonly currentChapterNumber: number;
  readonly currentLessonId: EntityId;
  readonly currentLessonTitle: string;
  readonly directPrerequisiteLessons: readonly {
    readonly id: EntityId;
    readonly title: string;
    readonly chapterTitle: string;
  }[];
  readonly earlierChapterTitles: readonly string[];
  readonly unlearnedChapterTitles: readonly string[];
}

export interface CurriculumSearchHit {
  readonly chunk: CurriculumChunk;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export type CoachingPromptMode = 'socratic-hint' | 'rubric-review' | 'presentation-review';

export interface GroundedEssayContextPacket {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly mode: CoachingPromptMode;
  readonly course: {
    readonly id: EntityId;
    readonly code: string;
    readonly title: string;
    readonly notationRules: readonly string[];
    readonly forbiddenShortcutHints: readonly string[];
  };
  readonly syllabusHorizon: {
    readonly currentChapter: string;
    readonly currentLesson: string;
    readonly allowedPrerequisites: readonly string[];
    readonly unlearnedChaptersDoNotUse: readonly string[];
  };
  readonly exercise: {
    readonly id: EntityId;
    readonly title: string;
    readonly problemPrompt: string;
    readonly given: readonly GivenQuantity[];
    readonly theoryAnchors: readonly TheoryAnchor[];
    readonly visualContextSummary?: readonly string[] | undefined;
  };
  readonly activeStep: {
    readonly id: EntityId;
    readonly stepNumber: number;
    readonly totalSteps: number;
    readonly title: string;
    readonly prompt: string;
    readonly rubricCriteria: readonly { readonly id: string; readonly prompt: string }[];
    readonly hints: readonly string[];
    readonly studentDraft: string;
    readonly studentRevision: string;
    readonly modelRevealed: boolean;
    /** Only populated when `modelRevealed === true` so unrevealed reference answers never leak. */
    readonly referenceModelAnswer?: string | undefined;
  };
  readonly groundedExcerpts: readonly {
    readonly citationLabel: string;
    readonly lessonId: EntityId;
    readonly sectionTitle: string;
    readonly relation: SyllabusRelation;
    readonly excerptMarkdown: string;
  }[];
  readonly pedagogicalContract: readonly string[];
}

export type TutorCriterionStatus = 'met' | 'partial' | 'missing';

export type TutorAssessmentVerdict = 'pass' | 'not-pass';

export interface TutorCriterionFeedback {
  readonly criterionId: string;
  readonly status: TutorCriterionStatus;
  readonly comment: string;
}

export interface TutorCoachingFeedback {
  readonly version: 1;
  readonly exerciseId: EntityId;
  readonly stepId: EntityId;
  readonly source: 'webmcp' | 'clipboard';
  readonly receivedAt: string;
  readonly summary: string;
  readonly verdict?: TutorAssessmentVerdict | undefined;
  readonly score?: number | undefined;
  readonly maxScore?: number | undefined;
  readonly socraticQuestions: readonly string[];
  readonly criterionFeedback: readonly TutorCriterionFeedback[];
  readonly conventionWarnings: readonly string[];
  readonly citedSections: readonly string[];
}
