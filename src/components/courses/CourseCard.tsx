import { Link } from 'react-router';
import type { Course, Subject } from '../../domain/learning';
import { Badge } from '../ui/Badge';
import { ChevronRightIcon } from '../ui/Icons';
import { AtomicCourseEmblem } from './AtomicCourseEmblem';

export interface CourseCardProps {
  readonly course: Course;
  readonly subject?: Subject | undefined;
  readonly layout?: 'grid' | 'list';
  readonly lessonCount?: number | undefined;
  readonly progressPercent?: number | undefined;
}

export function CourseCard({
  course,
  subject,
  layout = 'grid',
  lessonCount,
  progressPercent,
}: CourseCardProps) {
  const isAvailable = course.status === 'available';
  const statusLabel = isAvailable ? 'Có nội dung học' : 'Chỉ có thông tin học phần';
  const code = course.academicCode ?? course.id.toUpperCase();
  const metaSummary =
    lessonCount && lessonCount > 0
      ? `${course.chapterIds.length} tầng chương · ${lessonCount} bài học`
      : `${course.chapterIds.length} tầng chương · ${course.resourceIds.length} tài liệu`;

  if (layout === 'list') {
    return (
      <article className="group transition-colors duration-300 ease-[var(--hus-ease)] hover:bg-surface-subtle/70">
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
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent" mono>
                  {code}
                </Badge>
                {subject ? (
                  <span className="text-xs font-medium text-ink-muted">{subject.title}</span>
                ) : null}
                <Badge tone={isAvailable ? 'success' : 'warning'}>{statusLabel}</Badge>
              </div>
              <h3 className="text-base font-semibold text-ink transition-colors duration-300 ease-[var(--hus-ease)] group-hover:text-accent">
                {course.title}
              </h3>
              <p className="text-xs text-ink-muted tabular-nums">
                {metaSummary}
                {progressPercent && progressPercent > 0 ? ` · ${progressPercent}% hoàn thành` : ''}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
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
    <article className="group hus-card-surface flex flex-col rounded-[var(--radius-xl)] border border-border bg-surface transition-[border-color,transform] duration-300 ease-[var(--hus-ease)] hover:-translate-y-0.5 hover:border-border-strong active:scale-[0.99]">
      <Link
        to={`/courses/${course.id}`}
        className="flex h-full flex-col justify-between p-6 no-underline"
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <AtomicCourseEmblem
              shellCount={course.chapterIds.length}
              electronCount={lessonCount ?? 0}
              isActive={isAvailable}
              progressPercent={progressPercent}
            />
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Badge tone="accent" mono>
                {code}
              </Badge>
              <Badge tone={isAvailable ? 'success' : 'warning'}>{statusLabel}</Badge>
            </div>
          </div>

          <h3 className="mt-4 font-display text-xl font-medium leading-snug text-ink transition-colors duration-300 ease-[var(--hus-ease)] group-hover:text-accent">
            {course.title}
          </h3>

          {subject ? (
            <p className="mt-1.5 text-xs font-medium text-ink-muted">{subject.title}</p>
          ) : null}

          {progressPercent && progressPercent > 0 ? (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Tiến độ</span>
                <span className="font-mono tabular-nums">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300 ease-[var(--hus-ease)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-muted">
          <span className="tabular-nums">{metaSummary}</span>
          <span className="inline-flex items-center gap-1 font-medium text-accent">
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
