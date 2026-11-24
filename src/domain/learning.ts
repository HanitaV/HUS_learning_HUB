/** Opaque identifiers by convention: stable, lowercase kebab-case, never paths. */
export type EntityId = string;

export interface Subject {
  readonly id: EntityId;
  readonly title: string;
}

export interface Provenance {
  readonly repository: string;
  readonly revision: string;
  readonly path: string;
  readonly rights: 'unreviewed' | 'approved' | 'restricted';
  readonly attribution?: string;
}

export interface Course {
  readonly schemaVersion: 1;
  readonly id: EntityId;
  readonly academicCode?: string;
  readonly subjectId: EntityId;
  readonly title: string;
  readonly language: string;
  readonly status: 'metadata-only' | 'available';
  readonly chapterIds: readonly EntityId[];
  readonly resourceIds: readonly EntityId[];
  readonly provenance: Provenance;
}

export interface Chapter {
  readonly id: EntityId;
  readonly courseId: EntityId;
  readonly title: string;
  readonly topicIds: readonly EntityId[];
}

export interface Topic {
  readonly id: EntityId;
  readonly chapterId: EntityId;
  readonly title: string;
  readonly lessonIds: readonly EntityId[];
  readonly prerequisiteIds?: readonly EntityId[];
}

export interface Lesson {
  readonly id: EntityId;
  readonly topicId: EntityId;
  readonly title: string;
  readonly content: { readonly format: 'markdown'; readonly assetPath: string };
  readonly exerciseIds: readonly EntityId[];
  readonly resourceIds: readonly EntityId[];
  readonly summary?: string;
  readonly provenance?: Provenance;
}

/** Full grading payloads belong to future exercise contracts and subject modules. */
export interface Exercise {
  readonly id: EntityId;
  readonly lessonId: EntityId;
  readonly title: string;
  readonly kind: string;
  readonly content: { readonly format: 'json'; readonly assetPath: string };
}

export interface Resource {
  readonly id: EntityId;
  readonly title: string;
  readonly kind: 'pdf' | 'image' | 'diagram' | 'markdown' | 'json' | 'external' | 'youtube';
  readonly url?: string;
  readonly assetPath?: string;
  readonly provenance: Provenance;
  /** PDF file page numbers, starting at 1; not printed slide numbers. */
  readonly pages?: readonly number[];
}

export interface KnowledgeRelationship {
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: 'prerequisite' | 'related' | 'applies';
}

export interface LearningProgress {
  readonly schemaVersion: 1;
  readonly courseId: EntityId;
  readonly entityId: EntityId;
  readonly entityKind: 'lesson' | 'exercise';
  readonly status: 'in-progress' | 'completed' | 'needs-review';
  readonly updatedAt: string;
}
