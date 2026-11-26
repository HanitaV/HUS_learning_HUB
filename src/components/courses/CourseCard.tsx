import { Link } from 'react-router';
import type { DisciplineTone } from '../../contracts/subject-module';
import type { Course, Subject } from '../../domain/learning';
import { isPracticeOnlyCourse } from '../../core/learning/progress';
import { Badge } from '../ui/Badge';
import { ChevronRightIcon, SparkLightbulbIcon } from '../ui/Icons';
import { AtomicCourseEmblem } from './AtomicCourseEmblem';

export interface CourseCardProps {
  readonly course: Course;
  readonly subject?: Subject | undefined;
  readonly layout?: 'grid' | 'list';
  readonly lessonCount?: number | undefined;
  readonly progressPercent?: number | undefined;
  readonly disciplineTone?: DisciplineTone | undefined;
  readonly studyBadge?: string | undefined;
  readonly studyHeadline?: string | undefined;
}

export function CourseCard({
  course,
  subject,
  layout = 'grid',
  lessonCount,
  progressPercent,
  disciplineTone,
  studyBadge,
  studyHeadline,
}: CourseCardProps) {
  const isAvailable = course.status === 'available';
  const practiceOnly = isPracticeOnlyCourse(course);
  const statusLabel = isAvailable ? 'Có nội dung học' : 'Chỉ có thông tin học phần';
  const code = course.academicCode ?? course.id.toUpperCase();
  const tone = disciplineTone ?? 'sapphire';
  const metaSummary =
    lessonCount && lessonCount > 0
      ? `${course.chapterIds.length} tầng chương · ${lessonCount} bài học`
      : `${course.chapterIds.length} tầng chương · ${course.resourceIds.length} tài liệu`;

  if (layout === 'list') {
    return (
      <article
        data-discipline={tone}
        className="group hus-disc-card transition-colors duration-300 ease-[var(--hus-ease)]"
      >
        <Link
          to={`/courses/${course.id}`}
          className="flex flex-col gap-3 px-4 py-4 no-underline sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <AtomicCourseEmblem
              shellCount={course.chapterIds.length}
              electronCount={lessonCount ?? 0}
              isActive={isAvailable}
              progressPercent={progressPercent}
              disciplineTone={disciplineTone}
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--disc-solid)] px-2 py-0.5 font-mono text-xs font-semibold text-white">
                  {code}
                </span>
                {subject ? (
                  <span className="text-xs font-medium text-[var(--disc-ink-muted)]">
                    {subject.title}
                  </span>
                ) : null}
                <Badge tone={isAvailable ? 'success' : 'warning'}>{statusLabel}</Badge>
                {practiceOnly ? <Badge tone="neutral">Chỉ luyện bài tập</Badge> : null}
              </div>
              <h3 className="text-base font-semibold text-[var(--disc-ink)] transition-colors duration-300 ease-[var(--hus-ease)] group-hover:text-[var(--disc-accent)]">
                {course.title}
              </h3>
              {studyBadge ? (
                <div className="hus-disc-pill inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium">
                  <SparkLightbulbIcon width={13} height={13} className="shrink-0" />
                  <span className="truncate">{studyBadge}</span>
                </div>
              ) : null}
              <p className="text-xs text-[var(--disc-ink-muted)] tabular-nums">
                {metaSummary}
                {progressPercent && progressPercent > 0 ? ` · ${progressPercent}% hoàn thành` : ''}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--disc-accent)]">
            Mở nguyên tử
            <ChevronRightIcon
              width={16}
              height={16}
              className="transition-transform duration-300 ease-[var(--hus-ease)] group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </article>
    );
  }

  return (
    <article
      data-discipline={tone}
      className="group hus-disc-card flex flex-col rounded-[var(--radius-xl)] border transition-[border-color,background-color,transform] duration-300 ease-[var(--hus-ease)] hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <Link
        to={`/courses/${course.id}`}
        className="flex h-full flex-col justify-between p-5 no-underline sm:p-6"
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <AtomicCourseEmblem
              shellCount={course.chapterIds.length}
              electronCount={lessonCount ?? 0}
              isActive={isAvailable}
              progressPercent={progressPercent}
              disciplineTone={disciplineTone}
            />
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--disc-solid)] px-2 py-0.5 font-mono text-xs font-semibold text-white">
                {code}
              </span>
              <Badge tone={isAvailable ? 'success' : 'warning'}>{statusLabel}</Badge>
              {practiceOnly ? <Badge tone="neutral">Chỉ luyện bài tập</Badge> : null}
            </div>
          </div>

          <h3 className="mt-4 font-display text-xl font-medium leading-snug text-[var(--disc-ink)] transition-colors duration-300 ease-[var(--hus-ease)] group-hover:text-[var(--disc-accent)]">
            {course.title}
          </h3>

          {subject ? (
            <p className="mt-1.5 text-xs font-medium text-[var(--disc-ink-muted)]">
              {subject.title}
            </p>
          ) : null}

          {studyBadge ? (
            <div className="hus-disc-pill mt-3 inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1 text-xs font-medium">
              <SparkLightbulbIcon width={13} height={13} className="shrink-0" />
              <span className="truncate">{studyBadge}</span>
            </div>
          ) : null}

          {studyHeadline ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--disc-ink-secondary)]">
              {studyHeadline}
            </p>
          ) : null}

          {progressPercent && progressPercent > 0 ? (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--disc-ink-muted)]">
                <span>Tiến độ</span>
                <span className="font-mono tabular-nums">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--disc-surface-active)]">
                <div
                  className="h-full rounded-full bg-[var(--disc-solid)] transition-[width] duration-300 ease-[var(--hus-ease)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--disc-border)] pt-3 text-xs text-[var(--disc-ink-muted)]">
          <span className="tabular-nums">{metaSummary}</span>
          <span className="inline-flex items-center gap-1 font-medium text-[var(--disc-accent)]">
            Khám phá
            <ChevronRightIcon
              width={14}
              height={14}
              className="transition-transform duration-300 ease-[var(--hus-ease)] group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}
