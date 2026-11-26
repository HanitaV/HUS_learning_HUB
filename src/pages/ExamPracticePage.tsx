import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { resolveCourseConventionCanon } from '../content/curriculum-canons';
import type { InjectedCodeSnippet } from '../contracts/subject-module';
import type {
  ChapterExamDraft,
  ChapterExamLengthPreset,
  ExamAnswerMode,
  ExamQuestionSourceFilter,
  ExerciseFormKind,
} from '../domain/chapter-exam';
import type { CodeLanguage } from '../domain/code-lab';
import type {
  CoachingHistoryEntry,
  CoachingPromptMode,
  GroundedEssayContextPacket,
  ReasoningScaffoldTemplate,
  StepCoachingLifecycleState,
  TutorCoachingFeedback,
} from '../domain/curriculum-tutor';
import type { MathSymbolContext } from '../domain/math-symbols';
import type { SemiEssayExercise, WrittenReasoningStep } from '../domain/semi-essay';
import type { ClassicExerciseDefinition, ExerciseDefinition } from '../domain/workspace';
import {
  buildPlaygroundSnippets,
  extractSingleExerciseSnippet,
  inferDefaultCodeLanguage,
} from '../core/code-lab/playground';
import {
  buildChapterExamPaper,
  evaluateChapterExam,
  extractWrittenStepsForExam,
  summarizeChapterExamPool,
} from '../core/learning/chapter-exam';
import { courseLessons } from '../core/learning/content';
import {
  deriveStepCoachingState,
  formatScoreVi,
} from '../core/learning/webmcp-essay-adapters';
import {
  parseBatchExternalTutorFeedback,
  parseExternalTutorFeedback,
} from '../infrastructure/ai/tutor-feedback-parser';
import { formatWholeExamWebMcpPrompt } from '../infrastructure/ai/webmcp-essay-bridge';
import { courseRegistry, getSubjectModule, subjectList } from '../infrastructure/content/catalogue';
import {
  learningContent,
  loadCourseExercises,
} from '../infrastructure/content/learning';
import { useExamWebMcpBridge } from '../app/useExamWebMcpBridge';
import {
  clearInteractiveStepDraftsByPrefix,
} from '../infrastructure/practice/interactive-step-drafts';
import {
  clearStoredExamPracticeSession,
  loadStoredExamPracticeConfig,
  loadStoredExamPracticeSession,
  saveStoredExamPracticeConfig,
  saveStoredExamPracticeSession,
} from '../infrastructure/progress/exam-practice-store';
import { progressStore } from '../infrastructure/progress/store';
import { EssayWebMcpCoachPanel } from '../components/learning/EssayWebMcpCoachPanel';
import { ExamInlineCodeLabSection } from '../components/learning/ExamInlineCodeLabSection';
import {
  EXAM_FORM_LABEL,
  ExamObjectiveQuestionCard,
} from '../components/learning/ExamObjectiveQuestionCard';
import { ExamWebMcpStatusBar } from '../components/learning/ExamWebMcpStatusBar';
import Markdown from '../components/learning/Markdown';
import { ProblemFigure } from '../components/learning/ProblemFigure';
import { RuledA4Sheet } from '../components/learning/RuledA4Sheet';
import {
  SemiEssayInteractiveStepBody,
  STEP_KIND_LABEL,
} from '../components/learning/SemiEssayInteractiveSteps';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  PlayIcon,
  RotateCcwIcon,
} from '../components/ui/Icons';
import { PageSkeleton } from '../components/ui/Skeleton';

const ORIGIN_FORM_TAG: Readonly<Record<ExerciseFormKind, string>> = {
  'multiple-choice': 'Chuyển từ kho Trắc nghiệm',
  'multiple-answer': 'Chuyển từ kho Chọn nhiều ý',
  'short-answer': 'Chuyển từ kho Trả lời ngắn',
  'semi-essay': 'Câu gốc Tự luận chuyên sâu',
};

const PRESET_META: readonly {
  readonly id: ChapterExamLengthPreset;
  readonly label: string;
  readonly desc: string;
}[] = [
  { id: 'short', label: 'Đề ngắn', desc: '3–4 câu rà nhanh cách trình bày' },
  { id: 'standard', label: 'Đề tiêu chuẩn', desc: '5–7 câu cân bằng các dạng' },
  { id: 'comprehensive', label: 'Đề tổng hợp', desc: '8–10 câu bao quát sâu' },
];

const EMPTY_DRAFT: ChapterExamDraft = {
  objectiveAnswers: {},
  writtenResponses: {},
  checkedRubricIds: {},
};

interface ExamWrittenStepItemProps {
  readonly questionNumber: number;
  readonly subPartIndex: number;
  readonly totalStepsInQuestion: number;
  readonly exercise: SemiEssayExercise;
  readonly step: WrittenReasoningStep;
  readonly stepNumber: number;
  readonly responseText: string;
  readonly lifecycleState: StepCoachingLifecycleState;
  readonly scaffolds: readonly ReasoningScaffoldTemplate[] | undefined;
  readonly isActiveTarget: boolean;
  readonly hasCanon: boolean;
  readonly webMcpAvailable: boolean;
  readonly symbolContext: MathSymbolContext | undefined;
  readonly stepCoaching: TutorCoachingFeedback | undefined;
  readonly stepCoachingHistory?: readonly CoachingHistoryEntry[] | undefined;
  readonly onActivateStep: (stepId: string) => void;
  readonly onChangeResponse: (stepId: string, value: string) => void;
  readonly onBuildPacket: (
    exercise: SemiEssayExercise,
    step: WrittenReasoningStep,
    stepNumber: number,
    mode: CoachingPromptMode,
  ) => GroundedEssayContextPacket | null;
  readonly onApplyFeedback: (exercise: SemiEssayExercise, feedback: TutorCoachingFeedback) => void;
  readonly onClearFeedback: (exercise: SemiEssayExercise, stepId: string) => void;
}

const ExamWrittenStepItem = memo(function ExamWrittenStepItem({
  questionNumber,
  subPartIndex,
  totalStepsInQuestion,
  exercise,
  step,
  stepNumber,
  responseText,
  lifecycleState,
  scaffolds,
  isActiveTarget,
  hasCanon,
  webMcpAvailable,
  symbolContext,
  stepCoaching,
  stepCoachingHistory,
  onActivateStep,
  onChangeResponse,
  onBuildPacket,
  onApplyFeedback,
  onClearFeedback,
}: ExamWrittenStepItemProps) {
  return (
    <div className="space-y-2.5" onFocusCapture={() => onActivateStep(step.id)}>
      {totalStepsInQuestion > 1 || step.prompt !== exercise.prompt ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">
            {totalStepsInQuestion > 1
              ? `Ý ${String.fromCharCode(97 + subPartIndex)}) ${step.title}`
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
          totalStepsInQuestion > 1
            ? `Bài làm Câu ${questionNumber}${String.fromCharCode(97 + subPartIndex)}`
            : `Bài làm tự luận Câu ${questionNumber}`
        }
        sheetTag="Giấy thi A4 kẻ ngang"
        value={responseText}
        symbolContext={symbolContext}
        defaultToolbarOpen={false}
        toolbarLabel={`Bảng ký hiệu đặc biệt Câu ${questionNumber}`}
        onChange={val => onChangeResponse(step.id, val)}
      />

      {hasCanon ? (
        <EssayWebMcpCoachPanel
          stepId={step.id}
          rubric={step.rubric}
          hasDraft={Boolean(responseText.trim())}
          modelRevealed={false}
          webMcpAvailable={webMcpAvailable}
          variant="exam-sheet"
          lifecycleState={lifecycleState}
          scaffolds={scaffolds}
          onInsertScaffold={scaffold => {
            const cur = responseText.trim();
            const nextVal = cur ? `${responseText.trimEnd()}\n\n${scaffold.template}` : scaffold.template;
            onChangeResponse(step.id, nextVal);
            requestAnimationFrame(() => {
              document.getElementById(`exam-written-${step.id}`)?.focus();
            });
          }}
          emphasizePresentationCheck
          hideRubricPrompts
          isActiveTarget={isActiveTarget}
          onActivateTarget={() => onActivateStep(step.id)}
          coachingFeedback={stepCoaching}
          coachingHistory={stepCoachingHistory}
          getGroundedPacket={mode => onBuildPacket(exercise, step, stepNumber, mode)!}
          onImportFeedbackText={rawText => {
            const parsed = parseExternalTutorFeedback(rawText, exercise, step.id, 'clipboard');
            if (!parsed.ok) return { ok: false, error: parsed.error };
            onApplyFeedback(exercise, parsed.value);
            return { ok: true };
          }}
          onClearFeedback={() => onClearFeedback(exercise, step.id)}
        />
      ) : null}
    </div>
  );
});

const ExamPracticeObjectiveItem = memo(function ExamPracticeObjectiveItem({
  questionNumber,
  totalQuestions,
  exercise,
  lessonTitle,
  lessonUrl,
  symbolContext,
  answer,
  submitted,
  correct,
  onLoadCodeSnippet,
  onChangeExerciseAnswer,
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
  readonly onLoadCodeSnippet?: (() => void) | undefined;
  readonly onChangeExerciseAnswer: (
    exerciseId: string,
    nextAns: string | readonly string[],
  ) => void;
}) {
  const handleChange = useCallback(
    (nextAns: string | readonly string[]) => {
      onChangeExerciseAnswer(exercise.id, nextAns);
    },
    [exercise.id, onChangeExerciseAnswer],
  );
  return (
    <ExamObjectiveQuestionCard
      questionNumber={questionNumber}
      totalQuestions={totalQuestions}
      exercise={exercise}
      lessonTitle={lessonTitle}
      lessonUrl={lessonUrl}
      symbolContext={symbolContext}
      answer={answer}
      submitted={submitted}
      correct={correct}
      onLoadCodeSnippet={onLoadCodeSnippet}
      onChangeAnswer={handleChange}
    />
  );
});

export default function ExamPracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const availableCourses = useMemo(
    () => courseRegistry.list().filter(c => c.status === 'available'),
    [],
  );

  const coursesBySubject = useMemo(
    () =>
      subjectList
        .map(subject => ({
          subject,
          courses: availableCourses.filter(c => c.subjectId === subject.id),
        }))
        .filter(group => group.courses.length > 0),
    [availableCourses],
  );

  const storedConfig = useMemo(() => loadStoredExamPracticeConfig(), []);

  const initialCourseId = useMemo(() => {
    const fromQuery = searchParams.get('course');
    if (fromQuery && availableCourses.some(c => c.id === fromQuery)) return fromQuery;
    if (storedConfig && availableCourses.some(c => c.id === storedConfig.courseId)) {
      return storedConfig.courseId;
    }
    return availableCourses[0]?.id ?? '';
  }, [availableCourses, searchParams, storedConfig]);

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const course = useMemo(
    () => availableCourses.find(c => c.id === selectedCourseId) ?? availableCourses[0],
    [availableCourses, selectedCourseId],
  );

  const courseChapters = useMemo(() => {
    if (!course) return [];
    return course.chapterIds
      .map(cid => learningContent.chapters.find(ch => ch.id === cid))
      .filter((ch): ch is NonNullable<typeof ch> => ch !== undefined);
  }, [course]);

  const initialChapterScope = useMemo(() => {
    const fromQuery = searchParams.get('chapter');
    if (fromQuery === 'all') return 'all';
    if (fromQuery && courseChapters.some(ch => ch.id === fromQuery)) return fromQuery;
    if (
      storedConfig &&
      storedConfig.courseId === initialCourseId &&
      (storedConfig.chapterScope === 'all' ||
        courseChapters.some(ch => ch.id === storedConfig.chapterScope))
    ) {
      return storedConfig.chapterScope;
    }
    return 'all';
  }, [courseChapters, initialCourseId, searchParams, storedConfig]);

  const initialAnswerMode = useMemo<ExamAnswerMode>(() => {
    const fromQuery = searchParams.get('mode');
    if (fromQuery === 'mixed' || fromQuery === 'written-all') return fromQuery;
    return storedConfig?.answerMode ?? 'written-all';
  }, [searchParams, storedConfig]);

  const initialQuestionSource = useMemo<ExamQuestionSourceFilter>(() => {
    const fromQuery = searchParams.get('source');
    if (fromQuery === 'all-db' || fromQuery === 'essay-only') return fromQuery;
    return storedConfig?.questionSource ?? 'all-db';
  }, [searchParams, storedConfig]);

  const [chapterScope, setChapterScope] = useState<string>(initialChapterScope);
  const [answerMode, setAnswerMode] = useState<ExamAnswerMode>(initialAnswerMode);
  const [questionSource, setQuestionSource] =
    useState<ExamQuestionSourceFilter>(initialQuestionSource);

  const effectiveChapterScope = useMemo(() => {
    if (chapterScope === 'all') return 'all';
    return courseChapters.some(ch => ch.id === chapterScope) ? chapterScope : 'all';
  }, [chapterScope, courseChapters]);

  const activeChapter = useMemo(
    () =>
      effectiveChapterScope === 'all'
        ? undefined
        : courseChapters.find(ch => ch.id === effectiveChapterScope),
    [courseChapters, effectiveChapterScope],
  );

  // Persist workbench configuration
  useEffect(() => {
    if (!course) return;
    saveStoredExamPracticeConfig({
      version: 1,
      courseId: course.id,
      chapterScope: effectiveChapterScope,
      answerMode,
      questionSource,
    });
  }, [course, effectiveChapterScope, answerMode, questionSource]);

  const allCourseLessons = useMemo(
    () => (course ? courseLessons(learningContent, course) : []),
    [course],
  );

  const scopedLessons = useMemo(() => {
    if (!course) return [];
    if (!activeChapter) return allCourseLessons;
    return activeChapter.topicIds
      .flatMap(tid => learningContent.topics.find(t => t.id === tid)?.lessonIds ?? [])
      .flatMap(lid => learningContent.lessons.filter(l => l.id === lid));
  }, [course, activeChapter, allCourseLessons]);

  const lessonOrder = useMemo(() => scopedLessons.map(l => l.id), [scopedLessons]);
  const lessonById = useMemo(
    () => new Map(allCourseLessons.map(l => [l.id, l])),
    [allCourseLessons],
  );

  const chapterByLessonId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of courseChapters) {
      const idx = course ? course.chapterIds.indexOf(ch.id) : -1;
      const prefix = /^(Chương\s+\d+|Bài\s+\d+)/i.exec(ch.title)?.[1] ?? `Chương ${idx + 1}`;
      for (const tid of ch.topicIds) {
        const topic = learningContent.topics.find(t => t.id === tid);
        for (const lid of topic?.lessonIds ?? []) {
          map.set(lid, prefix);
        }
      }
    }
    return map;
  }, [course, courseChapters]);

  const symbolContext = useMemo<MathSymbolContext | undefined>(() => {
    if (!course) return undefined;
    return {
      subjectId: course.subjectId,
      courseId: course.id,
      ...(activeChapter
        ? { chapterId: activeChapter.id, chapterLabel: activeChapter.title }
        : {}),
      courseLabel: course.title,
    };
  }, [course, activeChapter]);

  const [courseExercisePool, setCourseExercisePool] = useState<
    readonly ExerciseDefinition[] | null | undefined
  >(undefined);

  useEffect(() => {
    let active = true;
    if (!course) {
      setCourseExercisePool(null);
      return;
    }
    setCourseExercisePool(undefined);
    loadCourseExercises(course.id)
      .then(list => {
        if (active) setCourseExercisePool(list);
      })
      .catch(() => {
        if (active) setCourseExercisePool(null);
      });
    return () => {
      active = false;
    };
  }, [course]);

  const chapterFilteredExercises = useMemo(() => {
    if (!courseExercisePool) return [];
    const allowedLessonIds = new Set(lessonOrder);
    return courseExercisePool.filter(ex => allowedLessonIds.has(ex.lessonId));
  }, [courseExercisePool, lessonOrder]);

  const essayOnlyCount = useMemo(
    () => chapterFilteredExercises.filter(ex => ex.kind === 'semi-essay').length,
    [chapterFilteredExercises],
  );

  const activePool = useMemo(() => {
    if (questionSource === 'essay-only') {
      const essays = chapterFilteredExercises.filter(ex => ex.kind === 'semi-essay');
      return essays.length > 0 ? essays : chapterFilteredExercises;
    }
    return chapterFilteredExercises;
  }, [chapterFilteredExercises, questionSource]);

  const sessionCompositeKey = `${course?.id ?? ''}:${effectiveChapterScope}:${questionSource}:${answerMode}`;
  const storedSession = useMemo(
    () =>
      course
        ? loadStoredExamPracticeSession(
            course.id,
            effectiveChapterScope,
            questionSource,
            answerMode,
          )
        : null,
    [course, effectiveChapterScope, questionSource, answerMode],
  );

  const [preset, setPreset] = useState<ChapterExamLengthPreset>(
    () => storedSession?.preset ?? 'standard',
  );
  const [customCount, setCustomCount] = useState<number | undefined>(
    () => storedSession?.customCount,
  );
  const [seed, setSeed] = useState<number>(() => storedSession?.seed ?? 1);
  const [submitted, setSubmitted] = useState<boolean>(() => storedSession?.submitted ?? false);
  const [draft, setDraft] = useState<ChapterExamDraft>(
    () => storedSession?.draft ?? EMPTY_DRAFT,
  );
  const [pinnedExerciseIds, setPinnedExerciseIds] = useState<readonly string[] | undefined>(() => {
    const raw = searchParams.get('pinned');
    if (!raw) return undefined;
    const ids = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  });

  useEffect(() => {
    const raw = searchParams.get('pinned');
    if (!raw) return;
    const ids = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    setPinnedExerciseIds(prev => {
      if (prev && prev.length === ids.length && prev.every((id, idx) => id === ids[idx])) {
        return prev;
      }
      return ids;
    });
  }, [searchParams]);
  const [coachedSnapshotByStepId, setCoachedSnapshotByStepId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [lastCoachedQuestionNumber, setLastCoachedQuestionNumber] = useState<number | null>(null);
  const [wholePaperCopyMessage, setWholePaperCopyMessage] = useState<string | null>(null);

  const [trackedKey, setTrackedKey] = useState(sessionCompositeKey);
  if (sessionCompositeKey !== trackedKey) {
    setTrackedKey(sessionCompositeKey);
    const hydrated = course
      ? loadStoredExamPracticeSession(
          course.id,
          effectiveChapterScope,
          questionSource,
          answerMode,
        )
      : null;
    setPreset(hydrated?.preset ?? 'standard');
    setCustomCount(hydrated?.customCount);
    setSeed(hydrated?.seed ?? 1);
    setSubmitted(hydrated?.submitted ?? false);
    setDraft(hydrated?.draft ?? EMPTY_DRAFT);
    setPinnedExerciseIds(undefined);
    setCoachedSnapshotByStepId({});
    setLastCoachedQuestionNumber(null);
    setWholePaperCopyMessage(null);
  }

  const pendingSessionFlushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!course) return;
    const flushNow = () => {
      pendingSessionFlushRef.current = null;
      saveStoredExamPracticeSession(course.id, effectiveChapterScope, questionSource, answerMode, {
        version: 1,
        preset,
        customCount,
        seed,
        submitted,
        draft,
      });
    };
    pendingSessionFlushRef.current = flushNow;
    const timer = window.setTimeout(flushNow, 80);
    return () => {
      window.clearTimeout(timer);
      if (pendingSessionFlushRef.current) {
        pendingSessionFlushRef.current();
      }
    };
  }, [course, effectiveChapterScope, questionSource, answerMode, preset, customCount, seed, submitted, draft]);

  useEffect(() => {
    const handlePageFlush = () => {
      pendingSessionFlushRef.current?.();
    };
    window.addEventListener('beforeunload', handlePageFlush);
    window.addEventListener('pagehide', handlePageFlush);
    return () => {
      window.removeEventListener('beforeunload', handlePageFlush);
      window.removeEventListener('pagehide', handlePageFlush);
    };
  }, []);

  const canon = useMemo(() => {
    if (!course) return undefined;
    return resolveCourseConventionCanon({
      courseId: course.id,
      academicCode: course.academicCode,
      subjectId: course.subjectId,
      courseTitle: course.title,
    });
  }, [course]);

  const poolSummary = useMemo(
    () => summarizeChapterExamPool(activePool, lessonOrder),
    [activePool, lessonOrder],
  );

  const paper = useMemo(
    () =>
      buildChapterExamPaper({
        exercises: activePool,
        lessonOrder,
        preset,
        customCount,
        seed,
        answerMode,
        canon,
        pinnedExerciseIds,
      }),
    [activePool, lessonOrder, preset, customCount, seed, answerMode, canon, pinnedExerciseIds],
  );

  const writtenStepEntries = useMemo(() => {
    const entries: {
      readonly questionNumber: number;
      readonly exercise: SemiEssayExercise;
      readonly step: WrittenReasoningStep;
      readonly stepNumber: number;
    }[] = [];
    for (const item of paper.items) {
      if (item.exercise.kind !== 'semi-essay') continue;
      const semiExercise = item.exercise;
      const steps = extractWrittenStepsForExam(semiExercise);
      steps.forEach((step, idx) => {
        entries.push({
          questionNumber: item.questionNumber,
          exercise: semiExercise,
          step,
          stepNumber: idx + 1,
        });
      });
    }
    return entries;
  }, [paper.items]);

  const scopeLabel = useMemo(() => {
    if (!course) return '';
    if (!activeChapter) return `Toàn học phần (${courseChapters.length} chương)`;
    const idx = course.chapterIds.indexOf(activeChapter.id);
    const hasPrefix = /^(Chương\s+\d+|Bài\s+\d+)/i.test(activeChapter.title);
    return hasPrefix ? activeChapter.title : `Chương ${idx + 1}: ${activeChapter.title}`;
  }, [course, activeChapter, courseChapters.length]);

  const examInteractiveDraftPrefix = course
    ? `exam-practice:${course.id}:${effectiveChapterScope}:${questionSource}:${answerMode}:`
    : '';

  const {
    writtenStepMap,
    resolvedActiveStepId,
    setActiveWebMcpStepId,
    webMcpAvailable,
    coachingByStepId,
    coachingHistoryByStepId,
    buildStepPacket,
    buildExamOverview,
    applyExamCoachingFeedback,
    applyExamBatchCoachingFeedback,
    clearExamStepCoaching,
  } = useExamWebMcpBridge({
    course,
    canon,
    scopeLabel,
    submitted,
    paper,
    draft,
    setDraft,
    lessonOrder,
    writtenStepEntries,
    interactiveDraftPrefix: examInteractiveDraftPrefix || undefined,
    setLastCoachedQuestionNumber,
    setCoachedSnapshotByStepId,
  });

  const evaluation = useMemo(
    () => evaluateChapterExam(paper, draft, lessonOrder, coachingByStepId),
    [paper, draft, lessonOrder, coachingByStepId],
  );

  const handleChangeWrittenResponse = useCallback((stepId: string, val: string) => {
    setActiveWebMcpStepId(stepId);
    setDraft(prev => ({
      ...prev,
      writtenResponses: {
        ...prev.writtenResponses,
        [stepId]: val,
      },
    }));
  }, []);

  const handleChangeObjectiveAnswer = useCallback(
    (exerciseId: string, nextAns: string | readonly string[]) => {
      setDraft(prev => ({
        ...prev,
        objectiveAnswers: {
          ...prev.objectiveAnswers,
          [exerciseId]: nextAns,
        },
      }));
    },
    [],
  );

  const handleMarkInteractiveStepDone = useCallback((exerciseId: string, stepId: string) => {
    setDraft(prev => {
      const existing = prev.completedInteractiveStepIds?.[exerciseId] ?? [];
      if (existing.includes(stepId)) return prev;
      return {
        ...prev,
        completedInteractiveStepIds: {
          ...(prev.completedInteractiveStepIds ?? {}),
          [exerciseId]: [...existing, stepId],
        },
      };
    });
  }, []);

  const inlineCodeLabTool = useMemo(() => {
    if (!course) return undefined;
    const mod = getSubjectModule(course.subjectId);
    return (mod?.tools ?? []).find(
      t =>
        t.kind === 'code-lab' &&
        t.embedInExercises &&
        (!t.courseIds || t.courseIds.includes(course.id)),
    );
  }, [course]);

  const [injectedSnippet, setInjectedSnippet] = useState<InjectedCodeSnippet | undefined>(
    undefined,
  );
  const [paperResetNonce, setPaperResetNonce] = useState(0);

  const examPlaygroundSnippets = useMemo(() => {
    if (!inlineCodeLabTool || !course) return undefined;
    const promptItems = paper.items.map(it => ({
      id: it.exercise.id,
      title: it.exercise.title,
      prompt: it.exercise.prompt,
    }));
    const preferredLang = inferDefaultCodeLanguage({
      exercisePrompts: promptItems.map(p => p.prompt),
    });
    return buildPlaygroundSnippets({
      scopeId: `${course.id}-${effectiveChapterScope}`,
      exerciseItems: promptItems,
      defaultLanguage: preferredLang,
    });
  }, [inlineCodeLabTool, course, effectiveChapterScope, paper.items]);

  const handleTryCodeSnippet = useCallback(
    (snippet: { readonly label: string; readonly language: CodeLanguage; readonly code: string }) => {
      setInjectedSnippet(prev => ({
        nonce: (prev?.nonce ?? 0) + 1,
        label: snippet.label,
        language: snippet.language,
        code: snippet.code,
      }));
    },
    [],
  );

  const stepLifecycleByStepId = useMemo(() => {
    const map: Record<string, ReturnType<typeof deriveStepCoachingState>> = {};
    for (const entry of writtenStepEntries) {
      map[entry.step.id] = deriveStepCoachingState({
        draftText: draft.writtenResponses[entry.step.id] ?? '',
        rubric: entry.step.rubric,
        feedback: coachingByStepId[entry.step.id],
        coachedDraftSnapshot: coachedSnapshotByStepId[entry.step.id],
      });
    }
    return map;
  }, [writtenStepEntries, draft.writtenResponses, coachingByStepId, coachedSnapshotByStepId]);

  const activeQuestionNumber = useMemo(
    () => writtenStepMap.get(resolvedActiveStepId)?.questionNumber,
    [writtenStepMap, resolvedActiveStepId],
  );

  const weakExerciseIds = useMemo(() => {
    const ids: string[] = [];
    for (const { exercise } of paper.items) {
      if (exercise.kind === 'semi-essay') {
        const steps = extractWrittenStepsForExam(exercise);
        const hasCoachedGap = steps.some(s => {
          const st = stepLifecycleByStepId[s.id]?.state;
          return st === 'needs-revision' || st === 'revised-pending-recheck';
        });
        const unverifiedOnSubmit =
          submitted && !(evaluation.writtenByExerciseId[exercise.id]?.selfReviewed ?? false);
        if (hasCoachedGap || unverifiedOnSubmit) {
          ids.push(exercise.id);
        }
      } else if (submitted && !(evaluation.objectiveByExerciseId[exercise.id]?.correct ?? false)) {
        ids.push(exercise.id);
      }
    }
    return ids;
  }, [paper.items, stepLifecycleByStepId, submitted, evaluation]);

  const scrollToQuestion = useCallback((questionNum: number) => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    document.getElementById(`exam-q-${questionNum}`)?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const syncUrlParams = (next: {
    readonly course?: string;
    readonly chapter?: string;
    readonly mode?: ExamAnswerMode;
    readonly source?: ExamQuestionSourceFilter;
  }) => {
    const cId = next.course ?? course?.id ?? '';
    const ch = next.chapter ?? effectiveChapterScope;
    const m = next.mode ?? answerMode;
    const src = next.source ?? questionSource;
    const params = new URLSearchParams();
    if (cId) params.set('course', cId);
    if (ch !== 'all') params.set('chapter', ch);
    if (m !== 'written-all') params.set('mode', m);
    if (src !== 'all-db') params.set('source', src);
    setSearchParams(params, { replace: true });
  };

  if (!course) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Breadcrumbs
          items={[{ label: 'Tổng quan', to: '/' }, { label: 'Luyện đề tự luận' }]}
        />
        <div className="hus-card-surface rounded-[var(--radius-xl)] border border-border bg-surface p-6 sm:p-8">
          <h1 className="font-display text-2xl font-medium text-ink">
            Chưa có học phần để tạo đề luyện
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            Không gian luyện đề tự luận sẽ tự động nạp câu hỏi ngay khi có ít nhất một học phần ở
            trạng thái <code className="font-mono text-xs">available</code> trong{' '}
            <code className="font-mono text-xs">src/content/courses/&lt;course-id&gt;/course.ts</code>.
          </p>
          <div className="mt-5">
            <Link to="/courses" className="hus-btn hus-btn-secondary !no-underline">
              <span>Xem danh mục học phần</span>
              <ArrowRightIcon width={15} height={15} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (courseExercisePool === null) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Breadcrumbs
          items={[{ label: 'Tổng quan', to: '/' }, { label: 'Luyện đề tự luận' }]}
        />
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-medium text-ink">
            Chưa tải được ngân hàng câu hỏi luyện đề
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Không thể đọc dữ liệu câu hỏi của học phần đã chọn. Vui lòng tải lại trang hoặc chọn học phần khác.
          </p>
        </div>
      </div>
    );
  }

  if (courseExercisePool === undefined) {
    return <PageSkeleton label="Đang nạp ngân hàng câu hỏi luyện đề…" />;
  }

  const selectableCounts: number[] = [];
  for (let n = poolSummary.minSelectableCount; n <= poolSummary.maxSelectableCount; n += 1) {
    selectableCounts.push(n);
  }

  const draftedStepCount = writtenStepEntries.filter(
    entry => Boolean((draft.writtenResponses[entry.step.id] ?? '').trim()),
  ).length;

  const answeredQuestionCount = paper.items.filter(({ exercise }) => {
    if (exercise.kind === 'semi-essay') {
      return evaluation.writtenByExerciseId[exercise.id]?.drafted ?? false;
    }
    return evaluation.objectiveByExerciseId[exercise.id]?.answered ?? false;
  }).length;

  const handleCopyWholePaperWebMcp = async () => {
    const overview = buildExamOverview();
    if (!overview) return;
    const prompt = formatWholeExamWebMcpPrompt(overview, { webMcpAvailable });
    try {
      await navigator.clipboard.writeText(prompt);
      setWholePaperCopyMessage(
        `Đã chép Prompt Kép chấm toàn đề (${overview.draftedStepCount} ý đã viết)! Dán vào ✨ Ask Gemini — nếu thanh bên trả lời kèm JSON, bấm Sao chép câu trả lời rồi nhấn «Nhập toàn đề từ Gemini».`,
      );
    } catch {
      setWholePaperCopyMessage(
        'Trình duyệt không cho phép chép tự động vào Clipboard. Bạn có thể bấm nút Kiểm tra cách trình bày trên từng câu bên dưới.',
      );
    }
  };

  const handleImportWholePaperText = (rawText: string) => {
    const parsed = parseBatchExternalTutorFeedback(
      rawText,
      writtenStepEntries.map(entry => ({ exercise: entry.exercise, stepId: entry.step.id })),
    );
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    applyExamBatchCoachingFeedback(parsed.items);
    return { ok: true, count: parsed.items.length };
  };

  const handleShuffleNewPaper = () => {
    clearInteractiveStepDraftsByPrefix(examInteractiveDraftPrefix);
    setPaperResetNonce(n => n + 1);
    setPinnedExerciseIds(undefined);
    setSeed(prev => prev + 1);
    setSubmitted(false);
    setDraft(EMPTY_DRAFT);
    setLastCoachedQuestionNumber(null);
    setWholePaperCopyMessage(null);
  };

  const handleResetCurrentPaper = () => {
    clearStoredExamPracticeSession(
      course.id,
      effectiveChapterScope,
      questionSource,
      answerMode,
    );
    clearInteractiveStepDraftsByPrefix(examInteractiveDraftPrefix);
    setPaperResetNonce(n => n + 1);
    setPinnedExerciseIds(undefined);
    setSubmitted(false);
    setDraft(EMPTY_DRAFT);
    setLastCoachedQuestionNumber(null);
    setWholePaperCopyMessage(null);
  };

  const handleSubmitExam = () => {
    setSubmitted(true);
    const now = new Date().toISOString();
    for (const { exercise } of paper.items) {
      if (exercise.kind === 'semi-essay') {
        const writtenRes = evaluation.writtenByExerciseId[exercise.id];
        if (writtenRes?.selfReviewed) {
          progressStore.dispatch({
            type: 'attempt',
            exerciseId: exercise.id,
            correct: true,
            at: now,
          });
        }
        continue;
      }
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
          { label: 'Tổng quan', to: '/' },
          { label: 'Luyện đề tự luận' },
        ]}
      />

      {/* Compact Exam Practice Masthead & Paper Generator */}
      <header className="hus-card-surface space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3.5">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent" mono>
                {code}
              </Badge>
              <Badge tone="neutral">
                Kho {chapterFilteredExercises.length} câu ({essayOnlyCount} tự luận gốc)
              </Badge>
              <Badge tone={webMcpAvailable ? 'success' : 'warning'}>
                {webMcpAvailable ? 'WebMCP 2 chiều sẵn sàng' : 'Ask Gemini dự phòng'}
              </Badge>
              {submitted ? <Badge tone="success">Đã nộp đề</Badge> : null}
            </div>
            <h1 className="heading-page text-ink">Luyện đề tự luận &amp; Kiểm tra trình bày</h1>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShuffleNewPaper}
              className="hus-btn hus-btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
            >
              <RotateCcwIcon width={13} height={13} />
              <span>Đổi đề (#{seed})</span>
            </button>
            <Link
              to={`/courses/${course.id}`}
              className="hus-btn hus-btn-secondary min-h-[36px] px-3 py-1.5 text-xs !no-underline"
            >
              <span>Học phần {code}</span>
              <ArrowRightIcon width={13} height={13} />
            </Link>
          </div>
        </div>

        {/* Row 1: Course, Chapter Scope & Exact Count (Declarative WebMCP Form) */}
        <form
          toolname="hus_configure_exam_paper"
          tooldescription="Cấu hình đề luyện tập ĐHKHTN theo học phần, phạm vi chương và số lượng câu hỏi"
          toolautosubmit=""
          onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const nextCourse = data.get('courseId');
            const nextChapter = data.get('chapterScope');
            const nextCount = data.get('questionCount');
            if (typeof nextCourse === 'string' && nextCourse && nextCourse !== course.id) {
              setSelectedCourseId(nextCourse);
              setChapterScope('all');
              syncUrlParams({ course: nextCourse, chapter: 'all' });
            } else if (
              typeof nextChapter === 'string' &&
              nextChapter &&
              nextChapter !== effectiveChapterScope
            ) {
              setChapterScope(nextChapter);
              syncUrlParams({ chapter: nextChapter });
            }
            if (typeof nextCount === 'string' && nextCount) {
              const parsedCount = Number(nextCount);
              if (Number.isFinite(parsedCount) && parsedCount > 0) {
                setCustomCount(parsedCount);
                setSubmitted(false);
              }
            }
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <div className="space-y-1">
            <label htmlFor="exam-practice-course" className="block text-xs font-medium text-ink-secondary">
              Học phần luyện đề
            </label>
            <select
              id="exam-practice-course"
              name="courseId"
              toolparamdescription="Mã định danh học phần muốn tạo đề (ví dụ: linear-algebra, mechanics-heat, general-chemistry)"
              value={course.id}
              onChange={e => {
                const nextCourseId = e.target.value;
                setSelectedCourseId(nextCourseId);
                setChapterScope('all');
                syncUrlParams({ course: nextCourseId, chapter: 'all' });
              }}
              className="min-h-[38px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink focus:border-accent focus:outline-none"
            >
              {coursesBySubject.map(group => (
                <optgroup key={group.subject.id} label={group.subject.title}>
                  {group.courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.academicCode ? `${c.academicCode} — ${c.title}` : c.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="exam-practice-chapter" className="block text-xs font-medium text-ink-secondary">
              Phạm vi chương
            </label>
            <select
              id="exam-practice-chapter"
              name="chapterScope"
              toolparamdescription="Phạm vi chương (all cho toàn học phần hoặc id chương cụ thể)"
              value={effectiveChapterScope}
              onChange={e => {
                const nextScope = e.target.value;
                setChapterScope(nextScope);
                syncUrlParams({ chapter: nextScope });
              }}
              className="min-h-[38px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3 py-1.5 text-sm font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">
                Toàn học phần ({courseChapters.length} chương · {courseExercisePool.length} câu)
              </option>
              {courseChapters.map((ch, idx) => {
                const hasPrefix = /^(Chương\s+\d+|Bài\s+\d+)/i.test(ch.title);
                const label = hasPrefix ? ch.title : `Chương ${idx + 1}: ${ch.title}`;
                return (
                  <option key={ch.id} value={ch.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {selectableCounts.length > 1 ? (
            <div className="space-y-1">
              <label
                htmlFor="exam-practice-exact-count"
                className="block text-xs font-medium text-ink-secondary"
              >
                Số câu cụ thể ({poolSummary.minSelectableCount}–{poolSummary.maxSelectableCount})
              </label>
              <select
                id="exam-practice-exact-count"
                name="questionCount"
                toolparamdescription="Số lượng câu hỏi trong đề luyện tập"
                value={paper.targetCount}
                onChange={e => {
                  setCustomCount(Number(e.target.value));
                  setSubmitted(false);
                }}
                className="min-h-[38px] w-full rounded-[var(--radius-md)] border border-border bg-canvas px-3 py-1.5 font-mono text-sm font-medium text-ink focus:border-accent focus:outline-none md:w-36"
              >
                {selectableCounts.map(n => (
                  <option key={n} value={n}>
                    {n} câu hỏi
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </form>

        {/* Row 2: Compact Segmented Pills for Answer Mode, Source & Preset */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Hình thức trình bày bài làm"
            className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-border bg-canvas p-0.5"
          >
            <button
              type="button"
              aria-pressed={answerMode === 'written-all'}
              onClick={() => {
                setAnswerMode('written-all');
                syncUrlParams({ mode: 'written-all' });
              }}
              className={`min-h-[32px] rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                answerMode === 'written-all'
                  ? 'bg-accent-subtle font-semibold text-accent-ink'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              100% Tự luận giấy A4
            </button>
            <button
              type="button"
              aria-pressed={answerMode === 'mixed'}
              onClick={() => {
                setAnswerMode('mixed');
                syncUrlParams({ mode: 'mixed' });
              }}
              className={`min-h-[32px] rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                answerMode === 'mixed'
                  ? 'bg-accent-subtle font-semibold text-accent-ink'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Đề hỗn hợp
            </button>
          </div>

          <div
            role="group"
            aria-label="Nguồn câu hỏi rút từ Database"
            className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-border bg-canvas p-0.5"
          >
            <button
              type="button"
              aria-pressed={questionSource === 'all-db'}
              onClick={() => {
                setQuestionSource('all-db');
                syncUrlParams({ source: 'all-db' });
              }}
              className={`min-h-[32px] rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1 text-xs font-medium transition-colors ${
                questionSource === 'all-db'
                  ? 'bg-accent-subtle font-semibold text-accent-ink'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Toàn bộ kho ({chapterFilteredExercises.length})
            </button>
            <button
              type="button"
              aria-pressed={questionSource === 'essay-only'}
              onClick={() => {
                setQuestionSource('essay-only');
                syncUrlParams({ source: 'essay-only' });
              }}
              className={`min-h-[32px] rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1 text-xs font-medium transition-colors ${
                questionSource === 'essay-only'
                  ? 'bg-accent-subtle font-semibold text-accent-ink'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Chỉ câu gốc tự luận ({essayOnlyCount})
            </button>
          </div>

          <div
            role="group"
            aria-label="Độ dài đề luyện tập"
            className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-border bg-canvas p-0.5"
          >
            {PRESET_META.map(item => {
              const count = poolSummary.recommendedCountByPreset[item.id];
              const isSelected = customCount === undefined && preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isSelected}
                  title={item.desc}
                  onClick={() => {
                    setPreset(item.id);
                    setCustomCount(undefined);
                    setSubmitted(false);
                  }}
                  className={`min-h-[32px] rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-accent-subtle font-semibold text-accent-ink'
                      : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  {item.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Whole-Paper WebMCP Presentation Check & Focus Status Strip */}
        {writtenStepEntries.length > 0 ? (
          <ExamWebMcpStatusBar
            courseCode={code}
            webMcpAvailable={webMcpAvailable}
            draftedStepCount={draftedStepCount}
            totalWrittenSteps={writtenStepEntries.length}
            paperScoreOn10={evaluation.paperScoreOn10}
            paperPassed={evaluation.paperPassed}
            passedQuestionCount={evaluation.objectiveCorrect + evaluation.writtenSelfReviewed}
            totalQuestionCount={paper.items.length}
            activeQuestionNumber={activeQuestionNumber}
            lastCoachedQuestionNumber={lastCoachedQuestionNumber}
            weakQuestionCount={weakExerciseIds.length}
            isDrillMode={Boolean(pinnedExerciseIds && pinnedExerciseIds.length > 0)}
            copyFeedbackMessage={wholePaperCopyMessage}
            presentationCheckpoints={canon?.presentationCheckpoints}
            onCopyWholePaperPrompt={() => void handleCopyWholePaperWebMcp()}
            onImportWholePaperText={handleImportWholePaperText}
            onJumpToQuestion={scrollToQuestion}
            onStartWeakQuestionDrill={() => {
              if (weakExerciseIds.length === 0) return;
              setPinnedExerciseIds(weakExerciseIds);
              setSubmitted(false);
            }}
            onExitWeakQuestionDrill={() => {
              setPinnedExerciseIds(undefined);
            }}
          />
        ) : null}

        {/* Paper Composition & Quick Question Jump Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
          <nav aria-label="Chuyển nhanh đến câu hỏi trong đề" className="flex flex-wrap gap-1.5">
            {paper.items.map(item => {
              const isWritten = item.exercise.kind === 'semi-essay';
              const isDone = isWritten
                ? Boolean(evaluation.writtenByExerciseId[item.exercise.id]?.drafted)
                : Boolean(evaluation.objectiveByExerciseId[item.exercise.id]?.answered);
              const objCorrect = evaluation.objectiveByExerciseId[item.exercise.id]?.correct;
              const writtenReviewed =
                evaluation.writtenByExerciseId[item.exercise.id]?.selfReviewed;
              const itemSteps =
                item.exercise.kind === 'semi-essay'
                  ? extractWrittenStepsForExam(item.exercise)
                  : [];
              const hasNeedsRevision = itemSteps.some(
                s => stepLifecycleByStepId[s.id]?.state === 'needs-revision',
              );

              const toneClass = submitted
                ? isWritten
                  ? writtenReviewed
                    ? 'border-success/45 bg-success-subtle text-success'
                    : 'border-warning/45 bg-warning-subtle text-warning'
                  : objCorrect
                    ? 'border-success/45 bg-success-subtle text-success'
                    : 'border-danger/45 bg-danger-subtle text-danger'
                : isWritten && writtenReviewed
                  ? 'border-success/45 bg-success-subtle text-success'
                  : isWritten && hasNeedsRevision
                    ? 'border-warning/45 bg-warning-subtle text-warning'
                    : isDone
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-canvas text-ink-secondary hover:border-border-strong';

                  return (
                <a
                  key={item.exercise.id}
                  href={`#exam-q-${item.questionNumber}`}
                  onClick={e => {
                    e.preventDefault();
                    scrollToQuestion(item.questionNumber);
                  }}
                  className={`inline-flex min-h-[30px] items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono text-xs font-medium no-underline transition-colors ${toneClass}`}
                >
                  <span>Câu {item.questionNumber}</span>
                  {isWritten &&
                  evaluation.writtenByExerciseId[item.exercise.id]?.scoreOn10 !== undefined ? (
                    <span>
                      · {formatScoreVi(evaluation.writtenByExerciseId[item.exercise.id]!.scoreOn10!)}đ
                    </span>
                  ) : isWritten ? (
                    <span aria-hidden="true">· A4</span>
                  ) : null}
                </a>
              );
            })}
          </nav>

          <span className="font-mono font-medium tabular-nums text-ink-muted">
            Đã làm: {answeredQuestionCount}/{paper.items.length} câu ({scopeLabel})
          </span>
        </div>
      </header>

      {/* Post-Submit Summary Report */}
      {submitted ? (
        <section
          role="region"
          aria-label="Kết quả rà soát đề luyện tập"
          className="written-practice-reveal space-y-4 rounded-[var(--radius-xl)] border border-accent/45 bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
            <div className="flex items-center gap-2.5">
              <CheckCircleIcon width={20} height={20} className="text-success" />
              <h2 className="font-display text-xl font-medium text-ink">
                Tổng kết đề luyện tập {code}
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
                Tạo mã đề khác
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {evaluation.paperScoreOn10 !== null ? (
              <div
                data-exam-summary-score="true"
                className="rounded-[var(--radius-lg)] border border-accent/40 bg-canvas/75 p-4"
              >
                <p className="text-xs font-medium text-ink-muted">
                  Điểm chấm máy toàn đề (Thang 10 · Mức 1)
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    {formatScoreVi(evaluation.paperScoreOn10)}/10
                  </span>
                  <Badge tone={evaluation.paperPassed ? 'success' : 'danger'}>
                    {evaluation.paperPassed ? 'ĐẠT (PASS)' : 'CHƯA PASS'}
                  </Badge>
                </div>
              </div>
            ) : null}

            {evaluation.writtenTotal > 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border bg-canvas/75 p-4">
                <p className="text-xs font-medium text-ink-muted">
                  Trình bày tự luận giấy A4 (WebMCP đối chiếu ngầm)
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
                  {evaluation.writtenSelfReviewed}/{evaluation.writtenTotal}{' '}
                  <span className="font-sans text-sm font-normal text-ink-secondary">
                    câu đạt chuẩn trình bày qua WebMCP
                  </span>
                </p>
                {evaluation.writtenSelfReviewed < evaluation.writtenTotal ? (
                  <p className="mt-1 text-xs text-warning">
                    Đáp án mẫu &amp; thang chấm tự tích được ẩn hoàn toàn — hãy nhấn «Kiểm tra cách
                    trình bày &amp; kết quả» qua WebMCP ở các câu tự luận bên dưới.
                  </p>
                ) : null}
              </div>
            ) : null}

            {evaluation.objectiveTotal > 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border bg-canvas/75 p-4">
                <p className="text-xs font-medium text-ink-muted">
                  Phần chấm máy tự động (Trắc nghiệm &amp; Điền đáp số)
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
                  {evaluation.objectiveCorrect}/{evaluation.objectiveTotal}{' '}
                  <span className="font-sans text-sm font-normal text-ink-secondary">câu đúng</span>
                </p>
              </div>
            ) : null}
          </div>

          {evaluation.lessonsToReview.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3.5">
              <p className="text-xs font-semibold text-ink">
                Các bài học liên quan nên xem lại để củng cố lập luận &amp; ký hiệu chuẩn:
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
            <div className="rounded-[var(--radius-lg)] border border-success/40 bg-success-subtle/60 px-4 py-3 text-sm font-medium text-success">
              Bạn đã hoàn tất trình bày và đối chiếu đầy đủ các tiêu chí cho toàn bộ câu hỏi trong đề này!
            </div>
          )}
        </section>
      ) : null}

      {/* Ordered Exam Questions */}
      <ol className="space-y-6" aria-label="Đề luyện thi tự luận">
        {paper.items.map(item => {
          const { exercise, questionNumber, originalKind } = item;
          const sourceLesson = lessonById.get(exercise.lessonId);
          const chapterBadge = chapterByLessonId.get(exercise.lessonId);

          if (exercise.kind === 'semi-essay') {
            const steps = extractWrittenStepsForExam(exercise);
            const hasNativeWrittenSteps = exercise.steps.some(s => s.kind === 'written-reasoning');
            const interactiveDoneIds = draft.completedInteractiveStepIds?.[exercise.id] ?? [];
            const writtenStatus = evaluation.writtenByExerciseId[exercise.id];
            const semiSnippet = inlineCodeLabTool
              ? extractSingleExerciseSnippet(
                  [exercise.prompt, ...exercise.steps.map(s => s.prompt)].join('\n\n'),
                  exercise.title,
                )
              : null;
            let writtenSubIdx = 0;

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
                      {originalKind ? (
                        <Badge tone="neutral">{ORIGIN_FORM_TAG[originalKind]}</Badge>
                      ) : null}
                      {chapterBadge ? <Badge tone="neutral">{chapterBadge}</Badge> : null}
                      {writtenStatus?.verdict === 'pass' ? (
                        <Badge tone="success" mono>
                          PASS
                          {writtenStatus.scoreOn10 !== undefined
                            ? ` · ${formatScoreVi(writtenStatus.scoreOn10)}/10`
                            : ''}
                        </Badge>
                      ) : writtenStatus?.verdict === 'not-pass' ? (
                        <Badge tone="danger" mono>
                          CHƯA PASS
                          {writtenStatus.scoreOn10 !== undefined
                            ? ` · ${formatScoreVi(writtenStatus.scoreOn10)}/10`
                            : ''}
                        </Badge>
                      ) : submitted ? (
                        <Badge tone={writtenStatus?.selfReviewed ? 'success' : 'warning'}>
                          {writtenStatus?.selfReviewed
                            ? 'Đã đối chiếu trình bày'
                            : 'Cần rà soát trình bày'}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="font-display text-xl font-medium text-ink">{exercise.title}</h2>
                  </div>

                  {sourceLesson ? (
                    <Link
                      to={`/courses/${course.id}/lessons/${sourceLesson.id}`}
                      className="text-xs font-medium text-ink-muted no-underline hover:text-accent hover:underline"
                    >
                      Bài học gốc: {sourceLesson.title} →
                    </Link>
                  ) : null}
                </div>

                {/* Problem Statement & Optional Figure */}
                <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-subtle/55 px-4 py-3.5 text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                  <Markdown>{exercise.prompt}</Markdown>
                  {exercise.figure ? <ProblemFigure figure={exercise.figure} /> : null}
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

                {semiSnippet ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-accent/25 bg-accent-subtle/35 px-3.5 py-2">
                    <span className="text-xs text-ink-secondary">
                      Kiểm chứng đoạn mã của câu hỏi này ngay bên dưới đề luyện tập:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTryCodeSnippet(semiSnippet)}
                      className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
                    >
                      <PlayIcon width={13} height={13} className="text-accent" />
                      <span>Nạp mẫu code vào khung chạy thử</span>
                    </button>
                  </div>
                ) : null}

                {/* Ordered Interactive Diagrams/Checks & Ruled A4 Written Sub-parts */}
                <div className="mt-5 space-y-6">
                  {exercise.steps.map((step, rawIdx) => {
                    if (step.kind === 'written-reasoning') {
                      const currentSubIdx = writtenSubIdx;
                      writtenSubIdx += 1;
                      return (
                        <ExamWrittenStepItem
                          key={step.id}
                          questionNumber={questionNumber}
                          subPartIndex={currentSubIdx}
                          totalStepsInQuestion={steps.length}
                          exercise={exercise}
                          step={step}
                          stepNumber={currentSubIdx + 1}
                          responseText={draft.writtenResponses[step.id] ?? ''}
                          lifecycleState={stepLifecycleByStepId[step.id]?.state ?? 'unstarted'}
                          scaffolds={canon?.reasoningScaffolds}
                          isActiveTarget={
                            writtenStepEntries.length > 1 && resolvedActiveStepId === step.id
                          }
                          hasCanon={Boolean(canon && writtenStepMap.has(step.id))}
                          webMcpAvailable={webMcpAvailable}
                          symbolContext={symbolContext}
                          stepCoaching={coachingByStepId[step.id]}
                          stepCoachingHistory={coachingHistoryByStepId[step.id]}
                          onActivateStep={setActiveWebMcpStepId}
                          onChangeResponse={handleChangeWrittenResponse}
                          onBuildPacket={buildStepPacket}
                          onApplyFeedback={applyExamCoachingFeedback}
                          onClearFeedback={clearExamStepCoaching}
                        />
                      );
                    }

                    const isInteractiveDone = interactiveDoneIds.includes(step.id);
                    return (
                      <div
                        key={`${paperResetNonce}-${step.id}`}
                        data-exam-interactive-step={step.kind}
                        className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-canvas/60 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                          <h3 className="text-sm font-semibold text-ink">
                            Bước {rawIdx + 1}: {step.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={isInteractiveDone ? 'success' : 'neutral'}>
                              {STEP_KIND_LABEL[step.kind]}
                            </Badge>
                            {isInteractiveDone ? <Badge tone="success">Đã kiểm chứng</Badge> : null}
                          </div>
                        </div>
                        <div className="text-sm leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                          <Markdown>{step.prompt}</Markdown>
                        </div>
                        <SemiEssayInteractiveStepBody
                          step={step}
                          completed={isInteractiveDone}
                          fadeLevel={exercise.fadeLevel ?? 0}
                          examMode={submitted ? 'exam-submitted' : 'exam-active'}
                          draftKey={`${examInteractiveDraftPrefix}${exercise.id}:${step.id}`}
                          onSolved={() => handleMarkInteractiveStepDone(exercise.id, step.id)}
                        />
                      </div>
                    );
                  })}

                  {!hasNativeWrittenSteps
                    ? steps.map((step, sIdx) => (
                        <ExamWrittenStepItem
                          key={step.id}
                          questionNumber={questionNumber}
                          subPartIndex={sIdx}
                          totalStepsInQuestion={steps.length}
                          exercise={exercise}
                          step={step}
                          stepNumber={sIdx + 1}
                          responseText={draft.writtenResponses[step.id] ?? ''}
                          lifecycleState={stepLifecycleByStepId[step.id]?.state ?? 'unstarted'}
                          scaffolds={canon?.reasoningScaffolds}
                          isActiveTarget={
                            writtenStepEntries.length > 1 && resolvedActiveStepId === step.id
                          }
                          hasCanon={Boolean(canon && writtenStepMap.has(step.id))}
                          webMcpAvailable={webMcpAvailable}
                          symbolContext={symbolContext}
                          stepCoaching={coachingByStepId[step.id]}
                          stepCoachingHistory={coachingHistoryByStepId[step.id]}
                          onActivateStep={setActiveWebMcpStepId}
                          onChangeResponse={handleChangeWrittenResponse}
                          onBuildPacket={buildStepPacket}
                          onApplyFeedback={applyExamCoachingFeedback}
                          onClearFeedback={clearExamStepCoaching}
                        />
                      ))
                    : null}
                </div>
              </li>
            );
          }

          const objSnippet = inlineCodeLabTool
            ? extractSingleExerciseSnippet(exercise.prompt, exercise.title)
            : null;

          return (
            <ExamPracticeObjectiveItem
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
              onLoadCodeSnippet={
                objSnippet ? () => handleTryCodeSnippet(objSnippet) : undefined
              }
              onChangeExerciseAnswer={handleChangeObjectiveAnswer}
            />
          );
        })}
      </ol>

      {inlineCodeLabTool ? (
        <ExamInlineCodeLabSection
          courseId={course.id}
          tool={inlineCodeLabTool}
          playgroundSnippets={examPlaygroundSnippets}
          injectedSnippet={injectedSnippet}
        />
      ) : null}

      {/* Bottom Submit Action Bar */}
      <footer className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-ink">
            {submitted
              ? 'Đã lưu bài nộp — phần tự luận A4 được đối chiếu ngầm qua WebMCP'
              : `Tiến độ làm đề ${code}: ${answeredQuestionCount}/${paper.items.length} câu đã viết bài`}
          </p>
          <p className="text-xs text-ink-secondary">
            {submitted
              ? `Đạt chuẩn trình bày qua WebMCP: ${evaluation.writtenSelfReviewed}/${evaluation.writtenTotal} câu tự luận${
                  evaluation.objectiveTotal > 0
                    ? ` · Đúng ${evaluation.objectiveCorrect}/${evaluation.objectiveTotal} câu chấm máy (${EXAM_FORM_LABEL['multiple-choice']})`
                    : ''
                }.`
              : 'Bài viết A4 được tự động lưu trên trình duyệt; đáp án mẫu & thang đối chiếu được ẩn hoàn toàn để WebMCP kiểm tra độc lập.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetCurrentPaper}
            className="hus-btn hus-btn-secondary text-xs"
          >
            Làm mới bài nháp
          </button>

          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmitExam}
              className="hus-btn hus-btn-primary px-5"
            >
              <CheckCircleIcon width={16} height={16} />
              <span>Nộp đề kiểm tra</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShuffleNewPaper}
              className="hus-btn hus-btn-primary px-5"
            >
              <RotateCcwIcon width={15} height={15} />
              <span>Tạo mã đề mới</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
