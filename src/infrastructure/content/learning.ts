import type { ExerciseDefinition, LearningContent } from '../../domain/workspace';
import { courseLessons, validateContent, validateExercises } from '../../core/learning/content';
import { courseRegistry } from './catalogue';

const manifests = import.meta.glob<LearningContent>('../../content/courses/*/content.ts', { eager: true, import: 'default' });
const parts = Object.values(manifests);
export const learningContent: LearningContent = {
  chapters: parts.flatMap(p => p.chapters), topics: parts.flatMap(p => p.topics),
  lessons: parts.flatMap(p => p.lessons), exercises: parts.flatMap(p => p.exercises), resources: parts.flatMap(p => p.resources),
};
const markdown = import.meta.glob<string>('../../content/courses/*/lessons/*.md', { query: '?raw', import: 'default' });
const lazyExerciseBanks = import.meta.glob<readonly ExerciseDefinition[]>('../../content/courses/*/exercises.ts', { import: 'default' });

const lazyExerciseCourseIds = new Set(
  Object.keys(lazyExerciseBanks)
    .map(path => path.match(/\.\.\/\.\.\/content\/courses\/([^/]+)\/exercises\.ts$/)?.[1])
    .filter((id): id is string => Boolean(id)),
);

validateContent(courseRegistry.list(), learningContent, { lazyExerciseCourseIds });
for (const lesson of learningContent.lessons) {
  if (!markdown[`../../content/courses/${lesson.content.assetPath}`]) throw new Error(`Missing lesson body: ${lesson.id}`);
}

const exerciseBankCache = new Map<string, Promise<readonly ExerciseDefinition[]>>();

export function loadCourseExercises(courseId: string): Promise<readonly ExerciseDefinition[]> {
  const loader = lazyExerciseBanks[`../../content/courses/${courseId}/exercises.ts`];
  if (!loader) {
    const course = courseRegistry.get(courseId);
    const lessonIds = new Set(courseLessons(learningContent, course).map(l => l.id));
    return Promise.resolve(learningContent.exercises.filter(e => lessonIds.has(e.lessonId)));
  }
  let cached = exerciseBankCache.get(courseId);
  if (!cached) {
    cached = loader().then(exercises => {
      const course = courseRegistry.get(courseId);
      validateExercises(courseLessons(learningContent, course), exercises);
      return exercises;
    });
    exerciseBankCache.set(courseId, cached);
  }
  return cached;
}

export async function loadLessonExercises(courseId: string, lessonId: string): Promise<readonly ExerciseDefinition[]> {
  const lesson = learningContent.lessons.find(l => l.id === lessonId);
  if (!lesson || lesson.exerciseIds.length === 0) return [];
  const all = await loadCourseExercises(courseId);
  const byId = new Map(all.map(e => [e.id, e]));
  return lesson.exerciseIds.map(id => byId.get(id)).filter((e): e is ExerciseDefinition => e !== undefined);
}

export async function loadAllLazyCourseExercises(): Promise<readonly ExerciseDefinition[]> {
  const groups = await Promise.all([...lazyExerciseCourseIds].map(id => loadCourseExercises(id)));
  return groups.flat();
}

export async function loadLessonMarkdown(lessonId: string): Promise<string> {
  const lesson = learningContent.lessons.find(l => l.id === lessonId);
  const load = lesson && markdown[`../../content/courses/${lesson.content.assetPath}`];
  if (!load) throw new Error('Không tìm thấy nội dung bài học.');
  return load();
}
