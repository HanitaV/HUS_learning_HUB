import { resolveCourseConventionCanon } from '../../content/curriculum-canons';
import { getCourseSubject } from '../../core/courses/search';
import { courseLessons } from '../../core/learning/content';
import { buildNotebookLmCourseBundle } from '../../core/learning/curriculum-rag';
import type { EntityId } from '../../domain/learning';
import { courseRegistry, subjectList } from '../content/catalogue';
import { learningContent, loadLessonMarkdown } from '../content/learning';

export async function generateCourseNotebookBundle(
  courseId: EntityId,
  options?: { readonly filterChapterId?: EntityId | undefined },
): Promise<{ readonly filename: string; readonly markdown: string; readonly lessonCount: number }> {
  const course = courseRegistry.get(courseId);
  if (!course) {
    throw new Error('Không tìm thấy học phần để xuất sổ tay giáo trình.');
  }

  const subject = getCourseSubject(course, subjectList);
  const canon = resolveCourseConventionCanon({
    courseId: course.id,
    academicCode: course.academicCode,
    subjectId: course.subjectId,
    courseTitle: course.title,
  });

  const targetLessons = courseLessons(learningContent, course).filter(lesson => {
    if (!options?.filterChapterId) return true;
    const topic = learningContent.topics.find(t => t.id === lesson.topicId);
    return topic?.chapterId === options.filterChapterId;
  });

  const loadedPairs = await Promise.all(
    targetLessons.map(async lesson => {
      try {
        const md = await loadLessonMarkdown(lesson.id);
        return [lesson.id, md] as const;
      } catch {
        return null;
      }
    }),
  );

  const markdownByLessonId: Record<string, string> = {};
  for (const pair of loadedPairs) {
    if (pair) {
      markdownByLessonId[pair[0]] = pair[1];
    }
  }

  return buildNotebookLmCourseBundle({
    course,
    subjectTitle: subject?.title,
    canon,
    content: learningContent,
    markdownByLessonId,
    filterChapterId: options?.filterChapterId,
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
