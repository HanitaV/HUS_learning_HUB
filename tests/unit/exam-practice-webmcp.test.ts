import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCourseConventionCanon } from '../../src/content/curriculum-canons';
import { buildChapterExamPaper, evaluateChapterExam } from '../../src/core/learning/chapter-exam';
import {
  buildGroundedEssayContextPacket,
  formatAskGeminiPromptPacket,
} from '../../src/core/learning/curriculum-rag';
import { emptyWrittenStepDraft } from '../../src/core/learning/semi-essay';
import {
  adaptClassicExerciseToSemiEssay,
  adaptExerciseToWrittenExamProblem,
  deriveStepCoachingState,
  doesClassicPromptRequireStatements,
  syncCriteriaFromCoachingFeedback,
} from '../../src/core/learning/webmcp-essay-adapters';
import type {
  CourseConventionCanon,
  LessonWebMcpContextPacket,
  TutorCoachingFeedback,
} from '../../src/domain/curriculum-tutor';
import type { ClassicExerciseDefinition, ExerciseDefinition } from '../../src/domain/workspace';
import {
  formatLessonStudyWebMcpPrompt,
  formatWholeExamWebMcpPrompt,
  registerEssayWebMcpTools,
  type ExamPaperWebMcpOverview,
  type WebMcpToolDefinition,
} from '../../src/infrastructure/ai/webmcp-essay-bridge';
import {
  parseBatchExternalTutorFeedback,
  parseExternalTutorFeedback,
} from '../../src/infrastructure/ai/tutor-feedback-parser';
import {
  loadStoredChapterExamSession,
  saveStoredChapterExamSession,
} from '../../src/infrastructure/progress/chapter-exam-store';
import {
  clearStoredExamPracticeSession,
  loadStoredExamPracticeConfig,
  loadStoredExamPracticeSession,
  saveStoredExamPracticeConfig,
  saveStoredExamPracticeSession,
} from '../../src/infrastructure/progress/exam-practice-store';

describe('Database Written Exam Practice & WebMCP Presentation Checker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const standaloneMc: ClassicExerciseDefinition = {
    id: 'sample-ex-alg-1',
    lessonId: 'sample-ch0-algebra',
    kind: 'multiple-choice',
    title: 'Tách phân thức bằng phương pháp che',
    prompt:
      'Tách phân thức $\\dfrac{2x + 3}{(x - 1)(x - 2)} = \\dfrac{A}{x - 1} + \\dfrac{B}{x - 2}$. Giá trị của hệ số $A$ là bao nhiêu?',
    choices: [
      { id: 'a', label: '$-5$' },
      { id: 'b', label: '$5$' },
    ],
    answers: ['a'],
    explanation: 'Che $(x-1)$ thế $x=1$ ta có $A = -5$.',
  };

  const statementMc: ClassicExerciseDefinition = {
    id: 'sample-statement-mc',
    lessonId: 'sample-bst-1',
    kind: 'multiple-choice',
    title: 'Tính chất cây nhị phân tìm kiếm',
    prompt: 'Khẳng định nào sau đây là đúng về phép duyệt trung thứ tự trên BST?',
    choices: [
      { id: 'a', label: 'Cho dãy khóa tăng dần.' },
      { id: 'b', label: 'Luôn cho dãy khóa giảm dần.' },
    ],
    answers: ['a'],
    explanation: 'In-order trên BST thăm trái -> gốc -> phải nên dãy khóa không giảm.',
  };

  const shortAns: ClassicExerciseDefinition = {
    id: 'sample-sa-1',
    lessonId: 'sample-vars',
    kind: 'short-answer',
    title: 'Số bản sao biến static',
    prompt: 'Tạo 4 đối tượng Student thì có bao nhiêu bản sao của biến static count?',
    answers: ['1'],
    explanation: 'Biến static dùng chung duy nhất 1 bản sao cho cả lớp.',
  };

  it('distinguishes standalone calculation prompts from statement-dependent prompts when converting to written A4', () => {
    expect(doesClassicPromptRequireStatements(standaloneMc)).toBe(false);
    expect(doesClassicPromptRequireStatements(statementMc)).toBe(true);
    expect(doesClassicPromptRequireStatements(shortAns)).toBe(false);

    const adaptedStandalone = adaptClassicExerciseToSemiEssay(standaloneMc);
    expect(adaptedStandalone.prompt).not.toContain('**(A)** $-5$');
    expect(adaptedStandalone.steps).toHaveLength(1);
    expect(adaptedStandalone.steps[0]?.kind).toBe('written-reasoning');
    if (adaptedStandalone.steps[0]?.kind === 'written-reasoning') {
      expect(adaptedStandalone.steps[0].rubric).toHaveLength(3);
      expect(adaptedStandalone.steps[0].modelAnswer).toContain('$-5$');
      expect(adaptedStandalone.steps[0].modelAnswer).toContain('Che $(x-1)$');
    }

    const adaptedStatement = adaptClassicExerciseToSemiEssay(statementMc);
    expect(adaptedStatement.prompt).toContain('**(A)** Cho dãy khóa tăng dần.');
    expect(adaptedStatement.prompt).toContain('**(B)** Luôn cho dãy khóa giảm dần.');
  });

  it('converts all database questions in an exam paper to written A4 problems when answerMode is written-all', () => {
    const pool: readonly ExerciseDefinition[] = [standaloneMc, statementMc, shortAns];
    const writtenPaper = buildChapterExamPaper({
      exercises: pool,
      lessonOrder: ['sample-ch0-algebra', 'sample-bst-1', 'sample-vars'],
      preset: 'short',
      seed: 1,
      answerMode: 'written-all',
    });

    expect(writtenPaper.items).toHaveLength(3);
    expect(writtenPaper.items.every(it => it.exercise.kind === 'semi-essay')).toBe(true);
    expect(writtenPaper.items.map(it => it.originalKind).sort()).toEqual([
      'multiple-choice',
      'multiple-choice',
      'short-answer',
    ]);

    const evalInitial = evaluateChapterExam(writtenPaper, {
      objectiveAnswers: {},
      writtenResponses: {
        'sample-ex-alg-1-written': 'Thế x = 1 vào (2x+3)/(x-2) được A = -5.',
      },
      checkedRubricIds: {},
    });
    expect(evalInitial.objectiveTotal).toBe(0);
    expect(evalInitial.writtenTotal).toBe(3);
    expect(evalInitial.writtenDrafted).toBe(1);
  });

  it('formats presentation-review context packets and registers hus_get_exam_paper_submissions on WebMCP', async () => {
    const adapted = adaptExerciseToWrittenExamProblem(standaloneMc);
    const step = adapted.steps[0]!;
    if (step.kind !== 'written-reasoning') throw new Error('Expected written step');

    const canon = resolveCourseConventionCanon({
      courseId: 'sample-calc',
      academicCode: 'CALC101',
      subjectId: 'mathematics',
      courseTitle: 'Giải tích mẫu',
    });

    const packet = buildGroundedEssayContextPacket({
      mode: 'presentation-review',
      canon,
      exercise: adapted,
      step,
      stepNumber: 1,
      draft: {
        ...emptyWrittenStepDraft(),
        response: 'Ta có x != 1, x != 2. Quy đồng tử số: 2x + 3 = A(x-2) + B(x-1) => A = -5.',
        modelRevealed: false,
      },
      chunks: [],
      effectiveTheoryAnchors: [],
    });

    expect(packet.mode).toBe('presentation-review');
    expect(packet.activeStep.referenceModelAnswer).toBeUndefined();
    expect(packet.pedagogicalContract.join(' ')).toContain('CÁCH TRÌNH BÀY KẾT QUẢ');

    const internalWebMcpPacket = buildGroundedEssayContextPacket({
      mode: 'presentation-review',
      canon,
      exercise: adapted,
      step,
      stepNumber: 1,
      draft: {
        ...emptyWrittenStepDraft(),
        response: 'A = -5',
        modelRevealed: false,
      },
      chunks: [],
      effectiveTheoryAnchors: [],
      internalReferenceForWebMcp: true,
    });
    expect(internalWebMcpPacket.activeStep.referenceModelAnswer).toContain('$-5$');
    expect(internalWebMcpPacket.pedagogicalContract.join(' ')).toContain('BẢO MẬT ĐỀ THI');

    const webMcpCmd = formatAskGeminiPromptPacket(packet, { webMcpAvailable: true });
    expect(webMcpCmd).toContain('"mode": "presentation-review"');
    expect(webMcpCmd).toContain('hus_submit_essay_coaching');

    const overview: ExamPaperWebMcpOverview = {
      courseId: 'sample-calc',
      courseCode: 'CALC101',
      courseTitle: 'Giải tích mẫu',
      scopeLabel: 'Toàn học phần',
      notationRules: canon.notationRules,
      forbiddenShortcutHints: canon.forbiddenShortcutHints,
      submitted: false,
      totalQuestions: 2,
      draftedStepCount: 1,
      steps: [
        {
          questionNumber: 1,
          exerciseId: adapted.id,
          exerciseTitle: adapted.title,
          stepId: step.id,
          stepTitle: step.title,
          problemPrompt: adapted.prompt,
          stepPrompt: step.prompt,
          rubricCriteria: step.rubric,
          studentDraft: 'A = -5',
          hasDraft: true,
        },
        {
          questionNumber: 2,
          exerciseId: 'q2',
          exerciseTitle: 'Câu 2',
          stepId: 'q2-written',
          stepTitle: 'Trình bày',
          problemPrompt: 'Đề câu 2',
          stepPrompt: 'Viết lời giải',
          rubricCriteria: [],
          studentDraft: '',
          hasDraft: false,
        },
      ],
    };

    const dualWholeExamPrompt = formatWholeExamWebMcpPrompt(overview, { webMcpAvailable: true });
    expect(dualWholeExamPrompt).toContain('hus_get_exam_paper_submissions');
    expect(dualWholeExamPrompt).toContain('KHÔNG thông báo thiếu quyền');
    expect(dualWholeExamPrompt).toContain('A = -5');
    expect(dualWholeExamPrompt).toContain('"items"');

    const registered = new Map<string, WebMcpToolDefinition>();
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('document', {
      modelContext: {
        registerTool: (tool: WebMcpToolDefinition) => {
          registered.set(tool.name, tool);
        },
      },
    });

    const received: TutorCoachingFeedback[] = [];
    const handle = registerEssayWebMcpTools({
      getExercise: () => adapted,
      getActiveStepId: () => step.id,
      getContextPacket: mode => ({ ...packet, mode }),
      searchCurriculum: async () => [],
      onReceiveFeedback: fb => received.push(fb),
      getExamPaperOverview: () => overview,
    });

    expect(registered.has('hus_get_exam_paper_submissions')).toBe(true);
    const overviewRes = await registered
      .get('hus_get_exam_paper_submissions')!
      .execute({ onlyDrafted: true });
    expect(overviewRes.isError).toBeUndefined();
    const parsedOverview = JSON.parse(overviewRes.content[0]!.text) as ExamPaperWebMcpOverview;
    expect(parsedOverview.steps).toHaveLength(1);
    expect(parsedOverview.steps[0]?.stepId).toBe(step.id);

    const ctxRes = await registered
      .get('hus_get_essay_context')!
      .execute({ mode: 'presentation-review', stepId: step.id });
    expect(ctxRes.isError).toBeUndefined();
    expect(ctxRes.content[0]?.text).toContain('"mode": "presentation-review"');

    const coachRes = await registered.get('hus_submit_essay_coaching')!.execute({
      stepId: step.id,
      summary: 'Kết quả A = -5 đúng nhưng cần ghi rõ điều kiện x ≠ 1, x ≠ 2 ở dòng đầu.',
      conventionWarnings: ['Thiếu điều kiện xác định của phân thức trước khi quy đồng.'],
      criterionFeedback: [
        {
          criterionId: `${standaloneMc.id}-rubric-conclusion`,
          status: 'met',
          comment: 'Kết luận rõ A = -5.',
        },
      ],
    });
    expect(coachRes.isError).toBeUndefined();
    expect(received).toHaveLength(1);
    expect(received[0]?.conventionWarnings[0]).toContain('Thiếu điều kiện');

    handle.dispose();
  });

  it('persists and validates exam-practice config and scoped sessions safely', () => {
    const map = new Map<string, string>();
    const memStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };

    expect(
      saveStoredExamPracticeConfig(
        {
          version: 1,
          courseId: 'sample-calc',
          chapterScope: 'all',
          answerMode: 'written-all',
          questionSource: 'all-db',
        },
        memStorage,
      ),
    ).toBe(true);
    expect(loadStoredExamPracticeConfig(memStorage)).toEqual({
      version: 1,
      courseId: 'sample-calc',
      chapterScope: 'all',
      answerMode: 'written-all',
      questionSource: 'all-db',
    });

    saveStoredExamPracticeSession(
      'sample-calc',
      'all',
      'all-db',
      'written-all',
      {
        version: 1,
        preset: 'short',
        seed: 2,
        submitted: false,
        draft: {
          objectiveAnswers: {},
          writtenResponses: { s1: 'Lời giải nháp' },
          checkedRubricIds: { s1: ['r1'] },
        },
      },
      memStorage,
    );
    expect(
      loadStoredExamPracticeSession('sample-calc', 'all', 'all-db', 'written-all', memStorage)?.draft
        .writtenResponses.s1,
    ).toBe('Lời giải nháp');

    clearStoredExamPracticeSession('sample-calc', 'all', 'all-db', 'written-all', memStorage);
    expect(
      loadStoredExamPracticeSession('sample-calc', 'all', 'all-db', 'written-all', memStorage),
    ).toBeNull();
  });

  it('embeds canon presentationCheckpoints without duplicating generic step prompts, tracks revision lifecycle, pins weak drills, and serves hus_get_lesson_context', async () => {
    const defaultCanon = resolveCourseConventionCanon({
      courseId: 'sample-calc',
      academicCode: 'CALC101',
      subjectId: 'mathematics',
      courseTitle: 'Giải tích mẫu',
    });
    expect(defaultCanon.presentationCheckpoints?.length).toBeGreaterThanOrEqual(3);

    const canon: CourseConventionCanon = {
      ...defaultCanon,
      presentationCheckpoints: [
        'ĐKXĐ & giả thiết định lý',
        'Biến đổi tương đương / suy ra (⇔, ⇒) rõ bước',
        'Kết luận giới hạn / nghiệm dạng rút gọn chuẩn',
      ],
    };

    const adapted = adaptClassicExerciseToSemiEssay(standaloneMc, { canon });
    const step = adapted.steps[0]!;
    expect(step.prompt).toBe(adapted.prompt);
    if (step.kind === 'written-reasoning') {
      expect(step.rubric[0]?.prompt).toContain('ĐKXĐ');
    }

    if (step.kind !== 'written-reasoning') throw new Error('Expected written step');
    expect(deriveStepCoachingState({ draftText: '  ', rubric: step.rubric }).state).toBe('unstarted');
    expect(deriveStepCoachingState({ draftText: 'A = -5', rubric: step.rubric }).state).toBe('drafted');

    const partialFeedback: TutorCoachingFeedback = {
      version: 1,
      exerciseId: adapted.id,
      stepId: step.id,
      source: 'webmcp',
      receivedAt: '2026-11-25T10:00:00Z',
      summary: 'Cần nêu điều kiện mẫu khác 0.',
      socraticQuestions: [],
      criterionFeedback: [
        { criterionId: step.rubric[0]!.id, status: 'partial', comment: 'Thiếu ĐKXĐ' },
        { criterionId: step.rubric[1]!.id, status: 'met', comment: 'Biến đổi tốt' },
        { criterionId: step.rubric[2]!.id, status: 'met', comment: 'Kết quả đúng' },
      ],
      conventionWarnings: ['Thiếu điều kiện x != 1, x != 2'],
      citedSections: [],
    };

    const syncedAfterPartial = syncCriteriaFromCoachingFeedback(
      step.rubric.map(r => r.id),
      partialFeedback,
    );
    expect(syncedAfterPartial).not.toContain(step.rubric[0]!.id);
    expect(syncedAfterPartial).toHaveLength(2);

    expect(
      deriveStepCoachingState({
        draftText: 'A = -5',
        rubric: step.rubric,
        feedback: partialFeedback,
        coachedDraftSnapshot: 'A = -5',
      }).state,
    ).toBe('needs-revision');

    expect(
      deriveStepCoachingState({
        draftText: 'ĐKXĐ: x != 1, x != 2. Suy ra A = -5.',
        rubric: step.rubric,
        feedback: partialFeedback,
        coachedDraftSnapshot: 'A = -5',
      }).state,
    ).toBe('revised-pending-recheck');

    const fullMetFeedback: TutorCoachingFeedback = {
      ...partialFeedback,
      criterionFeedback: step.rubric.map(r => ({
        criterionId: r.id,
        status: 'met' as const,
        comment: 'Đạt',
      })),
      conventionWarnings: [],
    };
    expect(
      deriveStepCoachingState({
        draftText: 'ĐKXĐ: x != 1, x != 2. Suy ra A = -5.',
        rubric: step.rubric,
        feedback: fullMetFeedback,
        coachedDraftSnapshot: 'ĐKXĐ: x != 1, x != 2. Suy ra A = -5.',
      }).state,
    ).toBe('verified');

    const pool: readonly ExerciseDefinition[] = [standaloneMc, statementMc, shortAns];
    const drillPaper = buildChapterExamPaper({
      exercises: pool,
      lessonOrder: ['sample-ch0-algebra', 'sample-bst-1', 'sample-vars'],
      preset: 'standard',
      answerMode: 'written-all',
      canon,
      pinnedExerciseIds: [shortAns.id],
    });
    expect(drillPaper.items).toHaveLength(1);
    expect(drillPaper.items[0]?.exercise.id).toBe(shortAns.id);

    const map = new Map<string, string>();
    const memStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    saveStoredChapterExamSession(
      'sample-calc',
      'sample-calc-ch-1',
      {
        version: 1,
        preset: 'short',
        answerMode: 'written-all',
        seed: 3,
        submitted: false,
        draft: { objectiveAnswers: {}, writtenResponses: {}, checkedRubricIds: {} },
      },
      memStorage,
    );
    expect(loadStoredChapterExamSession('sample-calc', 'sample-calc-ch-1', memStorage)?.answerMode).toBe(
      'written-all',
    );

    const lessonPkt: LessonWebMcpContextPacket = {
      schemaVersion: 1,
      generatedAt: '2026-11-25T10:00:00Z',
      course: {
        id: 'sample-calc',
        code: 'CALC101',
        title: 'Giải tích mẫu',
        practiceOnly: true,
        notationRules: canon.notationRules,
        forbiddenShortcutHints: canon.forbiddenShortcutHints,
      },
      syllabusHorizon: {
        currentChapter: 'Chương 0',
        currentLesson: 'Tách phân thức',
        allowedPrerequisites: [],
        unlearnedChaptersDoNotUse: ['Chương 2: Đạo hàm'],
      },
      focusedExercise: {
        id: standaloneMc.id,
        title: standaloneMc.title,
        kind: standaloneMc.kind,
        prompt: standaloneMc.prompt,
      },
      pedagogicalContract: ['Không vượt chương.'],
    };
    expect(formatLessonStudyWebMcpPrompt(lessonPkt, { webMcpAvailable: true })).toContain(
      'hus_get_lesson_context',
    );
    expect(formatLessonStudyWebMcpPrompt(lessonPkt, { webMcpAvailable: true })).toContain(
      'KHÔNG thông báo thiếu quyền',
    );
    expect(formatLessonStudyWebMcpPrompt(lessonPkt, { webMcpAvailable: true })).toContain(
      'Chương 2: Đạo hàm',
    );

    const adapted2 = adaptClassicExerciseToSemiEssay(statementMc, { canon });
    const step2 = adapted2.steps[0]!;
    if (step2.kind !== 'written-reasoning') throw new Error('Expected written step 2');

    const batchReply = [
      'Nhận xét toàn đề từ Ask Gemini:',
      '```json',
      JSON.stringify({
        version: 1,
        items: [
          {
            exerciseId: adapted.id,
            stepId: step.id,
            summary: 'Câu 1: Đã tìm đúng A = -5, cần bổ sung ĐKXĐ.',
            criterionFeedback: [
              { criterionId: step.rubric[0]!.id, status: 'partial', comment: 'Thiếu ĐKXĐ.' },
            ],
          },
          {
            exerciseId: adapted2.id,
            stepId: step2.id,
            summary: 'Câu 2: Giải thích rõ thứ tự thăm trái - gốc - phải.',
            socraticQuestions: ['Nếu cây có khóa trùng nhau thì dãy khóa tăng ngặt hay không giảm?'],
          },
        ],
      }),
      '```',
    ].join('\n');

    const batchParsed = parseBatchExternalTutorFeedback(batchReply, [
      { exercise: adapted, stepId: step.id },
      { exercise: adapted2, stepId: step2.id },
    ]);
    expect(batchParsed.ok).toBe(true);
    if (batchParsed.ok) {
      expect(batchParsed.items).toHaveLength(2);
      expect(batchParsed.items[0]?.stepId).toBe(step.id);
      expect(batchParsed.items[1]?.stepId).toBe(step2.id);
    }

    const registered = new Map<string, WebMcpToolDefinition>();
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('document', {
      modelContext: {
        registerTool: (tool: WebMcpToolDefinition) => {
          registered.set(tool.name, tool);
        },
      },
    });
    const handle = registerEssayWebMcpTools({
      getExercise: () => adapted,
      getActiveStepId: () => step.id,
      getContextPacket: () => null,
      searchCurriculum: async () => [],
      onReceiveFeedback: () => {},
      getLessonContextPacket: () => lessonPkt,
    });
    expect(registered.has('hus_get_lesson_context')).toBe(true);
    const lessonRes = await registered.get('hus_get_lesson_context')!.execute({});
    expect(lessonRes.isError).toBeUndefined();
    expect(lessonRes.content[0]?.text).toContain('Chương 2: Đạo hàm');
    handle.dispose();
  });

  it('enforces M1 Gemini grading (>= 7.0/10 and zero missing criteria), blocks hallucinated passes, and computes whole-paper /10 score', () => {
    const canon = resolveCourseConventionCanon({
      courseId: 'sample-calc',
      academicCode: 'CALC101',
      subjectId: 'mathematics',
      courseTitle: 'Giải tích mẫu',
    });
    const q1 = adaptClassicExerciseToSemiEssay(standaloneMc, { canon });
    const q2 = adaptClassicExerciseToSemiEssay(statementMc, { canon });
    const s1 = q1.steps[0]!;
    const s2 = q2.steps[0]!;
    if (s1.kind !== 'written-reasoning' || s2.kind !== 'written-reasoning') {
      throw new Error('Expected written steps');
    }

    const reviewPkt = buildGroundedEssayContextPacket({
      mode: 'presentation-review',
      canon,
      exercise: q1,
      step: s1,
      stepNumber: 1,
      draft: {
        ...emptyWrittenStepDraft(),
        response: 'ĐKXĐ x != 1, x != 2. Ta có \\lim{x->1}{(x-1)*\\{(2x+3)/((x-1)*(x-2))}} = -5 => A = -5.',
      },
      chunks: [],
      effectiveTheoryAnchors: [],
    });
    const reviewPrompt = formatAskGeminiPromptPacket(reviewPkt, { webMcpAvailable: true });
    expect(reviewPrompt).toContain('"verdict"');
    expect(reviewPrompt).toContain('"score"');
    expect(reviewPrompt).toContain('7.0');
    expect(reviewPrompt).toContain('\\lim_{x \\to 1}');
    expect(reviewPrompt).not.toContain('\\lim{x->1}');
    expect(reviewPrompt).not.toContain('\\{(2x+3)');

    const hintPkt = buildGroundedEssayContextPacket({
      mode: 'socratic-hint',
      canon,
      exercise: q1,
      step: s1,
      stepNumber: 1,
      draft: { ...emptyWrittenStepDraft(), response: '' },
      chunks: [],
      effectiveTheoryAnchors: [],
    });
    expect(formatAskGeminiPromptPacket(hintPkt, { webMcpAvailable: true })).not.toContain(
      '"verdict":',
    );

    const m1PassRes = parseExternalTutorFeedback(
      JSON.stringify({
        exerciseId: q1.id,
        stepId: s1.id,
        verdict: 'pass',
        score: 8.0,
        maxScore: 10,
        summary: 'Hướng giải và đáp số A = -5 chính xác, chỉ thiếu 1 dấu suy ra nhỏ.',
        criterionFeedback: [
          { criterionId: s1.rubric[0]!.id, status: 'met', comment: 'Đủ ĐKXĐ.' },
          { criterionId: s1.rubric[1]!.id, status: 'partial', comment: 'Thiếu dấu suy ra.' },
          { criterionId: s1.rubric[2]!.id, status: 'met', comment: 'Kết quả A = -5 đúng.' },
        ],
      }),
      q1,
      s1.id,
      'clipboard',
    );
    expect(m1PassRes.ok).toBe(true);
    if (!m1PassRes.ok) throw new Error(m1PassRes.error);
    expect(m1PassRes.value.verdict).toBe('pass');
    expect(m1PassRes.value.score).toBe(8);
    expect(m1PassRes.value.maxScore).toBe(10);
    expect(
      deriveStepCoachingState({
        draftText: 'ĐKXĐ x != 1, 2 => A = -5',
        rubric: s1.rubric,
        feedback: m1PassRes.value,
        coachedDraftSnapshot: 'ĐKXĐ x != 1, 2 => A = -5',
      }).state,
    ).toBe('verified');

    const fakePassRes = parseExternalTutorFeedback(
      JSON.stringify({
        exerciseId: q2.id,
        stepId: s2.id,
        verdict: 'pass',
        score: 8.5,
        maxScore: 10,
        summary: 'Chưa giải thích vì sao trung thứ tự tăng dần.',
        criterionFeedback: [
          { criterionId: s2.rubric[0]!.id, status: 'met', comment: 'Nêu định nghĩa BST.' },
          { criterionId: s2.rubric[1]!.id, status: 'missing', comment: 'Bỏ trống phần lập luận.' },
          { criterionId: s2.rubric[2]!.id, status: 'partial', comment: 'Chọn đúng (A).' },
        ],
      }),
      q2,
      s2.id,
      'clipboard',
    );
    expect(fakePassRes.ok).toBe(true);
    if (!fakePassRes.ok) throw new Error(fakePassRes.error);
    expect(fakePassRes.value.verdict).toBe('not-pass');
    expect(fakePassRes.value.score).toBeLessThan(7);

    const paper = buildChapterExamPaper({
      exercises: [standaloneMc, statementMc],
      lessonOrder: ['sample-ch0-algebra', 'sample-bst-1'],
      preset: 'short',
      answerMode: 'written-all',
      canon,
    });
    const evaluated = evaluateChapterExam(
      paper,
      {
        objectiveAnswers: {},
        writtenResponses: {
          [s1.id]: 'ĐKXĐ x != 1, 2 => A = -5',
          [s2.id]: 'Chọn A',
        },
        checkedRubricIds: {},
      },
      ['sample-ch0-algebra', 'sample-bst-1'],
      {
        [s1.id]: m1PassRes.value,
        [s2.id]: fakePassRes.value,
      },
    );
    expect(evaluated.writtenSelfReviewed).toBe(1);
    expect(evaluated.gradedWrittenCount).toBe(2);
    expect(evaluated.paperScoreOn10).toBe(
      Math.round(((m1PassRes.value.score! + fakePassRes.value.score!) / 2) * 100) / 100,
    );
    expect(evaluated.lessonsToReview).toEqual(['sample-bst-1']);
  });
});
