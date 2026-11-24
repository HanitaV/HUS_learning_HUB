import type {
  CoachingPromptMode,
  CourseConventionCanon,
  CurriculumChunk,
  CurriculumHorizon,
  CurriculumSearchHit,
  GroundedEssayContextPacket,
  SyllabusRelation,
} from '../../domain/curriculum-tutor';
import type { Course, EntityId, Lesson } from '../../domain/learning';
import type {
  SemiEssayExercise,
  TheoryAnchor,
  WrittenReasoningStep,
  WrittenStepDraft,
} from '../../domain/semi-essay';
import type { LearningContent } from '../../domain/workspace';
import { normalizeVietnamese } from '../courses/search';
import { buildLessonGraph } from './graph';
import { parseMicroLesson } from './micro-lesson';

const VIETNAMESE_STOPWORDS: ReadonlySet<string> = new Set([
  'va',
  'cua',
  'cho',
  'trong',
  'voi',
  'cac',
  'mot',
  'nhung',
  'duoc',
  'khi',
  'thi',
  'la',
  'co',
  'tu',
  'den',
  'theo',
  'hay',
  'neu',
  've',
  'tai',
  'tren',
  'duoi',
  'nay',
  'do',
]);

/**
 * Dual-stream academic tokenizer:
 * 1. Accent-normalized Vietnamese keywords (>= 2 chars, stopwords filtered).
 * 2. Exact LaTeX commands (\sup, \inf, \varepsilon, \Delta, \ln) & code/math symbols (super, static, O(n), N*).
 */
export function tokenizeAcademicText(raw: string): readonly string[] {
  if (!raw.trim()) return [];
  const tokens: string[] = [];

  // Stream 1: LaTeX commands like \sup, \inf, \frac, \Delta, \sigma
  const latexMatches = raw.match(/\\[a-zA-Z]{2,}/g) ?? [];
  for (const cmd of latexMatches) {
    tokens.push(cmd.toLowerCase());
  }

  // Stream 2: Special academic notations like N*, O(n), ΔU, ΔG, ΔH, ΔS, p.show, super
  const symbolMatches = raw.match(/(?:\bN\*|\bO\([^)]+\)|Δ[A-Za-z]+|\b[A-Za-z_][A-Za-z0-9_]*\(\))/g) ?? [];
  for (const sym of symbolMatches) {
    tokens.push(sym.toLowerCase().replace(/\s+/g, ''));
  }

  // Stream 3: Accent-normalized Vietnamese & English words
  const normalized = normalizeVietnamese(
    raw
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[$`{}[\]().,;:!?/\\|<>=+~^"-]+/g, ' '),
  );
  for (const word of normalized.split(/\s+/)) {
    if (word.length < 2) continue;
    if (VIETNAMESE_STOPWORDS.has(word)) continue;
    tokens.push(word);
  }

  return tokens;
}

export function extractLatexFormulas(markdown: string): readonly string[] {
  const formulas: string[] = [];
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null = blockRegex.exec(markdown);
  while (match) {
    const clean = match[1]?.trim();
    if (clean && clean.length <= 260 && !formulas.includes(clean)) {
      formulas.push(clean);
    }
    match = blockRegex.exec(markdown);
  }

  if (formulas.length < 4) {
    const inlineRegex = /(?<!\$)\$(?!\$)([^\n$]{2,140}?)\$(?!\$)/g;
    let inlineMatch: RegExpExecArray | null = inlineRegex.exec(markdown);
    while (inlineMatch && formulas.length < 6) {
      const clean = inlineMatch[1]?.trim();
      if (clean && !formulas.includes(clean)) {
        formulas.push(clean);
      }
      inlineMatch = inlineRegex.exec(markdown);
    }
  }
  return formulas;
}

function formatChapterHeading(title: string, zeroBasedIndex: number): string {
  if (/^chương\s+\d+/i.test(title.trim())) {
    return title.trim();
  }
  return `Chương ${zeroBasedIndex + 1}: ${title.trim()}`;
}

export function buildCurriculumHorizon(
  course: Course,
  content: LearningContent,
  targetLessonId: EntityId,
): CurriculumHorizon | undefined {
  const graph = buildLessonGraph(course, content);
  const targetNode = graph.nodes.find(n => n.id === targetLessonId);
  if (!targetNode) return undefined;

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  const directPrerequisiteLessons = targetNode.directPrereqIds
    .map(id => nodeById.get(id))
    .filter((n): n is NonNullable<typeof n> => n !== undefined)
    .map(n => ({
      id: n.lesson.id,
      title: n.lesson.title,
      chapterTitle: n.chapter.title,
    }));

  const chapters = course.chapterIds
    .map(id => content.chapters.find(ch => ch.id === id))
    .filter((ch): ch is NonNullable<typeof ch> => ch !== undefined);

  const earlierChapterTitles = chapters
    .slice(0, targetNode.chapterIndex)
    .map((ch, idx) => formatChapterHeading(ch.title, idx));

  const unlearnedChapterTitles = chapters
    .slice(targetNode.chapterIndex + 1)
    .map((ch, idx) => formatChapterHeading(ch.title, targetNode.chapterIndex + idx + 1));

  return {
    courseId: course.id,
    academicCode: course.academicCode ?? course.id.toUpperCase(),
    currentChapterId: targetNode.chapter.id,
    currentChapterTitle: formatChapterHeading(targetNode.chapter.title, targetNode.chapterIndex),
    currentChapterNumber: targetNode.chapterIndex + 1,
    currentLessonId: targetNode.lesson.id,
    currentLessonTitle: targetNode.lesson.title,
    directPrerequisiteLessons,
    earlierChapterTitles,
    unlearnedChapterTitles,
  };
}

export function classifyLessonRelation(
  course: Course,
  content: LearningContent,
  targetLessonId: EntityId,
  candidateLessonId: EntityId,
): SyllabusRelation {
  if (candidateLessonId === targetLessonId) return 'current-lesson';
  const graph = buildLessonGraph(course, content);
  const targetNode = graph.nodes.find(n => n.id === targetLessonId);
  const candidateNode = graph.nodes.find(n => n.id === candidateLessonId);
  if (!targetNode || !candidateNode) return 'earlier-syllabus';

  if (targetNode.directPrereqIds.includes(candidateLessonId)) {
    return 'direct-prerequisite';
  }
  if (targetNode.ancestorIds.includes(candidateLessonId)) {
    return 'earlier-syllabus';
  }
  if (targetNode.descendantIds.includes(candidateLessonId)) {
    return 'later-syllabus';
  }
  if (candidateNode.chapterIndex < targetNode.chapterIndex) {
    return 'earlier-syllabus';
  }
  if (
    candidateNode.chapterIndex === targetNode.chapterIndex &&
    candidateNode.lessonIndexInChapter <= targetNode.lessonIndexInChapter
  ) {
    return 'earlier-syllabus';
  }
  return 'later-syllabus';
}

export function indexLessonMarkdownChunks(params: {
  readonly course: Course;
  readonly content: LearningContent;
  readonly targetLessonId: EntityId;
  readonly markdownByLessonId: Readonly<Record<string, string>>;
}): readonly CurriculumChunk[] {
  const { course, content, targetLessonId, markdownByLessonId } = params;
  const graph = buildLessonGraph(course, content);
  const chunks: CurriculumChunk[] = [];

  for (const node of graph.nodes) {
    const rawMd = markdownByLessonId[node.lesson.id];
    if (!rawMd) continue;

    const relation = classifyLessonRelation(course, content, targetLessonId, node.lesson.id);
    const parsed = parseMicroLesson(rawMd);

    for (const card of parsed.cards) {
      const cleanBody = card.bodyMarkdown.trim();
      if (!cleanBody) continue;
      chunks.push({
        id: `${node.lesson.id}#${card.headingId}`,
        courseId: course.id,
        chapterId: node.chapter.id,
        chapterTitle: node.chapter.title,
        chapterIndex: node.chapterIndex,
        lessonId: node.lesson.id,
        lessonTitle: node.lesson.title,
        headingId: card.headingId,
        sectionTitle: card.title,
        role: card.role,
        bodyMarkdown: cleanBody,
        formulas: extractLatexFormulas(cleanBody),
        relationToTarget: relation,
        provenance: node.lesson.provenance ?? course.provenance,
      });
    }
  }

  return chunks;
}

const RELATION_BOOST: Readonly<Record<SyllabusRelation, number>> = {
  'current-lesson': 1.55,
  'direct-prerequisite': 1.28,
  'earlier-syllabus': 1.0,
  'later-syllabus': 0.35,
};

/**
 * Deterministic Okapi BM25 + Graph-Proximity Retriever over heading-chunked HUS lessons.
 * Defaults to excluding `'later-syllabus'` chunks so Gemini never pulls unlearned theorems.
 */
export function searchCurriculumChunks(
  chunks: readonly CurriculumChunk[],
  query: string,
  options?: {
    readonly limit?: number | undefined;
    readonly allowFutureChapters?: boolean | undefined;
    readonly preferredHeadingIds?: readonly string[] | undefined;
  },
): readonly CurriculumSearchHit[] {
  const limit = Math.max(1, Math.min(12, options?.limit ?? 4));
  const allowFuture = options?.allowFutureChapters ?? false;
  const preferredHeadings = new Set(options?.preferredHeadingIds ?? []);

  const pool = allowFuture
    ? chunks
    : chunks.filter(chunk => chunk.relationToTarget !== 'later-syllabus');

  if (pool.length === 0) return [];

  const queryTokens = [...new Set(tokenizeAcademicText(query))];
  if (queryTokens.length === 0) {
    return pool.slice(0, limit).map(chunk => ({
      chunk,
      score: RELATION_BOOST[chunk.relationToTarget],
      matchedTerms: [],
    }));
  }

  const tokenizedDocs = pool.map(chunk => {
    const titleTokens = tokenizeAcademicText(`${chunk.lessonTitle} ${chunk.sectionTitle}`);
    const formulaTokens = tokenizeAcademicText(chunk.formulas.join(' '));
    const bodyTokens = tokenizeAcademicText(chunk.bodyMarkdown);
    // Fielded token repetition: title x3, formula x2, body x1
    const weightedTokens = [
      ...titleTokens,
      ...titleTokens,
      ...titleTokens,
      ...formulaTokens,
      ...formulaTokens,
      ...bodyTokens,
    ];
    const freq = new Map<string, number>();
    for (const tok of weightedTokens) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    return { chunk, freq, docLen: weightedTokens.length || 1 };
  });

  const avgDocLen =
    tokenizedDocs.reduce((sum, doc) => sum + doc.docLen, 0) / tokenizedDocs.length || 1;
  const docCount = tokenizedDocs.length;

  const df = new Map<string, number>();
  for (const qTok of queryTokens) {
    let count = 0;
    for (const doc of tokenizedDocs) {
      if (doc.freq.has(qTok)) count += 1;
    }
    df.set(qTok, count);
  }

  const k1 = 1.2;
  const b = 0.75;
  const scored: CurriculumSearchHit[] = [];

  for (const doc of tokenizedDocs) {
    let bm25 = 0;
    const matchedTerms: string[] = [];

    for (const qTok of queryTokens) {
      const tf = doc.freq.get(qTok) ?? 0;
      if (tf === 0) continue;
      matchedTerms.push(qTok);
      const n = df.get(qTok) ?? 0;
      const idf = Math.log(1 + (docCount - n + 0.5) / (n + 0.5));
      const normTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.docLen / avgDocLen)));
      bm25 += idf * normTf;
    }

    const headingBonus = preferredHeadings.has(doc.chunk.headingId) ? 2.5 : 0;
    const roleBonus =
      doc.chunk.role === 'intro' || doc.chunk.role === 'explain'
        ? 1.15
        : doc.chunk.role === 'practice'
          ? 0.9
          : 1.0;

    const rawScore = (bm25 + headingBonus) * RELATION_BOOST[doc.chunk.relationToTarget] * roleBonus;
    if (rawScore > 0) {
      scored.push({
        chunk: doc.chunk,
        score: Number(rawScore.toFixed(4)),
        matchedTerms,
      });
    }
  }

  if (scored.length === 0) {
    // Fallback to foundational intro/explain cards of the current lesson
    return pool
      .filter(c => c.relationToTarget === 'current-lesson')
      .slice(0, limit)
      .map(chunk => ({ chunk, score: 0.5, matchedTerms: [] }));
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function summarizeChunkForRail(markdown: string, maxChars = 340): string {
  const lines = markdown
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('```'));
  const joined = lines.slice(0, 4).join(' ');
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars).trimEnd()}…`;
}

function extractBulletConditions(markdown: string): readonly string[] {
  const bullets: string[] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      const item = trimmed.replace(/^[-*]\s+/, '').trim();
      if (item.length >= 8 && item.length <= 180) {
        bullets.push(item);
      }
    }
    if (bullets.length >= 3) break;
  }
  return bullets;
}

/**
 * Automatically populates `TheoryAnchor`s from verified lesson chunks whenever an exercise
 * (such as `written-practice.ts` across all 8 courses) has `exercise.theoryAnchors === []`.
 */
export function synthesizeFallbackTheoryAnchors(
  chunks: readonly CurriculumChunk[],
  exercise: SemiEssayExercise,
  activeStepIndex: number,
  maxAnchors = 3,
): {
  readonly anchors: readonly TheoryAnchor[];
  readonly activeAnchorIds: readonly string[];
} {
  if (exercise.theoryAnchors.length > 0) {
    const step = exercise.steps[activeStepIndex] ?? exercise.steps[0];
    return {
      anchors: exercise.theoryAnchors,
      activeAnchorIds: step?.theoryAnchorIds ?? [],
    };
  }

  const activeStep = exercise.steps[activeStepIndex] ?? exercise.steps[0];
  const query = [
    exercise.title,
    exercise.prompt,
    activeStep?.title ?? '',
    activeStep?.prompt ?? '',
  ].join(' ');

  const hits = searchCurriculumChunks(chunks, query, { limit: maxAnchors });
  const anchors: TheoryAnchor[] = hits.map((hit, idx) => ({
    id: `rag-anchor-${idx + 1}-${hit.chunk.headingId}`,
    title:
      hit.chunk.relationToTarget === 'current-lesson'
        ? hit.chunk.sectionTitle
        : `${hit.chunk.lessonTitle} · ${hit.chunk.sectionTitle}`,
    ...(hit.chunk.formulas[0] ? { formula: hit.chunk.formulas[0] } : {}),
    summary: summarizeChunkForRail(hit.chunk.bodyMarkdown),
    conditions: extractBulletConditions(hit.chunk.bodyMarkdown),
    lessonHeadingId: hit.chunk.headingId,
  }));

  return {
    anchors,
    activeAnchorIds: anchors.slice(0, 2).map(a => a.id),
  };
}

function truncateExcerpt(markdown: string, maxLength = 900): string {
  if (markdown.length <= maxLength) return markdown;
  return `${markdown.slice(0, maxLength).trimEnd()}\n… [Đã rút gọn]`;
}

export function buildGroundedEssayContextPacket(params: {
  readonly mode: CoachingPromptMode;
  readonly canon: CourseConventionCanon;
  readonly horizon?: CurriculumHorizon | undefined;
  readonly exercise: SemiEssayExercise;
  readonly step: WrittenReasoningStep;
  readonly stepNumber: number;
  readonly draft: WrittenStepDraft;
  readonly chunks: readonly CurriculumChunk[];
  readonly effectiveTheoryAnchors: readonly TheoryAnchor[];
  readonly nowIso?: string | undefined;
}): GroundedEssayContextPacket {
  const {
    mode,
    canon,
    horizon,
    exercise,
    step,
    stepNumber,
    draft,
    chunks,
    effectiveTheoryAnchors,
  } = params;

  const searchQuery = [
    exercise.title,
    exercise.prompt,
    step.title,
    step.prompt,
    ...step.rubric.map(r => r.prompt),
    draft.response,
  ].join(' ');

  const preferredHeadingIds = effectiveTheoryAnchors
    .map(a => a.lessonHeadingId)
    .filter((id): id is string => Boolean(id));

  const hits = searchCurriculumChunks(chunks, searchQuery, {
    limit: 4,
    allowFutureChapters: false,
    preferredHeadingIds,
  });

  const allHints = [...(step.hint ? [step.hint] : []), ...(step.hints ?? [])];

  const pedagogicalContract =
    mode === 'socratic-hint' || !draft.modelRevealed
      ? [
          'Đóng vai Trợ giảng Socratic của Trường ĐHKHTN – ĐHQGHN (VNU-HUS).',
          'CHỈ sử dụng khái niệm, định lý, ký hiệu thuộc bài học hiện tại và các bài tiên quyết đã liệt kê; TUYỆT ĐỐI KHÔNG dùng công cụ thuộc các chương chưa học.',
          'KHÔNG viết hộ lời giải hoàn chỉnh và KHÔNG tiết lộ kết quả cuối cùng thay sinh viên.',
          'Đối chiếu bài nháp của sinh viên với từng tiêu chí trong rubricCriteria để đặt 1–3 câu hỏi gợi mở đúng chỗ đang thiếu hoặc nhầm điều kiện.',
        ]
      : [
          'Đóng vai Trợ giảng Đối chiếu Tự luận của Trường ĐHKHTN – ĐHQGHN (VNU-HUS).',
          'Sinh viên đã mở lời giải tham khảo và đang ở bước tự đối chiếu & sửa bài.',
          'Hãy đối chiếu chi tiết bài nháp / bản sửa của sinh viên với từng tiêu chí rubricCriteria, chỉ rõ ý đã đạt, ý còn thiếu điều kiện chặt chẽ hoặc lệch ký hiệu giáo trình.',
        ];

  return {
    schemaVersion: 1,
    generatedAt: params.nowIso ?? new Date().toISOString(),
    mode,
    course: {
      id: canon.courseId,
      code: canon.academicCode,
      title: canon.courseTitle,
      notationRules: canon.notationRules,
      forbiddenShortcutHints: canon.forbiddenShortcutHints,
    },
    syllabusHorizon: {
      currentChapter: horizon ? horizon.currentChapterTitle : canon.courseTitle,
      currentLesson: horizon?.currentLessonTitle ?? exercise.lessonId,
      allowedPrerequisites:
        horizon?.directPrerequisiteLessons.map(p => `${p.title} (${p.chapterTitle})`) ?? [],
      unlearnedChaptersDoNotUse: horizon?.unlearnedChapterTitles ?? [],
    },
    exercise: {
      id: exercise.id,
      title: exercise.title,
      problemPrompt: exercise.prompt,
      given: exercise.given,
      theoryAnchors: effectiveTheoryAnchors,
    },
    activeStep: {
      id: step.id,
      stepNumber,
      totalSteps: exercise.steps.length,
      title: step.title,
      prompt: step.prompt,
      rubricCriteria: step.rubric,
      hints: allHints,
      studentDraft: draft.response,
      studentRevision: draft.revision,
      modelRevealed: draft.modelRevealed,
      ...(draft.modelRevealed ? { referenceModelAnswer: step.modelAnswer } : {}),
    },
    groundedExcerpts: hits.map(hit => ({
      citationLabel: `[${canon.academicCode} · ${hit.chunk.lessonTitle} § ${hit.chunk.sectionTitle}]`,
      lessonId: hit.chunk.lessonId,
      sectionTitle: hit.chunk.sectionTitle,
      relation: hit.chunk.relationToTarget,
      excerptMarkdown: truncateExcerpt(hit.chunk.bodyMarkdown),
    })),
    pedagogicalContract,
  };
}

/**
 * Formats a human-readable + machine-roundtrippable prompt packet for Chrome's "Ask Gemini"
 * side panel (works both with WebMCP enabled and on standard browsers via 1-click JSON paste-back).
 */
export function formatAskGeminiPromptPacket(
  packet: GroundedEssayContextPacket,
  options?: { readonly webMcpAvailable?: boolean | undefined },
): string {
  if (options?.webMcpAvailable) {
    return [
      `Hãy đóng vai Trợ giảng Socratic học phần ${packet.course.code} (${packet.course.title}) của ĐHKHTN.`,
      `1. Gọi công cụ WebMCP \`hus_get_essay_context\` trên trang này để đọc đề bài, thang tiêu chí rubric, trích đoạn giáo trình chuẩn và bài nháp hiện tại ở Bước ${packet.activeStep.stepNumber} (${packet.activeStep.id}).`,
      `2. Nếu cần tra cứu thêm định nghĩa/định lý tiên quyết, gọi \`hus_search_curriculum\`.`,
      `3. Không giải hộ trọn bài; hãy gửi kết quả đối chiếu và câu hỏi gợi mở về giao diện trang qua công cụ \`hus_submit_essay_coaching\`.`,
    ].join('\n');
  }

  const excerptsBlock =
    packet.groundedExcerpts.length > 0
      ? packet.groundedExcerpts
          .map(ex => `### ${ex.citationLabel}\n${ex.excerptMarkdown}`)
          .join('\n\n')
      : '*(Chưa có trích đoạn bổ sung — bám sát đề bài và quy ước học phần bên trên)*';

  const criteriaLines = packet.activeStep.rubricCriteria
    .map(c => `- \`${c.id}\`: ${c.prompt}`)
    .join('\n');

  const unlearnedLine =
    packet.syllabusHorizon.unlearnedChaptersDoNotUse.length > 0
      ? packet.syllabusHorizon.unlearnedChaptersDoNotUse.join('; ')
      : 'Không có';

  return [
    `# Yêu cầu Trợ giảng Socratic bám sát Giáo trình ĐHKHTN (${packet.course.code} — ${packet.course.title})`,
    '',
    '## 1. Nguyên tắc bắt buộc',
    ...packet.pedagogicalContract.map(rule => `- ${rule}`),
    ...packet.course.notationRules.map(rule => `- Quy ước ký hiệu: ${rule}`),
    ...packet.course.forbiddenShortcutHints.map(rule => `- Lưu ý tránh giải tắt: ${rule}`),
    `- Bài đang học: **${packet.syllabusHorizon.currentLesson}** (${packet.syllabusHorizon.currentChapter})`,
    `- Các chương CHƯA HỌC (không dùng để giải): ${unlearnedLine}`,
    '',
    '## 2. Đề bài & Yêu cầu bước hiện tại',
    `- **Bài tập:** ${packet.exercise.title}`,
    `- **Đề bài chung:** ${packet.exercise.problemPrompt}`,
    `- **Bước ${packet.activeStep.stepNumber}/${packet.activeStep.totalSteps} (` +
      `\`${packet.activeStep.id}\`):** ${packet.activeStep.title}`,
    `- **Yêu cầu bước này:** ${packet.activeStep.prompt}`,
    '',
    '## 3. Tiêu chí tự đối chiếu chuẩn của bước này (`rubricCriteria`)',
    criteriaLines,
    '',
    '## 4. Trích đoạn giáo trình ĐHKHTN được phép áp dụng',
    excerptsBlock,
    '',
    '## 5. Bài làm hiện tại của sinh viên',
    '```text',
    packet.activeStep.studentDraft.trim() || '(Sinh viên chưa viết nháp — hãy gợi mở cách bắt đầu dòng đầu tiên)',
    '```',
    ...(packet.activeStep.studentRevision.trim()
      ? ['**Bản sửa hiện tại:**', '```text', packet.activeStep.studentRevision.trim(), '```']
      : []),
    ...(packet.activeStep.referenceModelAnswer
      ? ['**Lời giải tham khảo (chỉ dùng để đối chiếu bản sửa):**', packet.activeStep.referenceModelAnswer]
      : []),
    '',
    '## 6. Định dạng trả lời (để nhập ngược về trang HUS Learning Hub)',
    'Sau phần giải thích ngắn gọn trên khung chat, hãy kèm **đúng 1 khối JSON** ở cuối theo mẫu sau (giữ nguyên mã `stepId` và `criterionId`):',
    '```json',
    JSON.stringify(
      {
        version: 1,
        exerciseId: packet.exercise.id,
        stepId: packet.activeStep.id,
        summary: 'Nhận xét tổng quan ngắn gọn 1–2 câu bám sát giáo trình.',
        socraticQuestions: ['Câu hỏi gợi mở 1 (có thể dùng $LaTeX$)?'],
        criterionFeedback: packet.activeStep.rubricCriteria.map(c => ({
          criterionId: c.id,
          status: 'partial',
          comment: 'Nhận xét cụ thể cho tiêu chí này.',
        })),
        conventionWarnings: [],
        citedSections: packet.groundedExcerpts.slice(0, 2).map(e => e.citationLabel),
      },
      null,
      2,
    ),
    '```',
  ].join('\n');
}

export function composeExamReadyEssay(
  exercise: SemiEssayExercise,
  drafts: Readonly<Record<string, WrittenStepDraft>>,
  completedStepIds: ReadonlySet<string>,
): string {
  const lines: string[] = [
    `# ${exercise.title}`,
    '',
    `**Đề bài:** ${exercise.prompt}`,
    '',
    '## Bài trình bày tự luận',
    '',
  ];

  exercise.steps.forEach((step, idx) => {
    if (!completedStepIds.has(step.id)) return;
    lines.push(`### Bước ${idx + 1}. ${step.title}`);
    if (step.kind === 'written-reasoning') {
      const draft = drafts[step.id];
      const text = draft?.revision.trim() || draft?.response.trim() || step.summaryTemplate;
      lines.push(text);
    } else {
      lines.push(step.summaryTemplate);
    }
    lines.push('');
  });

  if (exercise.explanation) {
    lines.push('---');
    lines.push(`**Tổng kết:** ${exercise.explanation}`);
  }

  return lines.join('\n').trim();
}

export function buildNotebookLmCourseBundle(params: {
  readonly course: Course;
  readonly subjectTitle?: string | undefined;
  readonly canon: CourseConventionCanon;
  readonly content: LearningContent;
  readonly markdownByLessonId: Readonly<Record<string, string>>;
  readonly filterChapterId?: EntityId | undefined;
}): { readonly filename: string; readonly markdown: string; readonly lessonCount: number } {
  const { course, subjectTitle, canon, content, markdownByLessonId, filterChapterId } = params;
  const code = (course.academicCode ?? course.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const chapters = course.chapterIds
    .map(id => content.chapters.find(ch => ch.id === id))
    .filter((ch): ch is NonNullable<typeof ch> => ch !== undefined)
    .filter(ch => !filterChapterId || ch.id === filterChapterId);

  const headerLines: string[] = [
    `# Sổ tay Giáo trình Chuẩn ĐHKHTN (VNU-HUS): ${canon.academicCode} — ${course.title}`,
    '',
    `- **Mã học phần:** ${canon.academicCode} (\`${course.id}\`)`,
    ...(subjectTitle ? [`- **Nhóm ngành:** ${subjectTitle}`] : []),
    `- **Nguồn lưu trữ gốc:** \`${course.provenance.repository}\` (revision \`${course.provenance.revision}\`)`,
    `- **Mục đích sử dụng:** Tài liệu nguồn chuẩn hóa dành cho **Google NotebookLM (@Gemini Notebook)** hoặc **Gemini Gems** để tra cứu, ôn tập và hướng dẫn giải tự luận đúng phạm vi đề cương ĐHKHTN.`,
    '',
    '## Quy ước ký hiệu & Nguyên tắc trình bày bắt buộc của học phần',
    ...canon.notationRules.map(r => `- ${r}`),
    ...canon.forbiddenShortcutHints.map(r => `- **Tránh lỗi vượt chương / giải tắt:** ${r}`),
    '',
    '---',
    '',
  ];

  const bodyLines: string[] = [];
  let lessonCount = 0;

  chapters.forEach((chapter, chOffset) => {
    const originalIndex = course.chapterIds.indexOf(chapter.id);
    const chapterZeroIdx = originalIndex >= 0 ? originalIndex : chOffset;
    bodyLines.push(`# ${formatChapterHeading(chapter.title, chapterZeroIdx)}`);
    bodyLines.push('');

    for (const topicId of chapter.topicIds) {
      const topic = content.topics.find(t => t.id === topicId);
      if (!topic) continue;
      const prereqTitles = (topic.prerequisiteIds ?? [])
        .map(pid => content.topics.find(t => t.id === pid)?.title)
        .filter((t): t is string => Boolean(t));

      bodyLines.push(`## Chủ đề: ${topic.title}`);
      if (prereqTitles.length > 0) {
        bodyLines.push(`> *Kiến thức tiên quyết cần nắm trước:* ${prereqTitles.join(', ')}`);
      }
      bodyLines.push('');

      for (const lessonId of topic.lessonIds) {
        const lesson: Lesson | undefined = content.lessons.find(l => l.id === lessonId);
        const md = markdownByLessonId[lessonId];
        if (!lesson || !md) continue;
        lessonCount += 1;
        const prov = lesson.provenance ?? course.provenance;
        bodyLines.push(`### Bài học: ${lesson.title} (\`${lesson.id}\`)`);
        bodyLines.push(`*Nguồn xác minh: \`${prov.path}\` · \`${prov.repository}\`*`);
        bodyLines.push('');
        bodyLines.push(md.trim());
        bodyLines.push('');
        bodyLines.push('---');
        bodyLines.push('');
      }
    }
  });

  const suffix = filterChapterId ? `-${filterChapterId}` : '';
  return {
    filename: `${code}${suffix}-giaotrinh-notebooklm.md`,
    markdown: [...headerLines, ...bodyLines].join('\n').trim() + '\n',
    lessonCount,
  };
}
