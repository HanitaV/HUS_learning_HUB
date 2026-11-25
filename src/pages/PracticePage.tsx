import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { resolveCourseConventionCanon } from '../content/curriculum-canons';
import type { CurriculumSearchHit } from '../domain/curriculum-tutor';
import type { MathSymbolContext } from '../domain/math-symbols';
import type { SemiEssayExercise } from '../domain/semi-essay';
import { buildPlaygroundSnippets, inferDefaultCodeLanguage } from '../core/code-lab/playground';
import { courseLessons } from '../core/learning/content';
import {
  buildCurriculumHorizon,
  classifyLessonRelation,
  indexLessonMarkdownChunks,
  searchCurriculumChunks,
} from '../core/learning/curriculum-rag';
import { courseRegistry, getSubjectModule } from '../infrastructure/content/catalogue';
import {
  learningContent,
  loadLessonExercises,
  loadLessonMarkdown,
} from '../infrastructure/content/learning';
import { progressStore } from '../infrastructure/progress/store';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { useLearningProgress } from '../app/useLearningProgress';
import { SemiEssayStudio } from '../components/learning/SemiEssayStudio';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ArrowLeftIcon } from '../components/ui/Icons';
import { PageSkeleton } from '../components/ui/Skeleton';

export default function PracticePage() {
  const { courseId, lessonId, exerciseId } = useParams();
  const { progress } = useLearningProgress();
  const course = courseRegistry.get(courseId ?? '');
  const lesson = courseLessons(learningContent, course).find(l => l.id === lessonId);

  const inlineCodeLabTool = useMemo(() => {
    if (!course) return undefined;
    const mod = getSubjectModule(course.subjectId);
    return (mod?.tools ?? []).find(
      tool =>
        tool.kind === 'code-lab' &&
        tool.embedInExercises &&
        (!tool.courseIds || tool.courseIds.includes(course.id)),
    );
  }, [course]);

  const LazyInlineCodeLab = useMemo(
    () => (inlineCodeLabTool ? lazy(inlineCodeLabTool.load) : null),
    [inlineCodeLabTool],
  );

  const symbolContext = useMemo<MathSymbolContext | undefined>(() => {
    if (!course || !lesson) return undefined;
    const topic = learningContent.topics.find(t => t.id === lesson.topicId);
    const chapter = topic
      ? learningContent.chapters.find(ch => ch.id === topic.chapterId)
      : undefined;
    return {
      subjectId: course.subjectId,
      courseId: course.id,
      ...(chapter ? { chapterId: chapter.id, chapterLabel: chapter.title } : {}),
      courseLabel: course.title,
    };
  }, [course, lesson]);

  const canon = useMemo(() => {
    if (!course) return undefined;
    return resolveCourseConventionCanon({
      courseId: course.id,
      academicCode: course.academicCode,
      subjectId: course.subjectId,
      courseTitle: course.title,
    });
  }, [course]);

  const horizon = useMemo(() => {
    if (!course || !lesson) return undefined;
    return buildCurriculumHorizon(course, learningContent, lesson.id);
  }, [course, lesson]);

  const [exercise, setExercise] = useState<SemiEssayExercise | null | undefined>(undefined);
  const [markdownByLessonId, setMarkdownByLessonId] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    let active = true;
    if (!course || !lesson || !exerciseId) {
      setExercise(null);
      return;
    }
    setExercise(undefined);
    loadLessonExercises(course.id, lesson.id)
      .then(list => {
        if (!active) return;
        const found = list.find(e => e.id === exerciseId && e.lessonId === lesson.id);
        setExercise(found && found.kind === 'semi-essay' ? found : null);
      })
      .catch(() => {
        if (active) setExercise(null);
      });
    return () => {
      active = false;
    };
  }, [course, lesson, exerciseId]);

  const needsImmediateLessonChunks = Boolean(
    inlineCodeLabTool ||
      (exercise &&
        (exercise.theoryAnchors.length === 0 ||
          exercise.steps.some(step => step.kind === 'written-reasoning'))),
  );

  // Load current lesson + direct prerequisite lessons when needed for Graph-RAG, Socratic tutor, or CodeLab
  useEffect(() => {
    let active = true;
    if (!course || !lesson || !needsImmediateLessonChunks) {
      setMarkdownByLessonId({});
      return;
    }
    const targetIds = [
      lesson.id,
      ...(horizon?.directPrerequisiteLessons.map(p => p.id) ?? []),
    ];
    Promise.all(
      targetIds.map(async id => {
        try {
          const md = await loadLessonMarkdown(id);
          return [id, md] as const;
        } catch {
          return null;
        }
      }),
    ).then(pairs => {
      if (!active) return;
      const loaded: Record<string, string> = {};
      for (const pair of pairs) {
        if (pair) loaded[pair[0]] = pair[1];
      }
      setMarkdownByLessonId(loaded);
    });
    return () => {
      active = false;
    };
  }, [course, lesson, horizon, needsImmediateLessonChunks]);

  const lessonBody = lesson ? markdownByLessonId[lesson.id] : undefined;

  const curriculumChunks = useMemo(() => {
    if (!course || !lesson) return [];
    return indexLessonMarkdownChunks({
      course,
      content: learningContent,
      targetLessonId: lesson.id,
      markdownByLessonId,
    });
  }, [course, lesson, markdownByLessonId]);

  const handleSearchCourseCurriculum = useCallback(
    async (query: string, expandCourse: boolean): Promise<readonly CurriculumSearchHit[]> => {
      if (!course || !lesson) return [];
      if (!expandCourse) {
        return searchCurriculumChunks(curriculumChunks, query, {
          limit: 5,
          allowFutureChapters: false,
        });
      }

      const earlierLessons = courseLessons(learningContent, course).filter(
        candidate =>
          classifyLessonRelation(course, learningContent, lesson.id, candidate.id) !==
          'later-syllabus',
      );
      const missingLessons = earlierLessons.filter(item => !markdownByLessonId[item.id]);
      let mergedMap = markdownByLessonId;

      if (missingLessons.length > 0) {
        const loaded = await Promise.all(
          missingLessons.map(async item => {
            try {
              const md = await loadLessonMarkdown(item.id);
              return [item.id, md] as const;
            } catch {
              return null;
            }
          }),
        );
        const nextMap: Record<string, string> = { ...markdownByLessonId };
        for (const pair of loaded) {
          if (pair) nextMap[pair[0]] = pair[1];
        }
        mergedMap = nextMap;
        setMarkdownByLessonId(nextMap);
      }

      const expandedChunks = indexLessonMarkdownChunks({
        course,
        content: learningContent,
        targetLessonId: lesson.id,
        markdownByLessonId: mergedMap,
      });
      return searchCurriculumChunks(expandedChunks, query, {
        limit: 5,
        allowFutureChapters: false,
      });
    },
    [course, lesson, curriculumChunks, markdownByLessonId],
  );

  const practiceSnippets = useMemo(() => {
    if (!inlineCodeLabTool || !exercise || !lesson) return undefined;
    const stepPrompts = [
      { id: exercise.id, title: exercise.title, prompt: exercise.prompt },
      ...exercise.steps.map(step => ({
        id: step.id,
        title: step.title,
        prompt: step.prompt,
      })),
    ];
    const preferredLanguage = inferDefaultCodeLanguage({
      lessonMarkdown: lessonBody,
      exercisePrompts: stepPrompts.map(item => item.prompt),
    });
    return buildPlaygroundSnippets({
      scopeId: `practice-${exercise.id}`,
      exerciseItems: stepPrompts,
      lessonMarkdown: lessonBody,
      defaultLanguage: preferredLanguage,
    });
  }, [inlineCodeLabTool, exercise, lesson, lessonBody]);

  if (!course || !lesson || exercise === null) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Tổng quan', to: '/' },
            { label: 'Học phần', to: '/courses' },
            ...(course ? [{ label: course.title, to: `/courses/${course.id}` }] : []),
            { label: 'Không tìm thấy bài luyện tập' },
          ]}
        />
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-medium text-ink">
            Không tìm thấy bài tự luận
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Bài tập này không tồn tại, không thuộc bài học đã chọn, hoặc chưa hỗ trợ không gian giải tự luận.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {course && lesson ? (
              <Link
                to={`/courses/${course.id}/lessons/${lesson.id}`}
                className="hus-btn hus-btn-primary"
              >
                <ArrowLeftIcon width={15} height={15} />
                Quay lại bài học
              </Link>
            ) : (
              <Link to="/courses" className="hus-btn hus-btn-secondary">
                <ArrowLeftIcon width={15} height={15} />
                Về danh sách học phần
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (exercise === undefined) {
    return <PageSkeleton />;
  }

  const previouslySolved = progress.attempts.some(
    attempt => attempt.exerciseId === exercise.id && attempt.correct,
  );
  const lessonUrl = `/courses/${course.id}/lessons/${lesson.id}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 overflow-x-clip">
      <Breadcrumbs
        items={[
          { label: 'Học phần', to: '/courses' },
          { label: course.title, to: `/courses/${course.id}` },
          { label: lesson.title, to: lessonUrl },
          { label: 'Giải tự luận' },
        ]}
      />
      <SemiEssayStudio
        key={exercise.id}
        exercise={exercise}
        courseId={course.id}
        canon={canon}
        horizon={horizon}
        curriculumChunks={curriculumChunks}
        onSearchCourseCurriculum={handleSearchCourseCurriculum}
        lessonTitle={lesson.title}
        lessonUrl={lessonUrl}
        previouslySolved={previouslySolved}
        symbolContext={symbolContext}
        onCompleteExercise={outcome => {
          if (outcome === 'self-reviewed') return;
          progressStore.dispatch({
            type: 'attempt',
            exerciseId: exercise.id,
            correct: true,
            at: new Date().toISOString(),
          });
        }}
        onRecordTutorAttempt={(passed, at) => {
          progressStore.dispatch({
            type: 'attempt',
            exerciseId: exercise.id,
            correct: passed,
            at,
          });
        }}
      />

      {LazyInlineCodeLab ? (
        <section
          aria-labelledby="practice-inline-code-heading"
          className="space-y-3 border-t border-border pt-6"
        >
          <div className="space-y-1">
            <h2
              id="practice-inline-code-heading"
              className="font-display text-xl font-medium text-ink"
            >
              Gõ &amp; chạy kiểm chứng mã nguồn tại chỗ
            </h2>
            <p className="text-sm text-ink-secondary">
              Thử nghiệm trực tiếp các lớp, phương thức hoặc kịch bản trong đề bài ngay trên trang này mà không cần chuyển sang tab khác.
            </p>
          </div>
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
                  <p role="status" className="text-sm text-ink-muted">
                    Đang tải khung thực hành mã nguồn…
                  </p>
                </div>
              }
            >
              <LazyInlineCodeLab
                courseId={course.id}
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                playgroundSnippets={practiceSnippets}
                embeddedSurface="practice"
              />
            </Suspense>
          </ErrorBoundary>
        </section>
      ) : null}
    </div>
  );
}
