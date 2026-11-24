import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Lesson } from '../../src/domain/learning';
import type {
  CodeSlotBuilderInteraction,
  ConceptProbeInteraction,
  DiagramGuidedInteraction,
  MoGuidedCanvasInteraction,
  NumericCheckInteraction,
  SkillQuest,
  StepChainBuilderInteraction,
} from '../../src/domain/skill-quest';
import { EMPTY_MO_COUNTS, getExpectedMoCounts } from '../../src/core/chemistry/essay-engine';
import { evaluateQuestInteraction, validateSkillQuests } from '../../src/core/quests/evaluator';
import {
  QUEST_PROGRESS_KEY,
  createQuestProgressStore,
  emptyQuestProgress,
  parseQuestProgress,
} from '../../src/infrastructure/quests/store';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('evaluateQuestInteraction', () => {
  const conceptProbe: ConceptProbeInteraction = {
    kind: 'concept-probe',
    prompt: 'Vì sao đệ quy cần điều kiện dừng?',
    choices: [
      { id: 'a', label: 'Để tránh tràn ngăn xếp', rationale: 'Chính xác: thiếu base case sẽ gọi vô hạn và gây StackOverflow.' },
      { id: 'b', label: 'Để chương trình chạy chậm hơn', rationale: 'Sai: điều kiện dừng giúp kết thúc phép đệ quy đúng lúc.' },
    ],
    answerId: 'a',
  };

  it('rejects mismatched interaction and answer kinds', () => {
    const result = evaluateQuestInteraction(conceptProbe, {
      kind: 'numeric-check',
      rawValue: '1',
    });
    expect(result).toEqual({
      correct: false,
      feedback: 'Kiểu câu trả lời không khớp với chặng hiện tại.',
    });
  });

  it('evaluates concept-probe with choice rationale and missing-choice prompt', () => {
    expect(evaluateQuestInteraction(conceptProbe, { kind: 'concept-probe', choiceId: '' }).correct).toBe(false);

    const wrong = evaluateQuestInteraction(conceptProbe, { kind: 'concept-probe', choiceId: 'b' });
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback).toContain('Sai');

    const right = evaluateQuestInteraction(conceptProbe, { kind: 'concept-probe', choiceId: 'a' });
    expect(right.correct).toBe(true);
    expect(right.feedback).toContain('StackOverflow');
  });

  it('evaluates code-slot-builder per-slot diagnostics and simulated output', () => {
    const codeBuilder: CodeSlotBuilderInteraction = {
      kind: 'code-slot-builder',
      language: 'python',
      codeTemplate: 'def gcd(a, b):\n  if {{base}}:\n    return a\n  return {{step}}',
      slots: [
        {
          id: 'base',
          placeholder: 'điều kiện dừng',
          correctOptionId: 'b1',
          options: [
            { id: 'b1', code: 'b == 0', feedback: 'Đúng base case Euclid.' },
            { id: 'b2', code: 'a == 0', feedback: 'Khi a == 0 thì kết quả phải là b chứ không phải a.' },
          ],
        },
        {
          id: 'step',
          placeholder: 'bước đệ quy',
          correctOptionId: 's1',
          options: [
            { id: 's1', code: 'gcd(b, a % b)', feedback: 'Chuẩn Euclid.' },
            { id: 's2', code: 'gcd(a, b)', feedback: 'Gọi lại y nguyên tham số sẽ lặp vô hạn!' },
          ],
        },
      ],
      simulatedOutput: 'gcd(48, 18) = 6',
    };

    const incomplete = evaluateQuestInteraction(codeBuilder, {
      kind: 'code-slot-builder',
      selectedBySlotId: { base: 'b1' },
    });
    expect(incomplete.correct).toBe(false);
    expect(incomplete.feedback).toBe('Hãy chọn đủ mảnh code cho mọi ô trống đang sáng viền vàng.');

    const wrongFirst = evaluateQuestInteraction(codeBuilder, {
      kind: 'code-slot-builder',
      selectedBySlotId: { base: 'b2', step: 's2' },
    });
    expect(wrongFirst.correct).toBe(false);
    expect(wrongFirst.feedback).toBe('Khi a == 0 thì kết quả phải là b chứ không phải a.');

    const wrongSecond = evaluateQuestInteraction(codeBuilder, {
      kind: 'code-slot-builder',
      selectedBySlotId: { base: 'b1', step: 's2' },
    });
    expect(wrongSecond.correct).toBe(false);
    expect(wrongSecond.feedback).toBe('Gọi lại y nguyên tham số sẽ lặp vô hạn!');

    const solved = evaluateQuestInteraction(codeBuilder, {
      kind: 'code-slot-builder',
      selectedBySlotId: { base: 'b1', step: 's1' },
    });
    expect(solved.correct).toBe(true);
    expect(solved.feedback).toBe('Chuẩn xác! Kết quả mô phỏng: gcd(48, 18) = 6');
  });

  it('evaluates mo-guided-canvas across select-ordering, fill-electrons, and count-bo (with comma decimal)', () => {
    const baseMo: Omit<MoGuidedCanvasInteraction, 'mode'> = {
      kind: 'mo-guided-canvas',
      moleculeLabel: 'N2',
      atomicNumber: 7,
      totalValenceElectrons: 10,
      expectedOrdering: 'type-2',
      expectedBondOrder: 3,
      expectedMagnetism: 'diamagnetic',
    };

    // 1. select-ordering (Z <= 7)
    const orderingStage: MoGuidedCanvasInteraction = { ...baseMo, mode: 'select-ordering' };
    const wrongOrder = evaluateQuestInteraction(orderingStage, {
      kind: 'mo-guided-canvas',
      chosenOrdering: 'type-1',
    });
    expect(wrongOrder.correct).toBe(false);
    expect(wrongOrder.feedback).toContain('Z ≤ 7');

    const rightOrder = evaluateQuestInteraction(orderingStage, {
      kind: 'mo-guided-canvas',
      chosenOrdering: 'type-2',
    });
    expect(rightOrder.correct).toBe(true);
    expect(rightOrder.feedback).toContain('π₂p < σ₂p');

    // Z >= 8 ordering
    const o2Ordering: MoGuidedCanvasInteraction = {
      kind: 'mo-guided-canvas',
      mode: 'select-ordering',
      moleculeLabel: 'O2',
      atomicNumber: 8,
      totalValenceElectrons: 12,
      expectedOrdering: 'type-1',
      expectedBondOrder: 2,
      expectedMagnetism: 'paramagnetic',
    };
    expect(
      evaluateQuestInteraction(o2Ordering, { kind: 'mo-guided-canvas', chosenOrdering: 'type-1' }).correct,
    ).toBe(true);
    expect(
      evaluateQuestInteraction(o2Ordering, { kind: 'mo-guided-canvas', chosenOrdering: 'type-2' }).feedback,
    ).toContain('Z ≥ 8');

    // 2. fill-electrons (Aufbau / Hund / full)
    const fillStage: MoGuidedCanvasInteraction = { ...baseMo, mode: 'fill-electrons' };
    expect(evaluateQuestInteraction(fillStage, { kind: 'mo-guided-canvas' }).correct).toBe(false);

    const hundViolation = evaluateQuestInteraction(fillStage, {
      kind: 'mo-guided-canvas',
      slotCounts: { ...EMPTY_MO_COUNTS, s2s: 2, s2s_star: 2, p2p_1: 2, p2p_2: 0 },
    });
    expect(hundViolation.correct).toBe(false);
    expect(hundViolation.feedback).toContain('Hund');

    const aufbauViolation = evaluateQuestInteraction(fillStage, {
      kind: 'mo-guided-canvas',
      slotCounts: { ...EMPTY_MO_COUNTS, s2s: 2, s2s_star: 1, p2p_1: 1 },
    });
    expect(aufbauViolation.correct).toBe(false);
    expect(aufbauViolation.feedback).toContain('Aufbau');

    const correctN2Fill = evaluateQuestInteraction(fillStage, {
      kind: 'mo-guided-canvas',
      slotCounts: getExpectedMoCounts('type-2', 10),
    });
    expect(correctN2Fill.correct).toBe(true);

    // 3. count-bo with Vietnamese comma "1,5" (e.g. NO / O2-)
    const countBoStage: MoGuidedCanvasInteraction = {
      kind: 'mo-guided-canvas',
      mode: 'count-bo',
      moleculeLabel: 'O2−',
      atomicNumber: 8,
      totalValenceElectrons: 13,
      expectedOrdering: 'type-1',
      expectedBondOrder: 1.5,
      expectedMagnetism: 'paramagnetic',
    };

    const wrongMag = evaluateQuestInteraction(countBoStage, {
      kind: 'mo-guided-canvas',
      bondOrderInput: '1,5',
      chosenMagnetism: 'diamagnetic',
    });
    expect(wrongMag.correct).toBe(false);
    expect(wrongMag.feedback).toContain('thuận từ');

    const wrongBo = evaluateQuestInteraction(countBoStage, {
      kind: 'mo-guided-canvas',
      bondOrderInput: '2',
      chosenMagnetism: 'paramagnetic',
    });
    expect(wrongBo.correct).toBe(false);

    const rightCommaBo = evaluateQuestInteraction(countBoStage, {
      kind: 'mo-guided-canvas',
      bondOrderInput: '1,5',
      chosenMagnetism: 'paramagnetic',
    });
    expect(rightCommaBo.correct).toBe(true);

    const rightDotBo = evaluateQuestInteraction(countBoStage, {
      kind: 'mo-guided-canvas',
      bondOrderInput: '1.5',
      chosenMagnetism: 'paramagnetic',
    });
    expect(rightDotBo.correct).toBe(true);
  });

  it('evaluates diagram-guided pass-through verdicts', () => {
    const diagramStage: DiagramGuidedInteraction = {
      kind: 'diagram-guided',
      diagramKind: 'fbd',
      spec: {
        kind: 'fbd',
        note: 'Vẽ FBD vật trên mặt phẳng nghiêng',
        bodies: [],
        forceCatalog: {},
      },
    };

    const failed = evaluateQuestInteraction(diagramStage, {
      kind: 'diagram-guided',
      diagramPassed: false,
      diagramSummary: 'Còn thiếu phản lực pháp tuyến N.',
    });
    expect(failed).toEqual({
      correct: false,
      feedback: 'Còn thiếu phản lực pháp tuyến N.',
    });

    const passed = evaluateQuestInteraction(diagramStage, {
      kind: 'diagram-guided',
      diagramPassed: true,
    });
    expect(passed).toEqual({
      correct: true,
      feedback: 'Sơ đồ chính xác!',
    });
  });

  it('evaluates step-chain-builder slots in order', () => {
    const chainStage: StepChainBuilderInteraction = {
      kind: 'step-chain-builder',
      contextLatex: 'P(A) = P(H_1)P(A|H_1) + P(H_2)P(A|H_2)',
      slots: [
        {
          id: 'step-1',
          stepLabel: 'Bước 1: Xác suất toàn phần',
          correctOptionId: 'ok-1',
          options: [
            { id: 'ok-1', labelLatex: '0.0295', feedback: 'Đúng!' },
            { id: 'bad-1', labelLatex: '0.95', feedback: 'Chưa nhân với tiên nghiệm P(H_i).' },
          ],
        },
        {
          id: 'step-2',
          stepLabel: 'Bước 2: Hậu nghiệm Bayes',
          correctOptionId: 'ok-2',
          options: [
            { id: 'ok-2', labelLatex: '0.322', feedback: 'Chuẩn!' },
            { id: 'bad-2', labelLatex: '0.01', feedback: 'Quên chia cho P(A).' },
          ],
        },
      ],
    };

    const badFirst = evaluateQuestInteraction(chainStage, {
      kind: 'step-chain-builder',
      selectedBySlotId: { 'step-1': 'bad-1', 'step-2': 'ok-2' },
    });
    expect(badFirst).toEqual({
      correct: false,
      feedback: 'Chưa nhân với tiên nghiệm P(H_i).',
    });

    const missingSecond = evaluateQuestInteraction(chainStage, {
      kind: 'step-chain-builder',
      selectedBySlotId: { 'step-1': 'ok-1' },
    });
    expect(missingSecond.correct).toBe(false);

    const allOk = evaluateQuestInteraction(chainStage, {
      kind: 'step-chain-builder',
      selectedBySlotId: { 'step-1': 'ok-1', 'step-2': 'ok-2' },
    });
    expect(allOk).toEqual({
      correct: true,
      feedback: 'Chuỗi biến đổi hoàn toàn chính xác!',
    });
  });

  it('evaluates numeric-check with Vietnamese comma decimal and limitingQuestion', () => {
    const numericStage: NumericCheckInteraction = {
      kind: 'numeric-check',
      label: 'Gia tốc hệ vật',
      symbolLatex: 'a',
      expected: 0.5,
      tolerance: 0.02,
      unit: 'm/s²',
      limitingQuestion: {
        prompt: 'Khi α = 90°, gia tốc tiến về bao nhiêu?',
        choices: [
          { id: 'g', label: 'a = g', rationale: 'Đúng: sin 90° = 1 nên vật rơi tự do khi m2 >> m1.' },
          { id: 'zero', label: 'a = 0', rationale: 'Sai: tại α = 90° lực kéo trọng trường đạt cực đại.' },
        ],
        answerId: 'g',
      },
    };

    expect(
      evaluateQuestInteraction(numericStage, { kind: 'numeric-check', rawValue: 'abc' }),
    ).toEqual({
      correct: false,
      feedback: 'Hãy nhập một giá trị số hợp lệ.',
    });

    expect(
      evaluateQuestInteraction(numericStage, {
        kind: 'numeric-check',
        rawValue: '0,9',
        limitingChoiceId: 'g',
      }).correct,
    ).toBe(false);

    expect(
      evaluateQuestInteraction(numericStage, {
        kind: 'numeric-check',
        rawValue: '0,5',
      }).correct,
    ).toBe(false);

    const wrongLimiting = evaluateQuestInteraction(numericStage, {
      kind: 'numeric-check',
      rawValue: '0,5',
      limitingChoiceId: 'zero',
    });
    expect(wrongLimiting.correct).toBe(false);
    expect(wrongLimiting.feedback).toContain('Sai');

    const solved = evaluateQuestInteraction(numericStage, {
      kind: 'numeric-check',
      rawValue: '0,5',
      limitingChoiceId: 'g',
    });
    expect(solved.correct).toBe(true);
    expect(solved.feedback).toContain('sin 90° = 1');
  });
});

describe('validateSkillQuests', () => {
  const lessons: readonly Lesson[] = [
    {
      id: 'lesson-1',
      topicId: 'topic-1',
      title: 'Bài 1',
      content: { format: 'markdown', assetPath: 'a.md' },
      exerciseIds: [],
      resourceIds: [],
    },
  ];

  function makeValidQuest(id = 'q-1', lessonId = 'lesson-1'): SkillQuest {
    const milestoneBase = {
      tag: 'Mốc',
      title: 'Tiêu đề',
      coachActPrompt: 'Làm đi',
      coachAdvancePrompt: 'Tốt!',
      coreMarkdown: 'Nội dung',
      deepDiveMarkdown: 'Đào sâu',
    };
    return {
      id,
      courseId: 'c-1',
      subjectId: 'cs',
      lessonId,
      title: 'Quest',
      subtitle: 'Sub',
      categoryLabel: 'CS',
      estimatedMinutes: 5,
      milestones: [
        {
          ...milestoneBase,
          id: 'm1',
          interaction: {
            kind: 'concept-probe',
            prompt: 'Hỏi?',
            choices: [{ id: 'c1', label: 'Đáp án', rationale: 'Lý do' }],
            answerId: 'c1',
          },
        },
        {
          ...milestoneBase,
          id: 'm2',
          interaction: {
            kind: 'code-slot-builder',
            language: 'python',
            codeTemplate: 'print({{slot1}})',
            slots: [
              {
                id: 'slot1',
                placeholder: 'giá trị',
                options: [{ id: 'o1', code: '42', feedback: 'OK' }],
                correctOptionId: 'o1',
              },
            ],
            simulatedOutput: '42',
          },
        },
        {
          ...milestoneBase,
          id: 'm3',
          interaction: {
            kind: 'step-chain-builder',
            slots: [
              {
                id: 's1',
                stepLabel: 'Bước 1',
                options: [{ id: 'so1', labelLatex: 'x=1', feedback: 'OK' }],
                correctOptionId: 'so1',
              },
            ],
          },
        },
      ],
    };
  }

  it('returns empty errors for valid quests', () => {
    expect(validateSkillQuests([makeValidQuest()], lessons)).toEqual([]);
  });

  it('catches bad lessonId, duplicate ids, short milestones, missing placeholders, and invalid answer references', () => {
    const q1 = makeValidQuest('dup-quest', 'missing-lesson');
    const q2: SkillQuest = {
      ...makeValidQuest('dup-quest', 'lesson-1'),
      milestones: [
        {
          ...q1.milestones[0]!,
          id: 'dup-m',
          interaction: {
            kind: 'concept-probe',
            prompt: '?',
            choices: [{ id: 'c1', label: 'A', rationale: 'R' }],
            answerId: 'missing-choice',
          },
        },
        {
          ...q1.milestones[1]!,
          id: 'dup-m',
          interaction: {
            kind: 'code-slot-builder',
            language: 'python',
            codeTemplate: 'print(1)',
            slots: [
              {
                id: 'missing_slot',
                placeholder: 'x',
                options: [{ id: 'o1', code: '1', feedback: 'ok' }],
                correctOptionId: 'missing-opt',
              },
            ],
            simulatedOutput: '1',
          },
        },
      ],
    };

    const errors = validateSkillQuests([q1, q2], lessons);
    expect(errors.some(e => e.includes('missing-lesson'))).toBe(true);
    expect(errors.some(e => e.includes('Trùng mã quest'))).toBe(true);
    expect(errors.some(e => e.includes('ít nhất 3 mốc'))).toBe(true);
    expect(errors.some(e => e.includes('trùng mã mốc'))).toBe(true);
    expect(errors.some(e => e.includes('missing-choice'))).toBe(true);
    expect(errors.some(e => e.includes('{{missing_slot}}'))).toBe(true);
    expect(errors.some(e => e.includes('missing-opt'))).toBe(true);
  });
});

describe('questProgressStore and parseQuestProgress', () => {
  it('parses valid progress and rejects malformed JSON or schema violations', () => {
    const valid = {
      schemaVersion: 1 as const,
      milestoneProgress: { 'quest-a': 2 },
      completedQuestIds: ['quest-b'],
    };
    expect(parseQuestProgress(JSON.stringify(valid))).toEqual(valid);
    expect(parseQuestProgress(JSON.stringify(emptyQuestProgress()))).toEqual(emptyQuestProgress());

    for (const bad of [
      '{broken',
      'null',
      '[]',
      JSON.stringify({ schemaVersion: 2, milestoneProgress: {}, completedQuestIds: [] }),
      JSON.stringify({ schemaVersion: 1, milestoneProgress: { q: -1 }, completedQuestIds: [] }),
      JSON.stringify({ schemaVersion: 1, milestoneProgress: { q: 1.5 }, completedQuestIds: [] }),
      JSON.stringify({ schemaVersion: 1, milestoneProgress: {}, completedQuestIds: [123] }),
    ]) {
      expect(() => parseQuestProgress(bad)).toThrow();
    }
  });

  it('tracks max milestone progress, completion, reset, and subscriptions', () => {
    const memory = new Map<string, string>();
    const store = createQuestProgressStore({
      getItem: k => memory.get(k) ?? null,
      setItem: (k, v) => {
        memory.set(k, v);
      },
    });

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.recordMilestone('quest-1', 2, 4);
    expect(store.getState().milestoneProgress['quest-1']).toBe(2);
    expect(store.getState().completedQuestIds).toEqual([]);

    // Never regresses when lower count is recorded
    store.recordMilestone('quest-1', 1, 4);
    expect(store.getState().milestoneProgress['quest-1']).toBe(2);

    // Marks completed at totalMilestones
    store.recordMilestone('quest-1', 4, 4);
    expect(store.getState().milestoneProgress['quest-1']).toBe(4);
    expect(store.getState().completedQuestIds).toEqual(['quest-1']);
    expect(JSON.parse(memory.get(QUEST_PROGRESS_KEY)!)).toEqual(store.getState());

    store.resetQuest('quest-1');
    expect(store.getState().milestoneProgress['quest-1']).toBeUndefined();
    expect(store.getState().completedQuestIds).toEqual([]);

    unsubscribe();
    store.recordMilestone('quest-2', 1, 4);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('works cleanly in-memory when storage or window.localStorage getter throws', async () => {
    const throwingStore = createQuestProgressStore({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    });

    expect(throwingStore.getError()).toContain('Không thể truy cập bộ nhớ trình duyệt');
    expect(() => throwingStore.recordMilestone('quest-1', 4, 4)).not.toThrow();
    expect(throwingStore.getState().milestoneProgress['quest-1']).toBe(4);
    expect(throwingStore.getState().completedQuestIds).toEqual(['quest-1']);

    // Also test module-level questProgressStore against a throwing window.localStorage getter
    vi.resetModules();
    const fakeWindow = {};
    Object.defineProperty(fakeWindow, 'localStorage', {
      get() {
        throw new Error('SecurityError: blocked');
      },
    });
    vi.stubGlobal('window', fakeWindow);

    const { questProgressStore } = await import('../../src/infrastructure/quests/store');
    expect(questProgressStore.getError()).toContain('Không thể truy cập bộ nhớ trình duyệt');
    expect(() => questProgressStore.recordMilestone('quest-x', 3, 4)).not.toThrow();
    expect(questProgressStore.getState().milestoneProgress['quest-x']).toBe(3);
  });
});
