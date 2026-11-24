import type { CodeWalkthrough, CodeWalkthroughStep } from '../../domain/code-lesson';

export interface ExtractedCodeBlock {
  readonly language: string;
  readonly code: string;
}

export type MarkdownCodeSegment =
  | { readonly kind: 'markdown'; readonly content: string }
  | { readonly kind: 'code'; readonly language: string; readonly code: string; readonly index: number };

export function splitMarkdownWithCodeBlocks(markdown: string): readonly MarkdownCodeSegment[] {
  const segments: MarkdownCodeSegment[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let lang = '';
  let proseBuf: string[] = [];
  let codeBuf: string[] = [];
  let codeIdx = 0;

  const flushProse = () => {
    const content = proseBuf.join('\n').trim();
    if (content.length > 0) {
      segments.push({ kind: 'markdown', content });
    }
    proseBuf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence && trimmed.startsWith('```')) {
      flushProse();
      inFence = true;
      lang = trimmed.slice(3).trim().toLowerCase() || 'text';
      codeBuf = [];
      continue;
    }
    if (inFence && trimmed.startsWith('```')) {
      inFence = false;
      const code = codeBuf.join('\n').trimEnd();
      if (code.trim().length > 0) {
        segments.push({ kind: 'code', language: lang, code, index: codeIdx });
        codeIdx += 1;
      }
      lang = '';
      codeBuf = [];
      continue;
    }
    if (inFence) {
      codeBuf.push(line);
    } else {
      proseBuf.push(line);
    }
  }

  if (inFence && codeBuf.length > 0) {
    proseBuf.push('```' + lang, ...codeBuf);
  }
  flushProse();

  return segments;
}

export function extractCodeBlocksFromMarkdown(markdown: string): readonly ExtractedCodeBlock[] {
  const blocks: ExtractedCodeBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let lang = '';
  let buf: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence && trimmed.startsWith('```')) {
      inFence = true;
      lang = trimmed.slice(3).trim().toLowerCase() || 'text';
      buf = [];
      continue;
    }
    if (inFence && trimmed.startsWith('```')) {
      inFence = false;
      const code = buf.join('\n').trimEnd();
      if (code.trim().length > 0) {
        blocks.push({ language: lang, code });
      }
      lang = '';
      buf = [];
      continue;
    }
    if (inFence) {
      buf.push(line);
    }
  }
  return blocks;
}

interface SegmentInfo {
  readonly startLine: number; // 1-based inclusive
  readonly endLine: number; // 1-based inclusive
  readonly title: string;
  readonly explanation: string;
}

function classifyChunk(chunkText: string, index: number, total: number, language: string): {
  readonly title: string;
  readonly explanation: string;
} {
  const lower = chunkText.toLowerCase();

  if (index === 0) {
    if (/\b(interface|abstract\s+class|class|record|enum)\b/.test(chunkText)) {
      return {
        title: 'Khai báo cấu trúc lớp / giao diện & thuộc tính',
        explanation:
          'Bắt đầu bằng việc định nghĩa khung lớp (hoặc giao diện), tên kiểu và các trường dữ liệu cốt lõi để cố định hợp đồng sử dụng.',
      };
    }
    if (/\b(static|public|private|protected|def\s+)\b/.test(chunkText)) {
      return {
        title: 'Khai báo chữ ký hàm & tham số đầu vào',
        explanation:
          'Xác định rõ tên hàm, kiểu dữ liệu đầu vào/đầu ra và khởi tạo các biến trạng thái ban đầu trước khi vào phần xử lý chính.',
      };
    }
    return {
      title: 'Khởi tạo dữ liệu & cấu trúc ban đầu',
      explanation:
        'Thiết lập các biến, kiểu dữ liệu hoặc cấu trúc lưu trữ nền tảng mà thuật toán sẽ thao tác ở các bước sau.',
    };
  }

  if (index === total - 1) {
    if (/\breturn\b/.test(lower)) {
      return {
        title: 'Hoàn thiện xử lý & trả về kết quả',
        explanation:
          'Hoàn tất các nhánh còn lại, đóng gói và trả về kết quả cuối cùng từ trạng thái đã tính toán.',
      };
    }
    if (/\bmain\s*\(/.test(chunkText) || /\bsystem\.out\.print/.test(lower) || /\bprint\(/.test(lower)) {
      return {
        title: 'Chạy thử & in kết quả kiểm chứng',
        explanation:
          'Gọi thử các phương thức vừa cài đặt với dữ liệu mẫu để quan sát hành vi thực tế và kiểm tra đầu ra.',
      };
    }
    return {
      title: 'Hoàn thiện mã nguồn đầy đủ',
      explanation:
        'Bổ sung phần còn lại để hoàn chỉnh đoạn mã chạy được và đóng đúng tất cả các khối lệnh.',
    };
  }

  if (/\b(while|for)\s*\(/.test(chunkText) || /\bfor\s+\w+\s+in\b/.test(chunkText)) {
    return {
      title: 'Vòng lặp xử lý cốt lõi',
      explanation:
        'Thêm vòng lặp duyệt qua các phần tử / trạng thái và cập nhật dần cấu trúc dữ liệu theo đúng ý tưởng thuật toán.',
    };
  }

  if (/\b(if|switch|try|catch)\b/.test(chunkText)) {
    return {
      title: 'Điều kiện biên & phân nhánh xử lý',
      explanation:
        'Kiểm tra các điều kiện dừng, trường hợp đặc biệt hoặc rẽ nhánh logic để thuật toán chạy an toàn và không sai biên.',
    };
  }

  if (/\b(override|extends|implements|super|this\.)\b/.test(chunkText)) {
    return {
      title: 'Cài đặt hành vi & liên kết hướng đối tượng',
      explanation:
        'Triển khai phương thức ghi đè hoặc ủy quyền giữa các đối tượng để thể hiện rõ tính đóng gói, kế thừa hoặc đa hình.',
    };
  }

  if (language === 'python' && /\bdef\s+/.test(chunkText)) {
    return {
      title: 'Xây dựng hàm hỗ trợ tiếp theo',
      explanation: 'Tách riêng phần xử lý tiếp theo thành hàm rõ ràng để dễ đọc và dễ kiểm thử từng phần.',
    };
  }

  return {
    title: `Bổ sung bước xử lý thứ ${index + 1}`,
    explanation:
      'Mở rộng đoạn mã với phần logic tiếp theo; các dòng được tô sáng là phần mới thêm vào ở bước này.',
  };
}

function findNaturalBreakPoints(lines: readonly string[]): readonly number[] {
  const n = lines.length;
  if (n <= 5) return [n];

  // Determine target number of steps (2..4) based on length
  const targetSteps = n <= 10 ? 2 : n <= 22 ? 3 : 4;

  // Score candidate split lines (1-based line count included in the chunk)
  const candidates: { lineCount: number; score: number }[] = [];
  for (let i = 2; i < n - 1; i += 1) {
    const line = lines[i - 1] ?? '';
    const next = lines[i] ?? '';
    const trimmed = line.trim();
    const nextTrim = next.trim();
    let score = 0;

    if (trimmed === '') score += 6;
    if (trimmed === '}' || trimmed === '};') score += 5;
    if (/^(public|private|protected|static|class|interface|def|@Override)\b/.test(nextTrim)) score += 6;
    if (/^(for|while|if|try|return)\b/.test(nextTrim)) score += 4;
    if (nextTrim.startsWith('//') || nextTrim.startsWith('#')) score += 4;
    if (trimmed.endsWith(';')) score += 2;

    if (score > 0) {
      candidates.push({ lineCount: i, score });
    }
  }

  const chosen: number[] = [];
  for (let step = 1; step < targetSteps; step += 1) {
    const ideal = Math.round((n * step) / targetSteps);
    const minPos = (chosen[chosen.length - 1] ?? 0) + 2;
    const maxPos = n - (targetSteps - step) * 2;
    if (minPos > maxPos) break;

    let bestPos = Math.max(minPos, Math.min(maxPos, ideal));
    let bestMetric = -Infinity;

    for (const c of candidates) {
      if (c.lineCount < minPos || c.lineCount > maxPos) continue;
      const dist = Math.abs(c.lineCount - ideal);
      const metric = c.score * 2 - dist;
      if (metric > bestMetric) {
        bestMetric = metric;
        bestPos = c.lineCount;
      }
    }
    chosen.push(bestPos);
  }

  chosen.push(n);
  return chosen;
}

/**
 * Splits a code listing into progressive, cumulative pedagogical steps
 * so learners watch the implementation grow step-by-step with line highlights.
 */
export function buildCodeWalkthrough(
  code: string,
  language = 'java',
  title = 'Hướng dẫn xây dựng code từng bước',
  id = 'walkthrough-1',
): CodeWalkthrough {
  const normalized = code.replace(/\r\n/g, '\n').trimEnd();
  const lines = normalized.split('\n');
  const breakPoints = findNaturalBreakPoints(lines);

  const segments: SegmentInfo[] = [];
  let prevEnd = 0;
  for (let idx = 0; idx < breakPoints.length; idx += 1) {
    const endLine = breakPoints[idx]!;
    const startLine = prevEnd + 1;
    const chunkText = lines.slice(prevEnd, endLine).join('\n');
    const info = classifyChunk(chunkText, idx, breakPoints.length, language);
    segments.push({
      startLine,
      endLine,
      title: info.title,
      explanation: info.explanation,
    });
    prevEnd = endLine;
  }

  const steps: CodeWalkthroughStep[] = segments.map((seg, idx) => {
    const cumulativeLines = lines.slice(0, seg.endLine);
    const highlightLines: number[] = [];
    for (let ln = seg.startLine; ln <= seg.endLine; ln += 1) {
      if ((lines[ln - 1] ?? '').trim().length > 0) {
        highlightLines.push(ln);
      }
    }
    return {
      id: `${id}-step-${idx + 1}`,
      title: `Bước ${idx + 1}: ${seg.title}`,
      explanation: seg.explanation,
      code: cumulativeLines.join('\n'),
      highlightLines,
      ...(idx < segments.length - 1
        ? { note: `Đang hiển thị ${seg.endLine}/${lines.length} dòng đầu tiên — bấm “Bước tiếp theo” để lắp tiếp phần sau.` }
        : { note: `Hoàn thiện trọn vẹn ${lines.length}/${lines.length} dòng code.` }),
    };
  });

  return {
    id,
    title,
    language,
    fullCode: normalized,
    steps,
  };
}
