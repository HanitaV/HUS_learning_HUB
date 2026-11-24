import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCourseConventionCanon } from '../../src/content/curriculum-canons';
import {
  buildCurriculumHorizon,
  buildGroundedEssayContextPacket,
  buildNotebookLmCourseBundle,
  composeExamReadyEssay,
  formatAskGeminiPromptPacket,
  indexLessonMarkdownChunks,
  searchCurriculumChunks,
  synthesizeFallbackTheoryAnchors,
  tokenizeAcademicText,
} from '../../src/core/learning/curriculum-rag';
import { emptyWrittenStepDraft } from '../../src/core/learning/semi-essay';
import type { TutorCoachingFeedback } from '../../src/domain/curriculum-tutor';
import type { Course } from '../../src/domain/learning';
import type { SemiEssayExercise, WrittenReasoningStep } from '../../src/domain/semi-essay';
import type { LearningContent } from '../../src/domain/workspace';
import { parseExternalTutorFeedback } from '../../src/infrastructure/ai/tutor-feedback-parser';
import {
  describeInactiveWebMcpReason,
  registerEssayWebMcpTools,
  type WebMcpToolDefinition,
} from '../../src/infrastructure/ai/webmcp-essay-bridge';

const sampleCourse: Course = {
  schemaVersion: 1,
  id: 'sample-calc',
  academicCode: 'CALC101',
  subjectId: 'mathematics',
  title: 'Giải tích mẫu',
  language: 'vi',
  status: 'available',
  chapterIds: ['ch-0', 'ch-1', 'ch-2'],
  resourceIds: [],
  provenance: {
    repository: 'local:template',
    revision: 'template',
    path: 'sample',
    rights: 'approved',
  },
};

const sampleContent: LearningContent = {
  chapters: [
    { id: 'ch-0', courseId: 'sample-calc', title: 'Chương 0. Công thức cần thuộc', topicIds: ['t-0'] },
    { id: 'ch-1', courseId: 'sample-calc', title: 'Chương 1. Giới hạn và liên tục', topicIds: ['t-1'] },
    { id: 'ch-2', courseId: 'sample-calc', title: 'Chương 2. Đạo hàm', topicIds: ['t-2'] },
  ],
  topics: [
    { id: 't-0', chapterId: 'ch-0', title: 'Kiến thức nền', lessonIds: ['l-0'] },
    { id: 't-1', chapterId: 'ch-1', title: 'Cận trên đúng', lessonIds: ['l-1'], prerequisiteIds: ['t-0'] },
    { id: 't-2', chapterId: 'ch-2', title: 'Định lý giá trị trung bình', lessonIds: ['l-2'], prerequisiteIds: ['t-1'] },
  ],
  lessons: [
    {
      id: 'l-0',
      topicId: 't-0',
      title: 'Tập số thực',
      summary: 'Ôn tập tập số',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-0.md' },
      exerciseIds: [],
      resourceIds: [],
    },
    {
      id: 'l-1',
      topicId: 't-1',
      title: 'Cận trên đúng và cận dưới đúng',
      summary: 'Định nghĩa sup và inf',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-1.md' },
      exerciseIds: ['sample-written-1'],
      resourceIds: [],
    },
    {
      id: 'l-2',
      topicId: 't-2',
      title: 'Định lý Lagrange và L’Hôpital',
      summary: 'Ứng dụng đạo hàm',
      content: { format: 'markdown', assetPath: 'sample/lessons/l-2.md' },
      exerciseIds: [],
      resourceIds: [],
    },
  ],
  exercises: [],
  resources: [],
};

const ch1Markdown = [
  '# Cận trên đúng và cận dưới đúng',
  '',
  '## 1. Định nghĩa cận trên đúng (sup)',
  'Số $M$ là cận trên đúng của tập $A$ nếu với mọi $x \\in A$ ta có $x \\le M$ và với mọi $\\varepsilon > 0$ tồn tại $x \\in A$ sao cho $x > M - \\varepsilon$.',
  '',
  '## 2. Tính chất dãy đơn điệu',
  'Xét $a_n = 1 - \\frac{1}{n+1}$ với $n \\in \\mathbb{N}^*$: dãy tăng ngặt và đạt giá trị nhỏ nhất tại $n = 1$.',
].join('\n');

const ch2Markdown = [
  '# Định lý Lagrange và L’Hôpital',
  '',
  '## Quy tắc L’Hôpital',
  'Khi hàm khả vi trên khoảng mở $(a, b)$, định lý Lagrange và quy tắc L’Hôpital dùng đạo hàm để tính giới hạn.',
].join('\n');

const sampleWrittenStep: WrittenReasoningStep = {
  id: 'step-1',
  kind: 'written-reasoning',
  title: 'Chứng minh sup và min của tập A',
  prompt: 'Tìm và chứng minh $\\sup A$ và $\\min A$ với $A = \\{n/(n+1) : n \\in \\mathbb{N}^*\\}$.',
  theoryAnchorIds: [],
  modelAnswer: 'Ta có $\\frac{n}{n+1} = 1 - \\frac{1}{n+1} < 1$, nên $\\sup A = 1$ và $\\min A = 1/2$ đạt tại $n = 1$.',
  rubric: [
    { id: 'monotone', prompt: 'Biến đổi và chỉ ra tính tăng ngặt' },
    { id: 'attained', prompt: 'Kiểm tra giá trị nhỏ nhất đạt tại n = 1' },
  ],
  summaryTemplate: 'Đã chứng minh sup A = 1 và min A = 1/2.',
};

const sampleExercise: SemiEssayExercise = {
  id: 'sample-written-1',
  lessonId: 'l-1',
  kind: 'semi-essay',
  title: 'Chứng minh sup và min của tập A',
  prompt: 'Bài tự luận mẫu về cận trên đúng.',
  given: [],
  theoryAnchors: [],
  steps: [sampleWrittenStep],
  explanation: 'Lời giải tổng kết.',
};

describe('Curriculum Graph-RAG, Horizon Guard & WebMCP Essay Bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tokenizes Vietnamese terms accent-insensitively while preserving LaTeX and code symbols', () => {
    const tokens = tokenizeAcademicText(
      'Chứng minh \\sup A và \\inf A trên tập N* với độ phức tạp O(n) và ΔG',
    );
    expect(tokens).toContain('\\sup');
    expect(tokens).toContain('\\inf');
    expect(tokens).toContain('n*');
    expect(tokens).toContain('o(n)');
    expect(tokens).toContain('δg');
    expect(tokens).toContain('chung');
    expect(tokens).toContain('minh');
  });

  it('enforces topological syllabus horizon and synthesizes TheoryAnchors for written-practice', () => {
    const horizon = buildCurriculumHorizon(sampleCourse, sampleContent, 'l-1');
    expect(horizon).toBeDefined();
    expect(horizon!.currentChapterTitle).toContain('Chương 1. Giới hạn và liên tục');
    expect(horizon!.earlierChapterTitles).toEqual(['Chương 0. Công thức cần thuộc']);
    expect(horizon!.unlearnedChapterTitles).toContain('Chương 2. Đạo hàm');

    const chunks = indexLessonMarkdownChunks({
      course: sampleCourse,
      content: sampleContent,
      targetLessonId: 'l-1',
      markdownByLessonId: {
        'l-1': ch1Markdown,
        'l-2': ch2Markdown,
      },
    });

    const guardedHits = searchCurriculumChunks(chunks, 'định lý Lagrange L’Hôpital đạo hàm', {
      limit: 5,
      allowFutureChapters: false,
    });
    expect(guardedHits.every(h => h.chunk.lessonId !== 'l-2')).toBe(true);

    const synthesized = synthesizeFallbackTheoryAnchors(chunks, sampleExercise, 0);
    expect(synthesized.anchors.length).toBeGreaterThan(0);
    expect(synthesized.activeAnchorIds.length).toBeGreaterThan(0);
  });

  it('protects unrevealed modelAnswer in Socratic context packet and formats NotebookLM bundle', () => {
    const canon = resolveCourseConventionCanon({
      courseId: sampleCourse.id,
      academicCode: sampleCourse.academicCode,
      subjectId: sampleCourse.subjectId,
      courseTitle: sampleCourse.title,
    });
    const chunks = indexLessonMarkdownChunks({
      course: sampleCourse,
      content: sampleContent,
      targetLessonId: 'l-1',
      markdownByLessonId: { 'l-1': ch1Markdown },
    });

    const unrevealedDraft = { ...emptyWrittenStepDraft(), response: 'Ta có n/(n+1) < 1.' };
    const socraticPacket = buildGroundedEssayContextPacket({
      mode: 'socratic-hint',
      canon,
      horizon: buildCurriculumHorizon(sampleCourse, sampleContent, 'l-1'),
      exercise: sampleExercise,
      step: sampleWrittenStep,
      stepNumber: 1,
      draft: unrevealedDraft,
      chunks,
      effectiveTheoryAnchors: [],
    });

    expect(socraticPacket.activeStep.referenceModelAnswer).toBeUndefined();
    const askPrompt = formatAskGeminiPromptPacket(socraticPacket, { webMcpAvailable: false });
    expect(askPrompt).toContain('CALC101');
    expect(askPrompt).not.toContain(sampleWrittenStep.modelAnswer);

    const revealedPacket = buildGroundedEssayContextPacket({
      mode: 'rubric-review',
      canon,
      exercise: sampleExercise,
      step: sampleWrittenStep,
      stepNumber: 1,
      draft: { ...unrevealedDraft, modelRevealed: true },
      chunks,
      effectiveTheoryAnchors: [],
    });
    expect(revealedPacket.activeStep.referenceModelAnswer).toBe(sampleWrittenStep.modelAnswer);

    const bundle = buildNotebookLmCourseBundle({
      course: sampleCourse,
      subjectTitle: 'Toán học',
      canon,
      content: sampleContent,
      markdownByLessonId: { 'l-1': ch1Markdown },
    });
    expect(bundle.filename).toBe('calc101-giaotrinh-notebooklm.md');
    expect(bundle.lessonCount).toBe(1);
    expect(bundle.markdown).toContain('Google NotebookLM');

    const composed = composeExamReadyEssay(
      sampleExercise,
      {
        [sampleWrittenStep.id]: {
          ...unrevealedDraft,
          modelRevealed: true,
          revision: 'Ta có $1 - \\frac{1}{n+1}$ tăng ngặt và đạt min bằng $1/2$ tại $n=1$.',
          reviewedCriterionIds: sampleWrittenStep.rubric.map(r => r.id),
          selfReviewed: true,
        },
      },
      new Set([sampleWrittenStep.id]),
    );
    expect(composed).toContain('Bài trình bày tự luận');
    expect(composed).toContain('đạt min bằng $1/2$');
  });

  it('strictly validates external Gemini JSON payloads and drops unknown rubric criterion IDs', () => {
    const conversationalReply = [
      'Bài nháp của bạn đi đúng hướng!',
      '```json',
      JSON.stringify({
        version: 1,
        exerciseId: sampleExercise.id,
        stepId: sampleWrittenStep.id,
        summary: 'Đã tách đúng $1 - \\frac{1}{n+1}$, cần nêu rõ $n \\in \\mathbb{N}^*$.',
        socraticQuestions: ['Tập $\\mathbb{N}^*$ bắt đầu từ giá trị nguyên nào?'],
        criterionFeedback: [
          { criterionId: 'monotone', status: 'met', comment: 'Đã giải thích tính tăng.' },
          { criterionId: 'hallucinated-id', status: 'met', comment: 'Tiêu chí ảo bịa thêm.' },
          { criterionId: 'attained', status: 'missing', comment: 'Chưa thay $n = 1$.' },
        ],
        conventionWarnings: ['Lưu ý tập chỉ số.'],
        citedSections: ['[CALC101 · Cận trên đúng và cận dưới đúng]'],
      }),
      '```',
    ].join('\n');

    const okRes = parseExternalTutorFeedback(
      conversationalReply,
      sampleExercise,
      sampleWrittenStep.id,
      'clipboard',
    );
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.value.criterionFeedback).toHaveLength(2);
      expect(okRes.value.criterionFeedback.map(c => c.criterionId)).toEqual([
        'monotone',
        'attained',
      ]);
      expect(okRes.value.socraticQuestions).toHaveLength(1);
    }

    const wrongExercise = parseExternalTutorFeedback(
      JSON.stringify({ exerciseId: 'other-ex', stepId: sampleWrittenStep.id, summary: 'Sai bài' }),
      sampleExercise,
      sampleWrittenStep.id,
      'clipboard',
    );
    expect(wrongExercise.ok).toBe(false);
  });

  it('registers, executes and cleans up WebMCP tools via document.modelContext', async () => {
    const canon = resolveCourseConventionCanon({
      courseId: sampleCourse.id,
      academicCode: sampleCourse.academicCode,
      subjectId: sampleCourse.subjectId,
      courseTitle: sampleCourse.title,
    });

    const registeredTools = new Map<string, WebMcpToolDefinition>();
    const signals: AbortSignal[] = [];

    const mockDoc = {
      modelContext: {
        registerTool: (tool: WebMcpToolDefinition, opts?: { signal?: AbortSignal }) => {
          registeredTools.set(tool.name, tool);
          if (opts?.signal) {
            signals.push(opts.signal);
            opts.signal.addEventListener('abort', () => {
              registeredTools.delete(tool.name);
            });
          }
        },
      },
    };

    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('document', mockDoc);

    let receivedFeedback: TutorCoachingFeedback | null = null;

    const reg = registerEssayWebMcpTools({
      getExercise: () => sampleExercise,
      getActiveStepId: () => sampleWrittenStep.id,
      getContextPacket: mode =>
        buildGroundedEssayContextPacket({
          mode,
          canon,
          exercise: sampleExercise,
          step: sampleWrittenStep,
          stepNumber: 1,
          draft: { ...emptyWrittenStepDraft(), response: 'Nháp thử WebMCP' },
          chunks: [],
          effectiveTheoryAnchors: [],
        }),
      searchCurriculum: async () => [],
      onReceiveFeedback: fb => {
        receivedFeedback = fb;
      },
    });

    expect(reg.support).toMatchObject({ available: true, host: 'document' });
    expect(
      describeInactiveWebMcpReason({
        available: false,
        host: 'none',
        hasOriginTrialToken: true,
        isTrialOriginMatch: false,
        detectedChromeMajor: 158,
      }),
    ).toContain('your-domain.example');
    expect(
      describeInactiveWebMcpReason({
        available: false,
        host: 'none',
        hasOriginTrialToken: true,
        isTrialOriginMatch: true,
        detectedChromeMajor: 163,
      }),
    ).toContain('Chrome 162');
    expect([...registeredTools.keys()]).toEqual([
      'hus_get_essay_context',
      'hus_search_curriculum',
      'hus_submit_essay_coaching',
    ]);

    const contextRes = await registeredTools.get('hus_get_essay_context')!.execute({
      mode: 'socratic-hint',
    });
    expect(contextRes.isError).toBeUndefined();
    expect(contextRes.content[0]?.text).toContain('Nháp thử WebMCP');

    const submitRes = await registeredTools.get('hus_submit_essay_coaching')!.execute({
      stepId: sampleWrittenStep.id,
      summary: 'Nhận xét truyền trực tiếp qua WebMCP thành công!',
      socraticQuestions: ['Hãy kiểm tra giá trị tại $n = 1$?'],
      criterionFeedback: [
        { criterionId: 'monotone', status: 'partial', comment: 'Cần giải thích rõ hơn.' },
      ],
    });
    expect(submitRes.isError).toBeUndefined();
    expect(receivedFeedback).not.toBeNull();
    expect(receivedFeedback!.source).toBe('webmcp');
    expect(receivedFeedback!.summary).toContain('WebMCP thành công');

    reg.dispose();
    expect(signals.every(s => s.aborted)).toBe(true);
    expect(registeredTools.size).toBe(0);
  });
});
