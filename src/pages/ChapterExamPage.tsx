import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import type {
  ChapterExamDraft,
  ChapterExamLengthPreset,
  ExerciseFormKind,
} from '../domain/chapter-exam';
import type { MathSymbol, MathSymbolContext, MathSymbolInsertMode } from '../domain/math-symbols';
import type { ClassicExerciseDefinition, ExerciseDefinition } from '../domain/workspace';
import { useMathSymbolPreferences } from '../app/useMathSymbolPreferences';
import {
  buildChapterExamPaper,
  evaluateChapterExam,
  extractWrittenStepsForExam,
  summarizeChapterExamPool,
} from '../core/learning/chapter-exam';
import {
  applyShorthandSuggestion,
  detectActiveBackslashQuery,
  filterShorthandSuggestions,
  renderTextByMathMode,
  shouldAutoShowMathPreview,
  type ActiveBackslashQuery,
  type MathShorthandEntry,
} from '../core/learning/math-shorthand';
import { insertMathSymbolAtCursor } from '../core/learning/math-symbols';
import { courseRegistry } from '../infrastructure/content/catalogue';
import { learningContent, loadCourseExercises } from '../infrastructure/content/learning';
import {
  clearStoredChapterExamSession,
  loadStoredChapterExamSession,
  saveStoredChapterExamSession,
} from '../infrastructure/progress/chapter-exam-store';
import { progressStore } from '../infrastructure/progress/store';
import Markdown from '../components/learning/Markdown';
import { MathSlashAutocomplete } from '../components/learning/MathSlashAutocomplete';
import { MathSymbolToolbar } from '../components/learning/MathSymbolToolbar';
import { RuledA4Sheet } from '../components/learning/RuledA4Sheet';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  RotateCcwIcon,
} from '../components/ui/Icons';
import { PageSkeleton } from '../components/ui/Skeleton';

const FORM_LABEL: Readonly<Record<ExerciseFormKind, string>> = {
  'multiple-choice': 'Trắc nghiệm 1 đáp án',
  'multiple-answer': 'Chọn nhiều đáp án',
  'short-answer': 'Trả lời ngắn',
  'semi-essay': 'Tự luận giấy A4',
};

const PRESET_META: readonly {
  readonly id: ChapterExamLengthPreset;
  readonly label: string;
  readonly desc: string;
}[] = [
  { id: 'short', label: 'Đề ngắn', desc: 'Ôn nhanh mỗi dạng' },
  { id: 'standard', label: 'Đề tiêu chuẩn', desc: 'Cân bằng toàn chương' },
  { id: 'comprehensive', label: 'Đề đầy đủ', desc: 'Bao quát sâu các bài' },
];

const EMPTY_DRAFT: ChapterExamDraft = {
  objectiveAnswers: {},
  writtenResponses: {},
  checkedRubricIds: {},
};

export default function ChapterExamPage() {
  const { courseId, chapterId } = useParams();
  const course = courseRegistry.get(courseId ?? '');
  const chapterIndex = course ? course.chapterIds.indexOf(chapterId ?? '') : -1;
  const chapter =
    course && chapterIndex >= 0
      ? learningContent.chapters.find(ch => ch.id === chapterId)
      : undefined;

  const chapterLessons = useMemo(() => {
    if (!chapter) return [];
    return chapter.topicIds
      .flatMap(tid => learningContent.topics.find(t => t.id === tid)?.lessonIds ?? [])
      .flatMap(lid => learningContent.lessons.filter(l => l.id === lid));
  }, [chapter]);

  const lessonOrder = useMemo(() => chapterLessons.map(l => l.id), [chapterLessons]);
  const lessonById = useMemo(
    () => new Map(chapterLessons.map(l => [l.id, l])),
    [chapterLessons],
  );

  const nextChapter = useMemo(() => {
    if (!course || chapterIndex < 0) return undefined;
    const nextId = course.chapterIds[chapterIndex + 1];
    return nextId ? learningContent.chapters.find(ch => ch.id === nextId) : undefined;
  }, [course, chapterIndex]);

  const symbolContext = useMemo<MathSymbolContext | undefined>(() => {
    if (!course || !chapter) return undefined;
    return {
      subjectId: course.subjectId,
      courseId: course.id,
      chapterId: chapter.id,
      chapterLabel: chapter.title,
      courseLabel: course.title,
    };
  }, [course, chapter]);

  const [chapterExercises, setChapterExercises] = useState<
    readonly ExerciseDefinition[] | null | undefined
  >(undefined);

  useEffect(() => {
    let active = true;
    if (!course || !chapter) {
      setChapterExercises(null);
      return;
    }
    setChapterExercises(undefined);
    const lessonIdSet = new Set(lessonOrder);
    loadCourseExercises(course.id)
      .then(all => {
        if (!active) return;
        setChapterExercises(all.filter(ex => lessonIdSet.has(ex.lessonId)));
      })
      .catch(() => {
        if (active) setChapterExercises(null);
      });
    return () => {
      active = false;
    };
  }, [course, chapter, lessonOrder]);

  const storedInitial = useMemo(
    () =>
      course && chapter ? loadStoredChapterExamSession(course.id, chapter.id) : null,
    [course, chapter],
  );

  const [preset, setPreset] = useState<ChapterExamLengthPreset>(
    () => storedInitial?.preset ?? 'standard',
  );
  const [customCount, setCustomCount] = useState<number | undefined>(
    () => storedInitial?.customCount,
  );
  const [seed, setSeed] = useState<number>(() => storedInitial?.seed ?? 1);
  const [submitted, setSubmitted] = useState<boolean>(() => storedInitial?.submitted ?? false);
  const [draft, setDraft] = useState<ChapterExamDraft>(
    () => storedInitial?.draft ?? EMPTY_DRAFT,
  );

  // Reset state if route params change between chapters
  const [activeKey, setActiveKey] = useState(`${courseId ?? ''}:${chapterId ?? ''}`);
  const currentKey = `${courseId ?? ''}:${chapterId ?? ''}`;
  if (currentKey !== activeKey) {
    setActiveKey(currentKey);
    const nextStored =
      course && chapter ? loadStoredChapterExamSession(course.id, chapter.id) : null;
    setPreset(nextStored?.preset ?? 'standard');
    setCustomCount(nextStored?.customCount);
    setSeed(nextStored?.seed ?? 1);
    setSubmitted(nextStored?.submitted ?? false);
    setDraft(nextStored?.draft ?? EMPTY_DRAFT);
  }

  useEffect(() => {
    if (!course || !chapter) return;
    saveStoredChapterExamSession(course.id, chapter.id, {
      version: 1,
      preset,
      customCount,
      seed,
      submitted,
      draft,
    });
  }, [course, chapter, preset, customCount, seed, submitted, draft]);

  const poolSummary = useMemo(
    () => summarizeChapterExamPool(chapterExercises ?? [], lessonOrder),
    [chapterExercises, lessonOrder],
  );

  const paper = useMemo(
    () =>
      buildChapterExamPaper({
        exercises: chapterExercises ?? [],
        lessonOrder,
        preset,
        customCount,
        seed,
      }),
    [chapterExercises, lessonOrder, preset, customCount, seed],
  );

  const evaluation = useMemo(
    () => evaluateChapterExam(paper, draft, lessonOrder),
    [paper, draft, lessonOrder],
  );

  if (!course || !chapter || chapterExercises === null) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Tổng quan', to: '/' },
            { label: 'Học phần', to: '/courses' },
            ...(course ? [{ label: course.title, to: `/courses/${course.id}` }] : []),
            { label: 'Không tìm thấy bài kiểm tra chương' },
          ]}
        />
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-medium text-ink">
            Không tìm thấy chương kiểm tra
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Chương học bạn yêu cầu không tồn tại trong học phần này hoặc chưa có ngân hàng câu hỏi.
          </p>
          <div className="mt-5">
            <Link
              to={course ? `/courses/${course.id}` : '/courses'}
              className="hus-btn hus-btn-primary"
            >
              <ArrowLeftIcon width={15} height={15} />
              {course ? 'Về trang học phần' : 'Về danh sách học phần'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (chapterExercises === undefined) {
    return <PageSkeleton />;
  }

  const selectableCounts: number[] = [];
  for (let n = poolSummary.minSelectableCount; n <= poolSummary.maxSelectableCount; n += 1) {
    selectableCounts.push(n);
  }

  const paperFormCounts = paper.summary.distinctForms
    .map(kind => ({
      kind,
      count: paper.items.filter(it => it.exercise.kind === kind).length,
    }))
    .filter(x => x.count > 0);

  const answeredQuestionCount = paper.items.filter(({ exercise }) => {
    if (exercise.kind === 'semi-essay') {
      return evaluation.writtenByExerciseId[exercise.id]?.drafted ?? false;
    }
    return evaluation.objectiveByExerciseId[exercise.id]?.answered ?? false;
  }).length;

  const handleSelectPreset = (nextPreset: ChapterExamLengthPreset) => {
    setPreset(nextPreset);
    setCustomCount(undefined);
    setSubmitted(false);
  };

  const handleSelectCount = (nextCount: number) => {
    setCustomCount(nextCount);
    setSubmitted(false);
  };

  const handleShuffleNewPaper = () => {
    setSeed(prev => prev + 1);
    setSubmitted(false);
    setDraft(EMPTY_DRAFT);
  };

  const handleResetCurrentPaper = () => {
    clearStoredChapterExamSession(course.id, chapter.id);
    setSubmitted(false);
    setDraft(EMPTY_DRAFT);
  };

  const handleSubmitExam = () => {
    setSubmitted(true);
    const now = new Date().toISOString();
    for (const { exercise } of paper.items) {
      if (exercise.kind === 'semi-essay') continue;
      const res = evaluation.objectiveByExerciseId[exercise.id];
      if (res?.answered) {
        progressStore.dispatch({
          type: 'attempt',
          exerciseId: exercise.id,
          correct: res.correct,
          at: now,
        });
      }
    }
    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  };

  const code = course.academicCode ?? course.id.toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6 overflow-x-clip">
      <Breadcrumbs
        items={[
          { label: 'Học phần', to: '/courses' },
          { label: course.title, to: `/courses/${course.id}` },
          {
            label: `Chương ${chapterIndex + 1}`,
            to: `/courses/${course.id}?chapter=${encodeURIComponent(chapter.id)}`,
          },
          { label: 'Kiểm tra cuối chương' },
        ]}
      />

      {/* Exam Masthead & Adaptive 3-10 Question Configuration */}
      <header className="hus-card-surface space-y-5 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" mono>
                {code} · Chương {chapterIndex + 1}
              </Badge>
              <Badge tone="neutral">
                {poolSummary.distinctForms.length} dạng bài · Ngân hàng {poolSummary.totalExercises}{' '}
                câu
              </Badge>
              {submitted ? <Badge tone="success">Đã nộp bài &amp; mở đối chiếu</Badge> : null}
            </div>
            <h1 className="heading-page text-ink">Kiểm tra cuối chương: {chapter.title}</h1>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Đề tự động cân bằng từ 3 đến 10 câu phủ đều các dạng bài có trong chương (bao gồm câu
              tự luận trình bày trên giấy A4 kẻ ngang) và trải rộng qua {chapterLessons.length} bài
              học.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShuffleNewPaper}
              className="hus-btn hus-btn-secondary text-xs"
            >
              <RotateCcwIcon width={13} height={13} />
              <span>Đổi mã đề khác (Đề #{seed})</span>
            </button>
          </div>
        </div>

        {/* Length Preset + Exact Question Count Controls */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-ink">
              Chọn độ dài đề kiểm tra (tự cân đối theo {poolSummary.distinctForms.length} dạng bài):
            </span>
            <div
              role="group"
              aria-label="Độ dài đề kiểm tra"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {PRESET_META.map(item => {
                const count = poolSummary.recommendedCountByPreset[item.id];
                const isSelected = customCount === undefined && preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPreset(item.id)}
                    className={`flex flex-col items-start rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent-subtle text-accent-ink'
                        : 'border-border bg-canvas/70 text-ink hover:border-border-strong'
                    }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-xs font-semibold">
                      <span>{item.label}</span>
                      <span className="font-mono tabular-nums">{count} câu</span>
                    </span>
                    <span className="mt-0.5 text-[11px] text-ink-secondary">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectableCounts.length > 1 ? (
            <div className="space-y-2">
              <label
                htmlFor="chapter-exam-exact-count"
                className="block text-xs font-semibold text-ink"
              >
                Tùy chỉnh số câu ({poolSummary.minSelectableCount}–{poolSummary.maxSelectableCount}{' '}
                câu):
              </label>
              <select
                id="chapter-exam-exact-count"
                value={paper.targetCount}
                onChange={e => handleSelectCount(Number(e.target.value))}
                className="min-h-[42px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3 py-2 font-mono text-sm font-medium text-ink focus:border-accent focus:outline-none lg:w-44"
              >
                {selectableCounts.map(n => (
                  <option key={n} value={n}>
                    {n} câu hỏi
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {/* Paper Composition Summary & Jump Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-ink-secondary">
            <strong className="font-semibold text-ink">Cấu trúc đề hiện tại ({paper.items.length} câu):</strong>
            {paperFormCounts.map(fc => (
              <Badge
                key={fc.kind}
                tone={fc.kind === 'semi-essay' ? 'accent' : 'neutral'}
              >
                {fc.count} {FORM_LABEL[fc.kind]}
              </Badge>
            ))}
          </div>
          <span className="font-mono font-medium tabular-nums text-ink-muted">
            Đã làm: {answeredQuestionCount}/{paper.items.length} câu
          </span>
        </div>

        <nav aria-label="Chuyển nhanh đến câu hỏi" className="flex flex-wrap gap-1.5">
          {paper.items.map(item => {
            const isWritten = item.exercise.kind === 'semi-essay';
            const isDone = isWritten
              ? Boolean(evaluation.writtenByExerciseId[item.exercise.id]?.drafted)
              : Boolean(evaluation.objectiveByExerciseId[item.exercise.id]?.answered);
            const objCorrect = evaluation.objectiveByExerciseId[item.exercise.id]?.correct;
            const writtenReviewed =
              evaluation.writtenByExerciseId[item.exercise.id]?.selfReviewed;

            const toneClass = submitted
              ? isWritten
                ? writtenReviewed
                  ? 'border-success/45 bg-success-subtle text-success'
                  : 'border-warning/45 bg-warning-subtle text-warning'
                : objCorrect
                  ? 'border-success/45 bg-success-subtle text-success'
                  : 'border-danger/45 bg-danger-subtle text-danger'
              : isDone
                ? 'border-accent bg-accent-subtle text-accent-ink'
                : 'border-border bg-canvas text-ink-secondary hover:border-border-strong';

            return (
              <a
                key={item.exercise.id}
                href={`#exam-q-${item.questionNumber}`}
                onClick={e => {
                  e.preventDefault();
                  document.getElementById(`exam-q-${item.questionNumber}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className={`inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-sm)] border px-2.5 py-1 font-mono text-xs font-medium no-underline transition-colors ${toneClass}`}
              >
                <span>Câu {item.questionNumber}</span>
                {isWritten ? <span aria-hidden="true">· A4</span> : null}
              </a>
            );
          })}
        </nav>
      </header>

      {/* Post-Submit Summary Report */}
      {submitted ? (
        <section
          role="region"
          aria-label="Kết quả kiểm tra cuối chương"
          className="written-practice-reveal space-y-4 rounded-[var(--radius-xl)] border border-accent/45 bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
            <div className="flex items-center gap-2.5">
              <CheckCircleIcon width={20} height={20} className="text-success" />
              <h2 className="font-display text-xl font-medium text-ink">
                Tổng kết bài kiểm tra Chương {chapterIndex + 1}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetCurrentPaper}
                className="hus-btn hus-btn-secondary text-xs"
              >
                Làm lại đề này
              </button>
              <button
                type="button"
                onClick={handleShuffleNewPaper}
                className="hus-btn hus-btn-primary text-xs"
              >
                Làm đề khác
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {evaluation.objectiveTotal > 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border bg-canvas/75 p-4">
                <p className="text-xs font-medium text-ink-muted">
                  Phần chấm tự động (Trắc nghiệm &amp; Điền đáp số)
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
                  {evaluation.objectiveCorrect}/{evaluation.objectiveTotal}{' '}
                  <span className="font-sans text-sm font-normal text-ink-secondary">câu đúng</span>
                </p>
              </div>
            ) : null}

            {evaluation.writtenTotal > 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border bg-canvas/75 p-4">
                <p className="text-xs font-medium text-ink-muted">
                  Phần Tự luận trình bày giấy A4 (Tự đối chiếu Rubric)
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
                  {evaluation.writtenSelfReviewed}/{evaluation.writtenTotal}{' '}
                  <span className="font-sans text-sm font-normal text-ink-secondary">
                    câu đã rà soát đủ ý
                  </span>
                </p>
                {evaluation.writtenSelfReviewed < evaluation.writtenTotal ? (
                  <p className="mt-1 text-xs text-warning">
                    Kéo xuống câu tự luận A4 bên dưới để đối chiếu đáp án mẫu và tích đủ các tiêu
                    chí rubric.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {evaluation.lessonsToReview.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3.5">
              <p className="text-xs font-semibold text-ink">
                Các bài học trong chương nên xem lại để nắm chắc toàn bộ dạng bài:
              </p>
              <div className="flex flex-wrap gap-2">
                {evaluation.lessonsToReview.map(lid => {
                  const les = lessonById.get(lid);
                  if (!les) return null;
                  return (
                    <Link
                      key={lid}
                      to={`/courses/${course.id}/lessons/${les.id}`}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle px-3 py-1 text-xs font-medium text-accent no-underline hover:border-accent"
                    >
                      <span>Ôn bài: {les.title}</span>
                      <ArrowRightIcon width={13} height={13} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success-subtle/60 px-4 py-3 text-sm text-success">
              <span className="font-medium">
                Bạn đã hoàn thành chính xác các câu hỏi và tự đối chiếu trọn vẹn phần tự luận của
                chương này!
              </span>
              {nextChapter ? (
                <Link
                  to={`/courses/${course.id}?chapter=${encodeURIComponent(nextChapter.id)}`}
                  className="hus-btn hus-btn-primary text-xs !no-underline"
                >
                  <span>Sang Chương {chapterIndex + 2}: {nextChapter.title}</span>
                  <ArrowRightIcon width={14} height={14} />
                </Link>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* Ordered Exam Questions */}
      <ol className="space-y-6" aria-label="Đề kiểm tra cuối chương">
        {paper.items.map(item => {
          const { exercise, questionNumber } = item;
          const sourceLesson = lessonById.get(exercise.lessonId);

          if (exercise.kind === 'semi-essay') {
            const steps = extractWrittenStepsForExam(exercise);
            const writtenStatus = evaluation.writtenByExerciseId[exercise.id];
            return (
              <li
                key={exercise.id}
                id={`exam-q-${questionNumber}`}
                className="scroll-mt-24 rounded-[var(--radius-xl)] border border-accent/35 bg-surface p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent" mono>
                        Câu {questionNumber}/{paper.items.length}
                      </Badge>
                      <Badge tone="accent">Tự luận · Giấy A4 kẻ ngang</Badge>
                      {submitted ? (
                        <Badge tone={writtenStatus?.selfReviewed ? 'success' : 'warning'}>
                          {writtenStatus?.selfReviewed ? 'Đã đối chiếu rubric' : 'Cần rà soát rubric'}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="font-display text-xl font-medium text-ink">{exercise.title}</h2>
                  </div>

                  {sourceLesson ? (
                    <Link
                      to={`/courses/${course.id}/lessons/${sourceLesson.id}/practice/${exercise.id}`}
                      className="text-xs font-medium text-accent no-underline hover:underline"
                    >
                      Mở phòng giải chi tiết &amp; sơ đồ →
                    </Link>
                  ) : null}
                </div>

                {/* Problem Statement */}
                <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-subtle/55 px-4 py-3.5 text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                  <Markdown>{exercise.prompt}</Markdown>
                </div>

                {exercise.given.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {exercise.given.map((g, gIdx) => (
                      <span
                        key={gIdx}
                        className="rounded-[var(--radius-sm)] border border-border bg-canvas px-2.5 py-1 text-ink-secondary"
                      >
                        <Markdown inline>{`$${g.symbolLatex} = ${g.value}$`}</Markdown>
                        {g.unit ? ` ${g.unit}` : ''} ({g.label})
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Sub-parts written on Ruled A4 Sheets */}
                <div className="mt-5 space-y-6">
                  {steps.map((step, sIdx) => {
                    const responseText = draft.writtenResponses[step.id] ?? '';
                    const checkedIds = draft.checkedRubricIds[step.id] ?? [];
                    return (
                      <div key={step.id} className="space-y-3">
                        {steps.length > 1 || step.prompt !== exercise.prompt ? (
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-ink">
                              {steps.length > 1
                                ? `Ý ${String.fromCharCode(97 + sIdx)}) ${step.title}`
                                : step.title}
                            </h3>
                            <div className="text-sm leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                              <Markdown>{step.prompt}</Markdown>
                            </div>
                          </div>
                        ) : null}

                        <RuledA4Sheet
                          id={`exam-written-${step.id}`}
                          label={
                            steps.length > 1
                              ? `Bài làm Câu ${questionNumber}${String.fromCharCode(97 + sIdx)}`
                              : `Bài làm tự luận Câu ${questionNumber}`
                          }
                          sheetTag="Giấy thi A4 kẻ ngang"
                          value={responseText}
                          symbolContext={symbolContext}
                          toolbarLabel={`Bảng ký hiệu đặc biệt Câu ${questionNumber}`}
                          onChange={val =>
                            setDraft(prev => ({
                              ...prev,
                              writtenResponses: {
                                ...prev.writtenResponses,
                                [step.id]: val,
                              },
                            }))
                          }
                        />

                        {submitted ? (
                          <div className="written-practice-reveal space-y-3 rounded-[var(--radius-lg)] border border-accent/35 bg-surface-subtle/65 p-4">
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-accent-ink">
                                Đáp án &amp; Thang ý chuẩn đối chiếu:
                              </p>
                              <div className="text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                                <Markdown>{step.modelAnswer}</Markdown>
                              </div>
                            </div>

                            {step.rubric.length > 0 ? (
                              <fieldset className="space-y-2 border-0 border-t border-border pt-3">
                                <legend className="mb-1.5 text-xs font-semibold text-ink">
                                  Tự kiểm tra các ý đã trình bày trên giấy A4:
                                </legend>
                                {step.rubric.map(criterion => {
                                  const isChecked = checkedIds.includes(criterion.id);
                                  return (
                                    <label
                                      key={criterion.id}
                                      className="flex min-h-[38px] cursor-pointer items-start gap-2.5 text-sm text-ink"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={e =>
                                          setDraft(prev => {
                                            const cur = prev.checkedRubricIds[step.id] ?? [];
                                            return {
                                              ...prev,
                                              checkedRubricIds: {
                                                ...prev.checkedRubricIds,
                                                [step.id]: e.target.checked
                                                  ? [...cur, criterion.id]
                                                  : cur.filter(id => id !== criterion.id),
                                              },
                                            };
                                          })
                                        }
                                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                                      />
                                      <span>{criterion.prompt}</span>
                                    </label>
                                  );
                                })}
                              </fieldset>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          }

          return (
            <ExamObjectiveQuestionCard
              key={exercise.id}
              questionNumber={questionNumber}
              totalQuestions={paper.items.length}
              exercise={exercise}
              lessonTitle={sourceLesson?.title}
              lessonUrl={
                sourceLesson ? `/courses/${course.id}/lessons/${sourceLesson.id}` : undefined
              }
              symbolContext={symbolContext}
              answer={draft.objectiveAnswers[exercise.id]}
              submitted={submitted}
              correct={evaluation.objectiveByExerciseId[exercise.id]?.correct ?? false}
              onChangeAnswer={nextAns =>
                setDraft(prev => ({
                  ...prev,
                  objectiveAnswers: {
                    ...prev.objectiveAnswers,
                    [exercise.id]: nextAns,
                  },
                }))
              }
            />
          );
        })}
      </ol>

      {/* Bottom Submit Action Bar */}
      <footer className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-ink">
            {submitted
              ? 'Bài kiểm tra đã được chấm và mở thang ý đối chiếu'
              : `Hoàn thành đề kiểm tra Chương ${chapterIndex + 1} (${answeredQuestionCount}/${paper.items.length} câu đã điền)`}
          </p>
          <p className="text-xs text-ink-secondary">
            {submitted
              ? 'Bạn có thể tích rà soát rubric ở các câu tự luận A4 hoặc tạo mã đề mới để luyện thêm.'
              : 'Bài nháp tự động lưu trên trình duyệt. Nhấn nộp bài khi bạn sẵn sàng chấm điểm và đối chiếu lời giải.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/courses/${course.id}?chapter=${encodeURIComponent(chapter.id)}`}
            className="hus-btn hus-btn-secondary text-xs !no-underline"
          >
            <ArrowLeftIcon width={14} height={14} />
            <span>Về lộ trình chương</span>
          </Link>

          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmitExam}
              className="hus-btn hus-btn-primary px-5"
            >
              <CheckCircleIcon width={16} height={16} />
              <span>Nộp bài kiểm tra chương</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShuffleNewPaper}
              className="hus-btn hus-btn-primary px-5"
            >
              <RotateCcwIcon width={15} height={15} />
              <span>Tạo đề kiểm tra mới</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function ExamObjectiveQuestionCard({
  questionNumber,
  totalQuestions,
  exercise,
  lessonTitle,
  lessonUrl,
  symbolContext,
  answer,
  submitted,
  correct,
  onChangeAnswer,
}: {
  readonly questionNumber: number;
  readonly totalQuestions: number;
  readonly exercise: ClassicExerciseDefinition;
  readonly lessonTitle?: string | undefined;
  readonly lessonUrl?: string | undefined;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly answer: string | readonly string[] | undefined;
  readonly submitted: boolean;
  readonly correct: boolean;
  readonly onChangeAnswer: (nextAnswer: string | readonly string[]) => void;
}) {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { preferences, setInsertMode } = useMathSymbolPreferences();
  const activeMathMode = preferences.insertMode;
  const [slashState, setSlashState] = useState<{
    readonly activeQuery: ActiveBackslashQuery;
    readonly highlightIndex: number;
  } | null>(null);

  const stringAnswer = typeof answer === 'string' ? answer : '';
  const arrayAnswer = Array.isArray(answer) ? answer : [];

  const slashSuggestions = useMemo(() => {
    if (!slashState) return [];
    return filterShorthandSuggestions(slashState.activeQuery.query, activeMathMode);
  }, [slashState, activeMathMode]);

  const handleInsertSymbol = (symbol: MathSymbol, mode: MathSymbolInsertMode) => {
    if (submitted) return;
    const el = inputRef.current;
    const inserted = insertMathSymbolAtCursor(
      stringAnswer,
      el?.selectionStart ?? stringAnswer.length,
      el?.selectionEnd ?? stringAnswer.length,
      symbol,
      mode,
    );
    onChangeAnswer(inserted.value);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(inserted.selectionStart, inserted.selectionEnd);
      }
    });
  };

  const handleInsertShorthand = (entry: MathShorthandEntry, mode: MathSymbolInsertMode) => {
    if (submitted) return;
    const el = inputRef.current;
    const posStart = el?.selectionStart ?? stringAnswer.length;
    const posEnd = el?.selectionEnd ?? posStart;
    const applied = applyShorthandSuggestion(
      stringAnswer,
      { replaceFrom: posStart, replaceTo: posEnd, query: '' },
      entry,
      mode,
      { wrapLatexWithDollars: true },
    );
    onChangeAnswer(applied.value);
    setSlashState(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(applied.caret, applied.caret);
      }
    });
  };

  const commitInputSlash = (entry: MathShorthandEntry) => {
    if (!slashState || submitted) return;
    const applied = applyShorthandSuggestion(
      stringAnswer,
      slashState.activeQuery,
      entry,
      activeMathMode,
      { wrapLatexWithDollars: true },
    );
    onChangeAnswer(applied.value);
    setSlashState(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(applied.caret, applied.caret);
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!slashState || slashSuggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSlashState(prev =>
        prev
          ? { ...prev, highlightIndex: (prev.highlightIndex + 1) % slashSuggestions.length }
          : null,
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSlashState(prev =>
        prev
          ? {
              ...prev,
              highlightIndex:
                (prev.highlightIndex - 1 + slashSuggestions.length) % slashSuggestions.length,
            }
          : null,
      );
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const picked = slashSuggestions[slashState.highlightIndex] ?? slashSuggestions[0];
      if (picked) {
        event.preventDefault();
        commitInputSlash(picked);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashState(null);
    }
  };

  return (
    <li
      id={`exam-q-${questionNumber}`}
      className="scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" mono>
              Câu {questionNumber}/{totalQuestions}
            </Badge>
            <Badge tone="neutral">{FORM_LABEL[exercise.kind]}</Badge>
            {submitted ? (
              <Badge tone={correct ? 'success' : 'danger'}>
                {correct ? 'Chính xác' : 'Chưa đúng'}
              </Badge>
            ) : null}
          </div>
          <h2 className="font-display text-lg font-medium text-ink">{exercise.title}</h2>
        </div>

        {lessonUrl && lessonTitle ? (
          <Link
            to={lessonUrl}
            className="text-xs font-medium text-ink-muted no-underline hover:text-accent hover:underline"
          >
            Thuộc bài: {lessonTitle}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-canvas/75 px-4 py-3.5 text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
        <Markdown>{exercise.prompt}</Markdown>
      </div>

      <div className="mt-4 space-y-3">
        {exercise.kind === 'multiple-choice' || exercise.kind === 'multiple-answer' ? (
          <fieldset disabled={submitted} className="space-y-2 border-0 p-0">
            <legend className="mb-2 text-xs font-medium text-ink-muted">
              {exercise.kind === 'multiple-answer'
                ? 'Chọn tất cả các phương án đúng'
                : 'Chọn một phương án đúng'}
            </legend>
            {exercise.choices.map(choice => {
              const isChecked =
                exercise.kind === 'multiple-answer'
                  ? arrayAnswer.includes(choice.id)
                  : stringAnswer === choice.id;
              const isExpectedAnswer = exercise.answers.includes(choice.id);
              const choiceTone = submitted
                ? isExpectedAnswer
                  ? 'border-success/55 bg-success-subtle text-ink'
                  : isChecked
                    ? 'border-danger/55 bg-danger-subtle text-ink'
                    : 'border-border bg-canvas/50 text-ink-secondary'
                : isChecked
                  ? 'border-accent bg-accent-subtle font-medium text-accent-ink'
                  : 'border-border bg-canvas/60 text-ink hover:border-border-strong';

              return (
                <label
                  key={choice.id}
                  className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm transition-colors ${choiceTone}`}
                >
                  <input
                    type={exercise.kind === 'multiple-answer' ? 'checkbox' : 'radio'}
                    name={fieldId}
                    value={choice.id}
                    checked={isChecked}
                    onChange={e => {
                      if (exercise.kind === 'multiple-answer') {
                        onChangeAnswer(
                          e.target.checked
                            ? [...arrayAnswer, choice.id]
                            : arrayAnswer.filter(id => id !== choice.id),
                        );
                      } else {
                        onChangeAnswer(e.target.value);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                  />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    <Markdown inline>{choice.label}</Markdown>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="space-y-2">
            <label htmlFor={fieldId} className="block text-xs font-medium text-ink-muted">
              Điền đáp án cho Câu {questionNumber}
            </label>
            <input
              ref={inputRef}
              id={fieldId}
              type="text"
              readOnly={submitted}
              value={stringAnswer}
              placeholder="Nhập kết quả hoặc biểu thức (gõ \ để chèn nhanh ký hiệu)…"
              onChange={e => {
                const val = e.target.value;
                const caret = e.target.selectionStart;
                onChangeAnswer(val);
                const q = detectActiveBackslashQuery(val, caret);
                setSlashState(q ? { activeQuery: q, highlightIndex: 0 } : null);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setSlashState(null)}
              className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
            {!submitted && slashState && slashSuggestions.length > 0 ? (
              <MathSlashAutocomplete
                id={`${fieldId}-slash`}
                query={slashState.activeQuery.query}
                suggestions={slashSuggestions}
                highlightedIndex={slashState.highlightIndex}
                mode={activeMathMode}
                onChangeMode={setInsertMode}
                onSelect={commitInputSlash}
                onClose={() => setSlashState(null)}
              />
            ) : null}
            {shouldAutoShowMathPreview(stringAnswer, activeMathMode) ? (
              <div className="rounded-[var(--radius-sm)] border border-border bg-canvas/70 px-3 py-1.5 text-xs text-ink">
                <span className="mr-2 text-ink-muted">Xem trước:</span>
                <Markdown inline>{renderTextByMathMode(stringAnswer, activeMathMode)}</Markdown>
              </div>
            ) : null}
            {!submitted ? (
              <MathSymbolToolbar
                variant="compact"
                allowLatexMode
                context={symbolContext}
                onInsert={handleInsertSymbol}
                onInsertShorthandEntry={handleInsertShorthand}
                label={`Bảng ký hiệu cho Câu ${questionNumber}`}
              />
            ) : null}
          </div>
        )}

        {submitted ? (
          <div
            role="status"
            className={`space-y-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
              correct
                ? 'border-success/40 bg-success-subtle text-ink'
                : 'border-danger/40 bg-danger-subtle text-ink'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {correct ? (
                <CheckCircleIcon width={16} height={16} className="shrink-0 text-success" />
              ) : (
                <AlertCircleIcon width={16} height={16} className="shrink-0 text-danger" />
              )}
              <span>
                {correct
                  ? 'Đáp án chính xác!'
                  : exercise.kind === 'short-answer'
                    ? `Đáp án chuẩn: ${exercise.answers.join(' hoặc ')}`
                    : 'Lựa chọn chưa chính xác.'}
              </span>
            </div>
            {exercise.explanation ? (
              <div className="text-xs leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                <Markdown>{exercise.explanation}</Markdown>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
