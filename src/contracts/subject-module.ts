import type { ComponentType } from 'react';
import type { CodeLanguage, CodePlaygroundSnippet } from '../domain/code-lab';
import type { EntityId } from '../domain/learning';

export interface InjectedCodeSnippet {
  readonly nonce: number;
  readonly label: string;
  readonly language: CodeLanguage;
  readonly code: string;
}

export interface SubjectToolProps {
  readonly courseId: EntityId;
  readonly initialPreset?: string | undefined;
  readonly lessonId?: EntityId | undefined;
  readonly lessonTitle?: string | undefined;
  readonly playgroundSnippets?: readonly CodePlaygroundSnippet[] | undefined;
  readonly injectedSnippet?: InjectedCodeSnippet | undefined;
  readonly embeddedSurface?: 'course' | 'lesson-exercise' | 'practice' | 'quest' | undefined;
}

export interface SubjectToolLessonLink {
  readonly lessonId: EntityId;
  readonly preset?: string;
  readonly label: string;
}

export type SubjectToolKind = 'visualization' | 'simulation' | 'exercise' | 'code-lab';

export interface SubjectToolDefinition {
  readonly id: EntityId;
  readonly title: string;
  readonly kind: SubjectToolKind;
  /** Optional list of courseIds this tool applies to. When omitted, applies to all courses in the subject. */
  readonly courseIds?: readonly EntityId[];
  /** When true, embeds this tool directly inside LessonPage and PracticePage exercise sections. */
  readonly embedInExercises?: boolean;
  /** Optional list of lessonIds where this tool should also appear inline inside the lesson exercise section. */
  readonly inlineLessonIds?: readonly EntityId[];
  readonly lessonLinks?: readonly SubjectToolLessonLink[];
  readonly load: () => Promise<{ default: ComponentType<SubjectToolProps> }>;
}

export interface CelestialConstellationFigure {
  readonly id: string;
  readonly label: string;
  readonly paths: readonly string[];
  readonly stars: readonly {
    readonly cx: number;
    readonly cy: number;
    readonly r?: number;
    readonly tone?: 'accent' | 'starlight';
  }[];
}

export interface SubjectCelestialBackdrop {
  readonly lightGlowCore: string;
  readonly lightGlowWarm: string;
  readonly darkGlowCore: string;
  readonly darkGlowWarm: string;
  readonly constellations: readonly CelestialConstellationFigure[];
}

export type DisciplineTone = 'sapphire' | 'emerald' | 'amber' | 'violet';

export type DisciplineEmblemKind =
  | 'circuit-tree'
  | 'hex-orbital'
  | 'wave-pendulum'
  | 'manifold-curve';

export interface SubjectVisualTheme {
  readonly tone: DisciplineTone;
  readonly emblemKind: DisciplineEmblemKind;
  readonly focusSummary: string;
}

/** React integration boundary. Domain types and calculations remain React-free. */
export interface SubjectModule {
  readonly subjectId: EntityId;
  /**
   * Controls dual-track layout on CoursePage:
   * - `'theory-first'`: prioritizes Knowledge, Algorithms & Visualized Lessons first, with Hands-on Code Lab as the second tab.
   * - `'practice-first'`: prioritizes Hands-on Practice first, with Theory & Foundations as the second tab.
   */
  readonly trackMode?: 'default' | 'practice-first' | 'theory-first';
  readonly practiceTrackLabel?: string;
  readonly theoryTrackLabel?: string;
  readonly defaultToolId?: EntityId;
  readonly visualTheme?: SubjectVisualTheme;
  readonly celestialBackdrop?: SubjectCelestialBackdrop;
  readonly tools?: readonly SubjectToolDefinition[];
}
