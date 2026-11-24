import { describe, expect, it } from 'vitest';
import { gradeParsonsSubmission } from '../../src/core/blocks/parsons';
import {
  gradeProofBlocks,
  validateProofDag,
} from '../../src/core/blocks/proof-dag';
import type {
  ParsonsExercise,
  ProofBlocksExercise,
} from '../../src/domain/block-logic';

describe('gradeParsonsSubmission', () => {
  const exercise: ParsonsExercise = {
    id: 'parsons-sum',
    courseId: 'cs101',
    title: 'Sum of list',
    language: 'python',
    prompt: 'Arrange the lines to compute the sum.',
    solutionOrder: ['b1', 'b2', 'b3'],
    blocks: [
      { id: 'b1', code: 'total = 0', expectedIndent: 0 },
      { id: 'b2', code: 'for x in nums:', expectedIndent: 0 },
      { id: 'b3', code: 'total += x', expectedIndent: 1 },
      {
        id: 'd1',
        code: 'total = x',
        expectedIndent: 1,
        isDistractor: true,
        distractorReason: 'Overwrites total instead of accumulating.',
      },
    ],
  };

  it('passes when all required lines are in order with exact indentation', () => {
    const result = gradeParsonsSubmission(exercise, [
      { blockId: 'b1', indent: 0 },
      { blockId: 'b2', indent: 0 },
      { blockId: 'b3', indent: 1 },
    ]);

    expect(result.passed).toBe(true);
    expect(result.correctCount).toBe(3);
    expect(result.expectedCount).toBe(3);
    expect(result.missingBlockIds).toEqual([]);
    expect(result.lineFeedback.map((f) => f.status)).toEqual([
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('detects wrong indentation, wrong order, distractors, and missing blocks', () => {
    const result = gradeParsonsSubmission(exercise, [
      { blockId: 'b2', indent: 0 },
      { blockId: 'd1', indent: 1 },
      { blockId: 'b1', indent: 0 },
    ]);

    expect(result.passed).toBe(false);
    expect(result.correctCount).toBe(0);
    expect(result.missingBlockIds).toEqual(['b3']);
    expect(result.lineFeedback.map((f) => f.status)).toEqual([
      'wrong-order',
      'distractor',
      'wrong-order',
    ]);
    expect(result.lineFeedback[1]?.message).toContain('Overwrites total');

    const indentResult = gradeParsonsSubmission(exercise, [
      { blockId: 'b1', indent: 0 },
      { blockId: 'b2', indent: 0 },
      { blockId: 'b3', indent: 0 },
    ]);
    expect(indentResult.passed).toBe(false);
    expect(indentResult.correctCount).toBe(2);
    expect(indentResult.lineFeedback[2]?.status).toBe('wrong-indent');
  });
});

describe('validateProofDag & gradeProofBlocks', () => {
  const proofExercise: ProofBlocksExercise = {
    id: 'proof-even-sum',
    courseId: 'math101',
    title: 'Sum of two even integers is even',
    theoremStatement: 'If $a, b$ are even, then $a + b$ is even.',
    hint: 'Express $a = 2k$ and $b = 2m$ independently first.',
    blocks: [
      {
        id: 's1',
        text: 'Let $a = 2k$ for some integer $k$.',
        role: 'assumption',
        prerequisiteIds: [],
      },
      {
        id: 's2',
        text: 'Let $b = 2m$ for some integer $m$.',
        role: 'assumption',
        prerequisiteIds: [],
      },
      {
        id: 's3',
        text: 'Then $a + b = 2(k + m)$.',
        role: 'step',
        prerequisiteIds: ['s1', 's2'],
      },
      {
        id: 's4',
        text: 'Since $k + m$ is an integer, $a + b$ is even.',
        role: 'conclusion',
        prerequisiteIds: ['s3'],
      },
      {
        id: 'sd',
        text: 'Assume $k = m$.',
        role: 'distractor',
        prerequisiteIds: [],
        isDistractor: true,
        distractorReason: 'a and b need not be equal.',
      },
    ],
  };

  it('validates a well-formed DAG with zero errors', () => {
    expect(validateProofDag(proofExercise)).toEqual([]);
  });

  it('reports unknown prerequisites, distractor prerequisites, and cycles', () => {
    const broken: ProofBlocksExercise = {
      ...proofExercise,
      blocks: [
        { id: 'a', text: 'A', prerequisiteIds: ['b', 'missing'] },
        { id: 'b', text: 'B', prerequisiteIds: ['a', 'dist'] },
        { id: 'dist', text: 'D', prerequisiteIds: [], isDistractor: true },
      ],
    };

    const errors = validateProofDag(broken);
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.some((e) => e.includes('unknown prerequisite'))).toBe(true);
    expect(errors.some((e) => e.includes('distractor block'))).toBe(true);
    expect(errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('accepts any valid topological ordering of required blocks', () => {
    const order1 = gradeProofBlocks(proofExercise, ['s1', 's2', 's3', 's4']);
    expect(order1.passed).toBe(true);
    expect(order1.validCount).toBe(4);
    expect(order1.requiredCount).toBe(4);
    expect(order1.missingRequiredIds).toEqual([]);

    const order2 = gradeProofBlocks(proofExercise, ['s2', 's1', 's3', 's4']);
    expect(order2.passed).toBe(true);
    expect(order2.validCount).toBe(4);
  });

  it('flags missing prerequisites, distractors, duplicates, and missing required blocks', () => {
    const result = gradeProofBlocks(proofExercise, [
      's3',
      's1',
      's1',
      'sd',
    ]);

    expect(result.passed).toBe(false);
    expect(result.requiredCount).toBe(4);
    expect(result.validCount).toBe(1);
    expect(result.missingRequiredIds).toEqual(['s2', 's4']);
    expect(result.diagnostics.map((d) => d.status)).toEqual([
      'missing-prereq',
      'valid',
      'duplicate',
      'distractor',
    ]);
    expect(result.diagnostics[0]?.missingPrereqIds).toEqual(['s1', 's2']);
    expect(result.diagnostics[3]?.message).toContain('need not be equal');
  });
});
