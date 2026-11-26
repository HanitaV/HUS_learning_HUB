import { useState } from 'react';
import type {
  CoachingHistoryEntry,
  CoachingPromptMode,
  GroundedEssayContextPacket,
  ReasoningScaffoldTemplate,
  TutorCoachingFeedback,
} from '../../domain/curriculum-tutor';
import type { MathSymbolContext } from '../../domain/math-symbols';
import type { WrittenReasoningStep, WrittenStepDraft } from '../../domain/semi-essay';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import { evaluateWrittenReasoningReview } from '../../core/learning/semi-essay';
import { Badge } from '../ui/Badge';
import { CRITERION_STATUS_META, EssayWebMcpCoachPanel } from './EssayWebMcpCoachPanel';
import Markdown from './Markdown';
import { RealtimeMathPreview } from './RealtimeMathPreview';
import { RuledA4Sheet } from './RuledA4Sheet';

export interface WrittenReasoningStepViewProps {
  readonly step: WrittenReasoningStep;
  readonly draft: WrittenStepDraft;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly scaffolds?: readonly ReasoningScaffoldTemplate[] | undefined;
  readonly webMcpAvailable?: boolean | undefined;
  readonly coachingFeedback?: TutorCoachingFeedback | undefined;
  readonly coachingHistory?: readonly CoachingHistoryEntry[] | undefined;
  readonly getGroundedPacket?: ((mode: CoachingPromptMode) => GroundedEssayContextPacket) | undefined;
  readonly onImportFeedbackText?:
    | ((rawText: string) => { readonly ok: boolean; readonly error?: string | undefined })
    | undefined;
  readonly onClearFeedback?: (() => void) | undefined;
  readonly update: (changes: Partial<WrittenStepDraft>) => void;
  readonly onReviewed: () => void;
}

export function WrittenReasoningStepView({
  step,
  draft,
  symbolContext,
  scaffolds,
  webMcpAvailable = false,
  coachingFeedback,
  coachingHistory,
  getGroundedPacket,
  onImportFeedbackText,
  onClearFeedback,
  update,
  onReviewed,
}: WrittenReasoningStepViewProps) {
  const { preferences } = useMathSymbolPreferences();
  const activeMathMode = preferences.insertMode;

  const [hintCount, setHintCount] = useState(0);
  const [showKeyOrientation, setShowKeyOrientation] = useState(false);

  const handleInsertScaffold = (scaffold: ReasoningScaffoldTemplate) => {
    const current = draft.response.trim();
    const nextValue = current ? `${draft.response.trimEnd()}\n\n${scaffold.template}` : scaffold.template;
    update({ response: nextValue });
    requestAnimationFrame(() => {
      document.getElementById(`${step.id}-response`)?.focus();
    });
  };

  const review = evaluateWrittenReasoningReview(step, draft);
  const hints = [...(step.hint ? [step.hint] : []), ...(step.hints ?? [])];
  const stage = review.complete
    ? 4
    : draft.revision.trim()
      ? 3
      : draft.modelRevealed
        ? 2
        : draft.response.trim()
          ? 1
          : 0;
  const stages = ['Viết nháp', 'Đối chiếu', 'Sửa bài', 'Tự rà soát'];

  const criterionFeedbackById = new Map(
    (coachingFeedback?.criterionFeedback ?? []).map(item => [item.criterionId, item]),
  );

  return (
    <div className="written-practice space-y-4">
      <div aria-label="Các giai đoạn tự viết và đối chiếu">
        <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
          {stages.map((label, index) => (
            <li
              key={label}
              aria-current={Math.min(stage, 3) === index ? 'step' : undefined}
              className={index < stage ? 'font-semibold text-accent' : 'text-ink-muted'}
            >
              {label}
            </li>
          ))}
        </ol>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true">
          <div
            className="written-practice-progress h-full bg-accent-solid"
            style={{ width: `${stage * 25}%` }}
          />
        </div>
        <span className="sr-only">Đã thực hiện {stage} trên 4 giai đoạn</span>
      </div>

      <p className="text-sm text-ink-secondary">
        Viết cách lập luận của bạn trước khi xem lời giải tham khảo. Bạn có thể đồng bộ đối chiếu qua WebMCP / Gemini hoặc tự rà soát theo rubric.
      </p>

      {/* Optional Reasoning Scaffolds to overcome blank-page paralysis */}
      {scaffolds && scaffolds.length > 0 && !draft.modelRevealed ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/65 px-3 py-2">
          <span className="text-xs font-medium text-ink-secondary">Khung sườn gợi mở:</span>
          {scaffolds.map(scaffold => (
            <button
              key={scaffold.id}
              type="button"
              onClick={() => handleInsertScaffold(scaffold)}
              title={scaffold.description}
              className="min-h-[30px] cursor-pointer rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              + {scaffold.label}
            </button>
          ))}
        </div>
      ) : null}

      <RuledA4Sheet
        id={`${step.id}-response`}
        label="Lập luận của bạn"
        sheetTag="Giấy A4 · Bản nháp"
        value={draft.response}
        onChange={val => update({ response: val })}
        symbolContext={symbolContext}
        toolbarLabel="Bảng chèn ký hiệu toán học cho lập luận"
        previewKey="response"
      />

      {/* Hints & Pre-Reveal Orientation Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {hints.length > 0 ? (
          <button
            type="button"
            className="hus-btn hus-btn-secondary"
            disabled={hintCount >= hints.length}
            onClick={() => setHintCount(count => count + 1)}
          >
            Xem gợi ý tiếp theo ({hintCount}/{hints.length})
          </button>
        ) : null}
        {!draft.modelRevealed && step.rubric.length > 0 ? (
          <button
            type="button"
            aria-expanded={showKeyOrientation}
            onClick={() => setShowKeyOrientation(v => !v)}
            className="hus-btn hus-btn-secondary"
          >
            {showKeyOrientation ? 'Ẩn trọng tâm cần nêu' : 'Xem trọng tâm cần nêu'}
          </button>
        ) : null}
      </div>

      {hints.slice(0, hintCount).map((hint, index) => (
        <div
          key={index}
          className="written-practice-reveal rounded-[var(--radius-md)] border border-border bg-surface-subtle p-3 text-sm text-ink-secondary"
        >
          <Markdown>{hint}</Markdown>
        </div>
      ))}

      {!draft.modelRevealed && showKeyOrientation ? (
        <div className="written-practice-reveal space-y-2 rounded-[var(--radius-md)] border border-accent/35 bg-accent-subtle/30 p-3.5 text-xs">
          <p className="font-semibold text-ink">
            Các ý cốt lõi cần có trong bài viết trước khi mở lời giải:
          </p>
          <ul className="list-disc space-y-1 pl-4 text-ink-secondary">
            {step.rubric.map(item => (
              <li key={item.id}>
                <Markdown inline>{item.prompt}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Curriculum-Grounded Gemini / WebMCP Socratic Tutor Panel */}
      {getGroundedPacket ? (
        <EssayWebMcpCoachPanel
          stepId={step.id}
          rubric={step.rubric}
          hasDraft={Boolean(draft.response.trim())}
          modelRevealed={draft.modelRevealed}
          webMcpAvailable={webMcpAvailable}
          coachingFeedback={coachingFeedback}
          coachingHistory={coachingHistory}
          getGroundedPacket={getGroundedPacket}
          onImportFeedbackText={onImportFeedbackText}
          onClearFeedback={onClearFeedback}
        />
      ) : null}

      {!draft.modelRevealed ? (
        <button
          type="button"
          disabled={!draft.response.trim()}
          onClick={() => update({ modelRevealed: true })}
          className="hus-btn hus-btn-primary"
        >
          Xem lời giải tham khảo
        </button>
      ) : (
        <div className="written-practice-reveal space-y-4 border-t border-border pt-4">
          {/* Side-by-Side Comparison on desktop: Initial Student Draft vs Verified Reference Solution */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <section
              aria-labelledby={`${step.id}-student-draft-compare`}
              className="rounded-[var(--radius-md)] border border-border bg-canvas/75 p-4"
            >
              <h3 id={`${step.id}-student-draft-compare`} className="font-semibold text-ink">
                Bản nháp ban đầu của bạn
              </h3>
              <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
                <RealtimeMathPreview value={draft.response} mode={activeMathMode} />
              </div>
            </section>

            <section
              aria-labelledby={`${step.id}-reference`}
              className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-4"
            >
              <h3 id={`${step.id}-reference`} className="font-semibold text-ink">
                Lời giải tham khảo
              </h3>
              <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
                <Markdown>{step.modelAnswer}</Markdown>
              </div>
            </section>
          </div>

          <fieldset data-written-review className="space-y-2 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-ink">
              Đối chiếu bài làm (tự động tích ý đạt qua WebMCP hoặc tự chọn)
            </legend>
            {step.rubric.map(criterion => {
              const tutorItem = criterionFeedbackById.get(criterion.id);
              const meta = tutorItem ? CRITERION_STATUS_META[tutorItem.status] : null;
              return (
                <label
                  key={criterion.id}
                  className="flex min-h-[44px] items-start gap-3 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                    checked={draft.reviewedCriterionIds.includes(criterion.id)}
                    onChange={event =>
                      update({
                        reviewedCriterionIds: event.target.checked
                          ? [...draft.reviewedCriterionIds, criterion.id]
                          : draft.reviewedCriterionIds.filter(id => id !== criterion.id),
                      })
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span>
                      <Markdown inline>{criterion.prompt}</Markdown>
                    </span>
                    {meta ? <Badge tone={meta.tone}>Gợi ý AI: {meta.label}</Badge> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <RuledA4Sheet
            id={`${step.id}-revision`}
            label="Bản sửa của bạn"
            sheetTag="Giấy A4 · Bản hoàn chỉnh"
            value={draft.revision}
            onChange={val => update({ revision: val })}
            symbolContext={symbolContext}
            toolbarLabel="Bảng chèn ký hiệu toán học cho bản sửa"
            previewKey="revision"
            defaultToolbarOpen={false}
          />

          <button
            type="button"
            disabled={!review.readyToComplete || review.complete}
            onClick={onReviewed}
            className="hus-btn hus-btn-primary"
          >
            Hoàn tất tự đối chiếu
          </button>
          {review.complete ? (
            <p role="status" className="text-sm font-semibold text-success">
              Đã tự đối chiếu
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
