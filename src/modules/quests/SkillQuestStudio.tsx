import {
  lazy,
  Suspense,
  useMemo,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { Link, useNavigate } from 'react-router';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { CodeLanguage } from '../../domain/code-lab';
import type { DiagramStepSpec } from '../../domain/semi-essay';
import type {
  CodeSlotBuilderInteraction,
  ConceptProbeInteraction,
  DiagramGuidedInteraction,
  MoGuidedCanvasInteraction,
  NumericCheckInteraction,
  QuestEvaluationResult,
  QuestInteractionAnswer,
  QuestStageInteraction,
  SkillQuest,
  SkillQuestMilestone,
  StepChainBuilderInteraction,
} from '../../domain/skill-quest';
import {
  buildExpectedMoFillSequence,
  EMPTY_MO_COUNTS,
  getExpectedMoCounts,
  type MoOrdering,
  type MoSlotCounts,
} from '../../core/chemistry/essay-engine';
import { evaluateQuestInteraction } from '../../core/quests/evaluator';
import { progressStore } from '../../infrastructure/progress/store';
import { questProgressStore } from '../../infrastructure/quests/store';
import { useLearningProgress } from '../../app/useLearningProgress';
import { useQuestProgress } from '../../app/useQuestProgress';
import { getDiagramModule } from '../diagrams/registry';
import type { MoProblemConfig } from '../chemistry/MoDiagramCanvas';
import Markdown from '../../components/learning/Markdown';
import { Badge } from '../../components/ui/Badge';
import { GuidingBeacon } from '../../components/ui/GuidingBeacon';
import { StarlightBurst } from '../../components/ui/StarlightBurst';
import {
  CheckCircleIcon,
  RotateCcwIcon,
} from '../../components/ui/Icons';

export interface SkillQuestStudioProps {
  readonly quest: SkillQuest;
  readonly courseTitle: string;
  readonly courseCode: string;
}

const LazyMoDiagramCanvas = lazy(() =>
  import('../chemistry/MoDiagramCanvas').then(m => ({ default: m.MoDiagramCanvas })),
);

const LazyCodeLabWorkspace = lazy(() => import('../code-lab/CodeLabWorkspace'));

const DIAGRAM_LAZY_CACHE: Partial<
  Record<DiagramStepSpec['kind'], LazyExoticComponent<ComponentType<DiagramRendererProps>>>
> = {};

function getLazyDiagramComponent(
  kind: DiagramStepSpec['kind'],
): LazyExoticComponent<ComponentType<DiagramRendererProps>> {
  const existing = DIAGRAM_LAZY_CACHE[kind];
  if (existing) {
    return existing;
  }
  const created = lazy(() => getDiagramModule(kind).load());
  DIAGRAM_LAZY_CACHE[kind] = created;
  return created;
}

function wrapInlineLatex(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('$')) {
    return trimmed;
  }
  return `$${trimmed}$`;
}

function buildMoConfigFromInteraction(interaction: MoGuidedCanvasInteraction): MoProblemConfig {
  const cleanAtom =
    interaction.moleculeLabel.replace(/[₂₃23⁺⁻+\-\s]/g, '').trim() || interaction.moleculeLabel;
  return {
    kind: 'mo-diagram',
    speciesLabel: interaction.moleculeLabel,
    atomLeft: cleanAtom,
    atomRight: cleanAtom,
    expectedOrdering: interaction.expectedOrdering,
    expectedTotalElectrons: interaction.totalValenceElectrons,
    expectedBondOrder: interaction.expectedBondOrder,
    expectedMagnetism: interaction.expectedMagnetism,
  };
}

interface MilestoneInteractionProps {
  readonly interaction: QuestStageInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
  readonly onAnswerChanged: () => void;
}

function ConceptProbeView({
  interaction,
  solved,
  onEvaluated,
}: {
  readonly interaction: ConceptProbeInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    solved ? interaction.answerId : null,
  );
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(solved ? true : null);

  const handleSelect = (choiceId: string) => {
    setSelectedId(choiceId);
    const result = evaluateQuestInteraction(interaction, {
      kind: 'concept-probe',
      choiceId,
    });
    setLastCorrect(result.correct);
    onEvaluated(result);
  };

  return (
    <div className="space-y-3">
      <div className="academic-prose text-sm font-medium text-ink">
        <Markdown>{interaction.prompt}</Markdown>
      </div>
      <div className="space-y-2.5" role="radiogroup" aria-label="Chọn câu trả lời">
        {interaction.choices.map((choice, index) => {
          const isSelected = selectedId === choice.id;
          const isCorrectChoice = isSelected && lastCorrect === true;
          const isWrongChoice = isSelected && lastCorrect === false;
          const highlightUnselected = !selectedId && index === 0;

          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(choice.id)}
              className={`flex min-h-[44px] w-full items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-sm transition-colors duration-200 ${
                isCorrectChoice
                  ? 'border-success bg-success-subtle/75 text-ink'
                  : isWrongChoice
                    ? 'border-warning bg-warning-subtle/80 text-ink'
                    : highlightUnselected
                      ? 'border-starlight/55 bg-surface hover:border-starlight hover:bg-surface-subtle/60'
                      : 'border-border bg-surface hover:border-border-strong hover:bg-surface-subtle/60'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isCorrectChoice
                    ? 'border-success bg-success text-canvas'
                    : isWrongChoice
                      ? 'border-warning bg-warning text-canvas'
                      : 'border-border-strong text-ink-muted'
                }`}
              >
                {isCorrectChoice ? '✓' : String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1 leading-relaxed text-ink">
                <Markdown inline>{choice.label}</Markdown>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CodeSlotBuilderView({
  interaction,
  solved,
  onEvaluated,
  onAnswerChanged,
}: {
  readonly interaction: CodeSlotBuilderInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
  readonly onAnswerChanged: () => void;
}) {
  const [selectedBySlotId, setSelectedBySlotId] = useState<Readonly<Record<string, string>>>(() =>
    solved
      ? Object.fromEntries(interaction.slots.map(s => [s.id, s.correctOptionId]))
      : {},
  );
  const [hasCorrectCheck, setHasCorrectCheck] = useState(solved);

  const slotMap = useMemo(
    () => new Map(interaction.slots.map(slot => [slot.id, slot])),
    [interaction.slots],
  );

  const firstUnfilledSlotId = useMemo(
    () => interaction.slots.find(slot => !selectedBySlotId[slot.id])?.id ?? null,
    [interaction.slots, selectedBySlotId],
  );

  const templateSegments = useMemo(
    () => interaction.codeTemplate.split(/\{\{([a-zA-Z0-9_-]+)\}\}/g),
    [interaction.codeTemplate],
  );

  const handlePickToken = (slotId: string, optionId: string) => {
    setSelectedBySlotId(prev => ({
      ...prev,
      [slotId]: optionId,
    }));
    setHasCorrectCheck(false);
    onAnswerChanged();
  };

  const handleClearSlot = (slotId: string) => {
    setSelectedBySlotId(prev => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setHasCorrectCheck(false);
    onAnswerChanged();
  };

  const handleCheck = () => {
    const answer: QuestInteractionAnswer = {
      kind: 'code-slot-builder',
      selectedBySlotId,
    };
    const result = evaluateQuestInteraction(interaction, answer);
    setHasCorrectCheck(result.correct);
    onEvaluated(result);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="font-mono uppercase tracking-wide">{interaction.language}</span>
          <span>Nhấn mảnh code bên dưới để lắp vào ô sáng</span>
        </div>
        <pre className="max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-canvas px-3 py-3 font-mono text-xs leading-relaxed text-ink">
          <code>
            {templateSegments.map((segment, index) => {
              if (index % 2 === 0) {
                return <span key={index}>{segment}</span>;
              }
              const slot = slotMap.get(segment);
              if (!slot) {
                return <span key={index}>{`{{${segment}}}`}</span>;
              }
              const chosenId = selectedBySlotId[slot.id];
              const chosenOpt = slot.options.find(opt => opt.id === chosenId);
              const isActiveTarget = !chosenOpt && firstUnfilledSlotId === slot.id;

              if (chosenOpt) {
                return (
                  <button
                    key={`${slot.id}-${index}`}
                    type="button"
                    onClick={() => handleClearSlot(slot.id)}
                    title="Nhấn để bỏ chọn mảnh code này"
                    className={`mx-0.5 inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono text-xs font-semibold transition-colors ${
                      hasCorrectCheck || solved
                        ? 'border-success/55 bg-success-subtle text-success'
                        : 'border-accent/45 bg-accent-subtle text-accent-ink hover:border-border-strong'
                    }`}
                  >
                    {chosenOpt.code}
                  </button>
                );
              }

              return (
                <span
                  key={`${slot.id}-${index}`}
                  className={`mx-0.5 inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono text-xs transition-colors ${
                    isActiveTarget
                      ? 'border-starlight bg-warning-subtle font-semibold text-ink ring-2 ring-starlight/30'
                      : 'border-dashed border-border-strong bg-surface text-ink-muted'
                  }`}
                >
                  {isActiveTarget ? `☞ [${slot.placeholder}]` : `[${slot.placeholder}]`}
                </span>
              );
            })}
          </code>
        </pre>
      </div>

      <div className="space-y-3">
        {interaction.slots.map((slot, slotIdx) => {
          const chosenId = selectedBySlotId[slot.id];
          const isCurrentFocus = firstUnfilledSlotId === slot.id;
          return (
            <div
              key={slot.id}
              className={`rounded-[var(--radius-md)] border p-3 transition-colors ${
                isCurrentFocus
                  ? 'border-starlight/60 bg-warning-subtle/30'
                  : 'border-border bg-surface'
              }`}
            >
              <p className="mb-2 text-xs font-semibold text-ink-secondary">
                Ô #{slotIdx + 1}: {slot.placeholder}
              </p>
              <div className="flex flex-wrap gap-2">
                {slot.options.map(option => {
                  const selected = chosenId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handlePickToken(slot.id, option.id)}
                      aria-pressed={selected}
                      className={`min-h-[44px] max-w-full break-all rounded-[var(--radius-sm)] border px-3 py-2 text-left font-mono text-xs transition-colors ${
                        selected
                          ? 'border-accent bg-accent-subtle font-semibold text-accent-ink ring-2 ring-accent/20'
                          : 'border-border bg-surface-subtle/70 text-ink hover:border-border-strong hover:bg-surface-subtle'
                      }`}
                    >
                      {option.code}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary min-h-[44px]">
          ▶ Kiểm tra mảnh code
        </button>
      </div>

      {hasCorrectCheck || solved ? (
        <div className="rounded-[var(--radius-md)] border border-success/40 bg-success-subtle/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
            Đầu ra mô phỏng
          </p>
          <pre className="mt-1.5 overflow-x-auto font-mono text-xs text-ink">
            {interaction.simulatedOutput}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function MoGuidedCanvasView({
  interaction,
  solved,
  onEvaluated,
  onAnswerChanged,
}: {
  readonly interaction: MoGuidedCanvasInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
  readonly onAnswerChanged: () => void;
}) {
  const moConfig = useMemo(() => buildMoConfigFromInteraction(interaction), [interaction]);
  const expectedCounts = useMemo(
    () => getExpectedMoCounts(interaction.expectedOrdering, interaction.totalValenceElectrons),
    [interaction.expectedOrdering, interaction.totalValenceElectrons],
  );
  const expectedSequence = useMemo(
    () =>
      buildExpectedMoFillSequence(
        interaction.expectedOrdering,
        interaction.totalValenceElectrons,
      ),
    [interaction.expectedOrdering, interaction.totalValenceElectrons],
  );

  // Mode 1: select-ordering
  const [chosenOrdering, setChosenOrdering] = useState<MoOrdering | undefined>(
    solved ? interaction.expectedOrdering : undefined,
  );
  // Mode 2: fill-electrons
  const [slotCounts, setSlotCounts] = useState<MoSlotCounts>(
    solved ? expectedCounts : EMPTY_MO_COUNTS,
  );
  // Mode 3: count-bo
  const [bondOrderInput, setBondOrderInput] = useState(
    solved ? String(interaction.expectedBondOrder).replace('.', ',') : '',
  );
  const [chosenMagnetism, setChosenMagnetism] = useState<'paramagnetic' | 'diamagnetic' | undefined>(
    solved ? interaction.expectedMagnetism : undefined,
  );

  const previewOrdering: MoOrdering =
    chosenOrdering ?? (interaction.expectedOrdering === 'type-1' ? 'type-2' : 'type-1');

  const nextExpectedStep = useMemo(
    () => expectedSequence.find(step => slotCounts[step.slotId] < step.countsAfter[step.slotId]),
    [expectedSequence, slotCounts],
  );

  const handleSelectOrdering = (ordering: MoOrdering) => {
    setChosenOrdering(ordering);
    onAnswerChanged();
  };

  const handleCheckOrdering = () => {
    onEvaluated(
      evaluateQuestInteraction(interaction, {
        kind: 'mo-guided-canvas',
        ...(chosenOrdering !== undefined ? { chosenOrdering } : {}),
      }),
    );
  };

  const handleCheckFill = () => {
    onEvaluated(
      evaluateQuestInteraction(interaction, {
        kind: 'mo-guided-canvas',
        slotCounts,
      }),
    );
  };

  const handleCheckBo = () => {
    onEvaluated(
      evaluateQuestInteraction(interaction, {
        kind: 'mo-guided-canvas',
        bondOrderInput,
        ...(chosenMagnetism !== undefined ? { chosenMagnetism } : {}),
      }),
    );
  };

  if (interaction.mode === 'select-ordering') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSelectOrdering('type-2')}
            aria-pressed={chosenOrdering === 'type-2'}
            className={`min-h-[44px] rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
              chosenOrdering === 'type-2'
                ? 'border-accent bg-accent-subtle text-accent-ink ring-2 ring-accent/20'
                : 'border-border bg-surface text-ink hover:border-border-strong'
            }`}
          >
            Khung Loại II (Z ≤ 7, có trộn s–p: π₂p thấp hơn σ₂p)
          </button>
          <button
            type="button"
            onClick={() => handleSelectOrdering('type-1')}
            aria-pressed={chosenOrdering === 'type-1'}
            className={`min-h-[44px] rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
              chosenOrdering === 'type-1'
                ? 'border-accent bg-accent-subtle text-accent-ink ring-2 ring-accent/20'
                : 'border-border bg-surface text-ink hover:border-border-strong'
            }`}
          >
            Khung Loại I (Z ≥ 8: σ₂p thấp hơn π₂p)
          </button>
        </div>

        <div className="min-w-0 max-w-full overflow-x-auto">
          <Suspense
            fallback={
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-6 text-center text-xs text-ink-muted">
                Đang tải giản đồ MO tương tác...
              </div>
            }
          >
            <LazyMoDiagramCanvas
              config={moConfig}
              ordering={previewOrdering}
              counts={EMPTY_MO_COUNTS}
              onOrderingChange={handleSelectOrdering}
              onCountsChange={() => {}}
            />
          </Suspense>
        </div>

        <button
          type="button"
          onClick={handleCheckOrdering}
          className="hus-btn hus-btn-primary min-h-[44px]"
        >
          Kiểm tra khung năng lượng
        </button>
      </div>
    );
  }

  if (interaction.mode === 'fill-electrons') {
    return (
      <div className="space-y-4">
        {nextExpectedStep ? (
          <div className="rounded-[var(--radius-md)] border border-starlight/45 bg-warning-subtle/50 px-3 py-2 text-xs text-ink">
            <span className="font-semibold text-warning">☞ Gợi ý ô tiếp theo: </span>
            <span>
              <Markdown inline>{nextExpectedStep.explanation}</Markdown>
            </span>
          </div>
        ) : null}

        <div className="min-w-0 max-w-full overflow-x-auto">
          <Suspense
            fallback={
              <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-6 text-center text-xs text-ink-muted">
                Đang tải giản đồ MO tương tác...
              </div>
            }
          >
            <LazyMoDiagramCanvas
              config={moConfig}
              ordering={interaction.expectedOrdering}
              counts={slotCounts}
              highlightSlotIds={nextExpectedStep ? [nextExpectedStep.slotId] : []}
              onOrderingChange={() => {}}
              onCountsChange={nextCounts => {
                setSlotCounts(nextCounts);
                onAnswerChanged();
              }}
            />
          </Suspense>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCheckFill}
            className="hus-btn hus-btn-primary min-h-[44px]"
          >
            Kiểm tra giản đồ electron
          </button>
          <button
            type="button"
            onClick={() => {
              setSlotCounts(EMPTY_MO_COUNTS);
              onAnswerChanged();
            }}
            className="hus-btn hus-btn-secondary min-h-[44px]"
          >
            <RotateCcwIcon width={14} height={14} />
            <span>Đặt lại ô</span>
          </button>
        </div>
      </div>
    );
  }

  // mode === 'count-bo'
  return (
    <div className="space-y-4">
      <div className="min-w-0 max-w-full overflow-x-auto">
        <Suspense
          fallback={
            <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-6 text-center text-xs text-ink-muted">
              Đang tải giản đồ MO tham chiếu...
            </div>
          }
        >
          <LazyMoDiagramCanvas
            config={moConfig}
            ordering={interaction.expectedOrdering}
            counts={expectedCounts}
            onOrderingChange={() => {}}
            onCountsChange={() => {}}
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 text-xs">
          <span className="font-semibold text-ink-secondary">Bậc liên kết (BO)</span>
          <input
            type="text"
            inputMode="decimal"
            value={bondOrderInput}
            onChange={e => {
              setBondOrderInput(e.target.value);
              onAnswerChanged();
            }}
            placeholder="Ví dụ: 1 hoặc 2,5"
            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>

        <div className="space-y-1.5 text-xs">
          <span className="block font-semibold text-ink-secondary">Từ tính của phân tử</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setChosenMagnetism('paramagnetic');
                onAnswerChanged();
              }}
              aria-pressed={chosenMagnetism === 'paramagnetic'}
              className={`min-h-[44px] rounded-[var(--radius-md)] border px-3 py-2 text-left text-xs font-medium transition-colors ${
                chosenMagnetism === 'paramagnetic'
                  ? 'border-accent bg-accent-subtle text-accent-ink ring-2 ring-accent/20'
                  : 'border-border bg-surface text-ink hover:border-border-strong'
              }`}
            >
              Thuận từ (có e⁻ độc thân)
            </button>
            <button
              type="button"
              onClick={() => {
                setChosenMagnetism('diamagnetic');
                onAnswerChanged();
              }}
              aria-pressed={chosenMagnetism === 'diamagnetic'}
              className={`min-h-[44px] rounded-[var(--radius-md)] border px-3 py-2 text-left text-xs font-medium transition-colors ${
                chosenMagnetism === 'diamagnetic'
                  ? 'border-accent bg-accent-subtle text-accent-ink ring-2 ring-accent/20'
                  : 'border-border bg-surface text-ink hover:border-border-strong'
              }`}
            >
              Nghịch từ (ghép đôi hết)
            </button>
          </div>
        </div>
      </div>

      <button type="button" onClick={handleCheckBo} className="hus-btn hus-btn-primary min-h-[44px]">
        Chốt kết quả MO
      </button>
    </div>
  );
}

function DiagramGuidedView({
  interaction,
  solved,
  onEvaluated,
}: {
  readonly interaction: DiagramGuidedInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
}) {
  const DiagramComponent = getLazyDiagramComponent(interaction.diagramKind);

  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <Suspense
        fallback={
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-6 text-center text-xs text-ink-muted">
            Đang tải mô-đun sơ đồ tương tác...
          </div>
        }
      >
        <DiagramComponent
          spec={interaction.spec}
          completed={solved}
          fadeLevel={0}
          onEvaluated={res => {
            const evaluated = evaluateQuestInteraction(interaction, {
              kind: 'diagram-guided',
              diagramPassed: res.correct,
              diagramSummary: res.summary,
            });
            onEvaluated(evaluated);
          }}
        />
      </Suspense>
    </div>
  );
}

function StepChainBuilderView({
  interaction,
  solved,
  onEvaluated,
  onAnswerChanged,
}: {
  readonly interaction: StepChainBuilderInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
  readonly onAnswerChanged: () => void;
}) {
  const [selectedBySlotId, setSelectedBySlotId] = useState<Readonly<Record<string, string>>>(() =>
    solved
      ? Object.fromEntries(interaction.slots.map(s => [s.id, s.correctOptionId]))
      : {},
  );

  const handleSelectOption = (slotId: string, optionId: string) => {
    setSelectedBySlotId(prev => ({
      ...prev,
      [slotId]: optionId,
    }));
    onAnswerChanged();
  };

  const handleCheck = () => {
    onEvaluated(
      evaluateQuestInteraction(interaction, {
        kind: 'step-chain-builder',
        selectedBySlotId,
      }),
    );
  };

  return (
    <div className="space-y-4">
      {interaction.contextLatex ? (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 px-3 py-2 text-sm text-ink">
          <Markdown>{`$$${interaction.contextLatex}$$`}</Markdown>
        </div>
      ) : null}

      <div className="space-y-3">
        {interaction.slots.map((slot, idx) => {
          const chosenId = selectedBySlotId[slot.id];
          return (
            <div
              key={slot.id}
              className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface p-3"
            >
              <div className="text-xs font-semibold text-ink-secondary">
                <span className="mr-1.5 font-mono text-accent">Bước {idx + 1}:</span>
                <Markdown inline>{slot.stepLabel}</Markdown>
              </div>
              <div className="flex flex-wrap gap-2">
                {slot.options.map(option => {
                  const isSelected = chosenId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectOption(slot.id, option.id)}
                      aria-pressed={isSelected}
                      className={`min-h-[44px] max-w-full rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent-subtle font-medium text-accent-ink ring-2 ring-accent/20'
                          : 'border-border bg-surface-subtle/60 text-ink hover:border-border-strong hover:bg-surface-subtle'
                      }`}
                    >
                      <Markdown inline>{wrapInlineLatex(option.labelLatex)}</Markdown>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary min-h-[44px]">
        Kiểm tra chuỗi bước
      </button>
    </div>
  );
}

function NumericCheckView({
  interaction,
  solved,
  onEvaluated,
  onAnswerChanged,
}: {
  readonly interaction: NumericCheckInteraction;
  readonly solved: boolean;
  readonly onEvaluated: (result: QuestEvaluationResult) => void;
  readonly onAnswerChanged: () => void;
}) {
  const [rawValue, setRawValue] = useState(
    solved ? String(interaction.expected).replace('.', ',') : '',
  );
  const [limitingChoiceId, setLimitingChoiceId] = useState<string | undefined>(
    solved && interaction.limitingQuestion ? interaction.limitingQuestion.answerId : undefined,
  );

  const handleCheck = () => {
    onEvaluated(
      evaluateQuestInteraction(interaction, {
        kind: 'numeric-check',
        rawValue,
        ...(limitingChoiceId !== undefined ? { limitingChoiceId } : {}),
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
        <div className="text-sm font-medium text-ink">
          <Markdown inline>{interaction.label}</Markdown>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold text-ink">
            <Markdown inline>{wrapInlineLatex(interaction.symbolLatex)}</Markdown>
          </span>
          <span className="text-sm text-ink-muted">=</span>
          <input
            type="text"
            inputMode="decimal"
            value={rawValue}
            onChange={e => {
              setRawValue(e.target.value);
              onAnswerChanged();
            }}
            placeholder="Nhập đáp số (hỗ trợ , hoặc .)"
            aria-label={interaction.label}
            className="min-h-[44px] min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface-subtle/50 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none sm:max-w-[220px]"
          />
          {interaction.unit ? <Badge mono>{interaction.unit}</Badge> : null}
        </div>
      </div>

      {interaction.limitingQuestion ? (
        <div className="space-y-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/40 p-3.5">
          <div className="text-xs font-semibold text-ink-secondary">
            <Markdown>{interaction.limitingQuestion.prompt}</Markdown>
          </div>
          <div className="space-y-2" role="radiogroup" aria-label="Câu hỏi kiểm tra giới hạn">
            {interaction.limitingQuestion.choices.map(choice => {
              const selected = limitingChoiceId === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setLimitingChoiceId(choice.id);
                    onAnswerChanged();
                  }}
                  className={`flex min-h-[44px] w-full items-center rounded-[var(--radius-sm)] border px-3 py-2 text-left text-xs transition-colors ${
                    selected
                      ? 'border-accent bg-accent-subtle font-medium text-accent-ink ring-2 ring-accent/20'
                      : 'border-border bg-surface text-ink hover:border-border-strong'
                  }`}
                >
                  <Markdown inline>{choice.label}</Markdown>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary min-h-[44px]">
        Kiểm tra đáp số
      </button>
    </div>
  );
}

function MilestoneInteractionRenderer({
  interaction,
  solved,
  onEvaluated,
  onAnswerChanged,
}: MilestoneInteractionProps) {
  switch (interaction.kind) {
    case 'concept-probe':
      return (
        <ConceptProbeView
          interaction={interaction}
          solved={solved}
          onEvaluated={onEvaluated}
        />
      );
    case 'code-slot-builder':
      return (
        <CodeSlotBuilderView
          interaction={interaction}
          solved={solved}
          onEvaluated={onEvaluated}
          onAnswerChanged={onAnswerChanged}
        />
      );
    case 'mo-guided-canvas':
      return (
        <MoGuidedCanvasView
          interaction={interaction}
          solved={solved}
          onEvaluated={onEvaluated}
          onAnswerChanged={onAnswerChanged}
        />
      );
    case 'diagram-guided':
      return (
        <DiagramGuidedView
          interaction={interaction}
          solved={solved}
          onEvaluated={onEvaluated}
        />
      );
    case 'step-chain-builder':
      return (
        <StepChainBuilderView
          interaction={interaction}
          solved={solved}
          onEvaluated={onEvaluated}
          onAnswerChanged={onAnswerChanged}
        />
      );
    case 'numeric-check':
      return (
        <NumericCheckView
          interaction={interaction}
          solved={solved}
          onEvaluated={onEvaluated}
          onAnswerChanged={onAnswerChanged}
        />
      );
  }
}

export function SkillQuestStudio({ quest, courseTitle, courseCode }: SkillQuestStudioProps) {
  const navigate = useNavigate();
  const { questProgress, questStorageError } = useQuestProgress();
  const { progress } = useLearningProgress();

  const totalMilestones = quest.milestones.length;
  const savedDone = questProgress.milestoneProgress[quest.id] ?? 0;
  const completedCount = Math.min(savedDone, totalMilestones);

  const [activeIdx, setActiveIdx] = useState<number>(() =>
    totalMilestones > 0 ? Math.min(savedDone, totalMilestones - 1) : 0,
  );
  const [lastEval, setLastEval] = useState<QuestEvaluationResult | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [finisherBurstKey, setFinisherBurstKey] = useState(0);
  const [showFinisher, setShowFinisher] = useState(false);
  const [inlineCodeOpen, setInlineCodeOpen] = useState(false);
  const [resetEpoch, setResetEpoch] = useState(0);

  const activeMilestone: SkillQuestMilestone | undefined = quest.milestones[activeIdx];
  const isAlreadyUnlockedDone = activeIdx < completedCount;
  const milestoneSolved = isAlreadyUnlockedDone || Boolean(lastEval?.correct);
  const allMilestonesCompleted = totalMilestones > 0 && completedCount >= totalMilestones;
  const lessonCompleted = progress.completedLessonIds.includes(quest.lessonId);

  const handleSelectMilestone = (idx: number) => {
    if (idx > completedCount || idx < 0 || idx >= totalMilestones) {
      return;
    }
    setActiveIdx(idx);
    setLastEval(null);
    setShowFinisher(false);
  };

  const handleEvaluated = (result: QuestEvaluationResult) => {
    setLastEval(result);
    if (result.correct) {
      setBurstKey(k => k + 1);
      questProgressStore.recordMilestone(quest.id, activeIdx + 1, totalMilestones);
    }
  };

  const handleAdvance = () => {
    if (activeIdx + 1 < totalMilestones) {
      setActiveIdx(activeIdx + 1);
      setLastEval(null);
      return;
    }
    if (completedCount >= totalMilestones) {
      setShowFinisher(true);
      setFinisherBurstKey(k => k + 1);
    }
  };

  const handleMarkOriginalLessonComplete = () => {
    progressStore.dispatch({
      type: 'complete',
      lessonId: quest.lessonId,
      completed: true,
    });
  };

  const seedQuestPrefillDraft = () => {
    if (!quest.codeLabProblemId || !quest.codeLabPrefill) return;
    const languages: readonly CodeLanguage[] = ['python', 'java'];
    for (const lang of languages) {
      const code = quest.codeLabPrefill[lang];
      if (!code) continue;
      const draftKey = `hus-code-lab:draft:v1:${quest.codeLabProblemId}:${lang}`;
      try {
        if (typeof window !== 'undefined' && window.localStorage.getItem(draftKey) === null) {
          window.localStorage.setItem(draftKey, code);
        }
      } catch {
        // Ignore storage restrictions.
      }
    }
  };

  const handleToggleInlineCodeLab = () => {
    if (!inlineCodeOpen) {
      seedQuestPrefillDraft();
    }
    setInlineCodeOpen(prev => !prev);
  };

  const handleOpenCodeLab = () => {
    if (!quest.codeLabProblemId) return;
    seedQuestPrefillDraft();
    navigate(`/courses/${quest.courseId}?tool=code-lab&preset=${quest.codeLabProblemId}`);
  };

  const handleRestartQuest = () => {
    questProgressStore.resetQuest(quest.id);
    setActiveIdx(0);
    setLastEval(null);
    setShowFinisher(false);
    setResetEpoch(e => e + 1);
  };

  if (!activeMilestone) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-sm text-ink-secondary">
        Nhiệm vụ này chưa có mốc tương tác nào.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      {questStorageError ? (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-4 py-3 text-xs text-warning"
        >
          {questStorageError}
        </div>
      ) : null}

      {/* Top 4-Milestone Assembly Ribbon */}
      <nav aria-label="Tiến trình các mốc nhiệm vụ" className="min-w-0">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
          {quest.milestones.map((milestone, idx) => {
            const isCompleted = idx < completedCount;
            const isActive = idx === activeIdx && !showFinisher;
            const isUnlocked = idx <= completedCount;

            return (
              <li key={milestone.id} className="min-w-0">
                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => handleSelectMilestone(idx)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`flex h-full min-h-[44px] w-full flex-col justify-between gap-1 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors duration-200 ${
                    isActive
                      ? 'border-starlight bg-surface shadow-xs ring-2 ring-starlight/25'
                      : isCompleted
                        ? 'border-success/40 bg-success-subtle/35 hover:border-success/65'
                        : isUnlocked
                          ? 'border-border bg-surface hover:border-border-strong'
                          : 'cursor-not-allowed border-border/60 bg-surface-subtle/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate font-mono text-[11px] font-semibold text-ink-muted">
                      {milestone.tag}
                    </span>
                    {isCompleted ? (
                      <span
                        aria-label="Đã hoàn thành"
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-canvas"
                      >
                        ✓
                      </span>
                    ) : null}
                  </div>
                  <span className="line-clamp-2 text-xs font-medium leading-snug text-ink">
                    <Markdown inline>{milestone.title}</Markdown>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Finisher Celebration Panel */}
      {allMilestonesCompleted && showFinisher ? (
        <section
          aria-label="Tổng kết hoàn thành nhiệm vụ"
          className="relative overflow-hidden rounded-[var(--radius-lg)] border border-starlight/55 bg-surface p-5 shadow-sm sm:p-6"
        >
          <StarlightBurst triggerKey={finisherBurstKey} />
          <div className="relative z-10 space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">✓ Hoàn thành {totalMilestones}/{totalMilestones} mốc</Badge>
                <Badge tone="accent" mono>
                  {courseCode}
                </Badge>
              </div>
              <h2 className="text-xl font-semibold text-ink">
                Chúc mừng! Bạn đã làm chủ “{quest.title}”
              </h2>
              <p className="text-sm text-ink-secondary">
                Tất cả {totalMilestones} mảnh kiến thức của nhiệm vụ trong học phần {courseTitle} đã
                được lắp ghép hoàn chỉnh.
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quest.milestones.map(m => (
                <li
                  key={m.id}
                  className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-success/35 bg-success-subtle/35 px-3 py-2.5 text-xs"
                >
                  <CheckCircleIcon width={16} height={16} className="mt-0.5 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-semibold text-ink-muted">{m.tag}</p>
                    <p className="font-medium text-ink">
                      <Markdown inline>{m.title}</Markdown>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
              <button
                type="button"
                onClick={handleMarkOriginalLessonComplete}
                className={`hus-btn min-h-[44px] ${
                  lessonCompleted ? 'hus-btn-secondary' : 'hus-btn-primary'
                }`}
              >
                {lessonCompleted
                  ? '✓ Đã hoàn thành bài học'
                  : '✓ Đánh dấu hoàn thành bài học gốc'}
              </button>

              {quest.codeLabProblemId ? (
                <>
                  <button
                    type="button"
                    aria-expanded={inlineCodeOpen}
                    onClick={handleToggleInlineCodeLab}
                    className="hus-btn hus-btn-primary min-h-[44px]"
                  >
                    <span>
                      {inlineCodeOpen ? 'Ẩn khung Code tại chỗ' : 'Chạy & chấm Code ngay tại đây'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCodeLab}
                    className="hus-btn hus-btn-secondary min-h-[44px]"
                  >
                    <span>Mở trong Phòng thực hành Code →</span>
                  </button>
                </>
              ) : null}

              <Link
                to={`/courses/${quest.courseId}/lessons/${quest.lessonId}`}
                className="hus-btn hus-btn-secondary min-h-[44px] !no-underline"
              >
                Đọc toàn văn bài học
              </Link>

              <Link to="/" className="hus-btn hus-btn-ghost min-h-[44px] !no-underline">
                Về Vũ trụ Mục tiêu
              </Link>

              <button
                type="button"
                onClick={handleRestartQuest}
                className="hus-btn hus-btn-ghost min-h-[44px]"
              >
                <RotateCcwIcon width={14} height={14} />
                <span>Làm lại nhiệm vụ từ đầu</span>
              </button>
            </div>

            {inlineCodeOpen && quest.codeLabProblemId ? (
              <div className="border-t border-border pt-4">
                <Suspense
                  fallback={
                    <p role="status" className="text-xs text-ink-muted">
                      Đang tải khung thực hành Code…
                    </p>
                  }
                >
                  <LazyCodeLabWorkspace
                    courseId={quest.courseId}
                    lessonId={quest.lessonId}
                    initialPreset={quest.codeLabProblemId}
                    embeddedSurface="quest"
                  />
                </Suspense>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        /* Active Milestone Stage */
        <section
          aria-label={activeMilestone.title}
          className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs sm:p-6"
        >
          <StarlightBurst triggerKey={burstKey} />

          <div className="relative z-10 space-y-5">
            <header className="space-y-2 border-b border-border/80 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={milestoneSolved ? 'success' : 'accent'}>
                  {activeMilestone.tag}
                </Badge>
                {milestoneSolved ? <Badge tone="success">✓ Đã mở khóa</Badge> : null}
              </div>
              <h2 className="text-lg font-semibold leading-snug text-ink sm:text-xl">
                <Markdown inline>{activeMilestone.title}</Markdown>
              </h2>
            </header>

            {/* Guiding Beacon */}
            <GuidingBeacon
              state={
                milestoneSolved
                  ? 'advance'
                  : lastEval && !lastEval.correct
                    ? 'nudge'
                    : 'act'
              }
              stepLabel={activeMilestone.tag}
              message={
                <Markdown inline>
                  {milestoneSolved
                    ? activeMilestone.coachAdvancePrompt
                    : lastEval && !lastEval.correct
                      ? lastEval.feedback
                      : activeMilestone.coachActPrompt}
                </Markdown>
              }
            />

            {/* Core Markdown + Dual-Depth Drawer */}
            <div className="space-y-3">
              <div className="academic-prose text-sm text-ink">
                <Markdown>{activeMilestone.coreMarkdown}</Markdown>
              </div>

              <details className="group rounded-[var(--radius-md)] border border-border bg-surface-subtle/50 px-3.5 py-2.5">
                <summary className="cursor-pointer select-none text-xs font-semibold text-ink-secondary transition-colors hover:text-ink">
                  🔬 Đào sâu bản chất (Dành cho người muốn tìm hiểu sâu hơn)
                </summary>
                <div className="academic-prose mt-3 border-t border-border/70 pt-3 text-sm text-ink-secondary">
                  <Markdown>{activeMilestone.deepDiveMarkdown}</Markdown>
                </div>
              </details>
            </div>

            {/* Milestone Interaction */}
            <div className="rounded-[var(--radius-md)] border border-border-strong/60 bg-surface-subtle/35 p-3.5 sm:p-4">
              <MilestoneInteractionRenderer
                key={`${activeMilestone.id}-${resetEpoch}`}
                interaction={activeMilestone.interaction}
                solved={isAlreadyUnlockedDone}
                onEvaluated={handleEvaluated}
                onAnswerChanged={() => {
                  if (lastEval && !lastEval.correct) {
                    setLastEval(null);
                  }
                }}
              />
            </div>

            {/* Inline positive feedback + Advance CTA */}
            {lastEval?.correct ? (
              <div className="rounded-[var(--radius-md)] border border-success/40 bg-success-subtle/60 px-3.5 py-2.5 text-xs font-medium text-ink">
                <span className="mr-1.5 font-bold text-success">✓</span>
                <Markdown inline>{lastEval.feedback}</Markdown>
              </div>
            ) : null}

            {milestoneSolved ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-xs text-ink-muted">
                  {activeIdx + 1 < totalMilestones
                    ? `Hoàn thành mốc ${activeIdx + 1}/${totalMilestones}`
                    : 'Bạn đã chạm mốc cuối cùng của nhiệm vụ!'}
                </span>
                <button
                  type="button"
                  onClick={handleAdvance}
                  className="hus-btn hus-btn-primary min-h-[44px]"
                >
                  {activeIdx + 1 < totalMilestones
                    ? '☞ Mở khóa Mốc tiếp theo →'
                    : '✦ Hoàn tất nhiệm vụ & Xem tổng kết →'}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
