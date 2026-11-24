import type { Course, EntityId, Subject } from '../../domain/learning';
import type { SubjectModule } from '../../contracts/subject-module';
import { subjects } from '../../content/subjects';
import { subjectModules } from '../../modules/subjects';
import { createCourseRegistry } from '../../core/courses/registry';

// Metadata only: heavy lesson bodies and tool code must be loaded on demand.
const manifests = import.meta.glob<Course>('../../content/courses/*/course.ts', {
  eager: true,
  import: 'default',
});

export const subjectList: readonly Subject[] = Object.freeze([...subjects]);

export const courseRegistry = createCourseRegistry(Object.values(manifests), subjectList);

const moduleBySubjectId = new Map<EntityId, SubjectModule>(
  subjectModules.map(mod => [mod.subjectId, mod]),
);

export function getSubjectModule(subjectId: EntityId): SubjectModule | undefined {
  return moduleBySubjectId.get(subjectId);
}
