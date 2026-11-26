import type {
  CodeExecutionResult,
  CodeLabCoachingFeedback,
  CodeLabCoachingVerdict,
  CodeLabWebMcpContextPacket,
  CodeLanguage,
  CodeProblem,
  JudgeSummary,
} from '../../domain/code-lab';
import { repairJsonLatexEscapes } from '../learning/json-repair';

const MAX_RAW_CHARS = 40_000;
const MAX_CODE_CHARS = 16_000;
const MAX_IO_CHARS = 2_500;

function truncateBounded(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}\n… [Đã rút gọn]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, maxLen).trimEnd()}…`;
}

function sanitizeList(value: unknown, maxItems: number, maxItemLen: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) break;
    const clean = sanitizeText(item, maxItemLen);
    if (clean && !out.includes(clean)) {
      out.push(clean);
    }
  }
  return out;
}

/**
 * Builds a WebMCP-safe CodeLab context packet.
 * Strictly excludes `hidden` test case stdin and expectedOutput to avoid leaking hidden tests.
 */
export function buildCodeLabContextPacket(params: {
  readonly courseId: string;
  readonly mode: 'problem' | 'playground';
  readonly language: CodeLanguage;
  readonly problem?: CodeProblem | undefined;
  readonly snippetLabel?: string | undefined;
  readonly studentCode: string;
  readonly customStdin: string;
  readonly runResult: CodeExecutionResult | null;
  readonly judgeSummary: JudgeSummary | null;
  readonly nowIso?: string | undefined;
}): CodeLabWebMcpContextPacket {
  const {
    courseId,
    mode,
    language,
    problem,
    snippetLabel,
    studentCode,
    customStdin,
    runResult,
    judgeSummary,
  } = params;

  const hiddenIds = new Set(
    (problem?.testCases ?? []).filter(tc => tc.hidden).map(tc => tc.id),
  );

  const failedVisibleVerdicts = (judgeSummary?.verdicts ?? [])
    .filter(v => !v.passed && !hiddenIds.has(v.testCaseId))
    .slice(0, 4)
    .map(v => ({
      label: v.label,
      status: v.status,
      expectedOutput: truncateBounded(v.expectedOutput, 600),
      actualOutput: truncateBounded(v.actualOutput, 600),
      stderr: truncateBounded(v.stderr, 800),
    }));

  const failedHiddenCount = (judgeSummary?.verdicts ?? []).filter(
    v => !v.passed && hiddenIds.has(v.testCaseId),
  ).length;

  return {
    schemaVersion: 1,
    generatedAt: params.nowIso ?? new Date().toISOString(),
    courseId,
    mode,
    language,
    ...(mode === 'problem' && problem
      ? {
          problem: {
            id: problem.id,
            title: problem.title,
            chapterLabel: problem.chapterLabel,
            difficulty: problem.difficulty,
            promptMarkdown: truncateBounded(problem.promptMarkdown, 4_000),
            hints: problem.hints,
            visibleTestCases: problem.testCases
              .filter(tc => !tc.hidden)
              .map(tc => ({
                label: tc.label,
                stdin: truncateBounded(tc.stdin, 600),
                expectedOutput: truncateBounded(tc.expectedOutput, 600),
              })),
            hiddenTestCaseCount: hiddenIds.size,
          },
        }
      : {}),
    ...(mode === 'playground' && snippetLabel ? { snippetLabel } : {}),
    studentCode: truncateBounded(studentCode, MAX_CODE_CHARS),
    customStdin: truncateBounded(customStdin, MAX_IO_CHARS),
    ...(runResult
      ? {
          latestExecution: {
            status: runResult.status,
            stdout: truncateBounded(runResult.stdout, MAX_IO_CHARS),
            stderr: truncateBounded(runResult.stderr, MAX_IO_CHARS),
            ...(runResult.errorMessage ? { errorMessage: runResult.errorMessage } : {}),
          },
        }
      : {}),
    ...(judgeSummary
      ? {
          latestJudgeSummary: {
            passed: judgeSummary.passed,
            total: judgeSummary.total,
            allPassed: judgeSummary.allPassed,
            failedVisibleVerdicts,
            failedHiddenCount,
          },
        }
      : {}),
    pedagogicalContract: [
      'Đóng vai Trợ giảng Lập trình Socratic của Trường ĐHKHTN – ĐHQGHN (VNU-HUS).',
      'TUYỆT ĐỐI KHÔNG viết lại toàn bộ chương trình lời giải hoàn chỉnh thay sinh viên.',
      'Hãy chỉ ra nguyên nhân gốc rễ từ lỗi biên dịch/runtime (`stderr`), sai khác output test case, trường hợp biên (mảng rỗng, 0-based index, tràn số, null/OOP), và đánh giá độ phức tạp thời gian/không gian $O(\\cdot)$.',
      'Đặt 1–3 câu hỏi gợi mở Socratic để sinh viên tự sửa code và bấm Chấm Test Case lại.',
    ],
  };
}

export function formatAskGeminiCodeLabPrompt(
  packet: CodeLabWebMcpContextPacket,
  options?: { readonly webMcpAvailable?: boolean | undefined },
): string {
  const langLabel = packet.language === 'java' ? 'Java (WASM)' : 'Python (WASM)';
  const dualPathHeader = options?.webMcpAvailable
    ? [
        '## 0. Chế độ kết nối tự thích ứng (WebMCP / ✨ Ask Gemini trên Chrome)',
        '- **Nếu môi trường của bạn gọi được công cụ WebMCP:** Hãy gọi `hus_get_codelab_context` để đọc mã nguồn & `stderr` mới nhất, rồi gọi `hus_submit_code_coaching` để đẩy gợi ý debug trực tiếp lên trang.',
        '- **Nếu đang chạy trên thanh bên ✨ Ask Gemini tiêu chuẩn (không có quyền gọi WebMCP):** **TUYỆT ĐỐI KHÔNG nhắc đến WebMCP và KHÔNG thông báo thiếu quyền gọi công cụ.** Hãy phân tích ngay bên dưới và **xuất đúng 1 khối ```json ... ``` ở cuối câu trả lời**.',
        '',
      ]
    : [];

  const judgeBlock = packet.latestJudgeSummary
    ? [
        `## 3. Kết quả chấm Test Case gần nhất (${packet.latestJudgeSummary.passed}/${packet.latestJudgeSummary.total})`,
        ...packet.latestJudgeSummary.failedVisibleVerdicts.map(
          v =>
            `- **${v.label} (${v.status}):** Kỳ vọng \`${v.expectedOutput || '(trống)'}\` | Thực tế \`${v.actualOutput || '(trống)'}\`${
              v.stderr ? ` | stderr: \`${v.stderr}\`` : ''
            }`,
        ),
        ...(packet.latestJudgeSummary.failedHiddenCount > 0
          ? [`- Có **${packet.latestJudgeSummary.failedHiddenCount} test case ẩn** chưa khớp đầu ra.`]
          : []),
      ]
    : [];

  const execBlock = packet.latestExecution
    ? [
        `## 3. Kết quả chạy thử gần nhất (${packet.latestExecution.status})`,
        `- **Stdout:** \`${packet.latestExecution.stdout || '(trống)'}\``,
        ...(packet.latestExecution.stderr
          ? [`- **Stderr:**\n\`\`\`\n${packet.latestExecution.stderr}\n\`\`\``]
          : []),
        ...(packet.latestExecution.errorMessage
          ? [`- **Thông báo lỗi:** ${packet.latestExecution.errorMessage}`]
          : []),
      ]
    : [];

  const sampleJson = JSON.stringify(
    {
      version: 1,
      ...(packet.problem ? { problemId: packet.problem.id } : {}),
      language: packet.language,
      verdict: packet.latestJudgeSummary?.allPassed ? 'pass' : 'needs-fix',
      summary: 'Nhận xét ngắn gọn 1–2 câu về logic, lỗi biên dịch hoặc hiệu năng thuật toán.',
      complexityNote: 'Thời gian $O(...)$, bộ nhớ phụ $O(...)$.',
      bugHints: ['Gợi ý lỗi cụ thể (không viết hộ full code).'],
      edgeCases: ['Trường hợp biên cần kiểm tra (ví dụ: n = 0, mảng rỗng).'],
      socraticQuestions: ['Câu hỏi gợi mở giúp sinh viên tự tìm ra chỗ sai?'],
    },
    null,
    2,
  );

  return [
    `# Trợ giảng Debug Socratic CodeLab (${packet.courseId.toUpperCase()} · ${langLabel})`,
    '',
    ...dualPathHeader,
    '## 1. Nguyên tắc bắt buộc',
    ...packet.pedagogicalContract.map(r => `- ${r}`),
    '',
    ...(packet.problem
      ? [
          `## 2. Đề bài: ${packet.problem.title} (${packet.problem.chapterLabel})`,
          packet.problem.promptMarkdown,
          '',
        ]
      : [
          `## 2. Chế độ Bàn nháp tự do (${packet.snippetLabel ?? langLabel})`,
          '',
        ]),
    '## Mã nguồn hiện tại của sinh viên',
    `\`\`\`${packet.language}`,
    packet.studentCode.trim() || '// (Chưa viết mã nguồn)',
    '```',
    '',
    ...judgeBlock,
    ...execBlock,
    '',
    '## Định dạng JSON đồng bộ 1-click về CodeLab',
    'Ở cuối câu trả lời, hãy kèm **đúng 1 khối JSON hợp lệ** (nhân đôi `\\\\` cho lệnh LaTeX nếu có):',
    '```json',
    sampleJson,
    '```',
  ].join('\n');
}

export type ParseCodeLabFeedbackResult =
  | { readonly ok: true; readonly value: CodeLabCoachingFeedback }
  | { readonly ok: false; readonly error: string };

export function parseExternalCodeLabFeedback(
  rawInput: unknown,
  fallbackLanguage: CodeLanguage,
  expectedProblemId: string | undefined,
  source: 'webmcp' | 'clipboard',
  nowIso?: string,
): ParseCodeLabFeedbackResult {
  let candidate: unknown = rawInput;

  if (typeof rawInput === 'string') {
    if (rawInput.length > MAX_RAW_CHARS) {
      return { ok: false, error: 'Nội dung phản hồi vượt quá giới hạn an toàn (40 KB).' };
    }
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { ok: false, error: 'Nội dung phản hồi đang trống.' };
    }
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let lastBlock: string | null = null;
    let match: RegExpExecArray | null = fenceRegex.exec(trimmed);
    while (match) {
      const block = match[1]?.trim();
      if (block && block.startsWith('{')) lastBlock = block;
      match = fenceRegex.exec(trimmed);
    }
    const jsonCandidate =
      lastBlock ??
      (trimmed.startsWith('{') && trimmed.endsWith('}')
        ? trimmed
        : trimmed.indexOf('{') >= 0 && trimmed.lastIndexOf('}') > trimmed.indexOf('{')
          ? trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)
          : '');
    if (!jsonCandidate) {
      return { ok: false, error: 'Không tìm thấy khối JSON hợp lệ trong phản hồi của Gemini.' };
    }
    try {
      candidate = JSON.parse(repairJsonLatexEscapes(jsonCandidate));
    } catch {
      return { ok: false, error: 'Không thể phân tích cú pháp JSON từ phản hồi CodeLab.' };
    }
  }

  if (!isRecord(candidate)) {
    return { ok: false, error: 'Phản hồi CodeLab phải là một đối tượng JSON.' };
  }

  const candidateProblemId =
    typeof candidate.problemId === 'string' && candidate.problemId.trim()
      ? candidate.problemId.trim()
      : undefined;
  if (candidateProblemId && expectedProblemId && candidateProblemId !== expectedProblemId) {
    return {
      ok: false,
      error: `Phản hồi thuộc bài lập trình khác (${candidateProblemId}), không khớp bài hiện tại (${expectedProblemId}).`,
    };
  }

  const language: CodeLanguage =
    candidate.language === 'java' || candidate.language === 'python'
      ? candidate.language
      : fallbackLanguage;
  const verdictStr =
    typeof candidate.verdict === 'string' ? candidate.verdict.trim().toLowerCase() : '';
  const verdict: CodeLabCoachingVerdict | undefined =
    verdictStr === 'pass' || verdictStr === 'needs-fix' ? verdictStr : undefined;

  const summary = sanitizeText(candidate.summary, 1_500);
  const complexityNote = sanitizeText(candidate.complexityNote, 400);
  const bugHints = sanitizeList(candidate.bugHints, 6, 600);
  const edgeCases = sanitizeList(candidate.edgeCases, 6, 400);
  const socraticQuestions = sanitizeList(candidate.socraticQuestions, 5, 500);

  if (!summary && bugHints.length === 0 && socraticQuestions.length === 0) {
    return {
      ok: false,
      error: 'Khối JSON thiếu nội dung nhận xét (`summary`, `bugHints` hoặc `socraticQuestions`).',
    };
  }

  return {
    ok: true,
    value: {
      version: 1,
      ...(expectedProblemId || candidateProblemId
        ? { problemId: expectedProblemId ?? candidateProblemId }
        : {}),
      language,
      source,
      receivedAt: nowIso ?? new Date().toISOString(),
      summary: summary ?? 'Đã nhận gợi ý debug Socratic từ Gemini.',
      ...(verdict !== undefined ? { verdict } : {}),
      ...(complexityNote ? { complexityNote } : {}),
      bugHints,
      edgeCases,
      socraticQuestions,
    },
  };
}
