import type {
  ProofBlockItem,
  ProofBlocksExercise,
  ProofGradeResult,
  ProofStepDiagnostic,
} from '../../domain/block-logic';

function isDistractorBlock(block: ProofBlockItem): boolean {
  return Boolean(block.isDistractor) || block.role === 'distractor';
}

/**
 * Validates that a proof DAG exercise has well-formed block references
 * and no prerequisite cycles among non-distractor blocks.
 */
export function validateProofDag(
  exercise: ProofBlocksExercise,
): readonly string[] {
  const errors: string[] = [];
  const blockById = new Map<string, ProofBlockItem>();

  for (const block of exercise.blocks) {
    if (blockById.has(block.id)) {
      errors.push(`Duplicate block ID "${block.id}".`);
    } else {
      blockById.set(block.id, block);
    }
  }

  const nonDistractors = exercise.blocks.filter(
    (block) => !isDistractorBlock(block),
  );

  for (const block of nonDistractors) {
    for (const prereqId of block.prerequisiteIds) {
      const prereq = blockById.get(prereqId);
      if (!prereq) {
        errors.push(
          `Block "${block.id}" references unknown prerequisite "${prereqId}".`,
        );
      } else if (isDistractorBlock(prereq)) {
        errors.push(
          `Block "${block.id}" references distractor block "${prereqId}" as a prerequisite.`,
        );
      } else if (prereqId === block.id) {
        errors.push(`Block "${block.id}" cannot depend on itself.`);
      }
    }
  }

  // Detect cycles among valid non-distractor blocks using 3-color DFS.
  const state = new Map<string, 'visiting' | 'visited'>();
  const reportedCycles = new Set<string>();

  const dfs = (id: string): void => {
    const currentState = state.get(id);
    if (currentState === 'visited') return;
    if (currentState === 'visiting') {
      if (!reportedCycles.has(id)) {
        reportedCycles.add(id);
        errors.push(`Prerequisite cycle detected involving block "${id}".`);
      }
      return;
    }

    state.set(id, 'visiting');
    const block = blockById.get(id);
    if (block && !isDistractorBlock(block)) {
      for (const prereqId of block.prerequisiteIds) {
        const prereq = blockById.get(prereqId);
        if (prereq && !isDistractorBlock(prereq) && prereqId !== id) {
          dfs(prereqId);
        }
      }
    }
    state.set(id, 'visited');
  };

  for (const block of nonDistractors) {
    if (!state.has(block.id)) {
      dfs(block.id);
    }
  }

  return errors;
}

/**
 * Grades a student's selected proof block sequence.
 * Accepts any valid topological ordering of all required non-distractor blocks.
 */
export function gradeProofBlocks(
  exercise: ProofBlocksExercise,
  selectedBlockIds: readonly string[],
): ProofGradeResult {
  const blockById = new Map<string, ProofBlockItem>();
  for (const block of exercise.blocks) {
    blockById.set(block.id, block);
  }

  const requiredBlocks = exercise.blocks.filter(
    (block) => !isDistractorBlock(block),
  );

  const seenSelectedIds = new Set<string>();
  const seenValidIds = new Set<string>();
  const diagnostics: ProofStepDiagnostic[] = [];

  for (const blockId of selectedBlockIds) {
    if (seenSelectedIds.has(blockId)) {
      diagnostics.push({
        blockId,
        status: 'duplicate',
        missingPrereqIds: [],
        message: 'This proof step was already selected.',
      });
      continue;
    }

    seenSelectedIds.add(blockId);
    const block = blockById.get(blockId);

    if (!block) {
      diagnostics.push({
        blockId,
        status: 'distractor',
        missingPrereqIds: [],
        message: 'Unknown proof step.',
      });
      continue;
    }

    if (isDistractorBlock(block)) {
      diagnostics.push({
        blockId,
        status: 'distractor',
        missingPrereqIds: [],
        message:
          block.distractorReason ??
          'This step is a distractor and does not belong in the proof.',
      });
      continue;
    }

    const missingPrereqIds = block.prerequisiteIds.filter(
      (prereqId) => !seenValidIds.has(prereqId),
    );

    if (missingPrereqIds.length > 0) {
      diagnostics.push({
        blockId,
        status: 'missing-prereq',
        missingPrereqIds,
        message: 'Required prerequisite steps must appear earlier in the proof.',
      });
      continue;
    }

    seenValidIds.add(blockId);
    diagnostics.push({
      blockId,
      status: 'valid',
      missingPrereqIds: [],
      message: 'Valid proof step.',
    });
  }

  const missingRequiredIds = requiredBlocks
    .filter((block) => !seenSelectedIds.has(block.id))
    .map((block) => block.id);

  const requiredCount = requiredBlocks.length;
  const validCount = seenValidIds.size;
  const passed =
    missingRequiredIds.length === 0 &&
    validCount === requiredCount &&
    diagnostics.every((diag) => diag.status === 'valid');

  return {
    passed,
    requiredCount,
    validCount,
    missingRequiredIds,
    diagnostics,
  };
}
