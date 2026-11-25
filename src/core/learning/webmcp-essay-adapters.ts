import type { Che1080BankExercise } from '../../domain/che1080-bank';
import type {
  CourseConventionCanon,
  StepCoachingLifecycleState,
  TutorAssessmentVerdict,
  TutorCoachingFeedback,
  TutorCriterionFeedback,
} from '../../domain/curriculum-tutor';
import type { EntityId, Provenance } from '../../domain/learning';
import type {
  SemiEssayExercise,
  WrittenReasoningStep,
} from '../../domain/semi-essay';
import type { ClassicExerciseDefinition, ExerciseDefinition } from '../../domain/workspace';

type RubricCriterion = WrittenReasoningStep['rubric'][number];

export interface VisualChemistryStepLike {
  readonly id: string;
  readonly title: string;
  readonly ruleTip: string;
  readonly trapNote: string;
  readonly completedEssayLine: string;
  readonly interaction:
    | {
        readonly type: 'written-essay';
        readonly prompt: string;
        readonly rubric: readonly RubricCriterion[];
        readonly modelAnswer: string;
      }
    | {
        readonly type: string;
        readonly prompt: string;
      };
}

export interface VisualChemistryProblemLike {
  readonly id: string;
  readonly topicId: string;
  readonly title: string;
  readonly statement: string;
  readonly steps: readonly VisualChemistryStepLike[];
}

const CHEM_TOPIC_TO_LESSON_ID: Readonly<Record<string, EntityId>> = {
  'mo-diagram': 'gc-mo-theory',
  'vb-hybridization': 'gc-vb-theory',
  'thermo-diagram': 'gc-gibbs',
  'equil-buffer': 'gc-eq-ice-table',
  'electro-cell': 'gc-ec-nernst',
};

const CHEM_CHAPTER_TO_LESSON_ID: Readonly<Record<number, EntityId>> = {
  1: 'gc-quantum-numbers',
  2: 'gc-mo-theory',
  3: 'gc-gibbs',
  4: 'gc-eq-ice-table',
  5: 'gc-kin-first-order',
  6: 'gc-sol-buffer',
  7: 'gc-ec-nernst',
};

export function adaptVisualChemistryProblemToSemiEssay(
  problem: VisualChemistryProblemLike,
): SemiEssayExercise {
  const lessonId = CHEM_TOPIC_TO_LESSON_ID[problem.topicId] ?? 'gc-mo-theory';
  const writtenSteps: WrittenReasoningStep[] = problem.steps
    .filter(
      (
        step,
      ): step is VisualChemistryStepLike & {
        readonly interaction: {
          readonly type: 'written-essay';
          readonly prompt: string;
          readonly rubric: readonly RubricCriterion[];
          readonly modelAnswer: string;
        };
      } => step.interaction.type === 'written-essay',
    )
    .map(step => ({
      id: step.id,
      kind: 'written-reasoning',
      title: step.title,
      prompt: step.interaction.prompt,
      theoryAnchorIds: [],
      hints: [step.ruleTip, step.trapNote].filter(Boolean),
      modelAnswer: step.interaction.modelAnswer,
      rubric: step.interaction.rubric,
      summaryTemplate: step.completedEssayLine,
    }));

  return {
    id: problem.id,
    lessonId,
    kind: 'semi-essay',
    title: problem.title,
    prompt: problem.statement,
    given: [],
    theoryAnchors: [],
    steps: writtenSteps,
    provenance: {
      repository: 'https://github.com/HanitaV/Chemistry',
      revision: 'ad043333d24f67da5d11611678754397f4595e49',
      path: 'src/modules/chemistry/problems.ts',
      rights: 'approved',
    },
  };
}

function summarizeStepIntoRubricPrompt(stepText: string, index: number): string {
  const cleaned = stepText.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 160) return cleaned;
  return `Bước ${index + 1}: ${cleaned.slice(0, 150).trimEnd()}…`;
}

export function adaptChe1080BankToSemiEssay(
  exercise: Che1080BankExercise,
): SemiEssayExercise {
  const lessonId = CHEM_CHAPTER_TO_LESSON_ID[exercise.chapterNumber] ?? 'gc-quantum-numbers';
  const rubric: RubricCriterion[] =
    exercise.solutionSteps.length > 0
      ? exercise.solutionSteps.map((stepText, idx) => ({
          id: `step-${idx + 1}`,
          prompt: summarizeStepIntoRubricPrompt(stepText, idx),
        }))
      : [{ id: 'final-answer', prompt: `Trình bày lập luận và kết quả khớp ${exercise.finalAnswer}` }];

  const modelLines = [
    ...exercise.solutionSteps.map((s, idx) => `**Bước ${idx + 1}.** ${s}`),
    ...(exercise.finalAnswer ? [`\n**Đáp số chuẩn:** ${exercise.finalAnswer}`] : []),
  ];

  return {
    id: exercise.id,
    lessonId,
    kind: 'semi-essay',
    title: `${exercise.code} — ${exercise.formTitle || exercise.chapterTitle}`,
    prompt: exercise.prompt,
    given: [],
    theoryAnchors: [],
    steps: [
      {
        id: `${exercise.id}-written`,
        kind: 'written-reasoning',
        title: `Trình bày bài giải ${exercise.code}`,
        prompt: exercise.prompt,
        theoryAnchorIds: [],
        hints: exercise.note ? [exercise.note] : [],
        modelAnswer: modelLines.join('\n\n'),
        rubric,
        summaryTemplate: exercise.finalAnswer || exercise.code,
      },
    ],
    provenance: {
      repository: 'local:docs/HUS-learning-resource',
      revision: 'che1080-bank-v1',
      path: exercise.sourceFile,
      rights: 'approved',
    },
  };
}

export function mergeMetCriteriaFromFeedback(
  existingCriterionIds: readonly string[],
  feedback: TutorCoachingFeedback,
): readonly string[] {
  const merged = new Set(existingCriterionIds);
  for (const item of feedback.criterionFeedback) {
    if (item.status === 'met') {
      merged.add(item.criterionId);
    }
  }
  return [...merged];
}

/**
 * Synchronizes checked rubric criteria from the latest WebMCP / Gemini evaluation:
 * marks `'met'` criteria checked and unchecks criteria downgraded to `'partial'` or `'missing'`.
 */
export function syncCriteriaFromCoachingFeedback(
  existingCriterionIds: readonly string[],
  feedback: TutorCoachingFeedback,
): readonly string[] {
  const synced = new Set(existingCriterionIds);
  for (const item of feedback.criterionFeedback) {
    if (item.status === 'met') {
      synced.add(item.criterionId);
    } else {
      synced.delete(item.criterionId);
    }
  }
  return [...synced];
}

export const TUTOR_M1_PASS_SCORE = 7.0;
export const TUTOR_MAX_SCORE = 10;

function roundQuarter(val: number): number {
  return Math.round(val * 4) / 4;
}

export function formatScoreVi(score: number): string {
  const rounded = Math.round(score * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded},0`;
  }
  return String(rounded).replace('.', ',');
}

/**
 * Enforces Level-1 (Mức 1) university grading guardrails:
 * - Normalizes score onto a 10-point scale (0.25 increments).
 * - Blocks hallucinated passes: any `'missing'` rubric criterion or score < 7.0/10 forces `'not-pass'`
 *   and caps score below 7.0 (`<= 6.75`).
 * - Grants `'pass'` when score >= 7.0/10 and zero rubric criteria are `'missing'`.
 */
export function normalizeM1TutorGrade(params: {
  readonly rawVerdict?: unknown;
  readonly rawScore?: unknown;
  readonly rawMaxScore?: unknown;
  readonly criterionFeedback: readonly TutorCriterionFeedback[];
}): {
  readonly verdict?: TutorAssessmentVerdict | undefined;
  readonly score?: number | undefined;
  readonly maxScore?: number | undefined;
} {
  const parsedVerdictStr =
    typeof params.rawVerdict === 'string' ? params.rawVerdict.trim().toLowerCase() : '';
  const hasExplicitVerdict =
    parsedVerdictStr === 'pass' ||
    parsedVerdictStr === 'not-pass' ||
    parsedVerdictStr === 'fail';

  const numericScore =
    typeof params.rawScore === 'number'
      ? params.rawScore
      : typeof params.rawScore === 'string' && params.rawScore.trim() !== ''
        ? Number(params.rawScore.replace(',', '.'))
        : Number.NaN;
  const hasExplicitScore = Number.isFinite(numericScore);

  if (!hasExplicitVerdict && !hasExplicitScore) {
    return {};
  }

  const rawMax =
    typeof params.rawMaxScore === 'number'
      ? params.rawMaxScore
      : typeof params.rawMaxScore === 'string' && params.rawMaxScore.trim() !== ''
        ? Number(params.rawMaxScore.replace(',', '.'))
        : Number.NaN;
  const maxScore = Number.isFinite(rawMax) && rawMax > 0 && rawMax <= 100 ? rawMax : TUTOR_MAX_SCORE;

  let scoreOn10: number;
  if (hasExplicitScore) {
    const clamped = Math.max(0, Math.min(maxScore, numericScore));
    scoreOn10 = roundQuarter((clamped / maxScore) * TUTOR_MAX_SCORE);
  } else if (params.criterionFeedback.length > 0) {
    const earnedUnits = params.criterionFeedback.reduce(
      (acc, item) => acc + (item.status === 'met' ? 1 : item.status === 'partial' ? 0.5 : 0),
      0,
    );
    scoreOn10 = roundQuarter((earnedUnits / params.criterionFeedback.length) * TUTOR_MAX_SCORE);
  } else {
    scoreOn10 = parsedVerdictStr === 'pass' ? 8.0 : 4.0;
  }

  const hasMissingCriterion = params.criterionFeedback.some(item => item.status === 'missing');
  const explicitFail = parsedVerdictStr === 'not-pass' || parsedVerdictStr === 'fail';

  if (hasMissingCriterion || explicitFail || scoreOn10 < TUTOR_M1_PASS_SCORE) {
    const cappedScore =
      hasMissingCriterion || explicitFail ? Math.min(scoreOn10, 6.75) : scoreOn10;
    return {
      verdict: 'not-pass',
      score: cappedScore,
      maxScore: TUTOR_MAX_SCORE,
    };
  }

  return {
    verdict: 'pass',
    score: scoreOn10,
    maxScore: TUTOR_MAX_SCORE,
  };
}

export function didExercisePassViaTutor(
  exercise: SemiEssayExercise,
  coachingByStepId: Readonly<Record<string, TutorCoachingFeedback>>,
): boolean | null {
  const writtenSteps = exercise.steps.filter(
    (s): s is WrittenReasoningStep => s.kind === 'written-reasoning',
  );
  if (writtenSteps.length === 0) return null;

  let allPassed = true;
  for (const step of writtenSteps) {
    const fb = coachingByStepId[step.id];
    if (!fb) {
      allPassed = false;
      continue;
    }
    if (fb.verdict === 'not-pass') {
      return false;
    }
    if (fb.verdict === 'pass') {
      continue;
    }
    const statusById = new Map(fb.criterionFeedback.map(c => [c.criterionId, c.status]));
    const legacyAllMet =
      step.rubric.length > 0
        ? step.rubric.every(r => statusById.get(r.id) === 'met')
        : fb.criterionFeedback.length > 0 && fb.criterionFeedback.every(c => c.status === 'met');
    if (!legacyAllMet) {
      allPassed = false;
    }
  }

  return allPassed ? true : null;
}

export interface StepCoachingStateSummary {
  readonly state: StepCoachingLifecycleState;
  readonly metCount: number;
  readonly totalCriteria: number;
  readonly hasWarnings: boolean;
}

export function deriveStepCoachingState(params: {
  readonly draftText: string;
  readonly rubric: readonly RubricCriterion[];
  readonly feedback?: TutorCoachingFeedback | undefined;
  readonly coachedDraftSnapshot?: string | undefined;
}): StepCoachingStateSummary {
  const trimmed = params.draftText.trim();
  const totalCriteria = params.rubric.length;
  if (!trimmed) {
    return {
      state: 'unstarted',
      metCount: 0,
      totalCriteria,
      hasWarnings: false,
    };
  }
  const fb = params.feedback;
  if (!fb) {
    return {
      state: 'drafted',
      metCount: 0,
      totalCriteria,
      hasWarnings: false,
    };
  }

  const statusById = new Map(fb.criterionFeedback.map(item => [item.criterionId, item.status]));
  const metCount = params.rubric.filter(r => statusById.get(r.id) === 'met').length;
  const allMet =
    totalCriteria === 0
      ? fb.criterionFeedback.every(c => c.status === 'met')
      : metCount === totalCriteria;
  const hasWarnings = fb.conventionWarnings.length > 0;
  const editedSinceCoaching =
    params.coachedDraftSnapshot !== undefined && trimmed !== params.coachedDraftSnapshot.trim();

  if (fb.verdict === 'not-pass') {
    return {
      state: editedSinceCoaching ? 'revised-pending-recheck' : 'needs-revision',
      metCount,
      totalCriteria,
      hasWarnings,
    };
  }

  if (fb.verdict === 'pass') {
    if (editedSinceCoaching && (!allMet || hasWarnings)) {
      return {
        state: 'revised-pending-recheck',
        metCount,
        totalCriteria,
        hasWarnings,
      };
    }
    return {
      state: 'verified',
      metCount,
      totalCriteria,
      hasWarnings,
    };
  }

  if (!allMet) {
    return {
      state: editedSinceCoaching ? 'revised-pending-recheck' : 'needs-revision',
      metCount,
      totalCriteria,
      hasWarnings,
    };
  }

  if (hasWarnings && editedSinceCoaching) {
    return {
      state: 'revised-pending-recheck',
      metCount,
      totalCriteria,
      hasWarnings,
    };
  }

  return {
    state: 'verified',
    metCount,
    totalCriteria,
    hasWarnings,
  };
}

const STATEMENT_DEPENDENT_PROMPT_PATTERN =
  /(?:(?:phát biểu|mệnh đề|khẳng định|nhận định|nhận xét|đẳng thức|bất đẳng thức|tính chất|kết luận|quan hệ|điều kiện|ý|câu|phương án|lựa chọn|trường hợp)\s+(?:nào\s+)?(?:sau đây|dưới đây)|(?:phát biểu|mệnh đề|khẳng định|nhận định|nhận xét|đẳng thức|tính chất|trường hợp|điều|ý|câu)\s+nào|(?:chọn|xác định)\s+(?:tất cả\s+)?(?:các\s+)?(?:phát biểu|mệnh đề|khẳng định|nhận định|lỗi))/i;

const TRAILING_MCQ_SCAFFOLD_LINE_PATTERN =
  /\n\n\*\*Câu hỏi:\*\*\s*(?:Nên chọn phương pháp nào|Để xác định chiều phản ứng[^\n]*chọn cách nào|Đề cho bảng nhiệt động:\s*nên vẽ hoặc lập gì|Trên thang mức năng lượng,\s*cần vẽ mũi tên nào|Chọn giản đồ MO cho|Câu hỏi này cần vẽ loại hình nào|Cần biểu diễn quá trình nào|Chọn công thức\.)[^\n]*$/i;

function normalizeClassicPromptForWrittenMode(
  prompt: string,
  includeStatements: boolean,
): string {
  if (includeStatements) return prompt;
  if (!TRAILING_MCQ_SCAFFOLD_LINE_PATTERN.test(prompt)) return prompt;
  const stripped = prompt.replace(TRAILING_MCQ_SCAFFOLD_LINE_PATTERN, '').trim();
  // Keep stripped body when it already contains a complete problem statement
  if (stripped.length >= 40) {
    return stripped;
  }
  return prompt;
}

const FALLBACK_DB_PROVENANCE: Provenance = {
  repository: 'local:src/content/courses',
  revision: 'course-exercise-db-v1',
  path: 'exercises.ts',
  rights: 'approved',
};

/**
 * Determines whether a classic multiple-choice / multiple-answer prompt refers directly
 * to statements (A/B/C/D) that must remain visible as non-clickable propositions when solving in written mode.
 */
export function doesClassicPromptRequireStatements(
  exercise: ClassicExerciseDefinition,
): boolean {
  if (exercise.kind === 'short-answer') return false;
  if (exercise.kind === 'multiple-answer') return true;
  return STATEMENT_DEPENDENT_PROMPT_PATTERN.test(exercise.prompt);
}

export interface AdaptClassicExerciseOptions {
  readonly canon?: CourseConventionCanon | undefined;
}

/**
 * Converts any classic database exercise (`multiple-choice`, `multiple-answer`, `short-answer`)
 * into a structured `SemiEssayExercise` for A4 written derivation & WebMCP presentation checking.
 */
export function adaptClassicExerciseToSemiEssay(
  exercise: ClassicExerciseDefinition,
  options?: AdaptClassicExerciseOptions,
): SemiEssayExercise {
  const includeStatements = doesClassicPromptRequireStatements(exercise);
  const checkpoints = options?.canon?.presentationCheckpoints ?? [];

  const statementLines =
    includeStatements && exercise.kind !== 'short-answer'
      ? [
          '',
          '**Các mệnh đề cần phân tích đúng – sai:**',
          ...exercise.choices.map(
            (choice, idx) =>
              `- **(${String.fromCharCode(65 + idx)})** ${choice.label}`,
          ),
        ]
      : [];

  const cleanedBasePrompt = normalizeClassicPromptForWrittenMode(
    exercise.prompt,
    includeStatements,
  );
  const fullPrompt = [...[cleanedBasePrompt], ...statementLines].join('\n');

  let verifiedAnswerSummary: string;
  if (exercise.kind === 'short-answer') {
    const primary = exercise.answers[0] ?? '';
    const alternates = exercise.answers.slice(1);
    verifiedAnswerSummary =
      alternates.length > 0
        ? `**Đáp số chuẩn:** ${primary} *(chấp nhận tương đương: ${alternates.join('; ')})*`
        : `**Đáp số chuẩn:** ${primary}`;
  } else {
    const answerSet = new Set(exercise.answers);
    const matchedLabels = exercise.choices
      .map((choice, idx) => ({
        choice,
        letter: String.fromCharCode(65 + idx),
      }))
      .filter(item => answerSet.has(item.choice.id))
      .map(item => `(${item.letter}) ${item.choice.label}`);
    verifiedAnswerSummary =
      matchedLabels.length > 0
        ? `**Kết quả chuẩn trong ngân hàng đề:** ${matchedLabels.join('; ')}`
        : `**Mã đáp án chuẩn:** ${exercise.answers.join(', ')}`;
  }

  const modelAnswerParts = [
    verifiedAnswerSummary,
    ...(exercise.explanation ? [`**Hướng dẫn & Giải thích đối chiếu:**\n\n${exercise.explanation}`] : []),
    ...(!exercise.explanation && exercise.hints && exercise.hints.length > 0
      ? [`**Gợi ý phương pháp:** ${exercise.hints.join(' ')}`]
      : []),
  ];

  const setupHint = checkpoints[0] ? ` (${checkpoints[0]})` : '';
  const derivationHint = checkpoints[1] ? ` (${checkpoints[1]})` : '';
  const conclusionHint = checkpoints[2] ? ` (${checkpoints[2]})` : '';

  const rubric: RubricCriterion[] = [
    {
      id: `${exercise.id}-rubric-setup`,
      prompt: `Nêu đúng cơ sở lý thuyết, công thức gốc hoặc điều kiện áp dụng trước khi biến đổi${setupHint}.`,
    },
    {
      id: `${exercise.id}-rubric-derivation`,
      prompt:
        includeStatements && exercise.kind !== 'short-answer'
          ? `Phân tích mạch lạc cơ sở đúng/sai từng mệnh đề theo ký hiệu chuẩn ĐHKHTN${derivationHint}.`
          : `Trình bày các bước biến đổi / suy luận rõ ràng, đúng ký hiệu chuẩn ĐHKHTN, không nhảy bước tắt${derivationHint}.`,
    },
    {
      id: `${exercise.id}-rubric-conclusion`,
      prompt: `Trình bày kết luận và kết quả cuối cùng rõ ràng, khớp đáp án chuẩn${conclusionHint}.`,
    },
  ];

  return {
    id: exercise.id,
    lessonId: exercise.lessonId,
    kind: 'semi-essay',
    title: exercise.title,
    prompt: fullPrompt,
    ...(exercise.figure ? { figure: exercise.figure } : {}),
    given: [],
    theoryAnchors: [],
    ...(exercise.explanation ? { explanation: exercise.explanation } : {}),
    steps: [
      {
        id: `${exercise.id}-written`,
        kind: 'written-reasoning',
        title: exercise.title,
        prompt: fullPrompt,
        theoryAnchorIds: [],
        ...(exercise.hints && exercise.hints.length > 0 ? { hints: exercise.hints } : {}),
        modelAnswer: modelAnswerParts.join('\n\n'),
        rubric,
        summaryTemplate: verifiedAnswerSummary,
      },
    ],
    provenance: exercise.provenance ?? FALLBACK_DB_PROVENANCE,
  };
}

export function adaptExerciseToWrittenExamProblem(
  exercise: ExerciseDefinition,
  options?: AdaptClassicExerciseOptions,
): SemiEssayExercise {
  if (exercise.kind === 'semi-essay') return exercise;
  return adaptClassicExerciseToSemiEssay(exercise, options);
}
