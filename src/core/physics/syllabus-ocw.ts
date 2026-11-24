import type { EntityId } from '../../domain/learning';
import type {
  MitOcwResourceRef,
  Phy1159SyllabusChapter,
  Phy1159SyllabusProgress,
} from '../../domain/phy1159-syllabus';
import { normalizeVietnamese } from '../courses/search';

export interface LessonMitSupplement {
  readonly supplement: readonly MitOcwResourceRef[];
  readonly furtherReading: readonly MitOcwResourceRef[];
  readonly comparisonNoteVi?: string;
  readonly selfStudyChapter?: boolean;
}

export function getMitSupplementForLesson(
  chapters: readonly Phy1159SyllabusChapter[],
  lessonId: EntityId,
): LessonMitSupplement {
  const matchedResources: MitOcwResourceRef[] = [];
  let comparisonNoteVi: string | undefined;
  let selfStudyChapter = false;

  for (const chapter of chapters) {
    if (chapter.webLessonIds.includes(lessonId)) {
      comparisonNoteVi = chapter.comparisonNoteVi;
      if (chapter.selfStudy) selfStudyChapter = true;
    }
    for (const resource of chapter.mitResources) {
      if (resource.lessonIds?.includes(lessonId)) {
        matchedResources.push(resource);
      }
    }
  }

  return {
    supplement: matchedResources.filter(r => r.category === 'supplement'),
    furtherReading: matchedResources.filter(r => r.category === 'further-reading'),
    ...(comparisonNoteVi ? { comparisonNoteVi } : {}),
    ...(selfStudyChapter ? { selfStudyChapter } : {}),
  };
}

export function getMitVideosForLesson(
  chapters: readonly Phy1159SyllabusChapter[],
  lessonId: EntityId,
): readonly MitOcwResourceRef[] {
  const { supplement, furtherReading } = getMitSupplementForLesson(chapters, lessonId);
  return [...supplement, ...furtherReading].filter(r => Boolean(r.youtubeId));
}

export const PHY1159_SYLLABUS_STORAGE_KEY = 'hus-learning-hub:phy1159-syllabus:v1';

export const EMPTY_SYLLABUS_PROGRESS: Phy1159SyllabusProgress = {
  schemaVersion: 1,
  completedChapterIds: [],
};

export function resolveChapterByPreset(
  chapters: readonly Phy1159SyllabusChapter[],
  preset?: string,
): Phy1159SyllabusChapter | undefined {
  if (!preset) return chapters[0];
  return chapters.find(ch => ch.id === preset) ?? chapters[0];
}

export function filterSyllabusChapters(
  chapters: readonly Phy1159SyllabusChapter[],
  rawQuery: string,
): readonly Phy1159SyllabusChapter[] {
  const query = normalizeVietnamese(rawQuery).trim();
  if (!query) return chapters;
  return chapters.filter(ch => {
    const haystack = [
      `chuong ${ch.number}`,
      ch.title,
      ...ch.sections.map(s => `${s.code} ${s.title}`),
      ...ch.mitResources.map(m => `${m.courseCode} ${m.title} ${m.relevanceVi}`),
      ...ch.internalDocs.map(d => d.title),
    ].join(' ');
    return normalizeVietnamese(haystack).includes(query);
  });
}

export function toggleChapterCompletion(
  progress: Phy1159SyllabusProgress,
  chapterId: EntityId,
): Phy1159SyllabusProgress {
  const exists = progress.completedChapterIds.includes(chapterId);
  const completedChapterIds = exists
    ? progress.completedChapterIds.filter(id => id !== chapterId)
    : [...progress.completedChapterIds, chapterId];
  return {
    schemaVersion: 1,
    completedChapterIds,
  };
}

export function parseSyllabusProgress(raw: string | null): Phy1159SyllabusProgress {
  if (!raw) return EMPTY_SYLLABUS_PROGRESS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'schemaVersion' in parsed &&
      parsed.schemaVersion === 1 &&
      'completedChapterIds' in parsed &&
      Array.isArray(parsed.completedChapterIds)
    ) {
      const validIds = parsed.completedChapterIds.filter(
        (id): id is string => typeof id === 'string',
      );
      return {
        schemaVersion: 1,
        completedChapterIds: [...new Set(validIds)],
      };
    }
  } catch {
    // Ignore malformed stored state and fall back cleanly.
  }
  return EMPTY_SYLLABUS_PROGRESS;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readSyllabusProgress(storage: StorageLike | null): {
  readonly progress: Phy1159SyllabusProgress;
  readonly storageAvailable: boolean;
} {
  if (!storage) {
    return { progress: EMPTY_SYLLABUS_PROGRESS, storageAvailable: false };
  }
  try {
    const raw = storage.getItem(PHY1159_SYLLABUS_STORAGE_KEY);
    return { progress: parseSyllabusProgress(raw), storageAvailable: true };
  } catch {
    return { progress: EMPTY_SYLLABUS_PROGRESS, storageAvailable: false };
  }
}

export function writeSyllabusProgress(
  storage: StorageLike | null,
  progress: Phy1159SyllabusProgress,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PHY1159_SYLLABUS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
