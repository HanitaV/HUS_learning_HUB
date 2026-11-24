import type {
  ParsonsBlock,
  ParsonsExercise,
  ParsonsGradeResult,
  ParsonsLineFeedback,
  ParsonsPlacement,
} from '../../domain/block-logic';

/**
 * Grades a student's Parsons problem submission against the exercise's
 * expected sequence and indentation levels.
 */
export function gradeParsonsSubmission(
  exercise: ParsonsExercise,
  placements: readonly ParsonsPlacement[],
): ParsonsGradeResult {
  const blockById = new Map<string, ParsonsBlock>();
  for (const block of exercise.blocks) {
    blockById.set(block.id, block);
  }

  const placedIds = new Set<string>();
  const lineFeedback: ParsonsLineFeedback[] = [];
  let nonDistractorIndex = 0;

  for (const placement of placements) {
    const block = blockById.get(placement.blockId);

    if (!block) {
      lineFeedback.push({
        blockId: placement.blockId,
        code: placement.blockId,
        status: 'distractor',
        message: 'Unknown block.',
      });
      continue;
    }

    if (block.isDistractor) {
      lineFeedback.push({
        blockId: block.id,
        code: block.code,
        status: 'distractor',
        message:
          block.distractorReason ??
          'This block is a distractor and does not belong in the solution.',
      });
      continue;
    }

    placedIds.add(block.id);
    const expectedBlockId = exercise.solutionOrder[nonDistractorIndex];
    nonDistractorIndex += 1;

    if (block.id !== expectedBlockId) {
      lineFeedback.push({
        blockId: block.id,
        code: block.code,
        status: 'wrong-order',
        message: 'This line is in the wrong order.',
      });
      continue;
    }

    if (placement.indent !== block.expectedIndent) {
      lineFeedback.push({
        blockId: block.id,
        code: block.code,
        status: 'wrong-indent',
        message: `Expected indentation level ${block.expectedIndent}, got ${placement.indent}.`,
      });
      continue;
    }

    lineFeedback.push({
      blockId: block.id,
      code: block.code,
      status: 'correct',
      message: 'Correct line and indentation.',
    });
  }

  const missingBlockIds = exercise.solutionOrder.filter(
    (id) => !placedIds.has(id),
  );
  const expectedCount = exercise.solutionOrder.length;
  const correctCount = lineFeedback.filter(
    (item) => item.status === 'correct',
  ).length;
  const passed =
    missingBlockIds.length === 0 &&
    lineFeedback.length === expectedCount &&
    correctCount === expectedCount;

  return {
    passed,
    correctCount,
    expectedCount,
    missingBlockIds,
    lineFeedback,
  };
}
