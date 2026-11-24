import type { EntityId } from './learning';

export type MitCourseCode = '8.01SC' | '5.60' | '8.044';

export type MitResourceCategory = 'supplement' | 'further-reading';

export type MitResourceType =
  | 'video-lesson'
  | 'video-lecture'
  | 'textbook-pdf'
  | 'notes-slides-pdf';

export interface SyllabusSectionItem {
  readonly code: string;
  readonly title: string;
  readonly selfStudy?: boolean;
}

export interface InternalDocRef {
  readonly id: EntityId;
  readonly title: string;
  readonly docPath: string;
  readonly kind: 'syllabus-pdf' | 'slide-pdf' | 'exercise-pdf';
  readonly pages?: readonly number[];
  readonly note?: string;
}

export interface MitOcwResourceRef {
  readonly id: EntityId;
  readonly courseCode: MitCourseCode;
  readonly courseTitle: string;
  readonly category: MitResourceCategory;
  readonly resourceType: MitResourceType;
  readonly title: string;
  readonly relevanceVi: string;
  readonly url: string;
  readonly youtubeId?: string;
  readonly lessonIds?: readonly EntityId[];
}

export interface Phy1159SyllabusChapter {
  readonly id: EntityId;
  readonly number: number;
  readonly title: string;
  readonly selfStudy?: boolean;
  readonly outcomes: readonly string[];
  readonly sections: readonly SyllabusSectionItem[];
  readonly webLessonIds: readonly EntityId[];
  readonly internalDocs: readonly InternalDocRef[];
  readonly mitResources: readonly MitOcwResourceRef[];
  readonly comparisonNoteVi: string;
  readonly mitGapNoteVi?: string;
}

export interface Phy1159SyllabusProgress {
  readonly schemaVersion: 1;
  readonly completedChapterIds: readonly EntityId[];
}
