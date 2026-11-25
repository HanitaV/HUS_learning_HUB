import { useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { ProbTreeStepSpec } from '../../domain/semi-essay';
import {
  gradeProbTreeStep,
  parseFractionOrDecimal,
  type ProbTreeBranchInput,
  type ProbTreeGradeResult,
} from '../../core/learning/hybrid-diagrams';
import {
  isPlainObject,
  useInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import Markdown from '../../components/learning/Markdown';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

export default function ProbTreeDiagram({
  spec,
  completed,
  draftKey,
  onEvaluated,
}: DiagramRendererProps) {
  const treeSpec = spec as ProbTreeStepSpec;
  const [inputs, setInputs, resetInputs] = useInteractiveStepDraft<
    Readonly<Record<string, ProbTreeBranchInput>>
  >(
    draftKey,
    () =>
      Object.fromEntries(
        treeSpec.branches.map(b => [
          b.id,
          completed
            ? {
                prior: String(Number(b.expectedPrior.toFixed(4))),
                conditional: String(Number(b.expectedConditional.toFixed(4))),
              }
            : { prior: '', conditional: '' },
        ]),
      ),
    raw => {
      if (!isPlainObject(raw)) return null;
      const out: Record<string, ProbTreeBranchInput> = {};
      for (const b of treeSpec.branches) {
        const entry = raw[b.id];
        if (entry === undefined) {
          out[b.id] = { prior: '', conditional: '' };
          continue;
        }
        if (
          !isPlainObject(entry) ||
          typeof entry.prior !== 'string' ||
          typeof entry.conditional !== 'string' ||
          entry.prior.length > 80 ||
          entry.conditional.length > 80
        ) {
          return null;
        }
        out[b.id] = { prior: entry.prior, conditional: entry.conditional };
      }
      return out;
    },
  );
  const [grade, setGrade] = useState<ProbTreeGradeResult | null>(null);

  const updateBranch = (branchId: string, patch: Partial<ProbTreeBranchInput>) => {
    setGrade(null);
    setInputs(prev => ({
      ...prev,
      [branchId]: {
        ...(prev[branchId] ?? { prior: '', conditional: '' }),
        ...patch,
      },
    }));
  };

  const handleCheck = () => {
    const res = gradeProbTreeStep(inputs, treeSpec);
    setGrade(res);
    onEvaluated({
      correct: res.correct,
      summary: res.correct
        ? 'Sơ đồ cây xác suất đầy đủ & nhánh điều kiện chính xác.'
        : 'Một số nhánh xác suất chưa chính xác, xem gợi ý bên dưới.',
    });
  };

  const handleReset = () => {
    resetInputs();
    setGrade(null);
  };

  const svgHeight = Math.max(180, treeSpec.branches.length * 64 + 28);
  const rootY = svgHeight / 2;

  return (
    <div className="space-y-4">
      {treeSpec.note ? <p className="text-sm text-ink-secondary">{treeSpec.note}</p> : null}

      {/* Visual SVG Probability Partition Tree */}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
        <svg
          viewBox={`0 0 500 ${svgHeight}`}
          role="img"
          aria-label={`Sơ đồ cây xác suất cho ${treeSpec.eventLabel}`}
          className="mx-auto h-auto w-full max-w-[540px] select-none"
        >
          {/* Root Node */}
          <rect
            x="10"
            y={rootY - 18}
            width="108"
            height="36"
            rx="8"
            fill="var(--hus-surface)"
            stroke="var(--hus-accent)"
            strokeWidth="1.5"
          />
          <text
            x="64"
            y={rootY + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="var(--hus-ink)"
          >
            Hệ đầy đủ
          </text>

          {treeSpec.branches.map((branch, idx) => {
            const branchY =
              treeSpec.branches.length === 1
                ? rootY
                : 34 + (idx * (svgHeight - 68)) / (treeSpec.branches.length - 1);
            const entry = inputs[branch.id] ?? { prior: '', conditional: '' };
            const pVal = parseFractionOrDecimal(entry.prior);
            const cVal = parseFractionOrDecimal(entry.conditional);
            const joint = pVal !== null && cVal !== null ? pVal * cVal : null;
            const barWidth = joint !== null ? Math.max(4, Math.min(86, joint * 180)) : 0;

            return (
              <g key={branch.id}>
                {/* Edge Root -> Hi */}
                <line
                  x1="118"
                  y1={rootY}
                  x2="205"
                  y2={branchY}
                  stroke="var(--hus-border-strong)"
                  strokeWidth="1.5"
                />
                <text
                  x="160"
                  y={(rootY + branchY) / 2 - 5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="var(--hus-accent)"
                >
                  {entry.prior.trim() || '?'}
                </text>

                {/* Partition Node Hi */}
                <rect
                  x="205"
                  y={branchY - 16}
                  width="74"
                  height="32"
                  rx="7"
                  fill="var(--hus-surface)"
                  stroke="var(--hus-border-strong)"
                  strokeWidth="1.3"
                />
                <text
                  x="242"
                  y={branchY + 4}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  fill="var(--hus-ink)"
                >
                  {branch.symbolLatex.replace(/_/g, '')}
                </text>

                {/* Edge Hi -> Event A */}
                <line
                  x1="279"
                  y1={branchY}
                  x2="372"
                  y2={branchY}
                  stroke="var(--hus-starlight)"
                  strokeWidth="1.5"
                />
                <text
                  x="325"
                  y={branchY - 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="var(--hus-ink-secondary)"
                >
                  {entry.conditional.trim() || '?'}
                </text>

                {/* Joint weight bar P(Hi)*P(A|Hi) */}
                <rect
                  x="374"
                  y={branchY - 13}
                  width="114"
                  height="26"
                  rx="6"
                  fill="var(--hus-surface)"
                  stroke="var(--hus-border)"
                />
                {barWidth > 0 ? (
                  <rect
                    x="376"
                    y={branchY - 11}
                    width={barWidth}
                    height="22"
                    rx="4"
                    fill="var(--hus-accent)"
                    fillOpacity="0.22"
                  />
                ) : null}
                <text
                  x="431"
                  y={branchY + 4}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="var(--hus-ink)"
                >
                  {joint !== null ? `w = ${joint.toFixed(4)}` : 'P(Hᵢ)·P(A|Hᵢ)'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Branch Probability Inputs (accepts fractions like 1/3, 9/25 or decimals) */}
      <div className="space-y-2.5">
        <p className="text-xs text-ink-muted">
          Nhập phân số (ví dụ <code className="font-mono">1/3</code>,{' '}
          <code className="font-mono">9/25</code>) hoặc số thập phân cho từng nhánh của{' '}
          <strong className="text-ink">{treeSpec.eventLabel}</strong>:
        </p>
        {treeSpec.branches.map(branch => {
          const current = inputs[branch.id] ?? { prior: '', conditional: '' };
          return (
            <div
              key={branch.id}
              className="grid gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
            >
              <div className="text-xs font-medium text-ink">{branch.label}</div>
              <div>
                <label
                  htmlFor={`pt-prior-${branch.id}`}
                  className="mb-1 block text-[11px] font-medium text-ink-secondary"
                >
                  <Markdown inline>{`$P(${branch.symbolLatex})$`}</Markdown>
                </label>
                <input
                  id={`pt-prior-${branch.id}`}
                  type="text"
                  data-prob-prior={branch.id}
                  value={current.prior}
                  onChange={e => updateBranch(branch.id, { prior: e.target.value })}
                  placeholder="vd: 1/3"
                  className="min-h-[38px] w-full rounded-[var(--radius-sm)] border border-border bg-canvas px-2.5 py-1 font-mono text-xs text-ink focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={`pt-cond-${branch.id}`}
                  className="mb-1 block text-[11px] font-medium text-ink-secondary"
                >
                  <Markdown inline>{`$P(${treeSpec.eventSymbolLatex} \\mid ${branch.symbolLatex})$`}</Markdown>
                </label>
                <input
                  id={`pt-cond-${branch.id}`}
                  type="text"
                  data-prob-cond={branch.id}
                  value={current.conditional}
                  onChange={e => updateBranch(branch.id, { conditional: e.target.value })}
                  placeholder="vd: 9/25"
                  className="min-h-[38px] w-full rounded-[var(--radius-sm)] border border-border bg-canvas px-2.5 py-1 font-mono text-xs text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra sơ đồ cây xác suất
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Làm lại
        </button>
      </div>

      {grade ? (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-1.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            grade.correct
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-warning/35 bg-warning-subtle text-ink'
          }`}
        >
          <div className="flex items-start gap-2 font-medium">
            {grade.correct ? (
              <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
            )}
            <span>
              {grade.correct
                ? `Chính xác! Tổng xác suất nhánh ∑ P(Hᵢ)·P(A|Hᵢ) ≈ ${grade.totalProbability.toFixed(4)} sẵn sàng cho bước trình bày Bayes.`
                : 'Sơ đồ cây xác suất cần điều chỉnh:'}
            </span>
          </div>
          {!grade.correct && grade.diagnostics.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-xs text-ink-secondary">
              {grade.diagnostics.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
