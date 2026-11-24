import type { EntityId } from '../../domain/learning';
import type { SkillQuest } from '../../domain/skill-quest';

const questModules = import.meta.glob<readonly SkillQuest[]>('../../content/quests/*.ts', {
  eager: true,
  import: 'default',
});

export const skillQuestList: readonly SkillQuest[] = Object.values(questModules).flat();

const questById = new Map<EntityId, SkillQuest>(skillQuestList.map(q => [q.id, q]));

export function getSkillQuest(id: EntityId): SkillQuest | undefined {
  return questById.get(id);
}

export function getQuestsForCourse(courseId: EntityId): readonly SkillQuest[] {
  return skillQuestList.filter(q => q.courseId === courseId);
}

export function getQuestsForLesson(lessonId: EntityId): readonly SkillQuest[] {
  return skillQuestList.filter(q => q.lessonId === lessonId);
}
