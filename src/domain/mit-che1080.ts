import type { EntityId } from './learning';

export type MitCourseId = '5.111sc' | '5.112' | '5.60';
export type MitResourceKind = 'video' | 'lecture-notes' | 'exercise' | 'solution';

/** Verified OCW resource derived from a local mirror under docs/. */
export interface MitResource {
  readonly id: EntityId;
  readonly courseId: MitCourseId;
  readonly courseLabel: string;
  readonly courseTitle: string;
  readonly lectureNumber: number;
  readonly title: string;
  readonly type: MitResourceKind;
  /** Official MIT OCW page. The only URL students open; nothing is claimed offline. */
  readonly ocwUrl: string;
  readonly youtubeId?: string;
  /** Path in the local docs/ mirror (not deployed). Present only when the file exists. */
  readonly localPath?: string;
  readonly sizeBytes?: number;
  readonly sourceSlug: string;
  readonly license: string;
}

export type MappingStatus = 'confirmed' | 'suggested';
export type LearningLevel = 'foundation' | 'standard' | 'advanced';

export interface MitLectureRef {
  readonly courseId: MitCourseId;
  readonly lectures: readonly number[];
  readonly status: MappingStatus;
  readonly level: LearningLevel;
  readonly relevanceVi: string;
  readonly note?: string;
}

export interface HusExerciseLink {
  readonly label: string;
  /** Hash-router path relative to the app (no leading #). */
  readonly to: string;
}

export interface Che1080Topic {
  readonly id: EntityId;
  readonly number: number;
  readonly title: string;
  readonly examFrequency: { readonly appeared: number; readonly of: number };
  readonly chapterTitle: string;
  /** English/Vietnamese search terms authored with the topic (not derived from filenames). */
  readonly keywords: readonly string[];
  readonly prerequisiteTopicIds: readonly EntityId[];
  readonly mit: readonly MitLectureRef[];
  readonly hus: readonly HusExerciseLink[];
  readonly lessonIds: readonly EntityId[];
}

export interface Che1080Progress {
  readonly schemaVersion: 1;
  readonly doneIds: readonly string[];
  readonly lastResourceId?: string;
}
