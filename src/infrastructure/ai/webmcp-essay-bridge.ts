import type {
  CodeLabCoachingFeedback,
  CodeLabWebMcpContextPacket,
  CodeLanguage,
} from '../../domain/code-lab';
import type {
  CoachingPromptMode,
  CurriculumSearchHit,
  GroundedEssayContextPacket,
  LessonWebMcpContextPacket,
  TutorCoachingFeedback,
} from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import type { SemiEssayExercise } from '../../domain/semi-essay';
import type { StudyDiagnosticsReport } from '../../core/learning/study-diagnostics';
import { parseExternalCodeLabFeedback } from '../../core/code-lab/webmcp-coach';
import { convertStudentShorthandToLatex } from '../../core/learning/realtime-math-preview';
import { parseExternalTutorFeedback } from './tutor-feedback-parser';

export interface WebMcpToolResponse {
  readonly content: readonly { readonly type: 'text'; readonly text: string }[];
  readonly isError?: boolean | undefined;
}

export interface WebMcpToolDefinition {
  readonly name: string;
  readonly title?: string | undefined;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly annotations?: {
    readonly readOnlyHint?: boolean | undefined;
    readonly idempotentHint?: boolean | undefined;
  } | undefined;
  readonly execute: (args: unknown) => Promise<WebMcpToolResponse> | WebMcpToolResponse;
}

export interface WebMcpModelContextPort {
  registerTool: (
    tool: WebMcpToolDefinition,
    options?: { readonly signal?: AbortSignal | undefined },
  ) => void | Promise<void>;
  unregisterTool?: ((name: string) => void | Promise<void>) | undefined;
  addEventListener?: ((type: string, listener: EventListener) => void) | undefined;
  removeEventListener?: ((type: string, listener: EventListener) => void) | undefined;
}

export const WEBMCP_ORIGIN_TRIAL_INFO = {
  origin: 'https://your-domain.example',
  origins: ['https://your-domain.example'],
  hostname: 'your-domain.example',
  hostnames: ['your-domain.example'],
  maxChromeMilestone: 162,
  expiryDateIso: '2027-03-30',
  expiryDisplayVi: '30/03/2027',
  availabilitySummaryVi:
    'Hỗ trợ đến Chrome 162 (kết thúc khi phát hành bản Chrome kế tiếp, muộn nhất ngày 30/03/2027)',
} as const;

export interface WebMcpSupportInfo {
  readonly available: boolean;
  readonly host: 'document' | 'navigator' | 'none';
  readonly hasOriginTrialToken: boolean;
  readonly isTrialOriginMatch: boolean;
  readonly detectedChromeMajor: number | null;
}

function detectChromeMajorVersion(): number | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent ?? '';
  const match = /\bChrom(?:e|ium)\/(\d+)\./.exec(ua);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function inspectOriginTrialEnvironment(): {
  readonly hasOriginTrialToken: boolean;
  readonly isTrialOriginMatch: boolean;
  readonly detectedChromeMajor: number | null;
} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      hasOriginTrialToken: false,
      isTrialOriginMatch: false,
      detectedChromeMajor: null,
    };
  }
  const hasOriginTrialToken =
    typeof document.querySelector === 'function'
      ? document.querySelector('meta[http-equiv="origin-trial"][content]') !== null
      : false;
  const host = window.location?.hostname ?? '';
  const isTrialOriginMatch = WEBMCP_ORIGIN_TRIAL_INFO.hostnames.some(
    (trialHost) => host === trialHost || host.endsWith(`.${trialHost}`),
  );
  return {
    hasOriginTrialToken,
    isTrialOriginMatch,
    detectedChromeMajor: detectChromeMajorVersion(),
  };
}

export function describeInactiveWebMcpReason(support: WebMcpSupportInfo): string {
  if (support.available) {
    return 'WebMCP đã hoạt động sẵn sàng trên trình duyệt này.';
  }
  if (!support.isTrialOriginMatch) {
    return `Trang hiện mở ngoài tên miền đăng ký Origin Trial (${WEBMCP_ORIGIN_TRIAL_INFO.hostnames.join(', ')}), nên WebMCP không tự bật mặc định và cần kích hoạt cờ thủ công.`;
  }
  if (
    support.detectedChromeMajor !== null &&
    support.detectedChromeMajor > WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone
  ) {
    return `Trình duyệt đang ở Chrome ${support.detectedChromeMajor} (vượt phạm vi Origin Trial tối đa Chrome ${WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}, hạn ${WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}), nên cần bật cờ WebMCP thủ công nếu tính năng chưa bật mặc định.`;
  }
  return `Dù trang đã tích hợp Origin Trial (đến Chrome ${WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}, muộn nhất ${WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}), WebMCP hiện không tự hoạt động mặc định trên trình duyệt này — cần bật cờ thủ công bên dưới.`;
}

function getBrowserModelContext(): {
  readonly port: WebMcpModelContextPort | null;
  readonly info: WebMcpSupportInfo;
} {
  const trialEnv = inspectOriginTrialEnvironment();
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.isSecureContext) {
    return { port: null, info: { available: false, host: 'none', ...trialEnv } };
  }

  const docCandidate = (document as Document & { modelContext?: unknown }).modelContext;
  if (
    typeof docCandidate === 'object' &&
    docCandidate !== null &&
    typeof (docCandidate as WebMcpModelContextPort).registerTool === 'function'
  ) {
    return {
      port: docCandidate as WebMcpModelContextPort,
      info: { available: true, host: 'document', ...trialEnv },
    };
  }

  const navCandidate = (navigator as Navigator & { modelContext?: unknown }).modelContext;
  if (
    typeof navCandidate === 'object' &&
    navCandidate !== null &&
    typeof (navCandidate as WebMcpModelContextPort).registerTool === 'function'
  ) {
    return {
      port: navCandidate as WebMcpModelContextPort,
      info: { available: true, host: 'navigator', ...trialEnv },
    };
  }

  return { port: null, info: { available: false, host: 'none', ...trialEnv } };
}

export function detectWebMcpSupport(): WebMcpSupportInfo {
  return getBrowserModelContext().info;
}

export function formatWholeExamWebMcpPrompt(
  overview: ExamPaperWebMcpOverview,
  options?: { readonly webMcpAvailable?: boolean | undefined },
): string {
  const draftedSteps = overview.steps.filter(s => s.hasDraft);
  const targetSteps = draftedSteps.length > 0 ? draftedSteps : overview.steps;

  const dualPathHeader = options?.webMcpAvailable
    ? [
        '## 0. Chế độ kết nối tự thích ứng (WebMCP / ✨ Ask Gemini trên Chrome)',
        `- **Nếu môi trường của bạn gọi được công cụ WebMCP:** Hãy gọi \`hus_get_exam_paper_submissions\` với \`{ "onlyDrafted": true }\` (kèm \`hus_search_curriculum\` khi cần) rồi ưu tiên gọi **1 lần duy nhất** công cụ \`hus_submit_exam_batch_coaching\` với \`{ "items": [...] }\` để đẩy toàn bộ điểm và nhận xét lên các tờ giấy A4 (hoặc gọi \`hus_submit_essay_coaching\` cho từng \`stepId\` nếu cần).`,
        '- **Nếu bạn đang chạy trên thanh bên ✨ Ask Gemini tiêu chuẩn (không có quyền gọi công cụ WebMCP):** **TUYỆT ĐỐI KHÔNG nhắc đến WebMCP và KHÔNG thông báo thiếu quyền gọi công cụ.** Hãy chấm cách trình bày trực tiếp cho toàn bộ các câu đã đính kèm bên dưới và **xuất đúng 1 khối ```json ... ``` tổng hợp ở cuối câu trả lời** để sinh viên đồng bộ 1-click về toàn bộ đề thi.',
        '',
      ]
    : [];

  const blocks = targetSteps.map(step => {
    const criteria = step.rubricCriteria.map(c => `  - \`${c.id}\`: ${c.prompt}`).join('\n');
    const latexDraft = convertStudentShorthandToLatex(step.studentDraft);
    return [
      `### Câu ${step.questionNumber} (\`exerciseId: "${step.exerciseId}"\`, \`stepId: "${step.stepId}"\`) — ${step.exerciseTitle}`,
      `- **Đề bài:** ${step.problemPrompt}`,
      ...(step.visualContextSummary && step.visualContextSummary.length > 0
        ? [
            '- **Dữ kiện hình vẽ / đồ thị đi kèm:**',
            ...step.visualContextSummary.map(line => `  - ${line}`),
          ]
        : []),
      ...(step.studentInteractiveWorkSummary && step.studentInteractiveWorkSummary.length > 0
        ? [
            '- **Bài làm tương tác ở các bước trước (dùng để kiểm tra chéo):**',
            ...step.studentInteractiveWorkSummary.map(line => `  - ${line}`),
          ]
        : []),
      `- **Tiêu chí trình bày & rubric:**\n${criteria}`,
      `- **Bài trình bày trên giấy A4 của sinh viên (đã biên dịch sang chuẩn LaTeX):**`,
      '```markdown',
      latexDraft.trim() || '(Chưa viết bài làm)',
      '```',
      ...(step.referenceModelAnswer
        ? [`- **Đáp án chuẩn đối chiếu:**\n${step.referenceModelAnswer}`]
        : []),
    ].join('\n');
  });

  const sampleBatchJson = JSON.stringify(
    {
      version: 1,
      items: targetSteps.map(step => ({
        exerciseId: step.exerciseId,
        stepId: step.stepId,
        verdict: 'pass',
        score: 8.5,
        maxScore: 10,
        summary: `Nhận xét tổng quan cách trình bày Câu ${step.questionNumber}.`,
        socraticQuestions: ['Câu hỏi gợi mở (không lộ đáp án cuối)?'],
        criterionFeedback: step.rubricCriteria.map(c => ({
          criterionId: c.id,
          status: 'partial',
          comment: 'Nhận xét cụ thể cho tiêu chí này.',
        })),
        conventionWarnings: [],
      })),
    },
    null,
    2,
  );

  return [
    `# Yêu cầu Kiểm tra Cách trình bày & Chấm điểm Đề tự luận ĐHKHTN (${overview.courseCode} — ${overview.courseTitle})`,
    '',
    ...dualPathHeader,
    `- **Phạm vi đề:** ${overview.scopeLabel}`,
    '- **Quy tắc chấm máy thang 10 chuẩn ĐHKHTN (Mức 1):** Tự giải kiểm chứng từng câu; chấm `score` trên thang `maxScore: 10` (bậc `0.25` hoặc `0.5`). Đặt `"verdict": "pass"` khi kết quả đúng, đạt `score >= 7.0` trên `10` và không có tiêu chí nào bị `"missing"`; ngược lại đặt `"not-pass"`.',
    '- **Nguyên tắc chống lộ đáp án:** Không chép sẵn trọn vẹn lời giải hay đáp số cuối cùng; với câu xét nhiều mệnh đề `(A)..(D)`, TUYỆT ĐỐI KHÔNG xác nhận đúng/sai cho từng mệnh đề riêng lẻ khi sinh viên chưa viết biến đổi chứng minh.',
    ...overview.notationRules.map(r => `- **Quy ước ký hiệu:** ${r}`),
    ...overview.forbiddenShortcutHints.map(r => `- **Lưu ý tránh giải tắt / vượt chương:** ${r}`),
    '',
    'Hãy kiểm tra chi tiết **cách trình bày lời giải & kết quả** cho từng câu dưới đây (bố cục dẫn dắt bước giải, điều kiện áp dụng, ký hiệu/đơn vị chuẩn ĐHKHTN và câu kết luận cuối):',
    '',
    blocks.join('\n\n---\n\n'),
    '',
    '## Định dạng JSON đồng bộ 1-click toàn đề',
    'Ở cuối câu trả lời, hãy kèm **đúng 1 khối JSON hợp lệ** chứa mảng `items` cho tất cả các câu trên (nhân đôi `\\\\` cho lệnh LaTeX trong chuỗi JSON):',
    '```json',
    sampleBatchJson,
    '```',
  ].join('\n');
}

export interface ExamPaperSubmissionStepOverview {
  readonly questionNumber: number;
  readonly exerciseId: EntityId;
  readonly exerciseTitle: string;
  readonly stepId: EntityId;
  readonly stepTitle: string;
  readonly problemPrompt: string;
  readonly stepPrompt: string;
  readonly rubricCriteria: readonly { readonly id: string; readonly prompt: string }[];
  readonly studentDraft: string;
  readonly hasDraft: boolean;
  readonly visualContextSummary?: readonly string[] | undefined;
  readonly studentInteractiveWorkSummary?: readonly string[] | undefined;
  readonly referenceModelAnswer?: string | undefined;
}

export interface ExamPaperWebMcpOverview {
  readonly courseId: EntityId;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly scopeLabel: string;
  readonly notationRules: readonly string[];
  readonly forbiddenShortcutHints: readonly string[];
  readonly submitted: boolean;
  readonly totalQuestions: number;
  readonly draftedStepCount: number;
  readonly steps: readonly ExamPaperSubmissionStepOverview[];
}

export function formatLessonStudyWebMcpPrompt(
  packet: LessonWebMcpContextPacket,
  options?: { readonly webMcpAvailable?: boolean | undefined },
): string {
  const dualPathHeader = options?.webMcpAvailable
    ? [
        '## Chế độ kết nối tự thích ứng (WebMCP / ✨ Ask Gemini trên Chrome)',
        '- **Nếu môi trường của bạn gọi được công cụ WebMCP:** Hãy gọi `hus_get_lesson_context` (và `hus_search_curriculum` khi cần) để đọc ngữ cảnh trực tiếp trên trang.',
        '- **Nếu đang chạy trên thanh bên ✨ Ask Gemini tiêu chuẩn (không có quyền gọi công cụ WebMCP):** **TUYỆT ĐỐI KHÔNG nhắc đến WebMCP và KHÔNG thông báo thiếu quyền gọi công cụ.** Hãy dùng ngay ngữ cảnh bài học đính kèm bên dưới để hướng dẫn Socratic.',
        '',
      ]
    : [];

  return [
    `# Yêu cầu Trợ giảng Bài học ĐHKHTN (${packet.course.code} — ${packet.course.title})`,
    '',
    ...dualPathHeader,
    `- **Bài học đang mở:** ${packet.syllabusHorizon.currentLesson} (${packet.syllabusHorizon.currentChapter})`,
    ...(packet.syllabusHorizon.unlearnedChaptersDoNotUse.length > 0
      ? [
          `- **Chặn vượt chương (tuyệt đối không dùng):** ${packet.syllabusHorizon.unlearnedChaptersDoNotUse.join('; ')}`,
        ]
      : []),
    ...packet.course.notationRules.map(r => `- **Quy ước ký hiệu:** ${r}`),
    ...(packet.activeLessonSection
      ? [
          `\n## Mục lý thuyết đang xem: ${packet.activeLessonSection.sectionTitle}`,
          packet.activeLessonSection.excerptMarkdown,
        ]
      : []),
    ...(packet.focusedExercise
      ? [
          `\n## Bài tập đang làm: ${packet.focusedExercise.title}`,
          packet.focusedExercise.prompt,
          ...(packet.focusedExercise.studentAttemptSummary
            ? [`- **Trạng thái làm bài:** ${packet.focusedExercise.studentAttemptSummary}`]
            : []),
        ]
      : []),
    '\nHãy hướng dẫn Socratic bám sát nội dung bài học trên, đúng ký hiệu ĐHKHTN, tuyệt đối không xác nhận lộ từng phương án đúng/sai và không tiết lộ thẳng đáp án cuối cùng nếu sinh viên đang tự làm.',
  ].join('\n');
}

export interface EssayWebMcpBindings {
  readonly getExercise: (stepId?: EntityId) => SemiEssayExercise;
  readonly getActiveStepId: () => EntityId;
  readonly getContextPacket: (
    mode: CoachingPromptMode,
    stepId?: EntityId,
  ) => GroundedEssayContextPacket | null;
  readonly searchCurriculum: (
    query: string,
    includeAllCourseLessons: boolean,
  ) => Promise<readonly CurriculumSearchHit[]>;
  readonly onReceiveFeedback: (feedback: TutorCoachingFeedback) => void;
  readonly onReceiveBatchFeedback?: ((items: readonly TutorCoachingFeedback[]) => void) | undefined;
  readonly getExamPaperOverview?: (() => ExamPaperWebMcpOverview | null) | undefined;
  readonly getLessonContextPacket?: (() => LessonWebMcpContextPacket | null) | undefined;
}

export const REGISTERED_ESSAY_TOOL_NAMES = [
  'hus_get_essay_context',
  'hus_search_curriculum',
  'hus_submit_essay_coaching',
  'hus_get_exam_paper_submissions',
  'hus_submit_exam_batch_coaching',
  'hus_get_lesson_context',
] as const;

export const REGISTERED_CODELAB_TOOL_NAMES = [
  'hus_get_codelab_context',
  'hus_submit_code_coaching',
] as const;

export const REGISTERED_DIAGNOSTICS_TOOL_NAMES = [
  'hus_get_study_diagnostics',
  'hus_launch_targeted_drill',
] as const;

export const REGISTERED_TOOL_NAMES = [
  ...REGISTERED_ESSAY_TOOL_NAMES,
  ...REGISTERED_CODELAB_TOOL_NAMES,
  ...REGISTERED_DIAGNOSTICS_TOOL_NAMES,
] as const;

const TOOL_ACTIVITY_LABEL_VI: Readonly<Record<string, string>> = {
  hus_get_essay_context: 'Gemini đang đọc bài nháp A4…',
  hus_search_curriculum: 'Gemini đang tra cứu giáo trình ĐHKHTN…',
  hus_submit_essay_coaching: 'Gemini đang đồng bộ nhận xét lên giấy A4…',
  hus_get_exam_paper_submissions: 'Gemini đang đọc toàn bộ đề thi…',
  hus_submit_exam_batch_coaching: 'Gemini đang chấm hàng loạt toàn đề…',
  hus_get_lesson_context: 'Gemini đang đọc ngữ cảnh bài học…',
  hus_get_codelab_context: 'Gemini đang đọc mã nguồn & stderr CodeLab…',
  hus_submit_code_coaching: 'Gemini đang đẩy gợi ý debug Socratic…',
  hus_get_study_diagnostics: 'Gemini đang phân tích Sổ tay Lỗi sai…',
  hus_launch_targeted_drill: 'Gemini đang mở đề luyện riêng câu yếu…',
};

export interface WebMcpActivitySnapshot {
  readonly activeToolName: string | null;
  readonly labelVi: string | null;
  readonly lastToolName: string | null;
  readonly lastCompletedAt: number | null;
  readonly invocationCount: number;
}

let activitySnapshot: WebMcpActivitySnapshot = {
  activeToolName: null,
  labelVi: null,
  lastToolName: null,
  lastCompletedAt: null,
  invocationCount: 0,
};

const activityListeners = new Set<() => void>();

function emitActivitySnapshot(next: WebMcpActivitySnapshot): void {
  activitySnapshot = next;
  for (const listener of activityListeners) {
    listener();
  }
}

function markToolActivityStart(toolName: string): void {
  emitActivitySnapshot({
    ...activitySnapshot,
    activeToolName: toolName,
    labelVi: TOOL_ACTIVITY_LABEL_VI[toolName] ?? `Đang chạy ${toolName}…`,
  });
}

function markToolActivityEnd(toolName: string, countInvocation: boolean): void {
  emitActivitySnapshot({
    activeToolName: activitySnapshot.activeToolName === toolName ? null : activitySnapshot.activeToolName,
    labelVi:
      activitySnapshot.activeToolName === toolName
        ? null
        : activitySnapshot.labelVi,
    lastToolName: toolName,
    lastCompletedAt: Date.now(),
    invocationCount: activitySnapshot.invocationCount + (countInvocation ? 1 : 0),
  });
}

export function getWebMcpActivitySnapshot(): WebMcpActivitySnapshot {
  return activitySnapshot;
}

export function subscribeWebMcpActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => {
    activityListeners.delete(listener);
  };
}

interface ActiveOwnerRecord {
  readonly id: symbol;
  readonly tools: readonly WebMcpToolDefinition[];
  controller: AbortController | null;
  active: boolean;
}

const portOwnerStacks = new WeakMap<WebMcpModelContextPort, ActiveOwnerRecord[]>();
const observedPorts = new WeakSet<WebMcpModelContextPort>();

function ensurePortLifecycleListeners(port: WebMcpModelContextPort): void {
  if (observedPorts.has(port) || typeof port.addEventListener !== 'function') return;
  observedPorts.add(port);
  try {
    port.addEventListener('toolactivated', event => {
      const maybeEvent = event as unknown as { toolName?: unknown };
      const toolName =
        typeof maybeEvent.toolName === 'string' ? maybeEvent.toolName : 'webmcp-tool';
      markToolActivityStart(toolName);
    });
    port.addEventListener('toolcancel', event => {
      const maybeEvent = event as unknown as { toolName?: unknown };
      const toolName =
        typeof maybeEvent.toolName === 'string'
          ? maybeEvent.toolName
          : (activitySnapshot.activeToolName ?? 'webmcp-tool');
      markToolActivityEnd(toolName, false);
    });
  } catch {
    // Ignore hosts without EventTarget support on modelContext
  }
}

export function getActiveRegisteredToolNames(): readonly string[] {
  const { port } = getBrowserModelContext();
  if (!port) return [];
  const stack = portOwnerStacks.get(port);
  const top = stack?.[stack.length - 1];
  if (!top || !top.active) return [];
  return top.tools.map(t => t.name);
}

export interface WebMcpDiagnosticsDryRunResult {
  readonly ok: boolean;
  readonly timestamp: string;
  readonly isSecureContext: boolean;
  readonly support: WebMcpSupportInfo;
  readonly activeToolNames: readonly string[];
  readonly checks: readonly {
    readonly id: string;
    readonly label: string;
    readonly passed: boolean;
    readonly detail: string;
  }[];
}

/**
 * Runs a safe, non-mutating WebMCP environment & registry self-test for `SettingsPage`.
 */
export function runWebMcpDiagnosticsDryRun(): WebMcpDiagnosticsDryRunResult {
  const isSecure = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false;
  const { port, info } = getBrowserModelContext();
  const activeToolNames = getActiveRegisteredToolNames();
  const hasNativeEvents = Boolean(port && typeof port.addEventListener === 'function');

  const checks = [
    {
      id: 'secure-context',
      label: 'Ngữ cảnh bảo mật (HTTPS / localhost)',
      passed: isSecure,
      detail: isSecure
        ? 'Trình duyệt đang ở Secure Context hợp lệ.'
        : 'Cần mở qua HTTPS hoặc localhost để trình duyệt cấp quyền WebMCP.',
    },
    {
      id: 'origin-trial',
      label: 'Origin Trial Token trong trang',
      passed: info.hasOriginTrialToken,
      detail: info.hasOriginTrialToken
        ? info.isTrialOriginMatch
          ? `Khớp tên miền Origin Trial (${WEBMCP_ORIGIN_TRIAL_INFO.hostnames.join(', ')}).`
          : `Đã nhúng token; tên miền hiện tại cần khớp hoặc bật cờ thủ công.`
        : 'Không tìm thấy thẻ meta origin-trial.',
    },
    {
      id: 'model-context-port',
      label: 'Cổng ModelContext của trình duyệt',
      passed: info.available,
      detail: info.available
        ? `Hoạt động qua ${info.host}.modelContext${hasNativeEvents ? ' (hỗ trợ sự kiện toolactivated/toolcancel)' : ''}.`
        : describeInactiveWebMcpReason(info),
    },
    {
      id: 'tool-registry',
      label: 'Bộ công cụ WebMCP trên route hiện tại',
      passed: info.available,
      detail: info.available
        ? activeToolNames.length > 0
          ? `Đang mở ${activeToolNames.length} công cụ: ${activeToolNames.join(', ')}.`
          : 'Cổng sẵn sàng (các công cụ chuyên biệt tự đăng ký khi mở bài học / đề thi / CodeLab / Tiến độ).'
        : 'Chưa thể đăng ký công cụ tự động khi ModelContext chưa bật.',
    },
  ] as const;

  return {
    ok: isSecure && info.available,
    timestamp: new Date().toISOString(),
    isSecureContext: isSecure,
    support: info,
    activeToolNames,
    checks,
  };
}

function wrapToolWithActivity(tool: WebMcpToolDefinition): WebMcpToolDefinition {
  return {
    ...tool,
    execute: async args => {
      markToolActivityStart(tool.name);
      try {
        return await tool.execute(args);
      } finally {
        markToolActivityEnd(tool.name, true);
      }
    },
  };
}

function deactivateOwnerRecord(port: WebMcpModelContextPort, record: ActiveOwnerRecord): void {
  if (!record.active) return;
  record.active = false;
  record.controller?.abort();
  record.controller = null;
  if (typeof port.unregisterTool === 'function') {
    for (const tool of record.tools) {
      try {
        void Promise.resolve(port.unregisterTool(tool.name)).catch(() => {});
      } catch {
        // Ignore already-unregistered errors
      }
    }
  }
}

function activateOwnerRecord(port: WebMcpModelContextPort, record: ActiveOwnerRecord): void {
  if (record.active) return;
  ensurePortLifecycleListeners(port);
  const controller = new AbortController();
  record.controller = controller;
  record.active = true;

  for (const rawTool of record.tools) {
    const tool = wrapToolWithActivity(rawTool);
    try {
      void Promise.resolve(port.registerTool(tool, { signal: controller.signal })).catch(() => {
        // Never retry without AbortSignal on async rejection (prevents orphan tools)
      });
    } catch (err) {
      if (err instanceof TypeError) {
        try {
          void Promise.resolve(port.registerTool(tool)).catch(() => {});
        } catch {
          // Ignore unsupported registration error
        }
      }
    }
  }
}

function registerScopedWebMcpTools(tools: readonly WebMcpToolDefinition[]): {
  readonly support: WebMcpSupportInfo;
  readonly dispose: () => void;
} {
  const { port, info } = getBrowserModelContext();
  if (!port) {
    return { support: info, dispose: () => {} };
  }

  let stack = portOwnerStacks.get(port);
  if (!stack) {
    stack = [];
    portOwnerStacks.set(port, stack);
  }
  const prevTop = stack[stack.length - 1];
  if (prevTop) {
    deactivateOwnerRecord(port, prevTop);
  }

  const record: ActiveOwnerRecord = {
    id: Symbol('webmcp-owner'),
    tools,
    controller: null,
    active: false,
  };
  stack.push(record);
  activateOwnerRecord(port, record);

  let disposed = false;
  return {
    support: info,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const currentStack = portOwnerStacks.get(port);
      if (!currentStack) return;
      const idx = currentStack.indexOf(record);
      if (idx === -1) return;
      const wasTop = idx === currentStack.length - 1;
      currentStack.splice(idx, 1);
      deactivateOwnerRecord(port, record);
      if (wasTop) {
        const nextTop = currentStack[currentStack.length - 1];
        if (nextTop) {
          activateOwnerRecord(port, nextTop);
        }
      }
    },
  };
}

const SINGLE_COACHING_INPUT_PROPERTIES = {
  exerciseId: {
    type: 'string',
    description: 'Tùy chọn mã bài tập (dùng để kiểm tra khớp đề khi chấm hàng loạt).',
  },
  stepId: {
    type: 'string',
    description: 'Mã định danh của bước tự viết đang nhận xét (lấy từ activeStep.id).',
  },
  summary: {
    type: 'string',
    description: 'Nhận xét tổng quan ngắn gọn 1–2 câu bám sát giáo trình (hỗ trợ LaTeX $...$).',
  },
  verdict: {
    type: 'string',
    enum: ['pass', 'not-pass'],
    description:
      'Kết quả chấm Mức 1 (pass khi kết quả đúng, score >= 7.0/10 và không có tiêu chí missing; ngược lại not-pass). Bỏ trống nếu chỉ đang gợi mở Socratic.',
  },
  score: {
    type: 'number',
    description: 'Điểm số chấm trên thang 10 (bậc 0.25 hoặc 0.5).',
  },
  maxScore: {
    type: 'number',
    description: 'Thang điểm tối đa (mặc định 10).',
  },
  socraticQuestions: {
    type: 'array',
    items: { type: 'string' },
    description: 'Từ 1 đến 3 câu hỏi gợi mở giúp sinh viên tự phát hiện ý còn thiếu.',
  },
  criterionFeedback: {
    type: 'array',
    description: 'Đánh giá chi tiết theo từng mã criterionId trong rubricCriteria.',
    items: {
      type: 'object',
      properties: {
        criterionId: { type: 'string' },
        status: { type: 'string', enum: ['met', 'partial', 'missing'] },
        comment: { type: 'string' },
      },
      required: ['criterionId', 'status', 'comment'],
      additionalProperties: false,
    },
  },
  conventionWarnings: {
    type: 'array',
    items: { type: 'string' },
    description: 'Cảnh báo nếu bài nháp thiếu điều kiện định lý, sai quy ước dấu/ký hiệu hoặc thiếu đơn vị.',
  },
  citedSections: {
    type: 'array',
    items: { type: 'string' },
    description: 'Danh sách mục bài học trong giáo trình đã dùng để đối chiếu.',
  },
} as const;

export function registerEssayWebMcpTools(bindings: EssayWebMcpBindings): {
  readonly support: WebMcpSupportInfo;
  readonly dispose: () => void;
} {
  const { port, info } = getBrowserModelContext();
  if (!port) {
    return { support: info, dispose: () => {} };
  }

  const tools: readonly WebMcpToolDefinition[] = [
    {
      name: 'hus_get_essay_context',
      description:
        'Trả về đề bài tự luận đang mở, yêu cầu bước hiện tại, danh sách tiêu chí rubric, quy ước ký hiệu học phần ĐHKHTN, phạm vi chương đã học và bài nháp mới nhất của sinh viên.',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['socratic-hint', 'rubric-review', 'presentation-review'],
            description:
              'Chọn socratic-hint để gợi mở không lộ đáp án, rubric-review để đối chiếu tiêu chí, hoặc presentation-review để kiểm tra chi tiết cách trình bày lập luận & kết quả trên giấy A4.',
          },
          stepId: {
            type: 'string',
            description:
              'Tùy chọn mã bước tự viết cần đọc (mặc định đọc bước đang chọn/nhập trên trang).',
          },
        },
        additionalProperties: false,
      },
      execute: rawArgs => {
        const rawMode =
          typeof rawArgs === 'object' && rawArgs !== null
            ? (rawArgs as { mode?: unknown }).mode
            : undefined;
        const mode: CoachingPromptMode =
          rawMode === 'rubric-review' || rawMode === 'presentation-review'
            ? rawMode
            : 'socratic-hint';
        const requestedStepId =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          typeof (rawArgs as { stepId?: unknown }).stepId === 'string' &&
          (rawArgs as { stepId: string }).stepId.trim() !== ''
            ? (rawArgs as { stepId: string }).stepId.trim()
            : undefined;
        const packet = bindings.getContextPacket(mode, requestedStepId);
        if (!packet) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Bước hiện tại không phải là bước tự viết lập luận (written-reasoning). Hãy chọn một bước tự viết trên trang.',
              },
            ],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(packet, null, 2) }],
        };
      },
    },
    {
      name: 'hus_search_curriculum',
      description:
        'Tìm kiếm các định nghĩa, định lý, công thức và ví dụ đã kiểm duyệt trong bài học hiện tại và các bài tiên quyết của học phần (chặn tự động các chương chưa học).',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Từ khóa tiếng Việt hoặc ký hiệu công thức LaTeX cần tra cứu trong giáo trình.',
          },
          includeAllEarlierCourseLessons: {
            type: 'boolean',
            description:
              'Đặt true nếu muốn mở rộng tìm kiếm sang toàn bộ các bài thuộc các chương trước trong cùng học phần.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async rawArgs => {
        const query =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          typeof (rawArgs as { query?: unknown }).query === 'string'
            ? (rawArgs as { query: string }).query.trim()
            : '';
        if (!query) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Tham số `query` không được để trống.' }],
          };
        }
        const expand =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          (rawArgs as { includeAllEarlierCourseLessons?: unknown }).includeAllEarlierCourseLessons ===
            true;
        const hits = await bindings.searchCurriculum(query.slice(0, 300), expand);
        const payload = hits.map(hit => ({
          lessonId: hit.chunk.lessonId,
          lessonTitle: hit.chunk.lessonTitle,
          chapterTitle: hit.chunk.chapterTitle,
          sectionTitle: hit.chunk.sectionTitle,
          relation: hit.chunk.relationToTarget,
          score: hit.score,
          excerptMarkdown: hit.chunk.bodyMarkdown,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
      },
    },
    {
      name: 'hus_submit_essay_coaching',
      description:
        'Truyền nhận xét Socratic, câu hỏi gợi mở, cảnh báo ký hiệu/điều kiện và đánh giá từng tiêu chí rubric ngược về giao diện HUS Learning Hub cho sinh viên xem trực tiếp.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          stepId: SINGLE_COACHING_INPUT_PROPERTIES.stepId,
          summary: SINGLE_COACHING_INPUT_PROPERTIES.summary,
          verdict: SINGLE_COACHING_INPUT_PROPERTIES.verdict,
          score: SINGLE_COACHING_INPUT_PROPERTIES.score,
          maxScore: SINGLE_COACHING_INPUT_PROPERTIES.maxScore,
          socraticQuestions: SINGLE_COACHING_INPUT_PROPERTIES.socraticQuestions,
          criterionFeedback: SINGLE_COACHING_INPUT_PROPERTIES.criterionFeedback,
          conventionWarnings: SINGLE_COACHING_INPUT_PROPERTIES.conventionWarnings,
          citedSections: SINGLE_COACHING_INPUT_PROPERTIES.citedSections,
        },
        required: ['stepId', 'summary'],
        additionalProperties: false,
      },
      execute: rawArgs => {
        const requestedStepId =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          typeof (rawArgs as { stepId?: unknown }).stepId === 'string' &&
          (rawArgs as { stepId: string }).stepId.trim() !== ''
            ? (rawArgs as { stepId: string }).stepId.trim()
            : undefined;
        const parsed = parseExternalTutorFeedback(
          rawArgs,
          bindings.getExercise(requestedStepId),
          bindings.getActiveStepId(),
          'webmcp',
        );
        if (!parsed.ok) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Dữ liệu phản hồi chưa hợp lệ: ${parsed.error}` }],
          };
        }
        bindings.onReceiveFeedback(parsed.value);
        return {
          content: [
            {
              type: 'text',
              text: `Đã hiển thị phản hồi hướng dẫn cho bước "${parsed.value.stepId}" trực tiếp trên trang HUS Learning Hub.`,
            },
          ],
        };
      },
    },
    ...(bindings.getExamPaperOverview
      ? ([
          {
            name: 'hus_get_exam_paper_submissions',
            description:
              'Trả về danh sách toàn bộ câu hỏi và bài trình bày tự luận trên giấy A4 mà sinh viên đã viết trong đề thi đang mở, kèm quy ước ký hiệu ĐHKHTN và rubric từng câu để kiểm tra cách trình bày kết quả toàn đề.',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
              type: 'object',
              properties: {
                onlyDrafted: {
                  type: 'boolean',
                  description:
                    'Đặt true để chỉ lấy các câu sinh viên đã viết bài nháp trên giấy A4.',
                },
              },
              additionalProperties: false,
            },
            execute: rawArgs => {
              const overview = bindings.getExamPaperOverview?.();
              if (!overview) {
                return {
                  isError: true,
                  content: [
                    {
                      type: 'text',
                      text: 'Hiện chưa có đề luyện thi tự luận nào đang mở trên trang.',
                    },
                  ],
                };
              }
              const onlyDrafted =
                typeof rawArgs === 'object' &&
                rawArgs !== null &&
                (rawArgs as { onlyDrafted?: unknown }).onlyDrafted === true;
              const rawSteps = onlyDrafted
                ? overview.steps.filter(s => s.hasDraft)
                : overview.steps;
              const payload = {
                ...overview,
                steps: rawSteps.map(s => ({
                  ...s,
                  studentDraft: convertStudentShorthandToLatex(s.studentDraft),
                })),
              };
              return {
                content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
              };
            },
          },
          {
            name: 'hus_submit_exam_batch_coaching',
            description:
              'Đồng bộ điểm số Mức 1 (/10), nhận xét trình bày, câu hỏi gợi mở và đánh giá rubric cho nhiều câu trong đề thi đang mở chỉ bằng một lần gọi duy nhất.',
            annotations: { readOnlyHint: false, idempotentHint: true },
            inputSchema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  minItems: 1,
                  description: 'Danh sách kết quả chấm từng bước tự luận (khớp theo stepId).',
                  items: {
                    type: 'object',
                    properties: SINGLE_COACHING_INPUT_PROPERTIES,
                    required: ['stepId', 'summary'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
            execute: rawArgs => {
              const rawItems =
                typeof rawArgs === 'object' && rawArgs !== null
                  ? (rawArgs as { items?: unknown }).items
                  : undefined;
              if (!Array.isArray(rawItems) || rawItems.length === 0) {
                return {
                  isError: true,
                  content: [
                    {
                      type: 'text',
                      text: 'Tham số `items` phải là một mảng không rỗng chứa kết quả chấm từng câu.',
                    },
                  ],
                };
              }

              const seenStepIds = new Set<string>();
              const validItems: TutorCoachingFeedback[] = [];
              let skippedCount = 0;
              let firstError: string | undefined;

              for (const entry of rawItems) {
                const requestedStepId =
                  typeof entry === 'object' &&
                  entry !== null &&
                  typeof (entry as { stepId?: unknown }).stepId === 'string'
                    ? (entry as { stepId: string }).stepId.trim()
                    : '';
                if (!requestedStepId || seenStepIds.has(requestedStepId)) {
                  skippedCount += 1;
                  continue;
                }
                const parsed = parseExternalTutorFeedback(
                  entry,
                  bindings.getExercise(requestedStepId),
                  requestedStepId,
                  'webmcp',
                );
                if (!parsed.ok) {
                  skippedCount += 1;
                  if (!firstError) firstError = parsed.error;
                  continue;
                }
                seenStepIds.add(parsed.value.stepId);
                validItems.push(parsed.value);
              }

              if (validItems.length === 0) {
                return {
                  isError: true,
                  content: [
                    {
                      type: 'text',
                      text: firstError
                        ? `Không có mục phản hồi hợp lệ nào: ${firstError}`
                        : 'Không có mục phản hồi hợp lệ nào khớp với mã stepId trên đề thi.',
                    },
                  ],
                };
              }

              if (bindings.onReceiveBatchFeedback) {
                bindings.onReceiveBatchFeedback(validItems);
              } else {
                for (const fb of validItems) {
                  bindings.onReceiveFeedback(fb);
                }
              }

              const skippedNote =
                skippedCount > 0 ? ` (Bỏ qua ${skippedCount} mục không hợp lệ hoặc trùng lặp.)` : '';
              return {
                content: [
                  {
                    type: 'text',
                    text: `Đã đồng bộ chấm điểm & nhận xét cho ${validItems.length} ý tự luận (${validItems.map(v => v.stepId).join(', ')}) trực tiếp lên đề thi.${skippedNote}`,
                  },
                ],
              };
            },
          },
        ] as const satisfies readonly WebMcpToolDefinition[])
      : []),
      ...(bindings.getLessonContextPacket
        ? ([
            {
              name: 'hus_get_lesson_context',
              description:
                'Trả về bài học hiện tại, mục lý thuyết sinh viên đang đọc, quy ước ký hiệu ĐHKHTN, danh sách chương chưa học (chặn vượt chương) và bài tập đang mở.',
              annotations: { readOnlyHint: true, idempotentHint: true },
              inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false,
              },
              execute: () => {
                const pkt = bindings.getLessonContextPacket?.();
                if (!pkt) {
                  return {
                    isError: true,
                    content: [
                      {
                        type: 'text',
                        text: 'Hiện chưa có ngữ cảnh bài học nào sẵn sàng trên trang.',
                      },
                    ],
                  };
                }
                return {
                  content: [{ type: 'text', text: JSON.stringify(pkt, null, 2) }],
                };
              },
            },
          ] as const satisfies readonly WebMcpToolDefinition[])
        : []),
  ];

  return registerScopedWebMcpTools(tools);
}

export interface CodeLabWebMcpBindings {
  readonly getContextPacket: () => CodeLabWebMcpContextPacket;
  readonly getLanguage: () => CodeLanguage;
  readonly getProblemId: () => EntityId | undefined;
  readonly onReceiveCoaching: (feedback: CodeLabCoachingFeedback) => void;
}

export function registerCodeLabWebMcpTools(bindings: CodeLabWebMcpBindings): {
  readonly support: WebMcpSupportInfo;
  readonly dispose: () => void;
} {
  const tools: readonly WebMcpToolDefinition[] = [
    {
      name: 'hus_get_codelab_context',
      description:
        'Trả về đề bài lập trình đang mở, mã nguồn sinh viên đang viết trong CodeLab, stdin tùy chỉnh và stdout/stderr hoặc test case hiển thị đang chạy/lỗi (ẩn test case bí mật).',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: () => ({
        content: [{ type: 'text', text: JSON.stringify(bindings.getContextPacket(), null, 2) }],
      }),
    },
    {
      name: 'hus_submit_code_coaching',
      description:
        'Đẩy gợi ý debug Socratic, nguyên nhân lỗi từ stderr, trường hợp biên và đánh giá độ phức tạp O(.) ngược về giao diện CodeLab (tuyệt đối không viết hộ full code lời giải).',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          problemId: { type: 'string' },
          language: { type: 'string', enum: ['python', 'java'] },
          verdict: { type: 'string', enum: ['pass', 'needs-fix'] },
          summary: { type: 'string' },
          complexityNote: { type: 'string' },
          bugHints: { type: 'array', items: { type: 'string' } },
          edgeCases: { type: 'array', items: { type: 'string' } },
          socraticQuestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary'],
        additionalProperties: false,
      },
      execute: rawArgs => {
        const parsed = parseExternalCodeLabFeedback(
          rawArgs,
          bindings.getLanguage(),
          bindings.getProblemId(),
          'webmcp',
        );
        if (!parsed.ok) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Dữ liệu phản hồi CodeLab chưa hợp lệ: ${parsed.error}` }],
          };
        }
        bindings.onReceiveCoaching(parsed.value);
        return {
          content: [
            {
              type: 'text',
              text: 'Đã hiển thị thẻ gợi ý debug Socratic trực tiếp trong CodeLab.',
            },
          ],
        };
      },
    },
  ];

  return registerScopedWebMcpTools(tools);
}

export interface StudyDiagnosticsWebMcpBindings {
  readonly getDiagnosticsReport: () => StudyDiagnosticsReport;
  readonly onLaunchTargetedDrill: (params: {
    readonly courseId: EntityId;
    readonly pinnedExerciseIds: readonly EntityId[];
  }) => void;
}

export function registerStudyDiagnosticsWebMcpTools(bindings: StudyDiagnosticsWebMcpBindings): {
  readonly support: WebMcpSupportInfo;
  readonly dispose: () => void;
} {
  const tools: readonly WebMcpToolDefinition[] = [
    {
      name: 'hus_get_study_diagnostics',
      description:
        'Đọc báo cáo chẩn đoán học tập cá nhân hóa: tiến độ từng học phần, điểm trung bình Mức 1 (/10), các lỗi ký hiệu/điều kiện lặp lại nhiều nhất và danh sách câu cần luyện lại.',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: () => ({
        content: [{ type: 'text', text: JSON.stringify(bindings.getDiagnosticsReport(), null, 2) }],
      }),
    },
    {
      name: 'hus_launch_targeted_drill',
      description:
        'Mở ngay phòng luyện đề tự luận (/exams) với danh sách câu hỏi yếu hoặc chưa đạt được ghim sẵn cho học phần chỉ định.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          courseId: {
            type: 'string',
            description: 'Mã học phần (ví dụ mat1091, phy1159, general-chemistry).',
          },
          exerciseIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Danh sách mã câu hỏi cụ thể (tùy chọn; mặc định lấy các câu yếu của học phần).',
          },
        },
        required: ['courseId'],
        additionalProperties: false,
      },
      execute: rawArgs => {
        const courseId =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          typeof (rawArgs as { courseId?: unknown }).courseId === 'string'
            ? (rawArgs as { courseId: string }).courseId.trim()
            : '';
        const report = bindings.getDiagnosticsReport();
        const explicitIds =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          Array.isArray((rawArgs as { exerciseIds?: unknown }).exerciseIds)
            ? ((rawArgs as { exerciseIds: unknown[] }).exerciseIds.filter(
                (id): id is string => typeof id === 'string' && id.trim().length > 0,
              ))
            : [];
        const targetIds =
          explicitIds.length > 0
            ? explicitIds
            : (report.weakExerciseIdsByCourse[courseId] ?? []);
        if (!courseId || targetIds.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Không tìm thấy câu hỏi yếu nào thuộc học phần này để tạo đề luyện riêng.',
              },
            ],
          };
        }
        bindings.onLaunchTargetedDrill({ courseId, pinnedExerciseIds: targetIds });
        return {
          content: [
            {
              type: 'text',
              text: `Đang mở phòng luyện đề riêng với ${targetIds.length} câu cần ôn lại của học phần "${courseId}".`,
            },
          ],
        };
      },
    },
  ];

  return registerScopedWebMcpTools(tools);
}
