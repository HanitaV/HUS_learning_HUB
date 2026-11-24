import type {
  CoachingPromptMode,
  CurriculumSearchHit,
  GroundedEssayContextPacket,
  TutorCoachingFeedback,
} from '../../domain/curriculum-tutor';
import type { EntityId } from '../../domain/learning';
import type { SemiEssayExercise } from '../../domain/semi-essay';
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
}

export const WEBMCP_ORIGIN_TRIAL_INFO = {
  origin: 'https://your-domain.example',
  hostname: 'your-domain.example',
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
  const isTrialOriginMatch =
    host === WEBMCP_ORIGIN_TRIAL_INFO.hostname ||
    host.endsWith(`.${WEBMCP_ORIGIN_TRIAL_INFO.hostname}`);
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
    return `Trang hiện mở ngoài tên miền đăng ký Origin Trial (${WEBMCP_ORIGIN_TRIAL_INFO.hostname}), nên WebMCP không tự bật mặc định và cần kích hoạt cờ thủ công.`;
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

export interface EssayWebMcpBindings {
  readonly getExercise: () => SemiEssayExercise;
  readonly getActiveStepId: () => EntityId;
  readonly getContextPacket: (mode: CoachingPromptMode) => GroundedEssayContextPacket | null;
  readonly searchCurriculum: (
    query: string,
    includeAllCourseLessons: boolean,
  ) => Promise<readonly CurriculumSearchHit[]>;
  readonly onReceiveFeedback: (feedback: TutorCoachingFeedback) => void;
}

const REGISTERED_TOOL_NAMES = [
  'hus_get_essay_context',
  'hus_search_curriculum',
  'hus_submit_essay_coaching',
] as const;

export function registerEssayWebMcpTools(bindings: EssayWebMcpBindings): {
  readonly support: WebMcpSupportInfo;
  readonly dispose: () => void;
} {
  const { port, info } = getBrowserModelContext();
  if (!port) {
    return { support: info, dispose: () => {} };
  }

  const controller = new AbortController();

  const tools: readonly WebMcpToolDefinition[] = [
    {
      name: 'hus_get_essay_context',
      title: 'Đọc đề bài, rubric & ngữ cảnh giáo trình ĐHKHTN hiện tại',
      description:
        'Trả về đề bài tự luận đang mở, yêu cầu bước hiện tại, danh sách tiêu chí rubric, quy ước ký hiệu học phần ĐHKHTN, phạm vi chương đã học và bài nháp mới nhất của sinh viên.',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['socratic-hint', 'rubric-review'],
            description:
              'Chọn socratic-hint để gợi mở không lộ đáp án, hoặc rubric-review để đối chiếu chi tiết theo tiêu chí chấm.',
          },
        },
        additionalProperties: false,
      },
      execute: rawArgs => {
        const mode: CoachingPromptMode =
          typeof rawArgs === 'object' &&
          rawArgs !== null &&
          (rawArgs as { mode?: unknown }).mode === 'rubric-review'
            ? 'rubric-review'
            : 'socratic-hint';
        const packet = bindings.getContextPacket(mode);
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
      title: 'Tra cứu giáo trình chuẩn ĐHKHTN của học phần đang học',
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
      title: 'Hiển thị nhận xét Socratic & đối chiếu Rubric lên khung làm bài',
      description:
        'Truyền nhận xét Socratic, câu hỏi gợi mở, cảnh báo ký hiệu/điều kiện và đánh giá từng tiêu chí rubric ngược về giao diện HUS Learning Hub cho sinh viên xem trực tiếp.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            description: 'Mã định danh của bước tự viết đang nhận xét (lấy từ activeStep.id).',
          },
          summary: {
            type: 'string',
            description: 'Nhận xét tổng quan ngắn gọn 1–2 câu bám sát giáo trình (hỗ trợ LaTeX $...$).',
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
        },
        required: ['stepId', 'summary'],
        additionalProperties: false,
      },
      execute: rawArgs => {
        const parsed = parseExternalTutorFeedback(
          rawArgs,
          bindings.getExercise(),
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
  ];

  for (const tool of tools) {
    try {
      void port.registerTool(tool, { signal: controller.signal });
    } catch {
      // Fallback for early implementations that only accept a single argument
      try {
        void port.registerTool(tool);
      } catch {
        // Ignore duplicate/unsupported registration errors cleanly
      }
    }
  }

  return {
    support: info,
    dispose: () => {
      controller.abort();
      if (typeof port.unregisterTool === 'function') {
        for (const name of REGISTERED_TOOL_NAMES) {
          try {
            void port.unregisterTool(name);
          } catch {
            // Already unregistered via AbortSignal
          }
        }
      }
    },
  };
}
