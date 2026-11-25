import { useMemo, useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { ProofDagStepSpec } from '../../domain/semi-essay';
import type { ProofBlocksExercise, ProofGradeResult } from '../../domain/block-logic';
import { gradeProofBlocks } from '../../core/blocks/proof-dag';
import {
  isStringArray,
  useInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import Markdown from '../../components/learning/Markdown';
import { Badge } from '../../components/ui/Badge';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

export default function ProofDagDiagram({
  spec,
  completed,
  draftKey,
  onEvaluated,
}: DiagramRendererProps) {
  const dagSpec = spec as ProofDagStepSpec;

  const syntheticExercise = useMemo<ProofBlocksExercise>(
    () => ({
      id: 'inline-proof-dag',
      courseId: 'inline-course',
      title: 'Khung suy luận chứng minh',
      theoremStatement: dagSpec.theoremStatement,
      hint: dagSpec.note ?? '',
      blocks: dagSpec.blocks,
    }),
    [dagSpec],
  );

  const validBlockIds = useMemo(
    () => new Set(dagSpec.blocks.map(b => b.id)),
    [dagSpec.blocks],
  );

  const [selectedIds, setSelectedIds, resetSelectedIds] = useInteractiveStepDraft<readonly string[]>(
    draftKey,
    () =>
      completed
        ? dagSpec.blocks.filter(b => !b.isDistractor && b.role !== 'distractor').map(b => b.id)
        : [],
    raw => (isStringArray(raw) && raw.every(id => validBlockIds.has(id)) ? raw : null),
  );
  const [grade, setGrade] = useState<ProofGradeResult | null>(null);

  const blockById = useMemo(
    () => new Map(dagSpec.blocks.map(b => [b.id, b])),
    [dagSpec.blocks],
  );

  const availableBlocks = dagSpec.blocks.filter(b => !selectedIds.includes(b.id));

  const addBlock = (id: string) => {
    setGrade(null);
    setSelectedIds(prev => [...prev, id]);
  };

  const removeAt = (idx: number) => {
    setGrade(null);
    setSelectedIds(prev => prev.filter((_, i) => i !== idx));
  };

  const moveAt = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= selectedIds.length) return;
    setGrade(null);
    setSelectedIds(prev => {
      const next = [...prev];
      const cur = next[idx];
      const other = next[target];
      if (!cur || !other) return prev;
      next[idx] = other;
      next[target] = cur;
      return next;
    });
  };

  const handleCheck = () => {
    const res = gradeProofBlocks(syntheticExercise, selectedIds);
    setGrade(res);
    onEvaluated({
      correct: res.passed,
      summary: res.passed
        ? 'Sơ đồ chuỗi suy luận chứng minh hợp lệ.'
        : 'Thứ tự tiền đề hoặc mệnh đề trong chuỗi chứng minh cần điều chỉnh.',
    });
  };

  const handleReset = () => {
    resetSelectedIds();
    setGrade(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle/70 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
        <strong className="text-accent">Mệnh đề cần dựng khung chứng minh:</strong>{' '}
        <Markdown inline>{dagSpec.theoremStatement}</Markdown>
      </div>
      {dagSpec.note ? <p className="text-xs text-ink-secondary">{dagSpec.note}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Source Pool */}
        <div className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
          <p className="text-xs font-semibold text-ink">Kho mệnh đề (nhấn để đưa vào chuỗi suy luận)</p>
          {availableBlocks.length === 0 ? (
            <p className="py-3 text-xs text-ink-muted">Đã chọn hết các khối trong kho.</p>
          ) : (
            <div className="space-y-2">
              {availableBlocks.map(block => (
                <button
                  key={block.id}
                  type="button"
                  data-proof-block={block.id}
                  onClick={() => addBlock(block.id)}
                  className="w-full cursor-pointer rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-left text-xs leading-relaxed text-ink transition-colors hover:border-accent hover:bg-accent-subtle/40"
                >
                  <Markdown inline>{block.text}</Markdown>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assembled Proof Chain */}
        <div className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
          <p className="text-xs font-semibold text-ink">
            Chuỗi suy luận của bạn ({selectedIds.length} bước)
          </p>
          {selectedIds.length === 0 ? (
            <p className="py-3 text-xs text-ink-muted">
              Chọn các mệnh đề từ cột bên trái theo đúng thứ tự nhân quả (giả thiết → biến đổi → kết luận).
            </p>
          ) : (
            <ol className="space-y-2">
              {selectedIds.map((id, idx) => {
                const block = blockById.get(id);
                const diag = grade?.diagnostics[idx];
                if (!block) return null;
                return (
                  <li
                    key={`${id}-${idx}`}
                    className={`rounded-[var(--radius-md)] border p-2.5 text-xs ${
                      diag?.status === 'valid'
                        ? 'border-success/50 bg-success-subtle/35'
                        : diag
                          ? 'border-warning/60 bg-warning-subtle/35'
                          : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="leading-relaxed text-ink">
                        <strong className="font-mono text-accent">{idx + 1}.</strong>{' '}
                        <Markdown inline>{block.text}</Markdown>
                      </span>
                      {diag ? (
                        <Badge tone={diag.status === 'valid' ? 'success' : 'warning'}>
                          {diag.status === 'valid'
                            ? 'Hợp lệ'
                            : diag.status === 'missing-prereq'
                              ? 'Thiếu tiền đề'
                              : 'Bước nhiễu'}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveAt(idx, -1)}
                        aria-label={`Đưa bước ${idx + 1} lên trên`}
                        className="rounded border border-border bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === selectedIds.length - 1}
                        onClick={() => moveAt(idx, 1)}
                        aria-label={`Đưa bước ${idx + 1} xuống dưới`}
                        className="rounded border border-border bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(idx)}
                        className="ml-auto rounded border border-border bg-canvas px-2 py-0.5 text-[11px] text-ink-muted hover:text-danger"
                      >
                        Bỏ
                      </button>
                    </div>
                    {diag && diag.status !== 'valid' ? (
                      <p className="mt-1.5 text-[11px] text-ink-secondary">{diag.message}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra sơ đồ suy luận
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Xếp lại
        </button>
      </div>

      {grade ? (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            grade.passed
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-warning/35 bg-warning-subtle text-ink'
          }`}
        >
          {grade.passed ? (
            <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
          )}
          <span>
            {grade.passed
              ? 'Chính xác! Sơ đồ suy luận đã đủ tiền đề và đúng thứ tự logic — hãy dựa vào khung này để trình bày lời giải tự luận chi tiết.'
              : grade.missingRequiredIds.length > 0
                ? `Bạn còn thiếu ${grade.missingRequiredIds.length} mệnh đề bắt buộc trong chuỗi chứng minh.`
                : 'Hãy loại bỏ mệnh đề gây nhiễu hoặc đổi thứ tự các bước chưa đủ tiền đề.'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
