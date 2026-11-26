import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ChapterExamDraft, ChapterExamPaper } from '../domain/chapter-exam';
import type {
  CoachingHistoryEntry,
  CoachingPromptMode,
  CourseConventionCanon,
  CurriculumChunk,
  GroundedEssayContextPacket,
  TutorCoachingFeedback,
} from '../domain/curriculum-tutor';
import type { Course, EntityId } from '../domain/learning';
import type { SemiEssayExercise, WrittenReasoningStep } from '../domain/semi-essay';
import { buildRevisionDiffContext } from '../core/learning/coaching-memory';
import {
  buildCurriculumHorizon,
  buildGroundedEssayContextPacket,
  indexLessonMarkdownChunks,
  prepareCurriculumSearchIndex,
  searchPreparedCurriculumIndex,
  summarizeExerciseVisualContext,
  synthesizeFallbackTheoryAnchors,
  type PreparedCurriculumIndex,
} from '../core/learning/curriculum-rag';
import { emptyWrittenStepDraft } from '../core/learning/semi-essay';
import {
  didExercisePassViaTutor,
  syncCriteriaFromCoachingFeedback,
} from '../core/learning/webmcp-essay-adapters';
import {
  loadStoredTutorFeedback,
  loadStoredTutorFeedbackHistory,
  saveStoredTutorFeedback,
  saveStoredTutorFeedbackWithHistory,
} from '../infrastructure/ai/tutor-feedback-parser';
import { collectExerciseInteractiveDraftSummaries } from '../infrastructure/practice/interactive-step-drafts';
import {
  detectWebMcpSupport,
  registerEssayWebMcpTools,
  type ExamPaperWebMcpOverview,
} from '../infrastructure/ai/webmcp-essay-bridge';
import { learningContent, loadLessonMarkdown } from '../infrastructure/content/learning';
import { progressStore } from '../infrastructure/progress/store';

export interface ExamWrittenStepEntry {
  readonly questionNumber: number;
  readonly exercise: SemiEssayExercise;
  readonly step: WrittenReasoningStep;
  readonly stepNumber: number;
}

export interface UseExamWebMcpBridgeParams {
  readonly course: Course | undefined;
  readonly canon: CourseConventionCanon | undefined;
  readonly scopeLabel: string;
  readonly submitted: boolean;
  readonly paper: ChapterExamPaper;
  readonly draft: ChapterExamDraft;
  readonly setDraft: Dispatch<SetStateAction<ChapterExamDraft>>;
  readonly lessonOrder: readonly EntityId[];
  readonly writtenStepEntries: readonly ExamWrittenStepEntry[];
  readonly interactiveDraftPrefix?: string | undefined;
  readonly setLastCoachedQuestionNumber: Dispatch<SetStateAction<number | null>>;
  readonly setCoachedSnapshotByStepId: Dispatch<SetStateAction<Readonly<Record<string, string>>>>;
}

export interface ExamWebMcpBridgeResult {
  readonly writtenStepMap: ReadonlyMap<string, ExamWrittenStepEntry>;
  readonly resolvedActiveStepId: string;
  readonly setActiveWebMcpStepId: Dispatch<SetStateAction<string>>;
  readonly webMcpAvailable: boolean;
  readonly coachingByStepId: Readonly<Record<string, TutorCoachingFeedback>>;
  readonly coachingHistoryByStepId: Readonly<Record<string, readonly CoachingHistoryEntry[]>>;
  readonly buildStepPacket: (
    exercise: SemiEssayExercise,
    step: WrittenReasoningStep,
    stepNumber: number,
    mode: CoachingPromptMode,
  ) => GroundedEssayContextPacket | null;
  readonly buildExamOverview: (fromWebMcp?: boolean) => ExamPaperWebMcpOverview | null;
  readonly applyExamCoachingFeedback: (
    exercise: SemiEssayExercise,
    feedback: TutorCoachingFeedback,
  ) => void;
  readonly applyExamBatchCoachingFeedback: (items: readonly TutorCoachingFeedback[]) => void;
  readonly clearExamStepCoaching: (exercise: SemiEssayExercise, stepId: string) => void;
}

/**
 * Coordinates WebMCP tool registration, cached Graph-RAG context building, rubric synchronization,
 * and Mức 1 progress recording across multi-question exam surfaces (`ExamPracticePage` & `ChapterExamPage`).
 */
export function useExamWebMcpBridge({
  course,
  canon,
  scopeLabel,
  submitted,
  paper,
  draft,
  setDraft,
  lessonOrder,
  writtenStepEntries,
  interactiveDraftPrefix,
  setLastCoachedQuestionNumber,
  setCoachedSnapshotByStepId,
}: UseExamWebMcpBridgeParams): ExamWebMcpBridgeResult {
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
  const [coachingHistoryByStepId, setCoachingHistoryByStepId] = useState<
    Readonly<Record<string, readonly CoachingHistoryEntry[]>>
  >({});

  // Hydrate persisted coaching feedback and revision history whenever paper's written exercises change
  useEffect(() => {
    const merged: Record<string, TutorCoachingFeedback> = {};
    const mergedHistory: Record<string, readonly CoachingHistoryEntry[]> = {};
    const seen = new Set<string>();
    for (const { exercise } of writtenStepEntries) {
      if (seen.has(exercise.id)) continue;
      seen.add(exercise.id);
      Object.assign(merged, loadStoredTutorFeedback(exercise));
      Object.assign(mergedHistory, loadStoredTutorFeedbackHistory(exercise.id));
    }
    setCoachingByStepId(merged);
    setCoachingHistoryByStepId(mergedHistory);
  }, [writtenStepEntries]);

  // Load lesson Markdown on demand for active written items in the exam paper
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
      if (Object.keys(loaded).length > 0) {
        setMarkdownByLessonId(prev => ({ ...prev, ...loaded }));
      }
    });
    return () => {
      active = false;
    };
  }, [course, writtenStepEntries]);

  // Pre-index chunks and BM25 token frequencies once per distinct lessonId on the paper
  const ragCacheByLessonId = useMemo(() => {
    const map = new Map<
      EntityId,
      { readonly chunks: readonly CurriculumChunk[]; readonly preparedIndex: PreparedCurriculumIndex }
    >();
    if (!course) return map;
    const uniqueLessonIds = new Set(writtenStepEntries.map(e => e.exercise.lessonId));
    for (const lessonId of uniqueLessonIds) {
      const chunks = indexLessonMarkdownChunks({
        course,
        content: learningContent,
        targetLessonId: lessonId,
        markdownByLessonId,
      });
      map.set(lessonId, {
        chunks,
        preparedIndex: prepareCurriculumSearchIndex(chunks),
      });
    }
    return map;
  }, [course, writtenStepEntries, markdownByLessonId]);

  const buildExamStepPacket = useCallback(
    (
      entry: {
        readonly exercise: SemiEssayExercise;
        readonly step: WrittenReasoningStep;
        readonly stepNumber: number;
      },
      mode: CoachingPromptMode,
      fromWebMcp = false,
    ): GroundedEssayContextPacket | null => {
      if (!course || !canon) return null;
      const horizon = buildCurriculumHorizon(course, learningContent, entry.exercise.lessonId);
      const cachedRag = ragCacheByLessonId.get(entry.exercise.lessonId);
      const chunks =
        cachedRag?.chunks ??
        indexLessonMarkdownChunks({
          course,
          content: learningContent,
          targetLessonId: entry.exercise.lessonId,
          markdownByLessonId,
        });
      const preparedIndex = cachedRag?.preparedIndex ?? prepareCurriculumSearchIndex(chunks);
      const stepIdx = Math.max(
        0,
        entry.exercise.steps.findIndex(s => s.id === entry.step.id),
      );
      const effectiveAnchors = synthesizeFallbackTheoryAnchors(
        chunks,
        entry.exercise,
        stepIdx,
        3,
        preparedIndex,
      ).anchors;
      const interactiveSummaries = collectExerciseInteractiveDraftSummaries(
        entry.exercise,
        interactiveDraftPrefix ?? '',
      );
      const currentDraftText = draft.writtenResponses[entry.step.id] ?? '';
      const revisionDiffContext = buildRevisionDiffContext(
        coachingHistoryByStepId[entry.step.id] ?? [],
        currentDraftText,
      );
      return buildGroundedEssayContextPacket({
        mode,
        canon,
        horizon,
        exercise: entry.exercise,
        step: entry.step,
        stepNumber: entry.stepNumber,
        draft: {
          ...emptyWrittenStepDraft(),
          response: currentDraftText,
          reviewedCriterionIds: draft.checkedRubricIds[entry.step.id] ?? [],
          modelRevealed: false,
        },
        chunks,
        preparedIndex,
        effectiveTheoryAnchors: effectiveAnchors,
        ...(interactiveSummaries.length > 0
          ? { studentInteractiveWorkSummary: interactiveSummaries }
          : {}),
        ...(revisionDiffContext ? { revisionDiffContext } : {}),
        internalReferenceForWebMcp: fromWebMcp && mode !== 'socratic-hint',
      });
    },
    [
      course,
      canon,
      ragCacheByLessonId,
      markdownByLessonId,
      draft.writtenResponses,
      draft.checkedRubricIds,
      interactiveDraftPrefix,
      coachingHistoryByStepId,
    ],
  );

  const buildExamOverview = useCallback(
    (fromWebMcp = false): ExamPaperWebMcpOverview | null => {
      if (!course || !canon) return null;
      const steps = writtenStepEntries.map(entry => {
        const text = draft.writtenResponses[entry.step.id] ?? '';
        const visualContextSummary = summarizeExerciseVisualContext(entry.exercise);
        const studentInteractiveWorkSummary = collectExerciseInteractiveDraftSummaries(
          entry.exercise,
          interactiveDraftPrefix ?? '',
        );
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
          ...(visualContextSummary.length > 0 ? { visualContextSummary } : {}),
          ...(studentInteractiveWorkSummary.length > 0
            ? { studentInteractiveWorkSummary }
            : {}),
          ...(fromWebMcp ? { referenceModelAnswer: entry.step.modelAnswer } : {}),
        };
      });
      return {
        courseId: course.id,
        courseCode: canon.academicCode,
        courseTitle: course.title,
        scopeLabel,
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
      canon,
      writtenStepEntries,
      draft.writtenResponses,
      interactiveDraftPrefix,
      scopeLabel,
      submitted,
      paper.items.length,
    ],
  );

  const applyExamBatchCoachingFeedback = useCallback(
    (items: readonly TutorCoachingFeedback[]) => {
      if (items.length === 0) return;

      const resolvedPairs: { readonly exercise: SemiEssayExercise; readonly feedback: TutorCoachingFeedback }[] = [];
      let lastMatchedQ: number | null = null;
      for (const feedback of items) {
        const entry = liveBridgeRef.current.writtenStepMap.get(feedback.stepId);
        if (!entry) continue;
        resolvedPairs.push({ exercise: entry.exercise, feedback });
        lastMatchedQ = entry.questionNumber;
      }
      if (resolvedPairs.length === 0) return;

      if (lastMatchedQ !== null) {
        setLastCoachedQuestionNumber(lastMatchedQ);
      }

      const nextCoachingMap: Record<string, TutorCoachingFeedback> = {
        ...liveBridgeRef.current.coachingByStepId,
      };
      const touchedExercises = new Map<string, SemiEssayExercise>();

      for (const { exercise, feedback } of resolvedPairs) {
        nextCoachingMap[feedback.stepId] = feedback;
        touchedExercises.set(exercise.id, exercise);
      }

      for (const exercise of touchedExercises.values()) {
        const passVerdict = didExercisePassViaTutor(exercise, nextCoachingMap);
        if (passVerdict !== null) {
          const latestTimestamp =
            [...resolvedPairs].reverse().find(p => p.exercise.id === exercise.id)?.feedback
              .receivedAt ?? new Date().toISOString();
          progressStore.dispatch({
            type: 'attempt',
            exerciseId: exercise.id,
            correct: passVerdict,
            at: latestTimestamp,
          });
        }
      }

      const updatedHistories: Record<string, readonly CoachingHistoryEntry[]> = {};
      for (const { exercise, feedback } of resolvedPairs) {
        const exerciseScoped: Record<string, TutorCoachingFeedback> = {};
        for (const s of exercise.steps) {
          if (nextCoachingMap[s.id]) exerciseScoped[s.id] = nextCoachingMap[s.id]!;
        }
        const savedHistory = saveStoredTutorFeedbackWithHistory(exercise, exerciseScoped, {
          updatedStepId: feedback.stepId,
          draftSnapshot: liveBridgeRef.current.writtenResponses[feedback.stepId] ?? '',
        });
        Object.assign(updatedHistories, savedHistory);
      }

      setCoachingByStepId(nextCoachingMap);
      if (Object.keys(updatedHistories).length > 0) {
        setCoachingHistoryByStepId(prev => ({ ...prev, ...updatedHistories }));
      }

      setDraft(prev => {
        const snapshotUpdates: Record<string, string> = {};
        let checkedChanged = false;
        const nextCheckedByStep: Record<string, readonly string[]> = {
          ...prev.checkedRubricIds,
        };

        for (const { feedback } of resolvedPairs) {
          const currentText = prev.writtenResponses[feedback.stepId] ?? '';
          snapshotUpdates[feedback.stepId] = currentText;
          const existingChecked = prev.checkedRubricIds[feedback.stepId] ?? [];
          const syncedChecked = syncCriteriaFromCoachingFeedback(existingChecked, feedback);
          if (
            syncedChecked.length !== existingChecked.length ||
            !syncedChecked.every((id, idx) => id === existingChecked[idx])
          ) {
            nextCheckedByStep[feedback.stepId] = syncedChecked;
            checkedChanged = true;
          }
        }

        setCoachedSnapshotByStepId(snapPrev => ({
          ...snapPrev,
          ...snapshotUpdates,
        }));

        return checkedChanged ? { ...prev, checkedRubricIds: nextCheckedByStep } : prev;
      });
    },
    [setDraft, setLastCoachedQuestionNumber, setCoachedSnapshotByStepId],
  );

  const applyExamCoachingFeedback = useCallback(
    (exercise: SemiEssayExercise, feedback: TutorCoachingFeedback) => {
      const matchedEntry = liveBridgeRef.current.writtenStepMap.get(feedback.stepId);
      if (matchedEntry) {
        setLastCoachedQuestionNumber(matchedEntry.questionNumber);
      }
      const nextPreview = {
        ...liveBridgeRef.current.coachingByStepId,
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
      const nextCoachingMap: Record<string, TutorCoachingFeedback> = {
        ...liveBridgeRef.current.coachingByStepId,
        [feedback.stepId]: feedback,
      };
      const exerciseScoped: Record<string, TutorCoachingFeedback> = {};
      for (const s of exercise.steps) {
        if (nextCoachingMap[s.id]) exerciseScoped[s.id] = nextCoachingMap[s.id]!;
      }
      const savedHistory = saveStoredTutorFeedbackWithHistory(exercise, exerciseScoped, {
        updatedStepId: feedback.stepId,
        draftSnapshot: liveBridgeRef.current.writtenResponses[feedback.stepId] ?? '',
      });
      setCoachingByStepId(nextCoachingMap);
      setCoachingHistoryByStepId(prev => ({ ...prev, ...savedHistory }));
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
    [setDraft, setLastCoachedQuestionNumber, setCoachedSnapshotByStepId],
  );

  const clearExamStepCoaching = useCallback((exercise: SemiEssayExercise, stepId: string) => {
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
  }, []);

  const searchExamCurriculum = useCallback(
    async (query: string, expandCourse: boolean) => {
      if (!course) return [];
      const activeEntry = writtenStepMap.get(resolvedActiveStepId) ?? writtenStepEntries[0];
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
      const cached = !expandCourse ? ragCacheByLessonId.get(targetLessonId) : undefined;
      if (cached) {
        return searchPreparedCurriculumIndex(cached.preparedIndex, query, {
          limit: 4,
          allowFutureChapters: false,
        });
      }
      const chunks = indexLessonMarkdownChunks({
        course,
        content: learningContent,
        targetLessonId,
        markdownByLessonId: workingMap,
      });
      return searchPreparedCurriculumIndex(prepareCurriculumSearchIndex(chunks), query, {
        limit: 4,
        allowFutureChapters: false,
      });
    },
    [
      course,
      writtenStepMap,
      resolvedActiveStepId,
      writtenStepEntries,
      lessonOrder,
      markdownByLessonId,
      ragCacheByLessonId,
    ],
  );

  const liveBridgeRef = useRef({
    writtenStepEntries,
    writtenStepMap,
    resolvedActiveStepId,
    coachingByStepId,
    writtenResponses: draft.writtenResponses,
    buildExamStepPacket,
    buildExamOverview,
    applyExamCoachingFeedback,
    applyExamBatchCoachingFeedback,
    searchExamCurriculum,
  });
  liveBridgeRef.current = {
    writtenStepEntries,
    writtenStepMap,
    resolvedActiveStepId,
    coachingByStepId,
    writtenResponses: draft.writtenResponses,
    buildExamStepPacket,
    buildExamOverview,
    applyExamCoachingFeedback,
    applyExamBatchCoachingFeedback,
    searchExamCurriculum,
  };

  useEffect(() => {
    if (!canon || writtenStepEntries.length === 0) return;
    const registration = registerEssayWebMcpTools({
      getExercise: requestedStepId => {
        const lookupId = requestedStepId ?? liveBridgeRef.current.resolvedActiveStepId;
        return (
          liveBridgeRef.current.writtenStepMap.get(lookupId)?.exercise ??
          liveBridgeRef.current.writtenStepEntries[0]!.exercise
        );
      },
      getActiveStepId: () => liveBridgeRef.current.resolvedActiveStepId,
      getContextPacket: (mode, requestedStepId) => {
        const lookupId = requestedStepId ?? liveBridgeRef.current.resolvedActiveStepId;
        const entry =
          liveBridgeRef.current.writtenStepMap.get(lookupId) ??
          liveBridgeRef.current.writtenStepEntries[0];
        return entry ? liveBridgeRef.current.buildExamStepPacket(entry, mode, true) : null;
      },
      searchCurriculum: (query, expand) =>
        liveBridgeRef.current.searchExamCurriculum(query, expand),
      onReceiveFeedback: feedback => {
        const entry =
          liveBridgeRef.current.writtenStepMap.get(feedback.stepId) ??
          liveBridgeRef.current.writtenStepEntries[0];
        if (entry) {
          liveBridgeRef.current.applyExamCoachingFeedback(entry.exercise, feedback);
        }
      },
      onReceiveBatchFeedback: items => {
        liveBridgeRef.current.applyExamBatchCoachingFeedback(items);
      },
      getExamPaperOverview: () => liveBridgeRef.current.buildExamOverview(true),
    });
    setWebMcpAvailable(registration.support.available);
    return () => {
      registration.dispose();
    };
  }, [canon, writtenStepEntries.length]);

  const buildStepPacket = useCallback(
    (
      exercise: SemiEssayExercise,
      step: WrittenReasoningStep,
      stepNumber: number,
      mode: CoachingPromptMode,
    ) => liveBridgeRef.current.buildExamStepPacket({ exercise, step, stepNumber }, mode),
    [],
  );

  return {
    writtenStepMap,
    resolvedActiveStepId,
    setActiveWebMcpStepId,
    webMcpAvailable,
    coachingByStepId,
    coachingHistoryByStepId,
    buildStepPacket,
    buildExamOverview: (fromWebMcp = false) => liveBridgeRef.current.buildExamOverview(fromWebMcp),
    applyExamCoachingFeedback,
    applyExamBatchCoachingFeedback,
    clearExamStepCoaching,
  };
}
