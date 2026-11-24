import { describe, expect, it } from 'vitest';
import type {
  AxisProjectionStep,
  ChoiceReasoningStep,
  EquationTransformStage,
  NumericUnitStep,
  SemiEssayExercise,
} from '../../src/domain/semi-essay';
import {
  buildSynthesizedEssay,
  evaluateAxisProjectionStep,
  evaluateChoiceReasoningStep,
  evaluateEquationTransformMove,
  evaluateNumericUnitStep,
  parseLocalizedNumber,
} from '../../src/core/learning/semi-essay';

describe('Semi-essay core evaluators', () => {
  it('parses Vietnamese decimal commas and rejects invalid numbers', () => {
    expect(parseLocalizedNumber(' 0,47 ')).toBeCloseTo(0.47);
    expect(parseLocalizedNumber('-18.7')).toBeCloseTo(-18.7);
    expect(parseLocalizedNumber('abc')).toBeNull();
    expect(parseLocalizedNumber('')).toBeNull();
    expect(parseLocalizedNumber('NaN')).toBeNull();
  });

  it('evaluates choice-reasoning with per-choice rationales', () => {
    const step: ChoiceReasoningStep = {
      id: 's1',
      kind: 'choice-reasoning',
      title: 'Dự đoán',
      prompt: 'Chọn chiều',
      theoryAnchorIds: ['a1'],
      choices: [
        { id: 'up', label: 'A lên dốc', rationale: 'Đúng vì m2g > m1g sin(alpha).' },
        { id: 'down', label: 'A xuống dốc', rationale: 'Sai vì thành phần trọng lực nhỏ hơn.' },
      ],
      answers: ['up'],
      summaryTemplate: 'A trượt lên dốc.',
    };
    const wrong = evaluateChoiceReasoningStep(step, ['down']);
    expect(wrong.correct).toBe(false);
    expect(wrong.rationales[0]?.rationale).toContain('nhỏ hơn');

    const right = evaluateChoiceReasoningStep(step, ['up']);
    expect(right.correct).toBe(true);
  });

  it('evaluates axis-projection rows and returns targeted hints', () => {
    const step: AxisProjectionStep = {
      id: 's4',
      kind: 'axis-projection',
      title: 'Chiếu trục',
      prompt: 'Chiếu lực',
      theoryAnchorIds: ['a1'],
      axes: [
        {
          id: 'ox',
          label: "Trục Ox'",
          rhsLatex: 'm_1 a',
          resultingEquationLatex: 'T - m_1 g \\sin\\alpha = m_1 a',
          rows: [
            {
              forceId: 'P',
              forceLatex: 'P',
              expectedSign: '-',
              expectedComponent: 'sin',
              componentOptions: [
                { id: 'sin', latex: 'm_1 g \\sin\\alpha' },
                { id: 'cos', latex: 'm_1 g \\cos\\alpha' },
              ],
              hint: 'Thành phần song song mặt nghiêng là sin(alpha) và hướng xuống dốc (-).',
            },
          ],
        },
      ],
      summaryTemplate: 'Chiếu lên Ox.',
    };

    const bad = evaluateAxisProjectionStep(step, { ox: { P: { sign: '-', component: 'cos' } } });
    expect(bad.correct).toBe(false);
    expect(bad.errors[0]?.hint).toContain('sin');

    const ok = evaluateAxisProjectionStep(step, { ox: { P: { sign: '-', component: 'sin' } } });
    expect(ok.correct).toBe(true);
  });

  it('handles suboptimal vs optimal equation-transform moves without advancing on suboptimal', () => {
    const stage: EquationTransformStage = {
      id: 'st1',
      prompt: 'Khử lực căng T',
      operations: [
        {
          id: 'sub',
          label: 'Trừ (1) - (2)',
          resultLatex: '2T - m_1 g\\sin\\alpha - m_2 g = (m_1 - m_2)a',
          optimal: false,
          feedback: 'Phép trừ tạo ra 2T thay vì khử T.',
        },
        {
          id: 'add',
          label: 'Cộng (1) + (2)',
          resultLatex: 'm_2 g - m_1 g\\sin\\alpha = (m_1 + m_2)a',
          canceledLatex: '+T - T = 0',
          optimal: true,
          feedback: 'Chính xác, lực căng T đã triệt tiêu.',
        },
      ],
    };

    const sub = evaluateEquationTransformMove(stage, 'sub');
    expect(sub.found).toBe(true);
    expect(sub.advance).toBe(false);
    expect(sub.feedback).toContain('2T');

    const add = evaluateEquationTransformMove(stage, 'add');
    expect(add.advance).toBe(true);
    expect(add.canceledLatex).toBe('+T - T = 0');
  });

  it('grades numeric-unit with tolerance and builds synthesized essay sections', () => {
    const step: NumericUnitStep = {
      id: 's5',
      kind: 'numeric-unit',
      title: 'Tính số',
      prompt: 'Tính a',
      theoryAnchorIds: ['a1'],
      fields: [
        { id: 'a', label: 'Gia tốc', symbolLatex: 'a', expected: 0.47, tolerance: 0.03, toleranceMode: 'absolute', unit: 'm/s²' },
      ],
      explanation: 'Thay số.',
      summaryTemplate: 'a ≈ 0,47 m/s².',
    };
    expect(evaluateNumericUnitStep(step, { a: '0,48' }).correct).toBe(true);
    expect(evaluateNumericUnitStep(step, { a: '0,90' }).correct).toBe(false);
    expect(evaluateNumericUnitStep(step, { a: 'xyz' }).fields[0]?.status).toBe('invalid');

    const exercise: SemiEssayExercise = {
      id: 'ex',
      lessonId: 'l',
      kind: 'semi-essay',
      title: 'Test',
      prompt: 'Prompt',
      given: [],
      theoryAnchors: [{ id: 'a1', title: 'T', summary: 'S', conditions: [] }],
      steps: [step],
    };
    expect(buildSynthesizedEssay(exercise, new Set(['s5']))).toHaveLength(1);
    expect(buildSynthesizedEssay(exercise, new Set())).toHaveLength(0);
  });
});
