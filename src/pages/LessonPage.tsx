import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { resolveCourseConventionCanon } from '../content/curriculum-canons';
import type { InjectedCodeSnippet } from '../contracts/subject-module';
import type { CodeLanguage } from '../domain/code-lab';
import type {
  CoachingPromptMode,
  LessonWebMcpContextPacket,
  TutorCoachingFeedback,
} from '../domain/curriculum-tutor';
import type { Course, Lesson } from '../domain/learning';
import type { MathSymbolContext } from '../domain/math-symbols';
import type { LessonAnimationSpec } from '../domain/code-lesson';
import type { SemiEssayExercise, WrittenReasoningStep } from '../domain/semi-essay';
import type { ExerciseDefinition } from '../domain/workspace';
import { buildPlaygroundSnippets, inferDefaultCodeLanguage } from '../core/code-lab/playground';
import { courseLessons } from '../core/learning/content';
import {
  buildCurriculumHorizon,
  buildGroundedEssayContextPacket,
  classifyLessonRelation,
  indexLessonMarkdownChunks,
  searchCurriculumChunks,
  synthesizeFallbackTheoryAnchors,
} from '../core/learning/curriculum-rag';
import { buildNeighborhoodFlow } from '../core/learning/goal-pathway';
import { parseMicroLesson } from '../core/learning/micro-lesson';
import { completedCourseLessonIds, isPracticeOnlyCourse } from '../core/learning/progress';
import { emptyWrittenStepDraft } from '../core/learning/semi-essay';
import {
  adaptClassicExerciseToSemiEssay,
  didExercisePassViaTutor,
} from '../core/learning/webmcp-essay-adapters';
import {
  loadStoredTutorFeedback,
  saveStoredTutorFeedback,
} from '../infrastructure/ai/tutor-feedback-parser';
import {
  detectWebMcpSupport,
  formatLessonStudyWebMcpPrompt,
  registerEssayWebMcpTools,
} from '../infrastructure/ai/webmcp-essay-bridge';
import { loadLessonAnimation } from '../infrastructure/animations/loader';
import { courseRegistry, getSubjectModule } from '../infrastructure/content/catalogue';
import { learningContent, loadLessonExercises, loadLessonMarkdown } from '../infrastructure/content/learning';
import { writtenPractice } from '../infrastructure/content/written-practice';
import { getQuestsForLesson, skillQuestList } from '../infrastructure/quests/registry';
import { progressStore } from '../infrastructure/progress/store';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { useLearningProgress } from '../app/useLearningProgress';
import { useQuestProgress } from '../app/useQuestProgress';
import { useWorkspacePreferences } from '../app/useWorkspacePreferences';
import type { InlineLessonA4Bridge } from '../components/learning/ExerciseSession';
import { InlineSemiEssayExerciseCard } from '../components/learning/InlineSemiEssayExerciseCard';
import { LearningFlowNeighborhoodGraph } from '../components/learning/LearningFlowNeighborhoodGraph';
import { LessonWorkspaceShell } from '../components/learning/LessonWorkspaceShell';
import Markdown from '../components/learning/Markdown';
import { MicroLessonStepper } from '../components/learning/MicroLessonStepper';
import { MitVideoCard, type MitSupplementItem } from '../components/learning/MitVideoCard';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { LessonSkeleton } from '../components/ui/Skeleton';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
} from '../components/ui/Icons';

const ExerciseSession = lazy(() => import('../components/learning/ExerciseSession'));

export default function LessonPage() {
  const { courseId, lessonId } = useParams();
  const course = courseRegistry.get(courseId ?? '');
  const lesson = courseLessons(learningContent, course).find(l => l.id === lessonId);

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
            Học phần bạn đang truy cập không tồn tại trong danh mục hiện tại.
          </p>
          <Link to="/courses" className="hus-btn hus-btn-secondary mt-5">
            <ArrowLeftIcon width={15} height={15} />
            Về danh sách học phần
          </Link>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Học phần', to: '/courses' },
            { label: course.title, to: `/courses/${course.id}` },
            { label: 'Bài học chưa sẵn sàng' },
          ]}
        />
        <LessonWorkspaceShell
          courseTitle={course.title}
          courseUrl={`/courses/${course.id}`}
          chapters={[]}
        >
          <h1>Bài học chưa sẵn sàng</h1>
          <p>Bài học này chưa được chuyển đổi hoặc không thuộc học phần hiện tại.</p>
          <p className="mt-6">
            <Link to={`/courses/${course.id}`} className="hus-btn hus-btn-secondary !no-underline">
              <ArrowLeftIcon width={15} height={15} />
              Quay lại trang học phần
            </Link>
          </p>
        </LessonWorkspaceShell>
      </div>
    );
  }

  return <LessonReader key={lesson.id} course={course} lesson={lesson} />;
}

function LessonReader({ course, lesson }: { readonly course: Course; readonly lesson: Lesson }) {
  const { progress, error } = useLearningProgress();
  const { questProgress } = useQuestProgress();
  const { preferences, setReadingSize } = useWorkspacePreferences();
  const [body, setBody] = useState<string | null>(null);
  const [animationSpec, setAnimationSpec] = useState<LessonAnimationSpec | undefined>(undefined);
  const [lessonExercises, setLessonExercises] = useState<readonly ExerciseDefinition[]>(() =>
    learningContent.exercises.filter(e => lesson.exerciseIds.includes(e.id)),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    setAnimationSpec(undefined);
    loadLessonMarkdown(lesson.id)
      .then(text => {
        if (active) setBody(text);
      })
      .catch(() => {
        if (active) setLoadError('Không thể tải bài học. Hãy thử lại.');
      });
    loadLessonAnimation(lesson.id)
      .then(spec => {
        if (active) setAnimationSpec(spec);
      })
      .catch(() => {
        if (active) setAnimationSpec(undefined);
      });
    if (lesson.exerciseIds.length > 0) {
      loadLessonExercises(course.id, lesson.id)
        .then(exercises => {
          if (active) setLessonExercises(exercises);
        })
        .catch(() => {
          if (active) setLessonExercises([]);
        });
    } else {
      setLessonExercises([]);
    }
    progressStore.dispatch({
      type: 'visit',
      topicId: lesson.topicId,
      lessonId: lesson.id,
      courseId: course.id,
      at: new Date().toISOString(),
    });
    return () => {
      active = false;
    };
  }, [lesson.id, lesson.topicId, lesson.exerciseIds.length, course.id, retry]);

  const practiceOnly = isPracticeOnlyCourse(course);
  const lessons = useMemo(() => courseLessons(learningContent, course), [course]);
  const effectiveCompletedIds = useMemo(
    () => completedCourseLessonIds(course, lessons, progress),
    [course, lessons, progress],
  );
  const effectiveCompletedSet = useMemo(
    () => new Set(effectiveCompletedIds),
    [effectiveCompletedIds],
  );
  const index = lessons.findIndex(l => l.id === lesson.id);
  const previous = lessons[index - 1];
  const next = lessons[index + 1];
  const explicitlyCompleted = progress.completedLessonIds.includes(lesson.id);
  const completed = effectiveCompletedSet.has(lesson.id);

  const topic = learningContent.topics.find(t => t.id === lesson.topicId);
  const chapter = topic ? learningContent.chapters.find(ch => ch.id === topic.chapterId) : undefined;
  const symbolContext = useMemo<MathSymbolContext>(() => {
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
  }, [course.id, course.subjectId, course.title, lesson.topicId]);

  const linkedTools = useMemo(() => {
    const mod = getSubjectModule(course.subjectId);
    if (!mod?.tools) return [];
    return mod.tools.flatMap(tool =>
      (tool.lessonLinks ?? [])
        .filter(link => link.lessonId === lesson.id)
        .map(link => ({
          tool,
          Component: lazy(tool.load),
          toolId: tool.id,
          preset: link.preset,
          label: link.label,
        })),
    );
  }, [course.subjectId, lesson.id]);
  const [openedLinkedToolKeys, setOpenedLinkedToolKeys] = useState<Readonly<Record<string, boolean>>>({});
  const mitSupplement = useMemo<{
    readonly supplement: readonly MitSupplementItem[];
    readonly furtherReading: readonly MitSupplementItem[];
    readonly comparisonNoteVi?: string;
    readonly selfStudyChapter?: boolean;
  }>(() => ({ supplement: [], furtherReading: [] }), []);
  const hasMitSupplement =
    mitSupplement.supplement.length > 0 || mitSupplement.furtherReading.length > 0;
  const lessonFlow = useMemo(
    () =>
      buildNeighborhoodFlow(
        { kind: 'lesson', lessonId: lesson.id },
        course,
        learningContent,
        effectiveCompletedIds,
        questProgress.completedQuestIds,
        skillQuestList,
      ),
    [lesson.id, course, effectiveCompletedIds, questProgress.completedQuestIds],
  );

  const lessonQuests = useMemo(() => getQuestsForLesson(lesson.id), [lesson.id]);
  const lessonWritten = useMemo(
    () => writtenPractice.filter(item => item.lessonId === lesson.id),
    [lesson.id],
  );
  const combinedLessonExercises = useMemo<readonly ExerciseDefinition[]>(() => {
    const existingIds = new Set(lessonExercises.map(ex => ex.id));
    const extraWritten = lessonWritten.filter(item => !existingIds.has(item.id));
    return [...lessonExercises, ...extraWritten];
  }, [lessonExercises, lessonWritten]);
  const nextTopic = next ? learningContent.topics.find(t => t.id === next.topicId) : undefined;
  const isEndOfChapter = Boolean(chapter && (!next || nextTopic?.chapterId !== chapter.id));
  const chapterIndex = chapter ? course.chapterIds.indexOf(chapter.id) : -1;
  const parsedMicro = useMemo(() => (body !== null ? parseMicroLesson(body) : null), [body]);
  const subjectModule = useMemo(
    () => getSubjectModule(course.subjectId),
    [course.subjectId],
  );
  const inlineCodeLabTool = useMemo(
    () =>
      (subjectModule?.tools ?? []).find(
        t =>
          t.kind === 'code-lab' &&
          t.embedInExercises &&
          (!t.courseIds || t.courseIds.includes(course.id)),
      ),
    [subjectModule, course.id],
  );
  const inlineLessonTools = useMemo(
    () =>
      (subjectModule?.tools ?? []).filter(
        t =>
          t.inlineLessonIds?.includes(lesson.id) &&
          (!t.courseIds || t.courseIds.includes(course.id)),
      ),
    [subjectModule, course.id, lesson.id],
  );
  const LazyInlineCodeLab = useMemo(
    () => (inlineCodeLabTool ? lazy(inlineCodeLabTool.load) : null),
    [inlineCodeLabTool],
  );
  const lazyInlineExtras = useMemo(
    () =>
      inlineLessonTools.map(tool => ({
        tool,
        Component: lazy(tool.load),
      })),
    [inlineLessonTools],
  );
  const practiceLabUrl = useMemo(() => {
    if (!subjectModule?.tools?.some(t => t.kind === 'code-lab')) return undefined;
    return `/courses/${course.id}?track=practice`;
  }, [course.id, subjectModule]);

  const codeLabSectionRef = useRef<HTMLDivElement | null>(null);
  const [injectedSnippet, setInjectedSnippet] = useState<InjectedCodeSnippet | undefined>(
    undefined,
  );

  const canon = useMemo(
    () =>
      resolveCourseConventionCanon({
        courseId: course.id,
        academicCode: course.academicCode,
        subjectId: course.subjectId,
        courseTitle: course.title,
      }),
    [course.id, course.academicCode, course.subjectId, course.title],
  );

  const horizon = useMemo(
    () => buildCurriculumHorizon(course, learningContent, lesson.id),
    [course, lesson.id],
  );

  const [extraMarkdownByLessonId, setExtraMarkdownByLessonId] = useState<
    Readonly<Record<string, string>>
  >({});

  const lessonChunks = useMemo(() => {
    const map: Record<string, string> = { ...extraMarkdownByLessonId };
    if (body) map[lesson.id] = body;
    return indexLessonMarkdownChunks({
      course,
      content: learningContent,
      targetLessonId: lesson.id,
      markdownByLessonId: map,
    });
  }, [course, lesson.id, body, extraMarkdownByLessonId]);

  const [webMcpAvailable, setWebMcpAvailable] = useState<boolean>(
    () => detectWebMcpSupport().available,
  );
  const [focusedExercise, setFocusedExercise] = useState<ExerciseDefinition | null>(null);
  const [activeInlineA4, setActiveInlineA4] = useState<{
    readonly exercise: SemiEssayExercise;
    readonly step: WrittenReasoningStep;
  } | null>(null);
  const [inlineA4Drafts, setInlineA4Drafts] = useState<Readonly<Record<string, string>>>({});
  const [inlineStepMetaByStepId, setInlineStepMetaByStepId] = useState<
    Readonly<
      Record<
        string,
        {
          readonly stepNumber?: number | undefined;
          readonly revisionText?: string | undefined;
          readonly modelRevealed?: boolean | undefined;
        }
      >
    >
  >({});
  const [inlineCoachingByStepId, setInlineCoachingByStepId] = useState<
    Readonly<Record<string, TutorCoachingFeedback>>
  >({});
  const [inlineCoachedSnapshotByStepId, setInlineCoachedSnapshotByStepId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [copiedLessonPrompt, setCopiedLessonPrompt] = useState(false);

  const adaptedClassicByStepId = useMemo(() => {
    const map = new Map<
      string,
      {
        readonly exercise: SemiEssayExercise;
        readonly step: WrittenReasoningStep;
        readonly stepIndex: number;
      }
    >();
    for (const ex of combinedLessonExercises) {
      if (ex.kind === 'semi-essay') {
        ex.steps.forEach((s, sIdx) => {
          if (s.kind === 'written-reasoning') {
            map.set(s.id, { exercise: ex, step: s, stepIndex: sIdx });
          }
        });
        continue;
      }
      const adapted = adaptClassicExerciseToSemiEssay(ex, { canon });
      const step = adapted.steps[0];
      if (step?.kind === 'written-reasoning') {
        map.set(step.id, { exercise: adapted, step, stepIndex: 0 });
      }
    }
    return map;
  }, [combinedLessonExercises, canon]);

  useEffect(() => {
    const merged: Record<string, TutorCoachingFeedback> = {};
    const seenIds = new Set<string>();
    for (const { exercise } of adaptedClassicByStepId.values()) {
      if (seenIds.has(exercise.id)) continue;
      seenIds.add(exercise.id);
      Object.assign(merged, loadStoredTutorFeedback(exercise));
    }
    setInlineCoachingByStepId(merged);
  }, [adaptedClassicByStepId]);

  const buildInlineEssayPacket = useCallback(
    (
      semiEx: SemiEssayExercise,
      step: WrittenReasoningStep,
      draftText: string,
      checkedIds: readonly string[],
      mode: CoachingPromptMode,
      fromWebMcp = false,
      options?: {
        readonly stepNumber?: number | undefined;
        readonly revisionText?: string | undefined;
        readonly modelRevealed?: boolean | undefined;
      },
    ) => {
      const stepIdx = Math.max(
        0,
        options?.stepNumber !== undefined
          ? options.stepNumber - 1
          : semiEx.steps.findIndex(s => s.id === step.id),
      );
      const anchors = synthesizeFallbackTheoryAnchors(lessonChunks, semiEx, stepIdx).anchors;
      const revealed = options?.modelRevealed ?? false;
      return buildGroundedEssayContextPacket({
        mode,
        canon,
        horizon,
        exercise: semiEx,
        step,
        stepNumber: stepIdx + 1,
        draft: {
          ...emptyWrittenStepDraft(),
          response: draftText,
          revision: options?.revisionText ?? '',
          reviewedCriterionIds: checkedIds,
          modelRevealed: revealed,
        },
        chunks: lessonChunks,
        effectiveTheoryAnchors: anchors,
        internalReferenceForWebMcp: fromWebMcp && mode !== 'socratic-hint',
      });
    },
    [lessonChunks, canon, horizon],
  );

  const buildLessonStudyPacket = useCallback((): LessonWebMcpContextPacket => {
    const primaryCard = parsedMicro?.cards[0];
    const targetEx = focusedExercise ?? lessonExercises[0];
    const exAttempts = targetEx
      ? progress.attempts.filter(a => a.exerciseId === targetEx.id)
      : [];
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      course: {
        id: course.id,
        code: canon.academicCode,
        title: course.title,
        practiceOnly,
        notationRules: canon.notationRules,
        forbiddenShortcutHints: canon.forbiddenShortcutHints,
      },
      syllabusHorizon: {
        currentChapter: horizon?.currentChapterTitle ?? chapter?.title ?? course.title,
        currentLesson: lesson.title,
        allowedPrerequisites:
          horizon?.directPrerequisiteLessons.map(p => `${p.title} (${p.chapterTitle})`) ?? [],
        unlearnedChaptersDoNotUse: horizon?.unlearnedChapterTitles ?? [],
      },
      ...(primaryCard
        ? {
            activeLessonSection: {
              sectionTitle: primaryCard.title,
              excerptMarkdown: primaryCard.bodyMarkdown.slice(0, 1800),
            },
          }
        : {}),
      ...(targetEx
        ? {
            focusedExercise: {
              id: targetEx.id,
              title: targetEx.title,
              kind: targetEx.kind,
              prompt: targetEx.prompt,
              ...(exAttempts.length > 0
                ? {
                    studentAttemptSummary: exAttempts.some(a => a.correct)
                      ? `Đã giải đúng (${exAttempts.length} lần thử)`
                      : `Đã thử ${exAttempts.length} lần, chưa chính xác — cần gợi mở Socratic không lộ đáp án`,
                  }
                : {}),
            },
          }
        : {}),
      pedagogicalContract: [
        'Bám sát định nghĩa, ký hiệu và phạm vi chương của bài học hiện tại tại Trường ĐHKHTN – ĐHQGHN.',
        'Tuyệt đối không dùng định lý/công cụ thuộc danh sách chương chưa học (unlearnedChaptersDoNotUse).',
        'Khi hướng dẫn bài tập chưa hoàn thành, đặt câu hỏi Socratic gợi mở từng bước thay vì chép sẵn đáp án cuối cùng.',
      ],
    };
  }, [
    parsedMicro,
    focusedExercise,
    lessonExercises,
    progress.attempts,
    course.id,
    course.title,
    canon,
    practiceOnly,
    horizon,
    chapter,
    lesson.title,
  ]);

  const applyInlineA4Feedback = useCallback(
    (semiEx: SemiEssayExercise, feedback: TutorCoachingFeedback, snapshotText?: string) => {
      const snap = snapshotText ?? inlineA4Drafts[feedback.stepId] ?? '';
      setInlineCoachedSnapshotByStepId(prev => ({ ...prev, [feedback.stepId]: snap }));
      const nextPreview = {
        ...lessonWebMcpRef.current.inlineCoachingByStepId,
        [feedback.stepId]: feedback,
      };
      const passVerdict = didExercisePassViaTutor(semiEx, nextPreview);
      if (passVerdict !== null) {
        progressStore.dispatch({
          type: 'attempt',
          exerciseId: semiEx.id,
          correct: passVerdict,
          at: feedback.receivedAt,
        });
      }
      setInlineCoachingByStepId(prev => {
        const next = { ...prev, [feedback.stepId]: feedback };
        const scoped: Record<string, TutorCoachingFeedback> = {};
        for (const s of semiEx.steps) {
          if (next[s.id]) scoped[s.id] = next[s.id]!;
        }
        saveStoredTutorFeedback(semiEx.id, scoped);
        return next;
      });
    },
    [inlineA4Drafts],
  );

  const clearInlineA4Feedback = useCallback((semiEx: SemiEssayExercise, stepId: string) => {
    setInlineCoachingByStepId(prev => {
      const copy = { ...prev };
      delete copy[stepId];
      const scoped: Record<string, TutorCoachingFeedback> = {};
      for (const s of semiEx.steps) {
        if (copy[s.id]) scoped[s.id] = copy[s.id]!;
      }
      saveStoredTutorFeedback(semiEx.id, scoped);
      return copy;
    });
  }, []);

  const searchLessonCurriculum = useCallback(
    async (query: string, expandCourse: boolean) => {
      let chunksPool = lessonChunks;
      if (expandCourse) {
        const earlier = lessons.filter(
          cand =>
            classifyLessonRelation(course, learningContent, lesson.id, cand.id) !==
            'later-syllabus',
        );
        const missing = earlier.filter(item => item.id !== lesson.id && !extraMarkdownByLessonId[item.id]);
        if (missing.length > 0) {
          const loadedPairs = await Promise.all(
            missing.map(async item => {
              try {
                const md = await loadLessonMarkdown(item.id);
                return [item.id, md] as const;
              } catch {
                return null;
              }
            }),
          );
          const mergedExtra: Record<string, string> = { ...extraMarkdownByLessonId };
          for (const pair of loadedPairs) {
            if (pair) mergedExtra[pair[0]] = pair[1];
          }
          setExtraMarkdownByLessonId(mergedExtra);
          const allMap: Record<string, string> = { ...mergedExtra };
          if (body) allMap[lesson.id] = body;
          chunksPool = indexLessonMarkdownChunks({
            course,
            content: learningContent,
            targetLessonId: lesson.id,
            markdownByLessonId: allMap,
          });
        }
      }
      return searchCurriculumChunks(chunksPool, query, { limit: 4, allowFutureChapters: false });
    },
    [lessonChunks, lessons, course, lesson.id, extraMarkdownByLessonId, body],
  );

  const lessonWebMcpRef = useRef({
    activeInlineA4,
    adaptedClassicByStepId,
    inlineA4Drafts,
    inlineStepMetaByStepId,
    inlineCoachingByStepId,
    buildInlineEssayPacket,
    buildLessonStudyPacket,
    applyInlineA4Feedback,
    searchLessonCurriculum,
  });
  lessonWebMcpRef.current = {
    activeInlineA4,
    adaptedClassicByStepId,
    inlineA4Drafts,
    inlineStepMetaByStepId,
    inlineCoachingByStepId,
    buildInlineEssayPacket,
    buildLessonStudyPacket,
    applyInlineA4Feedback,
    searchLessonCurriculum,
  };

  useEffect(() => {
    const fallbackEntry = [...adaptedClassicByStepId.values()][0] ?? null;
    const registration = registerEssayWebMcpTools({
      getExercise: requestedStepId => {
        if (requestedStepId && lessonWebMcpRef.current.adaptedClassicByStepId.has(requestedStepId)) {
          return lessonWebMcpRef.current.adaptedClassicByStepId.get(requestedStepId)!.exercise;
        }
        return (
          lessonWebMcpRef.current.activeInlineA4?.exercise ??
          fallbackEntry?.exercise ?? {
            id: `${lesson.id}-study`,
            lessonId: lesson.id,
            kind: 'semi-essay',
            title: lesson.title,
            prompt: lesson.title,
            given: [],
            theoryAnchors: [],
            steps: [],
            provenance: course.provenance,
          }
        );
      },
      getActiveStepId: () =>
        lessonWebMcpRef.current.activeInlineA4?.step.id ?? fallbackEntry?.step.id ?? '',
      getContextPacket: (mode, requestedStepId) => {
        const resolved =
          (requestedStepId
            ? lessonWebMcpRef.current.adaptedClassicByStepId.get(requestedStepId)
            : undefined) ??
          lessonWebMcpRef.current.activeInlineA4 ??
          fallbackEntry;
        if (!resolved) return null;
        const text = lessonWebMcpRef.current.inlineA4Drafts[resolved.step.id] ?? '';
        const meta = lessonWebMcpRef.current.inlineStepMetaByStepId[resolved.step.id];
        return lessonWebMcpRef.current.buildInlineEssayPacket(
          resolved.exercise,
          resolved.step,
          text,
          [],
          mode,
          true,
          meta,
        );
      },
      searchCurriculum: (query, expand) =>
        lessonWebMcpRef.current.searchLessonCurriculum(query, expand),
      onReceiveFeedback: feedback => {
        const resolved =
          lessonWebMcpRef.current.adaptedClassicByStepId.get(feedback.stepId) ??
          lessonWebMcpRef.current.activeInlineA4;
        if (resolved) {
          lessonWebMcpRef.current.applyInlineA4Feedback(resolved.exercise, feedback);
        }
      },
      getLessonContextPacket: () => lessonWebMcpRef.current.buildLessonStudyPacket(),
    });
    setWebMcpAvailable(registration.support.available);
    return () => {
      registration.dispose();
    };
  }, [lesson.id, course.provenance, lesson.title, adaptedClassicByStepId]);

  const inlineA4Bridge = useMemo<InlineLessonA4Bridge>(
    () => ({
      canon,
      webMcpAvailable,
      activeStepId: activeInlineA4?.step.id ?? '',
      coachingByStepId: inlineCoachingByStepId,
      coachedSnapshotByStepId: inlineCoachedSnapshotByStepId,
      onActivateExerciseStep: (semiEx, step, draftText, options) => {
        setActiveInlineA4({ exercise: semiEx, step });
        setInlineA4Drafts(prev => ({ ...prev, [step.id]: draftText }));
        if (options) {
          setInlineStepMetaByStepId(prev => ({ ...prev, [step.id]: options }));
        }
      },
      onSyncDraftText: (stepId, draftText, options) => {
        setInlineA4Drafts(prev =>
          prev[stepId] === draftText ? prev : { ...prev, [stepId]: draftText },
        );
        if (options) {
          setInlineStepMetaByStepId(prev => {
            const cur = prev[stepId];
            if (
              cur?.stepNumber === options.stepNumber &&
              cur?.revisionText === options.revisionText &&
              cur?.modelRevealed === options.modelRevealed
            ) {
              return prev;
            }
            return { ...prev, [stepId]: options };
          });
        }
      },
      onBuildPacket: (semiEx, step, draftText, checkedIds, mode, options) =>
        buildInlineEssayPacket(semiEx, step, draftText, checkedIds, mode, false, options),
      onApplyFeedback: applyInlineA4Feedback,
      onClearFeedback: clearInlineA4Feedback,
    }),
    [
      canon,
      webMcpAvailable,
      activeInlineA4,
      inlineCoachingByStepId,
      inlineCoachedSnapshotByStepId,
      buildInlineEssayPacket,
      applyInlineA4Feedback,
      clearInlineA4Feedback,
    ],
  );

  const scrollToLessonExercise = useCallback((exerciseId: string) => {
    if (typeof window === 'undefined') return;
    const target = document.getElementById(`lesson-exercise-${exerciseId}`);
    if (!target) return;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const playgroundSnippets = useMemo(() => {
    if (!inlineCodeLabTool) return undefined;
    const classicPrompts = lessonExercises
      .filter(ex => ex.kind !== 'semi-essay')
      .map(ex => ({ id: ex.id, title: ex.title, prompt: ex.prompt }));
    const preferredLanguage = inferDefaultCodeLanguage({
      lessonMarkdown: body ?? undefined,
      exercisePrompts: classicPrompts.map(item => item.prompt),
    });
    return buildPlaygroundSnippets({
      scopeId: lesson.id,
      exerciseItems: classicPrompts,
      lessonMarkdown: body ?? undefined,
      defaultLanguage: preferredLanguage,
    });
  }, [inlineCodeLabTool, lessonExercises, body, lesson.id]);

  const scrollToInlineCodeLab = () => {
    if (typeof window === 'undefined' || !codeLabSectionRef.current) return;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    codeLabSectionRef.current.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const handleTryCodeSnippet = (snippet: {
    readonly label: string;
    readonly language: CodeLanguage;
    readonly code: string;
  }) => {
    setInjectedSnippet(prev => ({
      nonce: (prev?.nonce ?? 0) + 1,
      label: snippet.label,
      language: snippet.language,
      code: snippet.code,
    }));
    scrollToInlineCodeLab();
  };

  const chapters = useMemo(
    () =>
      course.chapterIds
        .flatMap(id => learningContent.chapters.filter(ch => ch.id === id))
        .map(ch => ({
          id: ch.id,
          title: ch.title,
          lessons: ch.topicIds
            .flatMap(id => learningContent.topics.find(t => t.id === id)?.lessonIds ?? [])
            .flatMap(id => learningContent.lessons.filter(l => l.id === id))
            .map(l => ({
              id: l.id,
              title: l.title,
              to: `/courses/${course.id}/lessons/${l.id}`,
              completed: effectiveCompletedSet.has(l.id),
            })),
        })),
    [course.chapterIds, course.id, effectiveCompletedSet],
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Học phần', to: '/courses' },
          { label: course.title, to: `/courses/${course.id}` },
          { label: lesson.title },
        ]}
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

      <LessonWorkspaceShell
        courseTitle={course.title}
        courseUrl={`/courses/${course.id}`}
        chapters={chapters}
        currentLessonId={lesson.id}
        outline={[]}
      >
        {/* Lesson context bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {course.academicCode ? (
              <Badge tone="accent" mono>
                {course.academicCode}
              </Badge>
            ) : null}
            {practiceOnly ? <Badge tone="warning">Chỉ luyện bài tập</Badge> : null}
            {chapter ? <span>{chapter.title}</span> : null}
            {lessons.length > 0 ? (
              <span className="font-mono tabular-nums">
                · {practiceOnly ? 'Trạm' : 'Bài'} {index + 1}/{lessons.length}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {completed ? <Badge tone="success">Đã hoàn thành</Badge> : null}
            {webMcpAvailable ? <Badge tone="success">WebMCP sẵn sàng</Badge> : null}
            <button
              type="button"
              data-lesson-webmcp-btn="true"
              onClick={async () => {
                const pkt = buildLessonStudyPacket();
                const prompt = formatLessonStudyWebMcpPrompt(pkt, { webMcpAvailable });
                try {
                  await navigator.clipboard.writeText(prompt);
                  setCopiedLessonPrompt(true);
                  window.setTimeout(() => setCopiedLessonPrompt(false), 2500);
                } catch {
                  // Ignore clipboard restrictions silently
                }
              }}
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors duration-200 hover:border-accent hover:text-accent-ink"
            >
              {copiedLessonPrompt ? (
                <CheckIcon width={13} height={13} className="text-success" />
              ) : (
                <CopyIcon width={13} height={13} />
              )}
              <span>{copiedLessonPrompt ? 'Đã chép lệnh Socratic' : 'Hỏi Socratic bài này'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setReadingSize(preferences.readingSize === 'normal' ? 'comfortable' : 'normal')
              }
              aria-pressed={preferences.readingSize === 'comfortable'}
              aria-label={
                preferences.readingSize === 'comfortable'
                  ? 'Chuyển cỡ chữ đọc về tiêu chuẩn'
                  : 'Tăng cỡ chữ đọc thoải mái'
              }
              title={
                preferences.readingSize === 'comfortable'
                  ? 'Cỡ chữ: Thoải mái (nhấn để thu nhỏ)'
                  : 'Cỡ chữ: Tiêu chuẩn (nhấn để phóng lớn)'
              }
              className="inline-flex min-h-[34px] items-center rounded-[var(--radius-md)] border border-border bg-surface-subtle px-2.5 py-1 font-sans text-xs font-medium text-ink-secondary transition-colors duration-200 hover:border-border-strong hover:text-ink active:scale-95"
            >
              {preferences.readingSize === 'comfortable' ? 'Aa−' : 'Aa+'}
            </button>
          </div>
        </div>

        {/* Neighborhood Learning Flow Graph */}
        <div className="not-prose mb-6">
          <LearningFlowNeighborhoodGraph
            flow={lessonFlow}
            ariaLabel="Sơ đồ mạch bài học: cần học trước và học tiếp theo"
          />
        </div>

        {/* Compact Interactive Quest & Ruled-A4 Launch Strips */}
        {lessonQuests.length > 0 || lessonWritten.length > 0 ? (
          <div className="mb-5 space-y-2">
            {lessonQuests.map(quest => {
              const questDone = questProgress.completedQuestIds.includes(quest.id);
              return (
                <div
                  key={quest.id}
                  className="flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--radius-lg)] border border-starlight/40 bg-warning-subtle/45 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                    <Badge tone="warning">☞ Nhiệm vụ 4 mốc</Badge>
                    <span className="font-medium text-ink">{quest.title}</span>
                    {questDone ? <Badge tone="success">Đã chinh phục</Badge> : null}
                  </div>
                  <Link
                    to={`/quests/${quest.id}`}
                    className="hus-btn hus-btn-primary min-h-[34px] shrink-0 px-3 py-1 !no-underline text-xs"
                  >
                    <span>{questDone ? 'Chơi lại' : 'Bắt đầu'}</span>
                    <ArrowRightIcon width={13} height={13} />
                  </Link>
                </div>
              );
            })}

            {lessonWritten.map(item => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--radius-lg)] border border-accent/35 bg-accent-subtle/35 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                  <Badge tone="accent">Tự luận · Giấy A4</Badge>
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className="font-mono text-ink-muted">({item.steps.length} bước)</span>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToLessonExercise(item.id)}
                  className="hus-btn hus-btn-primary min-h-[34px] shrink-0 px-3 py-1 text-xs"
                >
                  <span>Làm trên giấy A4</span>
                  <ArrowRightIcon width={13} height={13} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Practice-Only Direct Exercise Flow OR Guided Micro-Step Lesson Track */}
        {(() => {
          const linkedToolsSection =
            linkedTools.length > 0 ? (
              <section
                aria-label="Công cụ thực hành liên quan"
                className={`${practiceOnly ? '' : 'mt-8 '}space-y-3`}
              >
                {linkedTools.map(item => {
                  const key = `${item.toolId}-${item.preset ?? ''}`;
                  const isOpened = Boolean(openedLinkedToolKeys[key]);
                  const ToolComponent = item.Component;
                  return (
                    <details
                      key={key}
                      data-inline-linked-tool={item.toolId}
                      onToggle={event => {
                        if ((event.currentTarget as HTMLDetailsElement).open && !isOpened) {
                          setOpenedLinkedToolKeys(prev => ({ ...prev, [key]: true }));
                        }
                      }}
                      className="group rounded-[var(--radius-xl)] border border-accent/35 bg-surface p-4 sm:p-5"
                    >
                      <summary className="flex min-h-[40px] cursor-pointer select-none flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge tone="accent">Phòng thực hành trực quan</Badge>
                          <span>{item.label}</span>
                        </div>
                        <Badge tone="neutral">Mở ngay tại bài học</Badge>
                      </summary>
                      {isOpened ? (
                        <div className="mt-4 border-t border-border pt-4">
                          <ErrorBoundary>
                            <Suspense
                              fallback={
                                <p role="status" className="text-sm text-ink-muted">
                                  Đang tải {item.tool.title}…
                                </p>
                              }
                            >
                              <ToolComponent
                                courseId={course.id}
                                lessonId={lesson.id}
                                lessonTitle={lesson.title}
                                initialPreset={item.preset}
                                embeddedSurface="lesson-exercise"
                              />
                            </Suspense>
                          </ErrorBoundary>
                        </div>
                      ) : null}
                    </details>
                  );
                })}
              </section>
            ) : null;

          const mitSupplementSection = hasMitSupplement ? (
            <section
              aria-labelledby="mit-supplement-heading"
              className={`${practiceOnly ? 'mt-6 ' : 'mt-10 '}space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface-subtle/40 p-4 sm:p-5`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="mit-supplement-heading"
                    className="!my-0 !border-0 !pb-0 text-base font-semibold text-ink"
                  >
                    Bổ trợ từ MIT OpenCourseWare
                  </h2>
                  {mitSupplement.selfStudyChapter ? (
                    <Badge tone="warning">Chương tự học</Badge>
                  ) : null}
                </div>
                <p className="!my-0 text-xs text-ink-secondary">
                  Học liệu bổ trợ nguồn ngoài bằng tiếng Anh, đi kèm bài giảng HUS ở trên. Video
                  chỉ tải trình phát khi bạn bấm “Xem video tại đây”.
                </p>
              </div>

              {mitSupplement.supplement.length > 0 ? (
                <ul className="!my-0 !list-none !pl-0 space-y-2.5">
                  {mitSupplement.supplement.map(item => (
                    <MitVideoCard key={item.id} resource={item} />
                  ))}
                </ul>
              ) : null}

              {mitSupplement.furtherReading.length > 0 ? (
                <details className="rounded-[var(--radius-lg)] border border-border bg-canvas/50 px-3.5 py-2.5">
                  <summary className="cursor-pointer text-xs font-medium text-ink">
                    Đọc thêm nâng cao ({mitSupplement.furtherReading.length} mục, không bắt buộc)
                  </summary>
                  <ul className="!mb-0 !mt-3 !list-none !pl-0 space-y-2.5">
                    {mitSupplement.furtherReading.map(item => (
                      <MitVideoCard key={item.id} resource={item} />
                    ))}
                  </ul>
                </details>
              ) : null}

              {mitSupplement.comparisonNoteVi ? (
                <p className="!my-0 text-xs leading-relaxed text-ink-secondary">
                  <strong className="font-semibold text-ink">Lưu ý đối chiếu HUS: </strong>
                  {mitSupplement.comparisonNoteVi}
                </p>
              ) : null}
            </section>
          ) : null;

          const exercisesSection =
            combinedLessonExercises.length > 0 || LazyInlineCodeLab ? (
              <section
                aria-labelledby="lesson-exercises-heading"
                className={
                  practiceOnly
                    ? 'space-y-5'
                    : 'mt-10 space-y-5 border-t border-border pt-8'
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2
                    id="lesson-exercises-heading"
                    className="!my-0 !border-0 !pb-0 text-lg font-semibold text-ink"
                  >
                    Bài tập tự luyện
                  </h2>
                  {combinedLessonExercises.length > 0 ? (
                    <span className="font-mono text-xs tabular-nums text-ink-muted">
                      {combinedLessonExercises.length} câu hỏi
                    </span>
                  ) : null}
                </div>
                <Suspense
                  fallback={
                    <p role="status" className="text-sm text-ink-muted">
                      Đang tải bài tập…
                    </p>
                  }
                >
                  {combinedLessonExercises.map(exercise => {
                    if (exercise.kind === 'semi-essay') {
                      return (
                        <InlineSemiEssayExerciseCard
                          key={exercise.id}
                          exercise={exercise}
                          curriculumChunks={lessonChunks}
                          symbolContext={symbolContext}
                          inlineA4Bridge={inlineA4Bridge}
                          onFocusExercise={setFocusedExercise}
                          onTryCodeSnippet={
                            LazyInlineCodeLab ? handleTryCodeSnippet : undefined
                          }
                        />
                      );
                    }
                    return (
                      <ExerciseSession
                        key={exercise.id}
                        exercise={exercise}
                        symbolContext={symbolContext}
                        onFocusExercise={setFocusedExercise}
                        inlineA4Bridge={inlineA4Bridge}
                        onTryCodeSnippet={
                          LazyInlineCodeLab ? handleTryCodeSnippet : undefined
                        }
                      />
                    );
                  })}
                </Suspense>

                {LazyInlineCodeLab ? (
                  <div
                    id="lesson-code-lab"
                    ref={codeLabSectionRef}
                    className="scroll-mt-24 space-y-4 pt-2"
                  >
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
                          playgroundSnippets={playgroundSnippets}
                          injectedSnippet={injectedSnippet}
                          embeddedSurface="lesson-exercise"
                        />
                      </Suspense>
                    </ErrorBoundary>

                    {lazyInlineExtras.map(({ tool, Component }) => (
                      <details
                        key={tool.id}
                        className="group rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5"
                      >
                        <summary className="flex min-h-[36px] cursor-pointer select-none flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
                          <span>Luyện tập bổ trợ tại chỗ: {tool.title}</span>
                          <Badge tone="neutral">Mở ngay tại trang</Badge>
                        </summary>
                        <div className="mt-4 border-t border-border pt-4">
                          <ErrorBoundary>
                            <Suspense
                              fallback={
                                <p role="status" className="text-sm text-ink-muted">
                                  Đang tải {tool.title}…
                                </p>
                              }
                            >
                              <Component courseId={course.id} lessonId={lesson.id} />
                            </Suspense>
                          </ErrorBoundary>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null;

          if (practiceOnly) {
            return (
              <div data-practice-only-lesson="true" className="not-prose space-y-6">
                <div className="space-y-3">
                  <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                    {parsedMicro?.title ?? lesson.title}
                  </h1>
                  <p
                    data-practice-only-banner="true"
                    className="!my-0 rounded-[var(--radius-lg)] border border-accent/30 bg-accent-subtle/35 px-4 py-2.5 text-xs leading-relaxed text-ink-secondary"
                  >
                    <strong className="font-semibold text-ink">
                      Chế độ luyện bài tập ({course.academicCode ?? course.id}):
                    </strong>{' '}
                    Bỏ qua các chặng học lý thuyết — bạn giải trực tiếp các bài tập bên dưới là hoàn thành trạm. Khi quên công thức có thể mở sổ tra cứu thu gọn ở cuối bài.
                  </p>
                </div>

                {linkedToolsSection}
                {exercisesSection}

                <details
                  data-formula-reference="true"
                  className="group rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5"
                >
                  <summary className="flex min-h-[40px] cursor-pointer select-none flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
                    <span>Tra cứu nhanh công thức &amp; ví dụ mẫu (chỉ mở khi quên)</span>
                    <Badge tone="neutral">Sổ tra cứu thu gọn</Badge>
                  </summary>
                  <div className="hus-panel-enter mt-4 space-y-6 border-t border-border pt-4">
                    {loadError ? (
                      <div
                        role="alert"
                        className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-subtle p-4 text-sm text-danger"
                      >
                        <p className="!my-0 !text-danger">{loadError}</p>
                        <button
                          type="button"
                          onClick={() => setRetry(n => n + 1)}
                          className="hus-btn hus-btn-secondary mt-3 text-xs"
                        >
                          Thử lại
                        </button>
                      </div>
                    ) : body === null || !parsedMicro ? (
                      <p role="status" className="text-sm text-ink-muted">
                        Đang tải bảng công thức…
                      </p>
                    ) : (
                      <>
                        {parsedMicro.cards.map(card => (
                          <section key={card.id} className="space-y-3 border-b border-border/70 pb-5 last:border-b-0 last:pb-0">
                            <h3 className="!my-0 font-display text-lg font-medium text-ink">
                              {card.title}
                            </h3>
                            {card.bodyMarkdown.trim().length > 0 ? (
                              <div className="academic-prose">
                                <Markdown>{card.bodyMarkdown}</Markdown>
                              </div>
                            ) : null}
                            {card.deepDiveMarkdown ? (
                              <div className="academic-prose rounded-[var(--radius-lg)] border border-border bg-surface-subtle/50 p-3.5">
                                <Markdown>{card.deepDiveMarkdown}</Markdown>
                              </div>
                            ) : null}
                          </section>
                        ))}
                        {parsedMicro.attributionFooter ? (
                          <footer className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle/40 px-4 py-3 text-xs text-ink-muted">
                            <div className="academic-prose text-xs">
                              <Markdown>{parsedMicro.attributionFooter}</Markdown>
                            </div>
                          </footer>
                        ) : null}
                      </>
                    )}
                  </div>
                </details>

                {mitSupplementSection}
              </div>
            );
          }

          return loadError ? (
            <div
              role="alert"
              className="rounded-[var(--radius-md)] border border-danger/30 bg-danger-subtle p-4 text-sm text-danger"
            >
              <p className="!my-0 !text-danger">{loadError}</p>
              <button
                type="button"
                onClick={() => setRetry(n => n + 1)}
                className="hus-btn hus-btn-secondary mt-3 text-xs"
              >
                Thử lại
              </button>
            </div>
          ) : body === null || !parsedMicro ? (
            <LessonSkeleton label="Đang tải bài học…" />
          ) : (
            <div className="not-prose space-y-5">
              <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                {parsedMicro.title}
              </h1>
              <MicroLessonStepper
                lessonId={lesson.id}
                parsed={parsedMicro}
                animationSpec={animationSpec}
                practiceLabUrl={practiceLabUrl}
                onJumpToCodeLab={LazyInlineCodeLab ? scrollToInlineCodeLab : undefined}
                isLessonCompleted={completed}
                onCompleteLesson={() => {
                  if (!explicitlyCompleted) {
                    progressStore.dispatch({
                      type: 'complete',
                      lessonId: lesson.id,
                      completed: true,
                    });
                  }
                }}
                afterCardContent={
                  <>
                    {linkedToolsSection}
                    {mitSupplementSection}
                    {exercisesSection}
                  </>
                }
              />
            </div>
          );
        })()}

        {/* Completion control bar */}
        {practiceOnly || (body !== null && !loadError) ? (
          <div className="mt-10 flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-surface-subtle/65 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="!my-0 text-sm font-semibold text-ink">
                {completed
                  ? practiceOnly
                    ? 'Bạn đã hoàn thành trạm bài tập này'
                    : 'Bạn đã hoàn thành bài học này'
                  : practiceOnly
                    ? 'Hoàn thành trạm bài tập'
                    : 'Hoàn thành bài học'}
              </p>
              <p className="!my-1 text-xs text-ink-muted">
                {practiceOnly && completed && !explicitlyCompleted
                  ? 'Tự động ghi nhận khi bạn giải đúng bài tập trong trạm này.'
                  : 'Trạng thái được lưu cục bộ trên trình duyệt này.'}
              </p>
            </div>
            {practiceOnly && completed && !explicitlyCompleted ? (
              <Badge tone="success">
                <CheckCircleIcon width={14} height={14} />
                Đã hoàn thành qua bài tập
              </Badge>
            ) : (
              <button
                type="button"
                aria-pressed={explicitlyCompleted}
                onClick={() =>
                  progressStore.dispatch({
                    type: 'complete',
                    lessonId: lesson.id,
                    completed: !explicitlyCompleted,
                  })
                }
                className={`hus-btn shrink-0 ${
                  explicitlyCompleted
                    ? 'border border-success/40 bg-success-subtle text-success hover:border-success'
                    : 'hus-btn-primary'
                }`}
              >
                <CheckCircleIcon width={16} height={16} />
                {explicitlyCompleted ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
              </button>
            )}
          </div>
        ) : null}

        {/* Station & Previous / Next lesson navigation */}
        <nav
          aria-label="Mạch bài học kế tiếp"
          className="mt-8 space-y-3 border-t border-border pt-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Mạch bài học kế tiếp
            </span>
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 px-3 py-1 text-xs font-medium text-accent !no-underline transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              ← Về Sơ đồ liên kết bài học ({course.academicCode ?? course.id})
            </Link>
          </div>
          {chapter ? (
            <div
              className={`flex flex-col gap-3 rounded-[var(--radius-xl)] border p-4 sm:flex-row sm:items-center sm:justify-between ${
                isEndOfChapter
                  ? 'border-accent/55 bg-accent-subtle/45'
                  : 'border-border bg-surface-subtle/50'
              }`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={isEndOfChapter ? 'accent' : 'neutral'} mono>
                    {isEndOfChapter
                      ? `Hoàn tất Chương ${chapterIndex + 1}`
                      : `Chương ${chapterIndex + 1}`}
                  </Badge>
                  <span className="text-xs text-ink-muted">
                    Đề 3–10 câu tùy dạng bài &amp; độ dài (kèm tự luận giấy A4)
                  </span>
                </div>
                <p className="!my-0 text-sm font-semibold text-ink">
                  Kiểm tra cuối chương: {chapter.title}
                </p>
              </div>
              <Link
                to={`/courses/${course.id}/chapters/${chapter.id}/exam`}
                className={`hus-btn shrink-0 !no-underline text-xs ${
                  isEndOfChapter ? 'hus-btn-primary' : 'hus-btn-secondary'
                }`}
              >
                <span>Làm bài kiểm tra chương</span>
                <ArrowRightIcon width={14} height={14} />
              </Link>
            </div>
          ) : null}

          {previous || next ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {previous ? (
                <Link
                  to={`/courses/${course.id}/lessons/${previous.id}`}
                  data-lesson-nav="prev"
                  className="group flex min-h-[68px] flex-col justify-center rounded-[var(--radius-xl)] border border-border bg-canvas px-4 py-3.5 !no-underline transition-[border-color,background-color,transform] duration-300 ease-[var(--hus-ease)] hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-subtle"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <ArrowLeftIcon width={13} height={13} />
                    Bài trước
                  </span>
                  <span className="mt-1 line-clamp-1 font-display text-base font-medium text-ink group-hover:text-accent">
                    {previous.title}
                  </span>
                </Link>
              ) : (
                <div className="hidden sm:block" />
              )}

              {next ? (
                <Link
                  to={`/courses/${course.id}/lessons/${next.id}`}
                  data-lesson-nav="next"
                  className="group flex min-h-[68px] flex-col justify-center rounded-[var(--radius-xl)] border border-border bg-canvas px-4 py-3.5 text-left !no-underline transition-[border-color,background-color,transform] duration-300 ease-[var(--hus-ease)] hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-subtle sm:items-end sm:text-right"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    Bài tiếp theo
                    <ArrowRightIcon width={13} height={13} />
                  </span>
                  <span className="mt-1 line-clamp-1 font-display text-base font-medium text-ink group-hover:text-accent">
                    {next.title}
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
        </nav>

        {lesson.provenance?.attribution ? (
          <footer className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-ink-muted">
            {lesson.provenance.attribution}
          </footer>
        ) : null}
      </LessonWorkspaceShell>
    </div>
  );
}
