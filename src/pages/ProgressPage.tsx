import { useState } from 'react';
import { Link } from 'react-router';
import { useLearningProgress } from '../app/useLearningProgress';
import { useQuestProgress } from '../app/useQuestProgress';
import {
  completedCourseLessonIds,
  courseEffectiveProgress,
  effectiveCompletedLessonIds,
  subjectProgress,
} from '../core/learning/progress';
import { courseLessons } from '../core/learning/content';
import { courseRegistry, subjectList } from '../infrastructure/content/catalogue';
import { learningContent } from '../infrastructure/content/learning';
import { skillQuestList } from '../infrastructure/quests/registry';
import { progressStore } from '../infrastructure/progress/store';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { ObservatoryHeader } from '../components/ui/ObservatoryHeader';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  UploadIcon,
} from '../components/ui/Icons';

export default function ProgressPage() {
  const { progress, error } = useLearningProgress();
  const [message, setMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const { questProgress } = useQuestProgress();
  const completedQuests = skillQuestList.filter(q =>
    questProgress.completedQuestIds.includes(q.id),
  );
  const availableCourses = courseRegistry.list().filter(c => c.status === 'available');
  const effectiveCompletedIds = effectiveCompletedLessonIds(
    availableCourses,
    learningContent,
    progress,
  );
  const visits = progress.recentTopics.flatMap(t => {
    const course = courseRegistry.get(t.courseId);
    const lesson = courseLessons(learningContent, course).find(l => l.id === t.lessonId);
    return lesson && course
      ? [{ ...t, title: lesson.title, courseCode: course.academicCode ?? course.id }]
      : [];
  });
  const hasAnyProgress =
    progress.completedLessonIds.length > 0 ||
    progress.attempts.length > 0 ||
    completedQuests.length > 0;

  const exportBackup = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hus-progress-v1.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-8">
      <ObservatoryHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Tổng quan', to: '/' }, { label: 'Tiến độ học tập' }]} />
        }
        title="Tiến độ học tập"
        description={
          <p>
            Tiến độ lưu cục bộ trên trình duyệt này.{' '}
            <span className="font-medium text-ink tabular-nums">
              {effectiveCompletedIds.length} bài đã hoàn thành
            </span>{' '}
            ·{' '}
            <span className="font-medium text-ink tabular-nums">
              {progress.attempts.length} lượt làm bài
            </span>
          </p>
        }
      />

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning"
        >
          <AlertCircleIcon width={16} height={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Unified Observatory local telemetry strip */}
      <dl className="hus-card-surface grid grid-cols-1 divide-y divide-border overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-6 py-5">
          <dt className="text-xs font-medium text-ink-muted">Bài học hoàn thành</dt>
          <dd className="mt-1.5 font-mono text-3xl font-semibold tabular-nums text-ink">
            {effectiveCompletedIds.length}
          </dd>
        </div>
        <div className="px-6 py-5">
          <dt className="text-xs font-medium text-ink-muted">Lượt làm bài tập</dt>
          <dd className="mt-1.5 font-mono text-3xl font-semibold tabular-nums text-ink">
            {progress.attempts.length}
          </dd>
        </div>
        <div className="px-6 py-5">
          <dt className="text-xs font-medium text-ink-muted">Nhiệm vụ 4 mốc hoàn thành</dt>
          <dd className="mt-1.5 font-mono text-3xl font-semibold tabular-nums text-ink">
            {completedQuests.length}/{skillQuestList.length}
          </dd>
        </div>
      </dl>

      {!hasAnyProgress ? (
        <EmptyState
          icon={<CheckCircleIcon width={18} height={18} />}
          title="Chưa có dữ liệu tiến độ học tập"
          description="Khi bạn hoàn thành bài giảng hoặc làm bài tập tự luyện, tiến độ thực tế trên trình duyệt này sẽ được cập nhật tại đây."
          action={
            <Link to="/courses" className="hus-btn hus-btn-secondary">
              Khám phá học phần
              <ChevronRightIcon width={15} height={15} />
            </Link>
          }
        />
      ) : null}

      {/* Course progress & Subject progress */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section aria-label="Tiến độ học phần" className="space-y-4 lg:col-span-2">
          <h2 className="heading-section">Tiến độ theo học phần</h2>
          <div className="hus-card-surface overflow-hidden divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface">
            {availableCourses.map(course => {
              const lessons = courseLessons(learningContent, course);
              const completedCount = completedCourseLessonIds(course, lessons, progress).length;
              const percentage = courseEffectiveProgress(course, lessons, progress);

              return (
                <article key={course.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone="accent" mono>
                          {course.academicCode ?? course.id}
                        </Badge>
                        <span className="font-mono text-xs tabular-nums text-ink-muted">
                          {completedCount}/{lessons.length} bài
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-ink">
                        <Link
                          to={`/courses/${course.id}`}
                          className="text-ink no-underline hover:text-accent hover:underline"
                        >
                          {course.title}
                        </Link>
                      </h3>
                    </div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                      {percentage}%
                    </p>
                  </div>
                  <progress
                    className="hus-progress mt-3"
                    aria-label={`Tiến độ ${course.title}`}
                    max={100}
                    value={percentage}
                  />
                </article>
              );
            })}
          </div>
        </section>

        <section aria-label="Tiến độ theo môn" className="space-y-4">
          <h2 className="heading-section">Tiến độ theo môn</h2>
          <div className="hus-card-surface rounded-[var(--radius-xl)] border border-border bg-surface p-5">
            <ul className="divide-y divide-border">
              {subjectList.map(subject => {
                const hasAvailable = courseRegistry
                  .list()
                  .some(c => c.subjectId === subject.id && c.status === 'available');
                const pct = hasAvailable
                  ? subjectProgress(learningContent, courseRegistry.list(), subject.id, progress)
                  : null;
                return (
                  <li
                    key={subject.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="font-medium text-ink">{subject.title}</span>
                    <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                      {pct !== null ? `${pct}% hoàn thành` : 'Chưa có bài học'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>

      {/* Recent topics */}
      <section aria-labelledby="recent-topics-heading" className="space-y-4">
        <h2 id="recent-topics-heading" className="heading-section">
          Chủ đề gần đây
        </h2>
        {visits.length > 0 ? (
          <ul className="hus-card-surface overflow-hidden divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface">
            {visits.map(topic => (
              <li key={topic.topicId}>
                <Link
                  to={`/courses/${topic.courseId}/lessons/${topic.lessonId}`}
                  className="group flex min-h-[48px] items-center justify-between gap-3 px-4 py-3 no-underline transition-colors duration-200 hover:bg-surface-subtle/70 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ClockIcon width={15} height={15} className="shrink-0 text-ink-muted" />
                    <span className="truncate text-sm font-medium text-ink group-hover:text-accent">
                      {topic.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral" mono>
                      {topic.courseCode}
                    </Badge>
                    <ChevronRightIcon width={14} height={14} className="text-ink-muted" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-subtle/60 px-4 py-3 text-xs text-ink-muted">
            Chưa có chủ đề nào được mở gần đây.
          </p>
        )}
      </section>

      {/* Completed 4-milestone Quests */}
      <section aria-labelledby="completed-quests-heading" className="space-y-4">
        <div className="flex items-baseline gap-2.5">
          <h2 id="completed-quests-heading" className="heading-section">
            Nhiệm vụ lắp ráp 4 mốc
          </h2>
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            ({completedQuests.length}/{skillQuestList.length})
          </span>
        </div>
        {completedQuests.length > 0 ? (
          <ul className="hus-card-surface overflow-hidden divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface">
            {completedQuests.map(quest => {
              const course = courseRegistry.get(quest.courseId);
              return (
                <li key={quest.id}>
                  <Link
                    to={`/quests/${quest.id}`}
                    className="group flex min-h-[48px] items-center justify-between gap-3 px-4 py-3.5 no-underline transition-colors duration-200 hover:bg-surface-subtle/70 sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent-subtle text-accent-ink">
                        <CheckCircleIcon width={16} height={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink group-hover:text-accent">
                          {quest.title}
                        </p>
                        <p className="truncate text-xs text-ink-secondary">
                          {quest.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {course ? (
                        <Badge tone="accent" mono>
                          {course.academicCode ?? course.id}
                        </Badge>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                        Ôn lại nhiệm vụ
                        <ArrowRightIcon width={14} height={14} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<CheckCircleIcon width={18} height={18} />}
            title="Chưa chinh phục nhiệm vụ 4 mốc nào"
            description="Chọn một đích đến trong Vũ trụ Mục tiêu ở trang chủ để bắt đầu lắp ráp kiến thức từng bước."
            action={
              <Link to="/" className="hus-btn hus-btn-secondary">
                Mở Vũ trụ Mục tiêu
                <ArrowRightIcon width={15} height={15} />
              </Link>
            }
          />
        )}
      </section>

      {/* Backup & Restore */}
      <section className="hus-card-surface space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-7">
        <div>
          <h2 className="heading-section">Sao lưu &amp; khôi phục dữ liệu</h2>
          <p className="mt-1.5 max-w-prose text-sm text-ink-secondary">
            Dữ liệu học tập chỉ lưu cục bộ trên trình duyệt này (giữ tối đa 20 chủ đề gần đây và
            1.000 lượt làm bài). Khi khôi phục, tệp JSON sẽ được kiểm tra hợp lệ trước khi thay thế
            dữ liệu hiện tại.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={exportBackup}
            className="hus-btn hus-btn-secondary shrink-0"
          >
            <DownloadIcon width={15} height={15} />
            Xuất bản sao lưu JSON
          </button>

          <label className="flex min-h-[44px] flex-1 cursor-pointer flex-col justify-center rounded-[var(--radius-md)] border border-dashed border-border-strong bg-canvas px-4 py-3 text-sm transition-colors duration-200 hover:border-accent">
            <span className="inline-flex items-center gap-2 font-medium text-ink">
              <UploadIcon width={15} height={15} className="text-ink-muted" />
              Khôi phục bản sao lưu JSON
            </span>
            <input
              className="mt-2 block w-full max-w-full text-xs text-ink-muted file:mr-3 file:rounded-[var(--radius-sm)] file:border file:border-border file:bg-surface file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink hover:file:border-border-strong"
              type="file"
              accept=".json,application/json"
              onChange={async event => {
                const file = event.target.files?.[0];
                if (!file) return;
                const input = event.currentTarget;
                setImportError(null);
                setMessage(null);
                try {
                  if (file.size > 5_000_000) throw new Error('Tệp vượt quá 5 MB.');
                  progressStore.restore(await file.text());
                  setMessage('Đã khôi phục dữ liệu vào phiên hiện tại.');
                } catch (e) {
                  setImportError(e instanceof Error ? e.message : 'Không thể đọc tệp.');
                }
                input.value = '';
              }}
            />
          </label>
        </div>

        {importError ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger"
          >
            {importError}
          </p>
        ) : null}
        {message ? (
          <p
            role="status"
            className="rounded-[var(--radius-md)] border border-success/30 bg-success-subtle px-4 py-3 text-sm text-success"
          >
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
