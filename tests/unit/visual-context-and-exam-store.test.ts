import { describe, expect, it } from 'vitest';
import { resolveCourseConventionCanon } from '../../src/content/curriculum-canons';
import type { ClassicExerciseDefinition } from '../../src/domain/workspace';
import type { SemiEssayExercise } from '../../src/domain/semi-essay';
import { emptyWrittenStepDraft } from '../../src/core/learning/semi-essay';
import { adaptClassicExerciseToSemiEssay } from '../../src/core/learning/webmcp-essay-adapters';
import {
  buildGroundedEssayContextPacket,
  formatAskGeminiPromptPacket,
  summarizeExerciseVisualContext,
} from '../../src/core/learning/curriculum-rag';
import { parseChapterExamSessionJson } from '../../src/infrastructure/progress/chapter-exam-store';

describe('Visual context forwarding & exam session interactive step persistence', () => {
  it('preserves ProblemFigureSpec when adapting a classic exercise to SemiEssayExercise', () => {
    const classic: ClassicExerciseDefinition = {
      id: 'phy1159-l9-1-test',
      lessonId: 'phy1159-t9-1',
      title: 'So sánh công trên giản đồ pV',
      prompt: 'Khí biến đổi từ A sang B theo 3 đường 1, 2, 3.',
      kind: 'multiple-choice',
      figure: {
        kind: 'plot-2d',
        alt: 'Giản đồ p-V gồm 3 đường 1 (trên), 2 (giữa), 3 (dưới) nối từ A sang B',
        xLabel: 'V',
        yLabel: 'p',
        xMax: 10,
        yMax: 10,
        paths: [
          {
            id: 'p1',
            label: '(1)',
            points: [
              { x: 2, y: 8, label: 'A' },
              { x: 8, y: 8 },
              { x: 8, y: 3, label: 'B' },
            ],
          },
        ],
      },
      choices: [
        { id: 'a', label: 'A1 > A2 > A3' },
        { id: 'b', label: 'A1 = A2 = A3' },
      ],
      answers: ['a'],
    };

    const adapted = adaptClassicExerciseToSemiEssay(classic);
    expect(adapted.figure).toEqual(classic.figure);

    const summary = summarizeExerciseVisualContext(adapted);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toContain('Giản đồ p-V gồm 3 đường');
    expect(summary[0]).toContain('(1): A(2, 8) → (8, 8) → B(8, 3)');
  });

  it('includes heatmap matrix and figure summary inside GroundedEssayContextPacket and Ask Gemini prompt', () => {
    const canon = resolveCourseConventionCanon({
      courseId: 'phy1159',
      academicCode: 'PHY1159',
      subjectId: 'physics',
      courseTitle: 'Cơ – Nhiệt',
    });

    const exercise: SemiEssayExercise = {
      id: 'phy1159-se-8-1-test',
      lessonId: 'phy1159-t8-1',
      kind: 'semi-essay',
      title: 'Bản đồ nhiệt 2D',
      prompt: 'Quan sát bản đồ nhiệt bên dưới.',
      figure: {
        kind: 'physics-schematic',
        scene: 'carnot-engine-flow',
        alt: 'Sơ đồ truyền nhiệt từ nguồn nóng sang nguồn lạnh',
      },
      given: [],
      theoryAnchors: [],
      steps: [
        {
          id: 'step-heatmap',
          kind: 'diagram',
          title: 'Đường đẳng nhiệt',
          prompt: 'Chọn các ô 90 °C',
          theoryAnchorIds: [],
          diagramKind: 'heatmap',
          spec: {
            kind: 'heatmap',
            mode: 'place-flow',
            rows: 2,
            cols: 3,
            values: [
              [90, 65, 40],
              [90, 60, 35],
            ],
            unit: '°C',
            xLabel: 'x',
            yLabel: 'y',
            flowPoints: [{ id: 'M', row: 0, col: 1, label: 'M', expectedAngle: 0, hint: 'Sang phải' }],
          },
          summaryTemplate: 'Đường đẳng nhiệt cột trái.',
        },
        {
          id: 'step-written',
          kind: 'written-reasoning',
          title: 'Phương trình cân bằng nhiệt',
          prompt: 'Viết phương trình cân bằng nhiệt.',
          theoryAnchorIds: [],
          modelAnswer: 'Q_tỏa = Q_thu',
          rubric: [{ id: 'r1', prompt: 'Viết đúng Q_tỏa = Q_thu' }],
          summaryTemplate: 'Q_tỏa = Q_thu',
        },
      ],
    };

    const writtenStep = exercise.steps[1];
    if (!writtenStep || writtenStep.kind !== 'written-reasoning') {
      throw new Error('Expected written step');
    }

    const packet = buildGroundedEssayContextPacket({
      mode: 'socratic-hint',
      canon,
      exercise,
      step: writtenStep,
      stepNumber: 2,
      draft: emptyWrittenStepDraft(),
      chunks: [],
      effectiveTheoryAnchors: [],
    });

    expect(packet.exercise.visualContextSummary).toBeDefined();
    expect(packet.exercise.visualContextSummary?.some(line => line.includes('[90, 65, 40] °C'))).toBe(true);
    expect(packet.exercise.visualContextSummary?.some(line => line.includes('M(hàng 0, cột 1)'))).toBe(true);

    const promptText = formatAskGeminiPromptPacket(packet, { webMcpAvailable: false });
    expect(promptText).toContain('Dữ kiện hình vẽ / đồ thị đi kèm');
    expect(promptText).toContain('[90, 65, 40] °C');
  });

  it('parses legacy v1 exam sessions without completedInteractiveStepIds and round-trips new ones', () => {
    const legacyJson = JSON.stringify({
      version: 1,
      preset: 'standard',
      seed: 42,
      submitted: false,
      draft: {
        objectiveAnswers: { ex1: 'opt-a' },
        writtenResponses: { step1: 'Bài làm tự luận' },
        checkedRubricIds: { step1: ['r1'] },
      },
    });
    const parsedLegacy = parseChapterExamSessionJson(legacyJson);
    expect(parsedLegacy).not.toBeNull();
    expect(parsedLegacy?.draft.completedInteractiveStepIds).toBeUndefined();

    const withInteractiveJson = JSON.stringify({
      version: 1,
      preset: 'short',
      answerMode: 'written-all',
      seed: 7,
      submitted: false,
      draft: {
        objectiveAnswers: {},
        writtenResponses: {},
        checkedRubricIds: {},
        completedInteractiveStepIds: {
          'phy1159-se-8-1': ['step-heatmap-1', 'step-heatmap-2'],
        },
      },
    });
    const parsedInteractive = parseChapterExamSessionJson(withInteractiveJson);
    expect(parsedInteractive?.draft.completedInteractiveStepIds).toEqual({
      'phy1159-se-8-1': ['step-heatmap-1', 'step-heatmap-2'],
    });

    const malformedJson = JSON.stringify({
      version: 1,
      preset: 'short',
      seed: 7,
      submitted: false,
      draft: {
        objectiveAnswers: {},
        writtenResponses: {},
        checkedRubricIds: {},
        completedInteractiveStepIds: {
          'phy1159-se-8-1': [123],
        },
      },
    });
    expect(parseChapterExamSessionJson(malformedJson)).toBeNull();
  });
});
