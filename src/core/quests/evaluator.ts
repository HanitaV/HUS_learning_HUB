import type { Lesson } from '../../domain/learning';
import type {
  CodeSlotBuilderInteraction,
  ConceptProbeInteraction,
  MoGuidedCanvasInteraction,
  NumericCheckInteraction,
  QuestEvaluationResult,
  QuestInteractionAnswer,
  QuestStageInteraction,
  SkillQuest,
  StepChainBuilderInteraction,
} from '../../domain/skill-quest';
import { diagnoseMoFill } from '../chemistry/essay-engine';
import { parseLocalizedNumber } from '../learning/semi-essay';

function evaluateConceptProbe(
  interaction: ConceptProbeInteraction,
  answer: Extract<QuestInteractionAnswer, { readonly kind: 'concept-probe' }>,
): QuestEvaluationResult {
  const choice = interaction.choices.find(c => c.id === answer.choiceId);
  if (!choice) {
    return {
      correct: false,
      feedback: 'Hãy chọn một phương án trước khi kiểm tra.',
    };
  }

  return {
    correct: choice.id === interaction.answerId,
    feedback: choice.rationale,
  };
}

function evaluateCodeSlotBuilder(
  interaction: CodeSlotBuilderInteraction,
  answer: Extract<QuestInteractionAnswer, { readonly kind: 'code-slot-builder' }>,
): QuestEvaluationResult {
  for (const slot of interaction.slots) {
    const selectedOptionId = answer.selectedBySlotId[slot.id];
    if (!selectedOptionId) {
      return {
        correct: false,
        feedback: 'Hãy chọn đủ mảnh code cho mọi ô trống đang sáng viền vàng.',
      };
    }
  }

  for (const slot of interaction.slots) {
    const selectedOptionId = answer.selectedBySlotId[slot.id];
    if (selectedOptionId !== slot.correctOptionId) {
      const chosenOption = slot.options.find(opt => opt.id === selectedOptionId);
      return {
        correct: false,
        feedback: chosenOption?.feedback ?? 'Mảnh code này chưa khớp logic.',
      };
    }
  }

  return {
    correct: true,
    feedback: 'Chuẩn xác! Kết quả mô phỏng: ' + interaction.simulatedOutput,
  };
}

function evaluateMoGuidedCanvas(
  interaction: MoGuidedCanvasInteraction,
  answer: Extract<QuestInteractionAnswer, { readonly kind: 'mo-guided-canvas' }>,
): QuestEvaluationResult {
  if (interaction.mode === 'select-ordering') {
    if (!answer.chosenOrdering) {
      return {
        correct: false,
        feedback: 'Hãy chọn sơ đồ thứ tự mức năng lượng MO (Loại I hoặc Loại II) trước khi kiểm tra.',
      };
    }

    const correct = answer.chosenOrdering === interaction.expectedOrdering;
    if (interaction.expectedOrdering === 'type-2') {
      return {
        correct,
        feedback: correct
          ? `Chính xác! Với Z ≤ 7 (${interaction.moleculeLabel}, Z = ${interaction.atomicNumber}), tương tác trộn s–p mạnh đẩy σ₂p lên cao hơn π₂p (Loại II: π₂p < σ₂p).`
          : `Chưa đúng. Với Z ≤ 7 (${interaction.moleculeLabel}, Z = ${interaction.atomicNumber}), tương tác trộn s–p đẩy σ₂p lên cao hơn π₂p, nên phải chọn Loại II (π₂p < σ₂p) thay vì Loại I (σ₂p < π₂p).`,
      };
    }

    return {
      correct,
      feedback: correct
        ? `Chính xác! Với Z ≥ 8 (${interaction.moleculeLabel}, Z = ${interaction.atomicNumber}), chênh lệch năng lượng 2s–2p lớn nên trộn s–p yếu, giữ thứ tự chuẩn Loại I (σ₂p < π₂p).`
        : `Chưa đúng. Với Z ≥ 8 (${interaction.moleculeLabel}, Z = ${interaction.atomicNumber}), trộn s–p yếu nên σ₂p vẫn thấp hơn π₂p — hãy chọn Loại I (σ₂p < π₂p) thay vì Loại II (π₂p < σ₂p).`,
    };
  }

  if (interaction.mode === 'fill-electrons') {
    if (!answer.slotCounts) {
      return {
        correct: false,
        feedback: 'Hãy điền các electron vào sơ đồ orbital phân tử trước khi kiểm tra.',
      };
    }

    const diag = diagnoseMoFill(
      answer.slotCounts,
      interaction.expectedOrdering,
      interaction.expectedOrdering,
      interaction.totalValenceElectrons,
    );
    return {
      correct: diag.ok,
      feedback: diag.message,
    };
  }

  const parsedBo = parseLocalizedNumber(answer.bondOrderInput ?? '');
  if (parsedBo === null || Number.isNaN(parsedBo)) {
    return {
      correct: false,
      feedback: 'Hãy nhập bậc liên kết (BO) là một giá trị số hợp lệ (ví dụ: 2 hoặc 1,5).',
    };
  }

  if (!answer.chosenMagnetism) {
    return {
      correct: false,
      feedback: 'Hãy chọn từ tính của phân tử (thuận từ hoặc nghịch từ).',
    };
  }

  const boCorrect = Math.abs(parsedBo - interaction.expectedBondOrder) <= 0.01;
  const magnetismCorrect = answer.chosenMagnetism === interaction.expectedMagnetism;

  if (!boCorrect && !magnetismCorrect) {
    return {
      correct: false,
      feedback:
        'Cả bậc liên kết và từ tính đều chưa đúng. Hãy tính lại BO = (N_liên_kết − N*_phản_liên_kết) / 2 và kiểm tra xem còn electron độc thân (thuận từ) hay đã ghép đôi hết (nghịch từ).',
    };
  }

  if (!boCorrect) {
    return {
      correct: false,
      feedback:
        'Từ tính đã đúng, nhưng bậc liên kết (BO) chưa khớp. Hãy kiểm tra lại công thức BO = (N_liên_kết − N*_phản_liên_kết) / 2.',
    };
  }

  if (!magnetismCorrect) {
    const expectedLabel =
      interaction.expectedMagnetism === 'paramagnetic'
        ? 'thuận từ (có electron độc thân)'
        : 'nghịch từ (mọi electron đều ghép đôi)';
    return {
      correct: false,
      feedback: `Bậc liên kết BO = ${interaction.expectedBondOrder} đã chính xác, nhưng từ tính chưa chuẩn: ${interaction.moleculeLabel} có tính chất ${expectedLabel}.`,
    };
  }

  const magnetismLabel =
    interaction.expectedMagnetism === 'paramagnetic' ? 'thuận từ' : 'nghịch từ';
  return {
    correct: true,
    feedback: `Chính xác! ${interaction.moleculeLabel} có bậc liên kết BO = ${interaction.expectedBondOrder} và tính chất ${magnetismLabel}.`,
  };
}

function evaluateStepChainBuilder(
  interaction: StepChainBuilderInteraction,
  answer: Extract<QuestInteractionAnswer, { readonly kind: 'step-chain-builder' }>,
): QuestEvaluationResult {
  for (const slot of interaction.slots) {
    const selectedOptionId = answer.selectedBySlotId[slot.id];
    if (!selectedOptionId) {
      return {
        correct: false,
        feedback: `Hãy chọn bước biến đổi cho "${slot.stepLabel}".`,
      };
    }

    if (selectedOptionId !== slot.correctOptionId) {
      const chosenOption = slot.options.find(opt => opt.id === selectedOptionId);
      return {
        correct: false,
        feedback: chosenOption?.feedback ?? 'Bước biến đổi này chưa chính xác.',
      };
    }
  }

  return {
    correct: true,
    feedback: 'Chuỗi biến đổi hoàn toàn chính xác!',
  };
}

function evaluateNumericCheck(
  interaction: NumericCheckInteraction,
  answer: Extract<QuestInteractionAnswer, { readonly kind: 'numeric-check' }>,
): QuestEvaluationResult {
  const val = parseLocalizedNumber(answer.rawValue);
  if (val === null || Number.isNaN(val)) {
    return {
      correct: false,
      feedback: 'Hãy nhập một giá trị số hợp lệ.',
    };
  }

  if (Math.abs(val - interaction.expected) > interaction.tolerance) {
    const unitSuffix = interaction.unit ? ` ${interaction.unit}` : '';
    return {
      correct: false,
      feedback: `Giá trị số chưa đúng (sai số cho phép ±${interaction.tolerance}${unitSuffix}). Hãy kiểm tra lại phép tính.`,
    };
  }

  if (interaction.limitingQuestion) {
    const chosen = interaction.limitingQuestion.choices.find(
      c => c.id === answer.limitingChoiceId,
    );
    if (!chosen) {
      return {
        correct: false,
        feedback: 'Giá trị số đã chuẩn! Hãy chọn đáp án cho câu hỏi kiểm tra trường hợp giới hạn.',
      };
    }

    if (chosen.id !== interaction.limitingQuestion.answerId) {
      return {
        correct: false,
        feedback: chosen.rationale,
      };
    }

    return {
      correct: true,
      feedback: `Chính xác! ${chosen.rationale}`,
    };
  }

  return {
    correct: true,
    feedback: 'Chính xác! Kết quả số khớp với đáp án chuẩn.',
  };
}

export function evaluateQuestInteraction(
  interaction: QuestStageInteraction,
  answer: QuestInteractionAnswer,
): QuestEvaluationResult {
  if (interaction.kind !== answer.kind) {
    return {
      correct: false,
      feedback: 'Kiểu câu trả lời không khớp với chặng hiện tại.',
    };
  }

  if (interaction.kind === 'concept-probe' && answer.kind === 'concept-probe') {
    return evaluateConceptProbe(interaction, answer);
  }

  if (interaction.kind === 'code-slot-builder' && answer.kind === 'code-slot-builder') {
    return evaluateCodeSlotBuilder(interaction, answer);
  }

  if (interaction.kind === 'mo-guided-canvas' && answer.kind === 'mo-guided-canvas') {
    return evaluateMoGuidedCanvas(interaction, answer);
  }

  if (interaction.kind === 'diagram-guided' && answer.kind === 'diagram-guided') {
    return {
      correct: answer.diagramPassed,
      feedback:
        answer.diagramSummary ??
        (answer.diagramPassed
          ? 'Sơ đồ chính xác!'
          : 'Hãy kiểm tra lại sơ đồ tương tác trước khi qua mốc tiếp theo.'),
    };
  }

  if (interaction.kind === 'step-chain-builder' && answer.kind === 'step-chain-builder') {
    return evaluateStepChainBuilder(interaction, answer);
  }

  if (interaction.kind === 'numeric-check' && answer.kind === 'numeric-check') {
    return evaluateNumericCheck(interaction, answer);
  }

  return {
    correct: false,
    feedback: 'Kiểu câu trả lời không khớp với chặng hiện tại.',
  };
}

export function validateSkillQuests(
  quests: readonly SkillQuest[],
  lessons: readonly Lesson[],
): readonly string[] {
  const errors: string[] = [];
  const seenQuestIds = new Set<string>();
  const lessonIds = new Set(lessons.map(lesson => lesson.id));

  for (const quest of quests) {
    if (seenQuestIds.has(quest.id)) {
      errors.push(`Trùng mã quest "${quest.id}".`);
    } else {
      seenQuestIds.add(quest.id);
    }

    if (!lessonIds.has(quest.lessonId)) {
      errors.push(`Quest "${quest.id}" tham chiếu lessonId không tồn tại: "${quest.lessonId}".`);
    }

    if (quest.milestones.length < 3) {
      errors.push(
        `Quest "${quest.id}" phải có ít nhất 3 mốc (hiện có ${quest.milestones.length}).`,
      );
    }

    const seenMilestoneIds = new Set<string>();
    for (const milestone of quest.milestones) {
      if (seenMilestoneIds.has(milestone.id)) {
        errors.push(`Quest "${quest.id}" bị trùng mã mốc "${milestone.id}".`);
      } else {
        seenMilestoneIds.add(milestone.id);
      }

      const { interaction } = milestone;
      if (interaction.kind === 'code-slot-builder') {
        for (const slot of interaction.slots) {
          if (!interaction.codeTemplate.includes(`{{${slot.id}}}`)) {
            errors.push(
              `Quest "${quest.id}" mốc "${milestone.id}": codeTemplate thiếu placeholder "{{${slot.id}}}".`,
            );
          }
          if (!slot.options.some(opt => opt.id === slot.correctOptionId)) {
            errors.push(
              `Quest "${quest.id}" mốc "${milestone.id}" ô "${slot.id}": correctOptionId "${slot.correctOptionId}" không nằm trong options.`,
            );
          }
        }
      } else if (interaction.kind === 'concept-probe') {
        if (!interaction.choices.some(choice => choice.id === interaction.answerId)) {
          errors.push(
            `Quest "${quest.id}" mốc "${milestone.id}": answerId "${interaction.answerId}" không nằm trong choices.`,
          );
        }
      } else if (interaction.kind === 'step-chain-builder') {
        for (const slot of interaction.slots) {
          if (!slot.options.some(opt => opt.id === slot.correctOptionId)) {
            errors.push(
              `Quest "${quest.id}" mốc "${milestone.id}" bước "${slot.id}": correctOptionId "${slot.correctOptionId}" không nằm trong options.`,
            );
          }
        }
      } else if (interaction.kind === 'numeric-check' && interaction.limitingQuestion) {
        const lq = interaction.limitingQuestion;
        if (!lq.choices.some(choice => choice.id === lq.answerId)) {
          errors.push(
            `Quest "${quest.id}" mốc "${milestone.id}": limitingQuestion.answerId "${lq.answerId}" không nằm trong choices.`,
          );
        }
      }
    }
  }

  return errors;
}
