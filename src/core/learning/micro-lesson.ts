import type {
  MicroLessonCard,
  MicroLessonCardRole,
  MicroSelfCheck,
  ParsedMicroLesson,
} from '../../domain/micro-lesson';
import { normalizeVietnamese } from '../courses/search';
import { slugifyHeading } from './outline';

const LONG_SECTION_CHAR_LIMIT = 1500;

export function isDeepDiveHeading(label: string): boolean {
  const norm = normalizeVietnamese(label);
  return (
    norm.includes('do phuc tap') ||
    norm.includes('mo rong') ||
    norm.includes('so sanh') ||
    norm.includes('chung minh') ||
    norm.includes('bo tro') ||
    norm.includes('nang cao')
  );
}

export function classifyCardRole(label: string, isDeep: boolean): MicroLessonCardRole | undefined {
  if (isDeep) return 'deep-dive';
  const norm = normalizeVietnamese(label);
  if (
    norm.includes('huong dan code') ||
    norm.includes('cai dat') ||
    norm.includes('code tung buoc')
  ) {
    return 'code';
  }
  if (
    norm.includes('giai thich') ||
    norm.includes('mo phong') ||
    norm.includes('y tuong') ||
    norm.includes('hoat anh') ||
    norm.includes('vi du chay tay')
  ) {
    return 'explain';
  }
  if (
    norm.includes('gioi thieu') ||
    norm.includes('vi sao can') ||
    norm.includes('bai toan') ||
    norm.includes('mo dau')
  ) {
    return 'intro';
  }
  if (norm.includes('tu kiem tra') || norm.includes('luyen tap') || norm.includes('loi thuong gap')) {
    return 'practice';
  }
  return undefined;
}

interface RawSection {
  readonly title: string;
  readonly lines: readonly string[];
}

function isAnswerSubheading(label: string): boolean {
  const norm = normalizeVietnamese(label).trim();
  return norm === 'dap so' || norm === 'loi giai' || norm.startsWith('dap so ') || norm.startsWith('loi giai ');
}

function splitByH3IfNeeded(sectionTitle: string, lines: readonly string[]): readonly RawSection[] {
  const rawText = lines.join('\n');
  const subSections: { title: string; isAnswer: boolean; lines: string[] }[] = [];
  let introLines: string[] = [];
  let currentSub: { title: string; isAnswer: boolean; lines: string[] } | null = null;
  let inCode = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCode = !inCode;
    }
    if (!inCode) {
      const h3Match = /^###\s+(.+?)\s*#*$/.exec(trimmed);
      if (h3Match?.[1]) {
        if (currentSub) subSections.push(currentSub);
        const subLabel = h3Match[1].trim();
        currentSub = {
          title: subLabel,
          isAnswer: isAnswerSubheading(subLabel),
          lines: [],
        };
        continue;
      }
    }
    if (currentSub) {
      currentSub.lines.push(line);
    } else {
      introLines.push(line);
    }
  }
  if (currentSub) subSections.push(currentSub);

  const nonAnswerSubs = subSections.filter(s => !s.isAnswer);
  if (rawText.length <= LONG_SECTION_CHAR_LIMIT || nonAnswerSubs.length < 2) {
    return [{ title: sectionTitle, lines }];
  }

  const out: RawSection[] = [];
  if (introLines.some(l => l.trim().length > 0)) {
    out.push({ title: sectionTitle, lines: introLines });
  }

  for (let idx = 0; idx < subSections.length; idx += 1) {
    const sub = subSections[idx]!;
    if (sub.isAnswer && out.length > 0) {
      const prev = out[out.length - 1]!;
      out[out.length - 1] = {
        title: prev.title,
        lines: [...prev.lines, `### ${sub.title}`, ...sub.lines],
      };
    } else {
      out.push({
        title: `${sectionTitle} · ${sub.title}`,
        lines: sub.lines,
      });
    }
  }

  return out;
}

function extractCardSelfChecks(
  lines: readonly string[],
  cardPrefix: string,
): {
  readonly bodyMarkdown: string;
  readonly selfChecks: readonly MicroSelfCheck[];
} {
  const selfChecks: MicroSelfCheck[] = [];
  const keptLines: string[] = [];
  let inCode = false;
  let idx = 0;
  let checkSeq = 1;

  while (idx < lines.length) {
    const line = lines[idx]!;
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCode = !inCode;
      keptLines.push(line);
      idx += 1;
      continue;
    }

    if (!inCode) {
      // Pattern B: ### Đáp số / ### Lời giải subsection
      const h3Match = /^###\s+(.+?)\s*#*$/.exec(trimmed);
      if (h3Match?.[1] && isAnswerSubheading(h3Match[1])) {
        idx += 1;
        const answerLines: string[] = [];
        let subCode = false;
        while (idx < lines.length) {
          const nextLine = lines[idx]!;
          const nextTrim = nextLine.trim();
          if (nextTrim.startsWith('```')) subCode = !subCode;
          if (!subCode && /^#{2,3}\s+/.test(nextTrim)) break;
          answerLines.push(nextLine);
          idx += 1;
        }
        const answerMarkdown = answerLines.join('\n').trim();
        if (answerMarkdown) {
          selfChecks.push({
            id: `${cardPrefix}-sc-${checkSeq++}`,
            promptMarkdown: 'Hãy tự phác thảo hướng giải trước khi mở đối chiếu kết quả.',
            answerMarkdown,
          });
        }
        continue;
      }

      // Pattern A: > **Đáp án** or > **Đáp số** blockquote
      if (/^>\s*\*\*(?:Đáp án|Đáp số)\*\*/i.test(trimmed)) {
        // Pop trailing blank lines and then the immediately preceding prompt paragraph
        while (keptLines.length > 0 && keptLines[keptLines.length - 1]?.trim() === '') {
          keptLines.pop();
        }
        const promptLines: string[] = [];
        while (keptLines.length > 0) {
          const candidate = keptLines[keptLines.length - 1]!;
          const cTrim = candidate.trim();
          if (cTrim === '' || cTrim.startsWith('#') || cTrim.startsWith('```') || cTrim.startsWith('>')) {
            break;
          }
          promptLines.unshift(keptLines.pop()!);
        }

        const firstHeaderStripped = trimmed
          .replace(/^>\s*\*\*(?:Đáp án|Đáp số)\*\*[:：.\s-]*/i, '')
          .trim();
        const answerLines: string[] = firstHeaderStripped ? [firstHeaderStripped] : [];
        idx += 1;
        while (idx < lines.length) {
          const nextLine = lines[idx]!;
          const nextTrim = nextLine.trim();
          if (!nextTrim.startsWith('>')) break;
          answerLines.push(nextLine.replace(/^\s*>\s?/, ''));
          idx += 1;
        }

        const promptMarkdown =
          promptLines.join('\n').trim() || 'Tự nhẩm câu trả lời trước khi mở đáp án.';
        const answerMarkdown = answerLines.join('\n').trim();
        if (answerMarkdown) {
          selfChecks.push({
            id: `${cardPrefix}-sc-${checkSeq++}`,
            promptMarkdown,
            answerMarkdown,
          });
        }
        continue;
      }
    }

    keptLines.push(line);
    idx += 1;
  }

  return {
    bodyMarkdown: keptLines.join('\n').trim(),
    selfChecks,
  };
}

export function parseMicroLesson(markdown: string): ParsedMicroLesson {
  const lines = markdown.split(/\r?\n/);
  let title = 'Bài học';
  let attributionFooter: string | undefined;

  // Strip trailing `---` + 1..2 line provenance/attribution footer outside code fences
  let lastNonEmpty = lines.length - 1;
  while (lastNonEmpty >= 0 && lines[lastNonEmpty]?.trim() === '') {
    lastNonEmpty -= 1;
  }
  if (lastNonEmpty >= 2) {
    for (let k = lastNonEmpty - 1; k >= Math.max(0, lastNonEmpty - 3); k -= 1) {
      if (/^-{3,}\s*$/.test(lines[k]?.trim() ?? '')) {
        const footerCandidate = lines.slice(k + 1, lastNonEmpty + 1).join('\n').trim();
        if (footerCandidate && !footerCandidate.startsWith('#')) {
          attributionFooter = footerCandidate;
          lines.splice(k, lines.length - k);
        }
        break;
      }
    }
  }

  const h2Sections: RawSection[] = [];
  const leadLines: string[] = [];
  let currentH2: { title: string; lines: string[] } | null = null;
  let inCodeFence = false;
  let foundH1 = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence) {
      if (!foundH1 && /^#\s+/.test(trimmed)) {
        title = trimmed.replace(/^#\s+/, '').replace(/\s*#+\s*$/, '').trim() || 'Bài học';
        foundH1 = true;
        continue;
      }

      const h2Match = /^##\s+(.+?)\s*#*$/.exec(trimmed);
      if (h2Match?.[1]) {
        if (currentH2) h2Sections.push(currentH2);
        currentH2 = { title: h2Match[1].trim(), lines: [] };
        continue;
      }
    }

    if (currentH2) {
      currentH2.lines.push(line);
    } else {
      leadLines.push(line);
    }
  }
  if (currentH2) h2Sections.push(currentH2);

  const expandedSections: RawSection[] = [];
  const hasLead = leadLines.some(l => l.trim().length > 0);

  if (h2Sections.length === 0) {
    expandedSections.push({
      title: title || 'Nội dung chính',
      lines: leadLines,
    });
  } else {
    if (hasLead) {
      expandedSections.push({
        title: 'Mở đầu',
        lines: leadLines,
      });
    }
    for (const sec of h2Sections) {
      expandedSections.push(...splitByH3IfNeeded(sec.title, sec.lines));
    }
  }

  const headingCounts = new Map<string, number>();
  const cards: MicroLessonCard[] = [];

  for (const sec of expandedSections) {
    const cardIdx = cards.length;
    const cardId = `card-${cardIdx + 1}`;
    const baseHeading = slugifyHeading(sec.title);
    const seen = headingCounts.get(baseHeading) ?? 0;
    headingCounts.set(baseHeading, seen + 1);
    const headingId = seen === 0 ? baseHeading : `${baseHeading}-${seen + 1}`;

    const { bodyMarkdown, selfChecks } = extractCardSelfChecks(sec.lines, cardId);
    if (!bodyMarkdown && selfChecks.length === 0) continue;

    const deep = isDeepDiveHeading(sec.title);
    const role = classifyCardRole(sec.title, deep);
    cards.push({
      id: cardId,
      index: cardIdx,
      headingId,
      title: sec.title,
      bodyMarkdown,
      ...(deep ? { deepDiveTitle: sec.title, deepDiveMarkdown: bodyMarkdown } : {}),
      selfChecks,
      isDeepDiveCard: deep,
      ...(role ? { role } : {}),
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: 'card-1',
      index: 0,
      headingId: slugifyHeading(title),
      title,
      bodyMarkdown: '',
      selfChecks: [],
      isDeepDiveCard: false,
    });
  }

  return {
    title,
    cards,
    ...(attributionFooter !== undefined ? { attributionFooter } : {}),
  };
}
