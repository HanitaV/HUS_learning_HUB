import { resolveCourseConventionCanon } from '../../content/curriculum-canons';
import { getCourseSubject } from '../../core/courses/search';
import { courseLessons } from '../../core/learning/content';
import { buildNotebookLmCourseBundle } from '../../core/learning/curriculum-rag';
import {
  buildExerciseMetadataLookup,
  buildStudyDiagnosticsReport,
  formatMistakeLedgerMarkdown,
} from '../../core/learning/study-diagnostics';
import type { EntityId } from '../../domain/learning';
import { courseRegistry, subjectList } from '../content/catalogue';
import { learningContent, loadCourseExercises, loadLessonMarkdown } from '../content/learning';
import { writtenPractice } from '../content/written-practice';
import { progressStore } from '../progress/store';
import { scanAllStoredTutorFeedbackRecords } from './tutor-feedback-parser';

export type NotebookLmExportMode = 'syllabus' | 'study-pack' | 'mistake-ledger';

export async function generateCourseNotebookBundle(
  courseId: EntityId,
  options?: {
    readonly filterChapterId?: EntityId | undefined;
    readonly mode?: NotebookLmExportMode | undefined;
  },
): Promise<{ readonly filename: string; readonly markdown: string; readonly lessonCount: number }> {
  const course = courseRegistry.get(courseId);
  if (!course) {
    throw new Error('Không tìm thấy học phần để xuất sổ tay giáo trình.');
  }

  const mode = options?.mode ?? 'syllabus';
  const subject = getCourseSubject(course, subjectList);
  const canon = resolveCourseConventionCanon({
    courseId: course.id,
    academicCode: course.academicCode,
    subjectId: course.subjectId,
    courseTitle: course.title,
  });

  if (mode === 'mistake-ledger') {
    const courseExercises = await loadCourseExercises(courseId).catch(() => []);
    const lookup = buildExerciseMetadataLookup({
      courses: courseRegistry.list(),
      content: learningContent,
      exercises: [...courseExercises, ...writtenPractice],
    });
    const report = buildStudyDiagnosticsReport({
      courses: [course],
      content: learningContent,
      progress: progressStore.getSnapshot().progress,
      tutorRecords: scanAllStoredTutorFeedbackRecords(),
      exerciseLookup: lookup,
    });
    const code = (course.academicCode ?? course.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    return {
      filename: `${code}-so-loi-sai-notebooklm.md`,
      markdown: formatMistakeLedgerMarkdown(report, {
        courseId: course.id,
        courseLabel: `${canon.academicCode} — ${course.title}`,
      }),
      lessonCount: report.mistakeEntries.length,
    };
  }

  const targetLessons = courseLessons(learningContent, course).filter(lesson => {
    if (!options?.filterChapterId) return true;
    const topic = learningContent.topics.find(t => t.id === lesson.topicId);
    return topic?.chapterId === options.filterChapterId;
  });

  const [loadedPairs, courseExercises] = await Promise.all([
    Promise.all(
      targetLessons.map(async lesson => {
        try {
          const md = await loadLessonMarkdown(lesson.id);
          return [lesson.id, md] as const;
        } catch {
          return null;
        }
      }),
    ),
    mode === 'study-pack' ? loadCourseExercises(courseId).catch(() => []) : Promise.resolve([]),
  ]);

  const markdownByLessonId: Record<string, string> = {};
  for (const pair of loadedPairs) {
    if (pair) {
      markdownByLessonId[pair[0]] = pair[1];
    }
  }

  const combinedExercises =
    mode === 'study-pack'
      ? [...courseExercises, ...writtenPractice.filter(w => targetLessons.some(l => l.id === w.lessonId))]
      : [];

  return buildNotebookLmCourseBundle({
    course,
    subjectTitle: subject?.title,
    canon,
    content: learningContent,
    markdownByLessonId,
    filterChapterId: options?.filterChapterId,
    exercises: combinedExercises,
    bundleMode: mode,
  });
}

export function downloadMarkdownBundle(filename: string, markdown: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
