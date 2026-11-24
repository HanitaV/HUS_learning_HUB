import { Link } from 'react-router';
import type { LearningContent } from '../../domain/workspace';
import type { Course } from '../../domain/learning';
import { useLearningProgress } from '../../app/useLearningProgress';
import { Badge } from '../ui/Badge';
import { CheckCircleIcon, ChevronRightIcon } from '../ui/Icons';

export function CourseSyllabus({
  course,
  content,
}: {
  readonly course: Course;
  readonly content: LearningContent;
}) {
  const { progress } = useLearningProgress();

  const chapters = course.chapterIds.flatMap(id => content.chapters.filter(ch => ch.id === id));

  return (
    <ol className="space-y-4">
      {chapters.map((chapter, chapterIndex) => {
        const topics = chapter.topicIds
          .map(id => content.topics.find(t => t.id === id))
          .filter(t => t !== undefined);

        const chapterLessons = topics.flatMap(topic =>
          topic.lessonIds
            .map(id => content.lessons.find(l => l.id === id))
            .filter(l => l !== undefined),
        );
        const completedInChapter = chapterLessons.filter(l =>
          progress.completedLessonIds.includes(l.id),
        ).length;

        return (
          <li
            key={chapter.id}
            className="hus-card-surface overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-subtle/55 px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-muted">Chương {chapterIndex + 1}</p>
                <h3 className="mt-0.5 font-display text-lg font-medium text-ink">
                  {chapter.title}
                </h3>
              </div>
              {chapterLessons.length > 0 ? (
                <Badge
                  tone={completedInChapter === chapterLessons.length ? 'success' : 'neutral'}
                  mono
                >
                  {completedInChapter}/{chapterLessons.length} bài
                </Badge>
              ) : null}
            </div>

            <ul className="divide-y divide-border">
              {topics.map(topic => {
                const topicLessons = topic.lessonIds
                  .map(id => content.lessons.find(l => l.id === id))
                  .filter(l => l !== undefined);
                const prereqs = (topic.prerequisiteIds ?? [])
                  .map(id => content.topics.find(t => t.id === id))
                  .filter(t => t !== undefined);

                const hideDuplicateTopicTitle =
                  topicLessons.length === 1 && topicLessons[0]?.title === topic.title;

                return (
                  <li key={topic.id} className="px-4 py-3 sm:px-5">
                    {!hideDuplicateTopicTitle || prereqs.length > 0 ? (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        {!hideDuplicateTopicTitle ? (
                          <p className="text-xs font-medium text-ink-muted">{topic.title}</p>
                        ) : null}
                        {prereqs.length > 0 ? (
                          <span className="text-xs text-ink-muted">
                            Tiên quyết: {prereqs.map(p => p.title).join(', ')}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <ul className="space-y-1">
                      {topicLessons.map(lesson => {
                        const isCompleted = progress.completedLessonIds.includes(lesson.id);
                        return (
                          <li key={lesson.id}>
                            <Link
                              to={`/courses/${course.id}/lessons/${lesson.id}`}
                              aria-label={lesson.title}
                              className="group flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-md)] px-2.5 py-2 no-underline transition-colors duration-200 hover:bg-surface-subtle"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                {isCompleted ? (
                                  <CheckCircleIcon
                                    width={16}
                                    height={16}
                                    className="shrink-0 text-success"
                                  />
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0 rounded-full border border-border-strong bg-canvas"
                                  />
                                )}
                                <span className="min-w-0 flex-1 text-sm font-medium text-ink transition-colors duration-200 group-hover:text-accent">
                                  {lesson.title}
                                </span>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {lesson.exerciseIds.length > 0 ? (
                                  <span className="rounded-[var(--radius-sm)] border border-border bg-canvas px-2 py-0.5 font-mono text-xs text-ink-muted">
                                    <span className="sm:hidden">{lesson.exerciseIds.length} BT</span>
                                    <span className="hidden sm:inline">
                                      {lesson.exerciseIds.length} bài tập
                                    </span>
                                  </span>
                                ) : null}
                                <ChevronRightIcon
                                  width={15}
                                  height={15}
                                  className="text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                                />
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
