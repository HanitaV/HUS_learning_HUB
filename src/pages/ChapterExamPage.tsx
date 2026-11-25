import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { resolveCourseConventionCanon } from '../content/curriculum-canons';
import type { InjectedCodeSnippet } from '../contracts/subject-module';
import type {
  ChapterExamDraft,
  ChapterExamLengthPreset,
  ExamAnswerMode,
} from '../domain/chapter-exam';
import type { CodeLanguage } from '../domain/code-lab';
import type {
  CoachingPromptMode,
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
import {
  buildCurriculumHorizon,
  buildGroundedEssayContextPacket,
  indexLessonMarkdownChunks,
  searchCurriculumChunks,
  synthesizeFallbackTheoryAnchors,
} from '../core/learning/curriculum-rag';
import { emptyWrittenStepDraft } from '../core/learning/semi-essay';
import {
  deriveStepCoachingState,
  didExercisePassViaTutor,
  formatScoreVi,
  syncCriteriaFromCoachingFeedback,
} from '../core/learning/webmcp-essay-adapters';
import {
  loadStoredTutorFeedback,
  parseBatchExternalTutorFeedback,
  parseExternalTutorFeedback,
  saveStoredTutorFeedback,
} from '../infrastructure/ai/tutor-feedback-parser';
import {
  detectWebMcpSupport,
  formatWholeExamWebMcpPrompt,
  registerEssayWebMcpTools,
  type ExamPaperWebMcpOverview,
} from '../infrastructure/ai/webmcp-essay-bridge';
import { courseRegistry, getSubjectModule } from '../infrastructure/content/catalogue';
import {
  learningContent,
  loadCourseExercises,
  loadLessonMarkdown,
} from '../infrastructure/content/learning';
import {
  clearInteractiveStepDraftsByPrefix,
} from '../infrastructure/practice/interactive-step-drafts';
import {
  clearStoredChapterExamSession,
  loadStoredChapterExamSession,
  saveStoredChapterExamSession,
} from '../infrastructure/progress/chapter-exam-store';
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
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PlayIcon,
  RotateCcwIcon,
} from '../components/ui/Icons';
import { PageSkeleton } from '../components/ui/Skeleton';

const FORM_LABEL = EXAM_FORM_LABEL;

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

interface ChapterWrittenStepItemProps {
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
  readonly onActivateStep: (stepId: string) => void;
  readonly onChangeResponse: (stepId: string, value: string) => void;
  readonly onBuildPacket: (
    exercise: SemiEssayExercise,
    step: WrittenReasoningStep,
    stepNumber: number,
    mode: CoachingPromptMode,
  ) => ReturnType<typeof buildGroundedEssayContextPacket> | null;
  readonly onApplyFeedback: (exercise: SemiEssayExercise, feedback: TutorCoachingFeedback) => void;
  readonly onClearFeedback: (exercise: SemiEssayExercise, stepId: string) => void;
}

const ChapterWrittenStepItem = memo(function ChapterWrittenStepItem({
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
  onActivateStep,
  onChangeResponse,
  onBuildPacket,
  onApplyFeedback,
  onClearFeedback,
}: ChapterWrittenStepItemProps) {
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

const ChapterExamObjectiveItem = memo(function ChapterExamObjectiveItem({
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
  const [answerMode, setAnswerMode] = useState<ExamAnswerMode>(
    () => storedInitial?.answerMode ?? 'mixed',
  );
  const [seed, setSeed] = useState<number>(() => storedInitial?.seed ?? 1);
  const [submitted, setSubmitted] = useState<boolean>(() => storedInitial?.submitted ?? false);
  const [draft, setDraft] = useState<ChapterExamDraft>(
    () => storedInitial?.draft ?? EMPTY_DRAFT,
  );
  const [pinnedExerciseIds, setPinnedExerciseIds] = useState<readonly string[] | undefined>(
    undefined,
  );
  const [coachedSnapshotByStepId, setCoachedSnapshotByStepId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [lastCoachedQuestionNumber, setLastCoachedQuestionNumber] = useState<number | null>(null);
  const [wholePaperCopyMessage, setWholePaperCopyMessage] = useState<string | null>(null);

  // Reset state if route params change between chapters
  const [activeKey, setActiveKey] = useState(`${courseId ?? ''}:${chapterId ?? ''}`);
  const currentKey = `${courseId ?? ''}:${chapterId ?? ''}`;
  if (currentKey !== activeKey) {
    setActiveKey(currentKey);
    const nextStored =
      course && chapter ? loadStoredChapterExamSession(course.id, chapter.id) : null;
    setPreset(nextStored?.preset ?? 'standard');
    setCustomCount(nextStored?.customCount);
    setAnswerMode(nextStored?.answerMode ?? 'mixed');
    setSeed(nextStored?.seed ?? 1);
    setSubmitted(nextStored?.submitted ?? false);
    setDraft(nextStored?.draft ?? EMPTY_DRAFT);
    setPinnedExerciseIds(undefined);
    setCoachedSnapshotByStepId({});
    setLastCoachedQuestionNumber(null);
    setWholePaperCopyMessage(null);
  }

  const pendingChapterSessionFlushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!course || !chapter) return;
    const flushNow = () => {
      pendingChapterSessionFlushRef.current = null;
      saveStoredChapterExamSession(course.id, chapter.id, {
        version: 1,
        preset,
        customCount,
        answerMode,
        seed,
        submitted,
        draft,
      });
    };
    pendingChapterSessionFlushRef.current = flushNow;
    const timer = window.setTimeout(flushNow, 80);
    return () => {
      window.clearTimeout(timer);
      if (pendingChapterSessionFlushRef.current) {
        pendingChapterSessionFlushRef.current();
      }
    };
  }, [course, chapter, preset, customCount, answerMode, seed, submitted, draft]);

  useEffect(() => {
    const handlePageFlush = () => {
      pendingChapterSessionFlushRef.current?.();
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
        answerMode,
        canon,
        pinnedExerciseIds,
      }),
    [chapterExercises, lessonOrder, preset, customCount, seed, answerMode, canon, pinnedExerciseIds],
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

  const writtenStepMap = useMemo(
    () => new Map(writtenStepEntries.map(entry => [entry.step.id, entry])),
    [writtenStepEntries],
  );

  const [activeWebMcpStepId, setActiveWebMcpStepId] = useState<string>('');
  const resolvedActiveStepId =
    activeWebMcpStepId && writtenStepMap.has(activeWebMcpStepId)
      ? activeWebMcpStepId
      : (writtenStepEntries[0]?.step.id ?? '');

  const [webMcpAvailable, setWebMcpAvailable] = useState<boolean>(
    () => detectWebMcpSupport().available,
  );
  const [markdownByLessonId, setMarkdownByLessonId] = useState<Readonly<Record<string, string>>>({});
  const [coachingByStepId, setCoachingByStepId] = useState<
    Readonly<Record<string, TutorCoachingFeedback>>
  >({});

  const evaluation = useMemo(
    () => evaluateChapterExam(paper, draft, lessonOrder, coachingByStepId),
    [paper, draft, lessonOrder, coachingByStepId],
  );

  // Hydrate persisted coaching feedback whenever paper's written exercises change
  useEffect(() => {
    const merged: Record<string, TutorCoachingFeedback> = {};
    const seenExercises = new Set<string>();
    for (const { exercise } of writtenStepEntries) {
      if (seenExercises.has(exercise.id)) continue;
      seenExercises.add(exercise.id);
      Object.assign(merged, loadStoredTutorFeedback(exercise));
    }
    setCoachingByStepId(merged);
  }, [writtenStepEntries]);

  // Load chapter lesson Markdown on demand when the exam paper includes written A4 steps
  useEffect(() => {
    let active = true;
    if (!course || writtenStepEntries.length === 0) return;
    const targetLessonIds = [...new Set(writtenStepEntries.map(e => e.exercise.lessonId))];
    Promise.all(
      targetLessonIds.map(async lid => {
        try {
          const md = await loadLessonMarkdown(lid);
          return [lid, md] as const;
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
      setMarkdownByLessonId(prev => ({ ...prev, ...loaded }));
    });
    return () => {
      active = false;
    };
  }, [course, writtenStepEntries]);

  const buildExamStepPacket = useCallback(
    (
      entry: {
        readonly exercise: SemiEssayExercise;
        readonly step: WrittenReasoningStep;
        readonly stepNumber: number;
      },
      mode: CoachingPromptMode,
      fromWebMcp = false,
    ) => {
      if (!course || !canon) return null;
      const horizon = buildCurriculumHorizon(course, learningContent, entry.exercise.lessonId);
      const chunks = indexLessonMarkdownChunks({
        course,
        content: learningContent,
        targetLessonId: entry.exercise.lessonId,
        markdownByLessonId,
      });
      const stepIdx = Math.max(
        0,
        entry.exercise.steps.findIndex(s => s.id === entry.step.id),
      );
      const effectiveAnchors = synthesizeFallbackTheoryAnchors(
        chunks,
        entry.exercise,
        stepIdx,
      ).anchors;
      return buildGroundedEssayContextPacket({
        mode,
        canon,
        horizon,
        exercise: entry.exercise,
        step: entry.step,
        stepNumber: entry.stepNumber,
        draft: {
          ...emptyWrittenStepDraft(),
          response: draft.writtenResponses[entry.step.id] ?? '',
          reviewedCriterionIds: draft.checkedRubricIds[entry.step.id] ?? [],
          modelRevealed: false,
        },
        chunks,
        effectiveTheoryAnchors: effectiveAnchors,
        internalReferenceForWebMcp: fromWebMcp && mode !== 'socratic-hint',
      });
    },
    [course, canon, markdownByLessonId, draft.writtenResponses, draft.checkedRubricIds],
  );

  const buildChapterExamOverview = useCallback(
    (fromWebMcp = false): ExamPaperWebMcpOverview | null => {
      if (!course || !chapter || !canon) return null;
      const steps = writtenStepEntries.map(entry => {
        const text = draft.writtenResponses[entry.step.id] ?? '';
        return {
          questionNumber: entry.questionNumber,
          exerciseId: entry.exercise.id,
          exerciseTitle: entry.exercise.title,
          stepId: entry.step.id,
          stepTitle: entry.step.title,
          problemPrompt: entry.exercise.prompt,
          stepPrompt: entry.step.prompt,
          rubricCriteria: entry.step.rubric,
          studentDraft: text,
          hasDraft: text.trim().length > 0,
          ...(fromWebMcp ? { referenceModelAnswer: entry.step.modelAnswer } : {}),
        };
      });
      return {
        courseId: course.id,
        courseCode: canon.academicCode,
        courseTitle: course.title,
        scopeLabel: chapter.title,
        notationRules: canon.notationRules,
        forbiddenShortcutHints: canon.forbiddenShortcutHints,
        submitted,
        totalQuestions: paper.items.length,
        draftedStepCount: steps.filter(s => s.hasDraft).length,
        steps,
      };
    },
    [
      course,
      chapter,
      canon,
      writtenStepEntries,
      draft.writtenResponses,
      submitted,
      paper.items.length,
    ],
  );

  const applyExamCoachingFeedback = useCallback(
    (exercise: SemiEssayExercise, feedback: TutorCoachingFeedback) => {
      const matchedEntry = liveExamBridgeRef.current.writtenStepMap.get(feedback.stepId);
      if (matchedEntry) {
        setLastCoachedQuestionNumber(matchedEntry.questionNumber);
      }
      const nextPreview = {
        ...liveExamBridgeRef.current.coachingByStepId,
        [feedback.stepId]: feedback,
      };
      const passVerdict = didExercisePassViaTutor(exercise, nextPreview);
      if (passVerdict !== null) {
        progressStore.dispatch({
          type: 'attempt',
          exerciseId: exercise.id,
          correct: passVerdict,
          at: feedback.receivedAt,
        });
      }
      setCoachingByStepId(prev => {
        const next = { ...prev, [feedback.stepId]: feedback };
        const exerciseScoped: Record<string, TutorCoachingFeedback> = {};
        for (const s of exercise.steps) {
          if (next[s.id]) exerciseScoped[s.id] = next[s.id]!;
        }
        saveStoredTutorFeedback(exercise.id, exerciseScoped);
        return next;
      });
      setDraft(prev => {
        const currentText = prev.writtenResponses[feedback.stepId] ?? '';
        setCoachedSnapshotByStepId(snapPrev => ({
          ...snapPrev,
          [feedback.stepId]: currentText,
        }));
        const existingChecked = prev.checkedRubricIds[feedback.stepId] ?? [];
        const syncedChecked = syncCriteriaFromCoachingFeedback(existingChecked, feedback);
        if (
          syncedChecked.length === existingChecked.length &&
          syncedChecked.every((id, idx) => id === existingChecked[idx])
        ) {
          return prev;
        }
        return {
          ...prev,
          checkedRubricIds: {
            ...prev.checkedRubricIds,
            [feedback.stepId]: syncedChecked,
          },
        };
      });
    },
    [],
  );

  const clearExamStepCoaching = useCallback(
    (exercise: SemiEssayExercise, stepId: string) => {
      setCoachingByStepId(prev => {
        const copy = { ...prev };
        delete copy[stepId];
        const exerciseScoped: Record<string, TutorCoachingFeedback> = {};
        for (const s of exercise.steps) {
          if (copy[s.id]) exerciseScoped[s.id] = copy[s.id]!;
        }
        saveStoredTutorFeedback(exercise.id, exerciseScoped);
        return copy;
      });
    },
    [],
  );

  const searchExamCurriculum = useCallback(
    async (query: string, expandCourse: boolean) => {
      if (!course) return [];
      const activeEntry =
        writtenStepMap.get(resolvedActiveStepId) ?? writtenStepEntries[0];
      const targetLessonId = activeEntry?.exercise.lessonId ?? lessonOrder[0] ?? '';
      let workingMap = markdownByLessonId;
      if (expandCourse) {
        const missingIds = lessonOrder.filter(lid => !workingMap[lid]);
        if (missingIds.length > 0) {
          const pairs = await Promise.all(
            missingIds.map(async lid => {
              try {
                const md = await loadLessonMarkdown(lid);
                return [lid, md] as const;
              } catch {
                return null;
              }
            }),
          );
          const extra: Record<string, string> = {};
          for (const p of pairs) {
            if (p) extra[p[0]] = p[1];
          }
          workingMap = { ...workingMap, ...extra };
          setMarkdownByLessonId(workingMap);
        }
      }
      const chunks = indexLessonMarkdownChunks({
        course,
        content: learningContent,
        targetLessonId,
        markdownByLessonId: workingMap,
      });
      return searchCurriculumChunks(chunks, query, { limit: 4, allowFutureChapters: false });
    },
    [course, writtenStepMap, resolvedActiveStepId, writtenStepEntries, lessonOrder, markdownByLessonId],
  );

  const liveExamBridgeRef = useRef({
    writtenStepEntries,
    writtenStepMap,
    resolvedActiveStepId,
    coachingByStepId,
    buildExamStepPacket,
    buildChapterExamOverview,
    applyExamCoachingFeedback,
    searchExamCurriculum,
  });
  liveExamBridgeRef.current = {
    writtenStepEntries,
    writtenStepMap,
    resolvedActiveStepId,
    coachingByStepId,
    buildExamStepPacket,
    buildChapterExamOverview,
    applyExamCoachingFeedback,
    searchExamCurriculum,
  };

  useEffect(() => {
    if (!canon || writtenStepEntries.length === 0) return;
    const registration = registerEssayWebMcpTools({
      getExercise: requestedStepId => {
        const lookupId = requestedStepId ?? liveExamBridgeRef.current.resolvedActiveStepId;
        return (
          liveExamBridgeRef.current.writtenStepMap.get(lookupId)?.exercise ??
          liveExamBridgeRef.current.writtenStepEntries[0]!.exercise
        );
      },
      getActiveStepId: () => liveExamBridgeRef.current.resolvedActiveStepId,
      getContextPacket: (mode, requestedStepId) => {
        const lookupId = requestedStepId ?? liveExamBridgeRef.current.resolvedActiveStepId;
        const entry =
          liveExamBridgeRef.current.writtenStepMap.get(lookupId) ??
          liveExamBridgeRef.current.writtenStepEntries[0];
        return entry ? liveExamBridgeRef.current.buildExamStepPacket(entry, mode, true) : null;
      },
      searchCurriculum: (query, expand) =>
        liveExamBridgeRef.current.searchExamCurriculum(query, expand),
      onReceiveFeedback: feedback => {
        const entry =
          liveExamBridgeRef.current.writtenStepMap.get(feedback.stepId) ??
          liveExamBridgeRef.current.writtenStepEntries[0];
        if (entry) {
          liveExamBridgeRef.current.applyExamCoachingFeedback(entry.exercise, feedback);
        }
      },
      getExamPaperOverview: () => liveExamBridgeRef.current.buildChapterExamOverview(true),
    });
    setWebMcpAvailable(registration.support.available);
    return () => {
      registration.dispose();
    };
  }, [canon, writtenStepEntries.length]);

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
    if (!inlineCodeLabTool || !chapter) return undefined;
    const promptItems = paper.items.map(it => ({
      id: it.exercise.id,
      title: it.exercise.title,
      prompt: it.exercise.prompt,
    }));
    const preferredLang = inferDefaultCodeLanguage({
      exercisePrompts: promptItems.map(p => p.prompt),
    });
    return buildPlaygroundSnippets({
      scopeId: chapter.id,
      exerciseItems: promptItems,
      defaultLanguage: preferredLang,
    });
  }, [inlineCodeLabTool, chapter, paper.items]);

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

  const buildChapterStepPacketFromRef = useCallback(
    (
      exercise: SemiEssayExercise,
      step: WrittenReasoningStep,
      stepNumber: number,
      mode: CoachingPromptMode,
    ) => liveExamBridgeRef.current.buildExamStepPacket({ exercise, step, stepNumber }, mode),
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

  const draftedStepCount = writtenStepEntries.filter(
    entry => Boolean((draft.writtenResponses[entry.step.id] ?? '').trim()),
  ).length;

  const handleCopyWholePaperWebMcp = async () => {
    const overview = buildChapterExamOverview();
    if (!overview) return;
    const prompt = formatWholeExamWebMcpPrompt(overview, { webMcpAvailable });
    try {
      await navigator.clipboard.writeText(prompt);
      setWholePaperCopyMessage(
        `Đã chép Prompt Kép chấm toàn đề (${overview.draftedStepCount} ý đã viết)! Dán vào ✨ Ask Gemini — nếu thanh bên trả lời kèm JSON, bấm Sao chép câu trả lời rồi nhấn «Nhập toàn đề từ Gemini».`,
      );
    } catch {
      setWholePaperCopyMessage(
        'Trình duyệt không cho phép chép tự động vào Clipboard. Bạn có thể bấm nút Kiểm tra trình bày trên từng câu.',
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
    for (const fb of parsed.items) {
      const entry = writtenStepMap.get(fb.stepId);
      if (entry) {
        applyExamCoachingFeedback(entry.exercise, fb);
      }
    }
    return { ok: true, count: parsed.items.length };
  };

  const handleSelectPreset = (nextPreset: ChapterExamLengthPreset) => {
    setPinnedExerciseIds(undefined);
    setPreset(nextPreset);
    setCustomCount(undefined);
    setSubmitted(false);
  };

  const handleSelectCount = (nextCount: number) => {
    setPinnedExerciseIds(undefined);
    setCustomCount(nextCount);
    setSubmitted(false);
  };

  const examInteractiveDraftPrefix = `chapter-exam:${course.id}:${chapter.id}:`;

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
    clearStoredChapterExamSession(course.id, chapter.id);
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
  const explicitChapterPrefix = /^(Chương\s+\d+|Bài\s+\d+)/i.exec(chapter.title)?.[1];
  const chapterTag = explicitChapterPrefix ?? `Chương ${chapterIndex + 1}`;
  const headingTitle = explicitChapterPrefix
    ? `Kiểm tra cuối ${chapter.title}`
    : `Kiểm tra cuối Chương ${chapterIndex + 1}: ${chapter.title}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 overflow-x-clip">
      <Breadcrumbs
        items={[
          { label: 'Học phần', to: '/courses' },
          { label: course.title, to: `/courses/${course.id}` },
          {
            label: chapterTag,
            to: `/courses/${course.id}?chapter=${encodeURIComponent(chapter.id)}`,
          },
          { label: 'Kiểm tra cuối chương' },
        ]}
      />

      {/* Compact Exam Masthead & Adaptive 3-10 Question Configuration */}
      <header className="hus-card-surface space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3.5">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent" mono>
                {code} · {chapterTag}
              </Badge>
              <Badge tone="neutral">
                {poolSummary.distinctForms.length} dạng · Kho {poolSummary.totalExercises} câu
              </Badge>
              <Badge tone={webMcpAvailable ? 'success' : 'warning'}>
                {webMcpAvailable ? 'WebMCP 2 chiều sẵn sàng' : 'Ask Gemini dự phòng'}
              </Badge>
              {submitted ? <Badge tone="success">Đã nộp bài &amp; mở đối chiếu</Badge> : null}
            </div>
            <h1 className="heading-page text-ink">{headingTitle}</h1>
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
          </div>
        </div>

        {/* Answer Mode + Length Preset + Exact Question Count Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="group"
              aria-label="Hình thức trình bày bài kiểm tra chương"
              className="inline-flex flex-wrap rounded-[var(--radius-md)] border border-border bg-canvas p-0.5"
            >
              <button
                type="button"
                aria-pressed={answerMode === 'mixed'}
                onClick={() => {
                  setPinnedExerciseIds(undefined);
                  setAnswerMode('mixed');
                  setSubmitted(false);
                }}
                className={`min-h-[34px] rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                  answerMode === 'mixed'
                    ? 'bg-accent-subtle font-semibold text-accent-ink'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Đề hỗn hợp
              </button>
              <button
                type="button"
                aria-pressed={answerMode === 'written-all'}
                onClick={() => {
                  setPinnedExerciseIds(undefined);
                  setAnswerMode('written-all');
                  setSubmitted(false);
                }}
                className={`min-h-[34px] rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                  answerMode === 'written-all'
                    ? 'bg-accent-subtle font-semibold text-accent-ink'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                100% Tự luận giấy A4
              </button>
            </div>

            <div
              role="group"
              aria-label="Độ dài đề kiểm tra"
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
                    onClick={() => handleSelectPreset(item.id)}
                    className={`min-h-[34px] rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent-subtle font-semibold text-accent-ink'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    {item.label} ({count} câu)
                  </button>
                );
              })}
            </div>
          </div>

          {selectableCounts.length > 1 ? (
            <div className="flex items-center gap-2">
              <label
                htmlFor="chapter-exam-exact-count"
                className="text-xs font-medium text-ink-secondary"
              >
                Tùy chỉnh số câu ({poolSummary.minSelectableCount}–{poolSummary.maxSelectableCount}):
              </label>
              <select
                id="chapter-exam-exact-count"
                value={paper.targetCount}
                onChange={e => handleSelectCount(Number(e.target.value))}
                className="min-h-[36px] rounded-[var(--radius-md)] border border-border bg-canvas px-2.5 py-1 font-mono text-xs font-medium text-ink focus:border-accent focus:outline-none"
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

        {/* Paper Composition Summary & Jump Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
          <nav aria-label="Chuyển nhanh đến câu hỏi" className="flex flex-wrap gap-1.5">
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
                  {isWritten ? <span aria-hidden="true">· A4</span> : null}
                </a>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-1.5 text-ink-muted">
            {paperFormCounts.map(fc => (
              <Badge key={fc.kind} tone={fc.kind === 'semi-essay' ? 'accent' : 'neutral'}>
                {fc.count} {FORM_LABEL[fc.kind]}
              </Badge>
            ))}
            <span className="ml-1 font-mono font-medium tabular-nums">
              · {answeredQuestionCount}/{paper.items.length} câu
            </span>
          </div>
        </div>
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
                Tổng kết bài kiểm tra {chapterTag}
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
                  Phần Tự luận trình bày giấy A4 (WebMCP đối chiếu ngầm)
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">
                  {evaluation.writtenSelfReviewed}/{evaluation.writtenTotal}{' '}
                  <span className="font-sans text-sm font-normal text-ink-secondary">
                    câu đạt chuẩn trình bày qua WebMCP
                  </span>
                </p>
                {evaluation.writtenSelfReviewed < evaluation.writtenTotal ? (
                  <p className="mt-1 text-xs text-warning">
                    Nhấn «Kiểm tra cách trình bày &amp; kết quả» ở câu tự luận A4 bên dưới để WebMCP
                    đối chiếu ngầm và trả nhận xét (đáp án mẫu &amp; thang chấm được ẩn hoàn toàn).
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
                            ? 'Đạt chuẩn qua WebMCP'
                            : 'Chờ kiểm tra qua WebMCP'}
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
                      Thuộc bài: {sourceLesson.title}
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
                      Kiểm chứng đoạn mã của câu hỏi này ngay bên dưới đề kiểm tra:
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
                        <ChapterWrittenStepItem
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
                          onActivateStep={setActiveWebMcpStepId}
                          onChangeResponse={handleChangeWrittenResponse}
                          onBuildPacket={buildChapterStepPacketFromRef}
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
                        <ChapterWrittenStepItem
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
                          onActivateStep={setActiveWebMcpStepId}
                          onChangeResponse={handleChangeWrittenResponse}
                          onBuildPacket={buildChapterStepPacketFromRef}
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
            <ChapterExamObjectiveItem
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
              ? 'Bài kiểm tra đã được chấm phần trắc nghiệm & lưu bài tự luận'
              : `Hoàn thành đề kiểm tra ${chapterTag} (${answeredQuestionCount}/${paper.items.length} câu đã điền)`}
          </p>
          <p className="text-xs text-ink-secondary">
            {submitted
              ? 'Đáp án mẫu & thang ý tự luận được ẩn hoàn toàn — hãy nhờ WebMCP kiểm tra cách trình bày trên giấy A4.'
              : 'Bài nháp tự động lưu trên trình duyệt. Nhấn nộp bài để chấm trắc nghiệm và dùng WebMCP kiểm tra cách trình bày tự luận.'}
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
