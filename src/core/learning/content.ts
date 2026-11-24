import type { Course, Lesson } from '../../domain/learning';
import type { ExerciseDefinition, LearningContent } from '../../domain/workspace';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function courseLessons(content: LearningContent, course: Course | undefined): readonly Lesson[] {
  if (!course) return [];
  return course.chapterIds.flatMap(id => content.chapters.filter(ch => ch.id === id && ch.courseId === course.id)).flatMap(ch => ch.topicIds.flatMap(id => {
    const topic = content.topics.find(t => t.id === id);
    return (topic?.lessonIds ?? []).flatMap(id => content.lessons.filter(l => l.id === id));
  }));
}

export function validateExercises(
  lessons: readonly Lesson[],
  exercises: readonly ExerciseDefinition[],
): void {
  function requireRef(condition: boolean, id: string) { if (!condition) throw new Error(`Invalid content reference: ${id}`); }
  function unique(ids: readonly string[]) { requireRef(new Set(ids).size === ids.length, ids.join(',')); }

  const seen = new Set<string>();
  for (const exercise of exercises) {
    if (!ID_PATTERN.test(exercise.id) || seen.has(exercise.id)) throw new Error(`Invalid/duplicate content ID: ${exercise.id}`);
    seen.add(exercise.id);
  }
  for (const lesson of lessons) {
    unique(lesson.exerciseIds);
    for (const id of lesson.exerciseIds) requireRef(exercises.some(e => e.id === id && e.lessonId === lesson.id), id);
  }
  for (const exercise of exercises) {
    requireRef(lessons.some(l => l.id === exercise.lessonId && l.exerciseIds.includes(exercise.id)), exercise.id);
    if (exercise.kind === 'semi-essay') {
      requireRef(exercise.steps.length > 0, exercise.id);
      const anchorIds = exercise.theoryAnchors.map(a => a.id);
      unique(anchorIds);
      const anchorSet = new Set(anchorIds);
      const stepIds = exercise.steps.map(s => s.id);
      unique(stepIds);
      for (const step of exercise.steps) {
        requireRef(step.theoryAnchorIds.every(id => anchorSet.has(id)), `${exercise.id}:${step.id}`);
        if (step.kind === 'written-reasoning') {
          requireRef(step.modelAnswer.trim().length > 0 && step.rubric.length > 0, `${exercise.id}:${step.id}`);
          unique(step.rubric.map(item => item.id));
          requireRef(step.rubric.every(item => ID_PATTERN.test(item.id) && item.prompt.trim().length > 0), `${exercise.id}:${step.id}`);
        } else if (step.kind === 'choice-reasoning') {
          unique(step.choices.map(c => c.id));
          requireRef(step.answers.length > 0 && step.answers.every(a => step.choices.some(c => c.id === a)), `${exercise.id}:${step.id}`);
        } else if (step.kind === 'diagram') {
          requireRef(step.diagramKind === step.spec.kind, `${exercise.id}:${step.id}`);
        } else if (step.kind === 'equation-transform') {
          requireRef(step.stages.length > 0, `${exercise.id}:${step.id}`);
          for (const stage of step.stages) {
            requireRef(stage.operations.some(op => op.optimal), `${exercise.id}:${step.id}:${stage.id}`);
          }
        } else if (step.kind === 'numeric-unit') {
          requireRef(step.fields.length > 0, `${exercise.id}:${step.id}`);
        } else if (step.kind === 'axis-projection') {
          requireRef(step.axes.length > 0, `${exercise.id}:${step.id}`);
        }
      }
      continue;
    }
    requireRef(exercise.answers.length > 0 && exercise.answers.every(a => a.trim().length > 0), exercise.id);
    unique(exercise.answers);
    if (exercise.kind !== 'short-answer') {
      unique(exercise.choices.map(c => c.id));
      requireRef(exercise.choices.every(c => /^[a-z0-9-]+$/.test(c.id)), exercise.id);
      requireRef(exercise.answers.every(a => exercise.choices.some(c => c.id === a)), exercise.id);
      if (exercise.kind === 'multiple-choice') requireRef(exercise.answers.length === 1, exercise.id);
    }
  }
}

export function validateContent(
  courses: readonly Course[],
  content: LearningContent,
  options?: { readonly lazyExerciseCourseIds?: ReadonlySet<string> },
): void {
  const lazyCourses = options?.lazyExerciseCourseIds ?? new Set<string>();
  const all = [...content.chapters, ...content.topics, ...content.lessons, ...content.exercises, ...content.resources];
  const seen = new Set<string>();
  for (const item of all) {
    if (!ID_PATTERN.test(item.id) || seen.has(item.id)) throw new Error(`Invalid/duplicate content ID: ${item.id}`);
    seen.add(item.id);
  }
  function requireRef(condition: boolean, id: string) { if (!condition) throw new Error(`Invalid content reference: ${id}`); }
  function unique(ids: readonly string[]) { requireRef(new Set(ids).size === ids.length, ids.join(',')); }
  const safePath = (path: string) => !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(p => p === '..' || p === '.') && !/[:?#%]/.test(path);
  for (const course of courses) {
    unique(course.chapterIds); unique(course.resourceIds);
    for (const id of course.chapterIds) requireRef(content.chapters.some(ch => ch.id === id && ch.courseId === course.id), id);
    for (const id of course.resourceIds) requireRef(content.resources.some(r => r.id === id), id);
    if (course.status === 'available') requireRef(courseLessons(content, course).length > 0, course.id);
  }
  for (const chapter of content.chapters) {
    requireRef(courses.some(c => c.id === chapter.courseId && c.chapterIds.includes(chapter.id)), chapter.id);
    unique(chapter.topicIds);
    for (const id of chapter.topicIds) requireRef(content.topics.some(t => t.id === id && t.chapterId === chapter.id), id);
  }
  for (const topic of content.topics) {
    requireRef(content.chapters.some(ch => ch.id === topic.chapterId && ch.topicIds.includes(topic.id)), topic.id);
    unique(topic.lessonIds); unique(topic.prerequisiteIds ?? []);
    for (const id of topic.lessonIds) requireRef(content.lessons.some(l => l.id === id && l.topicId === topic.id), id);
    for (const id of topic.prerequisiteIds ?? []) requireRef(content.topics.some(t => t.id === id), id);
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error(`Prerequisite cycle: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of content.topics.find(t => t.id === id)?.prerequisiteIds ?? []) visit(prerequisite);
    visiting.delete(id); visited.add(id);
  }
  for (const topic of content.topics) visit(topic.id);

  const lazyLessonIds = new Set(
    courses
      .filter(c => lazyCourses.has(c.id))
      .flatMap(c => courseLessons(content, c).map(l => l.id)),
  );
  const eagerLessons: Lesson[] = [];
  const seenLazyExerciseIds = new Set<string>();

  for (const lesson of content.lessons) {
    requireRef(content.topics.some(t => t.id === lesson.topicId && t.lessonIds.includes(lesson.id)), lesson.id);
    requireRef(safePath(lesson.content.assetPath), lesson.id);
    unique(lesson.exerciseIds); unique(lesson.resourceIds);
    for (const id of lesson.resourceIds) requireRef(content.resources.some(r => r.id === id), id);
    if (lazyLessonIds.has(lesson.id)) {
      for (const id of lesson.exerciseIds) {
        if (!ID_PATTERN.test(id) || seen.has(id) || seenLazyExerciseIds.has(id)) {
          throw new Error(`Invalid/duplicate content ID: ${id}`);
        }
        seenLazyExerciseIds.add(id);
      }
    } else {
      eagerLessons.push(lesson);
    }
  }
  validateExercises(eagerLessons, content.exercises);
  for (const resource of content.resources) {
    requireRef(Boolean(resource.url || resource.assetPath), resource.id);
    if (resource.url) requireRef(/^https:\/\//.test(resource.url), resource.id);
    if (resource.assetPath) requireRef(safePath(resource.assetPath) && resource.provenance.rights === 'approved', resource.id);
    if (resource.pages) requireRef(resource.pages.every(p => Number.isInteger(p) && p > 0), resource.id);
  }
}
