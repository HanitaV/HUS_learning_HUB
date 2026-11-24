import { useId, useRef, type KeyboardEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { learningContent } from '../infrastructure/content/learning';
import { courseLessons } from '../core/learning/content';
import { courseWrittenPractice } from '../core/learning/written-content';
import { writtenPractice } from '../infrastructure/content/written-practice';
import { courseProgress } from '../core/learning/progress';
import { useLearningProgress } from '../app/useLearningProgress';
import { useQuestProgress } from '../app/useQuestProgress';
import { getQuestsForCourse } from '../infrastructure/quests/registry';
import { CourseAtlas } from '../components/learning/CourseAtlas';
import { NotebookLmExportControl } from '../components/learning/NotebookLmExportControl';
import { getCourseSubject } from '../core/courses/search';
import {
  courseRegistry,
  getSubjectModule,
  subjectList,
} from '../infrastructure/content/catalogue';
import { SubjectToolHost } from '../components/courses/SubjectToolHost';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ObservatoryHeader } from '../components/ui/ObservatoryHeader';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from '../components/ui/Icons';

const RIGHTS_LABEL = {
  approved: 'Đã rà soát bản quyền',
  unreviewed: 'Chưa rà soát phân phối',
  restricted: 'Giới hạn phân phối',
} as const;

export default function CoursePage() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedToolId = searchParams.get('tool');
  const requestedTrack = searchParams.get('track');
  const requestedChapterId = searchParams.get('chapter');
  const trackListId = useId();
  const practiceTabRef = useRef<HTMLButtonElement | null>(null);
  const theoryTabRef = useRef<HTMLButtonElement | null>(null);
  const { progress } = useLearningProgress();
  const { questProgress } = useQuestProgress();
  const course = courseRegistry.get(courseId ?? '');

  if (!course) {
    return (
      <div className="max-w-xl space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Tổng quan', to: '/' },
            { label: 'Học phần', to: '/courses' },
            { label: 'Không tìm thấy' },
          ]}
        />
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <h1 className="text-2xl font-semibold text-ink">Không tìm thấy học phần</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Mã học phần bạn truy cập không tồn tại trong danh mục hiện tại.
          </p>
          <Link to="/" className="hus-btn hus-btn-secondary mt-5">
            <ArrowLeftIcon width={15} height={15} />
            Về danh sách học phần
          </Link>
        </div>
      </div>
    );
  }

  const subject = getCourseSubject(course, subjectList);
  const subjectModule = getSubjectModule(course.subjectId);
  const code = course.academicCode ?? course.id;
  const isAvailable = course.status === 'available';
  const lessons = courseLessons(learningContent, course);
  const writingExercises = courseWrittenPractice(learningContent, course, writtenPractice);
  const lessonIds = lessons.map(l => l.id);
  const completedCount = lessonIds.filter(id => progress.completedLessonIds.includes(id)).length;
  const percentage = courseProgress(lessonIds, progress);

  const recentInCourse = progress.recentTopics.find(t => t.courseId === course.id);
  const nextLesson =
    (recentInCourse ? lessons.find(l => l.id === recentInCourse.lessonId) : undefined) ??
    lessons.find(l => !progress.completedLessonIds.includes(l.id)) ??
    lessons[0];

  const courseQuests = getQuestsForCourse(course.id);
  const availableTools = (subjectModule?.tools ?? []).filter(
    tool => !tool.courseIds || tool.courseIds.includes(course.id),
  );
  const hasTools = availableTools.length > 0;
  const isToolFocused = Boolean(
    requestedToolId && availableTools.some(t => t.id === requestedToolId),
  );
  const isPracticeFirst = subjectModule?.trackMode === 'practice-first' && hasTools;
  const isTheoryFirst = subjectModule?.trackMode === 'theory-first' && hasTools;
  const isDualTrack = isPracticeFirst || isTheoryFirst;
  const activeTrack: 'practice' | 'theory' = isToolFocused
    ? 'practice'
    : isTheoryFirst
      ? requestedTrack === 'practice'
        ? 'practice'
        : 'theory'
      : isPracticeFirst && requestedTrack === 'theory'
        ? 'theory'
        : 'practice';
  const practiceLabel = subjectModule?.practiceTrackLabel ?? 'Thực hành gõ code';
  const theoryLabel = subjectModule?.theoryTrackLabel ?? 'Kiến thức, Thuật toán & Hoạt ảnh';

  const handleTrackChange = (nextTrack: 'practice' | 'theory') => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('track', nextTrack);
    if (nextTrack === 'theory') {
      nextParams.delete('tool');
      nextParams.delete('preset');
    }
    setSearchParams(nextParams);
  };

  const handleTrackTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTrack: 'practice' | 'theory',
  ) => {
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowLeft' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      event.preventDefault();
      const nextTrack =
        event.key === 'Home'
          ? 'practice'
          : event.key === 'End'
            ? 'theory'
            : currentTrack === 'practice'
              ? 'theory'
              : 'practice';
      handleTrackChange(nextTrack);
      (nextTrack === 'practice' ? practiceTabRef : theoryTabRef).current?.focus();
    }
  };

  const toolsSection = hasTools ? (
    <section aria-labelledby="tools-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tools-heading" className="heading-section">
          Công cụ trực quan hóa &amp; thực hành
        </h2>
        {isToolFocused && !isPracticeFirst ? (
          <Link
            to={`/courses/${course.id}`}
            className="text-xs font-medium text-accent no-underline hover:underline"
          >
            Xem đề cương &amp; sơ đồ học phần ↓
          </Link>
        ) : null}
      </div>
      <SubjectToolHost
        courseId={course.id}
        subjectModule={subjectModule}
        autoOpenDefault={isPracticeFirst || Boolean(subjectModule?.defaultToolId)}
      />
    </section>
  ) : null;

  const questsSection =
    courseQuests.length > 0 ? (
      <section aria-labelledby="course-quests-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="course-quests-heading" className="heading-section">
            Nhiệm vụ lắp ráp tương tác (4 mốc)
          </h2>
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            {courseQuests.filter(q => questProgress.completedQuestIds.includes(q.id)).length}/
            {courseQuests.length} hoàn thành
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {courseQuests.map(quest => {
            const done = questProgress.completedQuestIds.includes(quest.id);
            return (
              <Link
                key={quest.id}
                to={`/quests/${quest.id}`}
                className="group hus-card-surface flex min-w-0 flex-col justify-between rounded-[var(--radius-xl)] border border-border bg-surface p-5 no-underline transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-starlight/60"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">☞ 4 mốc dẫn đường</Badge>
                    <Badge tone="neutral" mono>
                      ~{quest.estimatedMinutes} phút
                    </Badge>
                    {done ? <Badge tone="success">Đã chinh phục</Badge> : null}
                  </div>
                  <h3 className="font-display text-lg font-medium text-ink transition-colors group-hover:text-accent">
                    {quest.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-ink-secondary">{quest.subtitle}</p>
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <span>{done ? 'Ôn lại nhiệm vụ' : 'Bắt đầu lắp ráp từng bước'}</span>
                  <ArrowRightIcon
                    width={14}
                    height={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    ) : null;

  const writingSection =
    writingExercises.length > 0 ? (
      <section aria-labelledby="writing-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="writing-heading" className="heading-section">
            Luyện trình bày lời giải
          </h2>
          <Badge tone="accent">{writingExercises.length} bài tự luận giấy A4</Badge>
        </div>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Trình bày lập luận trên mặt giấy A4 kẻ ngang tích hợp bộ gõ ký tự đặc biệt &amp; công thức, mở gợi ý khi cần rồi tự đối chiếu rubric từng bước.
        </p>
        <ul className="divide-y divide-border border-y border-border">
          {writingExercises.map(exercise => {
            const hasDiagram = exercise.steps.some(step => step.kind === 'diagram');
            return (
              <li key={exercise.id}>
                <Link
                  to={`/courses/${course.id}/lessons/${exercise.lessonId}/practice/${exercise.id}`}
                  className="group flex min-h-[52px] items-center justify-between gap-4 py-4 text-sm font-medium text-ink no-underline hover:text-accent"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{exercise.title}</span>
                    <Badge tone={hasDiagram ? 'accent' : 'neutral'}>
                      {hasDiagram
                        ? `Giấy A4 + Biểu đồ (${exercise.steps.length} bước)`
                        : `Giấy A4 (${exercise.steps.length} bước)`}
                    </Badge>
                  </span>
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    className="shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null;

  const metadataRail = (
    <aside
      aria-label="Thông tin học phần"
      className="space-y-5 lg:sticky lg:top-24 lg:self-start"
    >
      <div className="hus-card-surface rounded-[var(--radius-xl)] border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-medium text-ink">Thông tin lưu trữ</h2>
        <dl className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between gap-3 border-b border-border pb-2.5">
            <dt className="text-ink-muted">Định danh ổn định</dt>
            <dd className="font-mono text-ink">{course.id}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-border pb-2.5">
            <dt className="text-ink-muted">Ngôn ngữ</dt>
            <dd className="text-ink">
              {course.language === 'vi' ? 'Tiếng Việt' : course.language}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-border pb-2.5">
            <dt className="text-ink-muted">Số chương</dt>
            <dd className="font-mono tabular-nums text-ink">{course.chapterIds.length}</dd>
          </div>
          {lessons.length > 0 ? (
            <div className="flex justify-between gap-3 border-b border-border pb-2.5">
              <dt className="text-ink-muted">Số bài học</dt>
              <dd className="font-mono tabular-nums text-ink">{lessons.length}</dd>
            </div>
          ) : null}
          {courseQuests.length > 0 ? (
            <div className="flex justify-between gap-3 border-b border-border pb-2.5">
              <dt className="text-ink-muted">Nhiệm vụ 4 mốc</dt>
              <dd className="font-mono tabular-nums text-ink">{courseQuests.length}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Quyền phân phối</dt>
            <dd className="text-right text-ink">{RIGHTS_LABEL[course.provenance.rights]}</dd>
          </div>
        </dl>
      </div>

      {isAvailable && lessons.length > 0 ? (
        <NotebookLmExportControl courseId={course.id} courseCode={code} />
      ) : null}

      <Link to="/" className="hus-btn hus-btn-ghost w-full justify-start px-3 text-xs">
        <ArrowLeftIcon width={14} height={14} />
        Về danh sách học phần
      </Link>
    </aside>
  );

  const atlasAndMetadata = (
    <>
      {/* Universal Celestial Course Atlas & Dependency Graph */}
      <CourseAtlas
        course={course}
        content={learningContent}
        courseQuests={courseQuests}
        completedQuestIds={questProgress.completedQuestIds}
        writtenExercises={writingExercises}
        initialChapterId={requestedChapterId}
      />

      {questsSection}

      {/* Full-width interactive subject tools (never squeezed beside the 20rem metadata rail) */}
      {!isDualTrack && !isToolFocused ? toolsSection : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          {writingSection ?? (
            <div className="rounded-[var(--radius-xl)] border border-border bg-surface/85 p-5 text-sm leading-relaxed text-ink-secondary">
              Chạm vào từng bài trong <strong className="font-medium text-ink">Sơ đồ liên kết</strong> hoặc các{' '}
              <strong className="font-medium text-ink">Nhiệm vụ 4 mốc</strong> ở trên để học tương tác theo từng chặng nhỏ.
            </div>
          )}
        </div>

        {metadataRail}
      </div>
    </>
  );

  return (
    <div className="space-y-8">
      {/* Atmospheric Observatory course masthead */}
      <ObservatoryHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Tổng quan', to: '/' },
              { label: 'Học phần', to: '/courses' },
              { label: code },
            ]}
          />
        }
        badges={
          <>
            <Badge tone="accent" mono>
              {code}
            </Badge>
            {subject ? (
              <Link
                to={`/courses?subject=${encodeURIComponent(subject.id)}`}
                className="no-underline transition-opacity hover:opacity-80"
              >
                <Badge tone="neutral">{subject.title}</Badge>
              </Link>
            ) : null}
            <Badge tone={isAvailable ? 'success' : 'warning'}>
              {isAvailable ? 'Có nội dung học' : 'Chỉ có thông tin học phần'}
            </Badge>
          </>
        }
        title={course.title}
        description={
          <p>
            Mã học phần: <span className="font-mono font-medium text-ink">{code}</span>
            {lessons.length > 0 ? (
              <span className="text-ink-muted">
                {' '}
                · {course.chapterIds.length} chương · {lessons.length} bài học
              </span>
            ) : null}
          </p>
        }
        aside={
          isAvailable && nextLesson ? (
            <Link
              to={`/courses/${course.id}/lessons/${nextLesson.id}`}
              className="hus-btn hus-btn-primary min-h-[44px] px-5"
            >
              <span>{recentInCourse || completedCount > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}</span>
              <ArrowRightIcon width={15} height={15} />
            </Link>
          ) : undefined
        }
        footer={
          isAvailable && nextLesson ? (
            completedCount > 0 ? (
              <div className="max-w-md space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-ink">Tiến độ học phần</span>
                  <span className="font-mono tabular-nums text-ink-muted">
                    {completedCount}/{lessons.length} bài · {percentage}%
                  </span>
                </div>
                <progress
                  aria-label={`Tiến độ ${course.title}`}
                  className="hus-progress"
                  max={100}
                  value={percentage}
                />
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-sm text-ink-muted">
                Bắt đầu từ bài đầu tiên hoặc chọn trực tiếp chủ đề trong đề cương bên dưới.
              </p>
            )
          ) : !isAvailable ? (
            <div className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning">
              Nội dung bài học chưa được chuyển vào nền tảng. Hiện tại trang này hiển thị thông tin định danh và nguồn dữ liệu gốc đã được xác minh.
            </div>
          ) : undefined
        }
      />

      {isDualTrack ? (
        <div className="space-y-8">
          <div className="space-y-6">
            <div
              role="tablist"
              aria-label="Chế độ học tập"
              className="inline-flex max-w-full flex-wrap gap-1.5 rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-1.5"
            >
              {(isTheoryFirst ? (['theory', 'practice'] as const) : (['practice', 'theory'] as const)).map(
                tab => {
                  const isPracticeTab = tab === 'practice';
                  const selected = activeTrack === tab;
                  return (
                    <button
                      key={tab}
                      ref={isPracticeTab ? practiceTabRef : theoryTabRef}
                      id={`${trackListId}-tab-${tab}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`${trackListId}-panel-${tab}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => handleTrackChange(tab)}
                      onKeyDown={event => handleTrackTabKeyDown(event, tab)}
                      className={`min-h-[40px] rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ${
                        selected
                          ? 'bg-surface text-accent-ink shadow-xs'
                          : 'text-ink-secondary hover:text-ink'
                      }`}
                    >
                      {isPracticeTab ? practiceLabel : theoryLabel}
                    </button>
                  );
                },
              )}
            </div>

            {activeTrack === 'practice' ? (
              <div
                id={`${trackListId}-panel-practice`}
                role="tabpanel"
                aria-labelledby={`${trackListId}-tab-practice`}
                className="space-y-6"
              >
                <SubjectToolHost
                  courseId={course.id}
                  subjectModule={subjectModule}
                  autoOpenDefault
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-ink-muted">
                  <span>Đang hiển thị không gian thực hành gõ code trực tiếp.</span>
                  <button
                    type="button"
                    onClick={() => handleTrackChange('theory')}
                    className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                  >
                    <span>Quay lại {theoryLabel}</span>
                    <ArrowRightIcon width={14} height={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                id={`${trackListId}-panel-theory`}
                role="tabpanel"
                aria-labelledby={`${trackListId}-tab-theory`}
                className="space-y-6"
              >
                <div className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-accent/25 bg-accent-subtle/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      Lộ trình học theo 4 bước: Kiến thức → Hoạt ảnh trực quan → Code từng bước → Thực hành
                    </p>
                    <p className="text-xs leading-relaxed text-ink-secondary">
                      Mỗi bài học bên dưới đều giới thiệu bài toán &amp; ý tưởng trước, minh họa bằng hoạt ảnh chạy từng bước rồi mới hướng dẫn ghép từng dòng code.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTrackChange('practice')}
                    className="hus-btn hus-btn-secondary shrink-0 text-xs"
                  >
                    <span>Mở phòng gõ code</span>
                    <ArrowRightIcon width={14} height={14} />
                  </button>
                </div>
                {atlasAndMetadata}
              </div>
            )}
          </div>

          {activeTrack === 'practice' ? atlasAndMetadata : null}
        </div>
      ) : (
        <>
          {/* When arriving via ?tool=..., elevate the full-width interactive tool directly above CourseAtlas */}
          {isToolFocused ? toolsSection : null}
          {atlasAndMetadata}
        </>
      )}
    </div>
  );
}
