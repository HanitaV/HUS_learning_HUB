import type { SearchEntry } from '../../core/learning/search';
import { courseRegistry, subjectList } from './catalogue';
import { learningContent } from './learning';

// Imported by the lazy catalogue page, never by the application bootstrap.
const indexes = import.meta.glob<Readonly<Record<string, string>>>('../../content/courses/*/search-index.ts', { eager: true, import: 'default' });
const indexedText = new Map(Object.values(indexes).flatMap(index => Object.entries(index)));

export const searchEntries: readonly SearchEntry[] = courseRegistry.list().flatMap(course => {
  const to = `/courses/${course.id}`;
  const base = { courseId: course.id, subjectId: course.subjectId };
  const subject = subjectList.find(s => s.id === course.subjectId);
  const entries: SearchEntry[] = [{ ...base, id: course.id, title: course.title, text: `${course.academicCode ?? ''} ${subject?.title ?? ''}`, to, kind: 'course' }];
  if (subject) entries.push({ ...base, id: subject.id, title: subject.title, text: course.title, to, kind: 'subject' });
  for (const chapter of learningContent.chapters.filter(ch => ch.courseId === course.id)) {
    entries.push({ ...base, id: chapter.id, title: chapter.title, text: course.title, to, kind: 'chapter' });
    for (const topic of learningContent.topics.filter(t => chapter.topicIds.includes(t.id))) {
      const first = topic.lessonIds[0];
      entries.push({ ...base, id: topic.id, title: topic.title, text: chapter.title, to: first ? `${to}/lessons/${first}` : to, kind: 'topic' });
      for (const lesson of learningContent.lessons.filter(l => topic.lessonIds.includes(l.id))) {
        entries.push({ ...base, id: lesson.id, title: lesson.title, text: indexedText.get(lesson.id) ?? lesson.summary ?? '', to: `${to}/lessons/${lesson.id}`, kind: 'lesson' });
      }
    }
  }
  const resourceIds = new Set([...course.resourceIds, ...learningContent.lessons.filter(l => entries.some(e => e.id === l.id)).flatMap(l => l.resourceIds)]);
  for (const resource of learningContent.resources.filter(r => resourceIds.has(r.id))) entries.push({ ...base, id: resource.id, title: resource.title, text: `${resource.kind} ${resource.provenance.attribution ?? ''} ${resource.provenance.path}`, to: '/resources', kind: 'resource' });
  return entries;
});
