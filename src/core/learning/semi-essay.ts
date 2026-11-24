import type {
  AxisProjectionStep,
  ChoiceReasoningStep,
  EquationTransformStage,
  NumericUnitStep,
  SemiEssayExercise,
  WrittenReasoningStep,
  WrittenStepDraft,
} from '../../domain/semi-essay';

export interface ChoiceReasoningEvaluation {
  readonly correct: boolean;
  readonly rationales: readonly { readonly choiceId: string; readonly label: string; readonly rationale: string; readonly isCorrectChoice: boolean }[];
}

export interface AxisProjectionSelection {
  readonly sign: '+' | '-' | '0' | '';
  readonly component: string;
}

export interface AxisProjectionEvaluation {
  readonly correct: boolean;
  readonly errors: readonly { readonly axisLabel: string; readonly forceId: string; readonly hint: string }[];
}

export interface EquationTransformMoveEvaluation {
  readonly found: boolean;
  readonly advance: boolean;
  readonly resultLatex: string;
  readonly canceledLatex?: string;
  readonly feedback: string;
}

export interface NumericFieldEvaluation {
  readonly fieldId: string;
  readonly label: string;
  readonly status: 'correct' | 'invalid' | 'out-of-range';
  readonly parsedValue: number | null;
  readonly message: string;
}

export interface NumericUnitEvaluation {
  readonly correct: boolean;
  readonly fields: readonly NumericFieldEvaluation[];
}

export interface SynthesizedEssaySection {
  readonly stepId: string;
  readonly stepNumber: number;
  readonly title: string;
  readonly summary: string;
  readonly theoryAnchorIds: readonly string[];
}

export function emptyWrittenStepDraft(): WrittenStepDraft {
  return { response: '', modelRevealed: false, reviewedCriterionIds: [], revision: '', selfReviewed: false };
}

export interface WrittenReasoningReview {
  readonly readyForReview: boolean;
  readonly readyToComplete: boolean;
  readonly complete: boolean;
  readonly missingCriterionIds: readonly string[];
}

export function evaluateWrittenReasoningReview(step: WrittenReasoningStep, draft: WrittenStepDraft): WrittenReasoningReview {
  const readyForReview = draft.response.trim().length > 0;
  const missingCriterionIds = step.rubric.filter(item => !draft.reviewedCriterionIds.includes(item.id)).map(item => item.id);
  const readyToComplete = readyForReview && draft.modelRevealed && step.rubric.length > 0 && missingCriterionIds.length === 0 && draft.revision.trim().length > 0;
  return {
    readyForReview,
    readyToComplete,
    complete: readyToComplete && draft.selfReviewed,
    missingCriterionIds,
  };
}

export function parseLocalizedNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (cleaned.length === 0) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function evaluateChoiceReasoningStep(
  step: ChoiceReasoningStep,
  selectedIds: readonly string[],
): ChoiceReasoningEvaluation {
  const uniqueSelected = [...new Set(selectedIds)];
  const answerSet = new Set(step.answers);
  const correct =
    uniqueSelected.length === answerSet.size &&
    uniqueSelected.every(id => answerSet.has(id));

  const rationales = uniqueSelected
    .map(id => step.choices.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map(choice => ({
      choiceId: choice.id,
      label: choice.label,
      rationale: choice.rationale,
      isCorrectChoice: answerSet.has(choice.id),
    }));

  return { correct, rationales };
}

export function evaluateAxisProjectionStep(
  step: AxisProjectionStep,
  selections: Readonly<Record<string, Readonly<Record<string, AxisProjectionSelection>>>>,
): AxisProjectionEvaluation {
  const errors: { readonly axisLabel: string; readonly forceId: string; readonly hint: string }[] = [];

  for (const axis of step.axes) {
    const axisSelections = selections[axis.id] ?? {};
    for (const row of axis.rows) {
      const picked = axisSelections[row.forceId];
      const signOk = picked?.sign === row.expectedSign;
      const compOk =
        row.expectedSign === '0'
          ? picked?.sign === '0' && (picked.component === '0' || picked.component === '' || picked.component === row.expectedComponent)
          : picked?.component === row.expectedComponent;

      if (!signOk || !compOk) {
        errors.push({
          axisLabel: axis.label,
          forceId: row.forceId,
          hint: row.hint,
        });
      }
    }
  }

  return {
    correct: errors.length === 0,
    errors,
  };
}

export function evaluateEquationTransformMove(
  stage: EquationTransformStage,
  operationId: string,
): EquationTransformMoveEvaluation {
  const op = stage.operations.find(item => item.id === operationId);
  if (!op) {
    return {
      found: false,
      advance: false,
      resultLatex: '',
      feedback: 'Thao tác biến đổi không hợp lệ.',
    };
  }
  return {
    found: true,
    advance: op.optimal,
    resultLatex: op.resultLatex,
    ...(op.canceledLatex ? { canceledLatex: op.canceledLatex } : {}),
    feedback: op.feedback,
  };
}

export function evaluateNumericUnitStep(
  step: NumericUnitStep,
  rawValues: Readonly<Record<string, string>>,
): NumericUnitEvaluation {
  const fields: NumericFieldEvaluation[] = step.fields.map(field => {
    const raw = rawValues[field.id] ?? '';
    const parsed = parseLocalizedNumber(raw);
    if (parsed === null) {
      return {
        fieldId: field.id,
        label: field.label,
        status: 'invalid',
        parsedValue: null,
        message: `${field.label}: hãy nhập một giá trị số hợp lệ (chấp nhận dấu chấm hoặc dấu phẩy).`,
      };
    }

    const allowedDiff =
      field.toleranceMode === 'relative'
        ? Math.abs(field.expected) * field.tolerance
        : field.tolerance;

    const within = Math.abs(parsed - field.expected) <= allowedDiff + 1e-12;
    return {
      fieldId: field.id,
      label: field.label,
      status: within ? 'correct' : 'out-of-range',
      parsedValue: parsed,
      message: within
        ? `${field.label}: chính xác (${parsed} ${field.unit}).`
        : `${field.label}: giá trị ${parsed} ${field.unit} chưa nằm trong sai số cho phép. Hãy kiểm tra lại bước thay số và đơn vị.`,
    };
  });

  return {
    correct: fields.every(f => f.status === 'correct'),
    fields,
  };
}

export function buildSynthesizedEssay(
  exercise: SemiEssayExercise,
  completedStepIds: ReadonlySet<string>,
): readonly SynthesizedEssaySection[] {
  return exercise.steps
    .map((step, index) => ({
      stepId: step.id,
      stepNumber: index + 1,
      title: step.title,
      summary: step.summaryTemplate,
      theoryAnchorIds: step.theoryAnchorIds,
    }))
    .filter(section => completedStepIds.has(section.stepId));
}
