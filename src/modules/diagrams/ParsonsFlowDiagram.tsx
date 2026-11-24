import { useMemo, useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { ParsonsFlowStepSpec } from '../../domain/semi-essay';
import type {
  ParsonsExercise,
  ParsonsGradeResult,
  ParsonsPlacement,
} from '../../domain/block-logic';
import { gradeParsonsSubmission } from '../../core/blocks/parsons';
import { Badge } from '../../components/ui/Badge';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

const MAX_INDENT = 4;

export default function ParsonsFlowDiagram({ spec, completed, onEvaluated }: DiagramRendererProps) {
  const parsonsSpec = spec as ParsonsFlowStepSpec;

  const syntheticExercise = useMemo<ParsonsExercise>(
    () => ({
      id: 'inline-parsons-flow',
      courseId: 'inline-course',
      title: 'Khung cấu trúc mã nguồn',
      language: parsonsSpec.language,
      prompt: parsonsSpec.note ?? '',
      blocks: parsonsSpec.blocks,
      solutionOrder: parsonsSpec.solutionOrder,
    }),
    [parsonsSpec],
  );

  const blockById = useMemo(
    () => new Map(parsonsSpec.blocks.map(b => [b.id, b])),
    [parsonsSpec.blocks],
  );

  const [placements, setPlacements] = useState<readonly ParsonsPlacement[]>(() =>
    completed
      ? parsonsSpec.solutionOrder.map(id => ({
          blockId: id,
          indent: blockById.get(id)?.expectedIndent ?? 0,
        }))
      : [],
  );
  const [grade, setGrade] = useState<ParsonsGradeResult | null>(null);

  const placedIds = new Set(placements.map(p => p.blockId));
  const availableBlocks = parsonsSpec.blocks.filter(b => !placedIds.has(b.id));

  const addBlock = (blockId: string) => {
    setGrade(null);
    const suggestedIndent = blockById.get(blockId)?.expectedIndent ?? 0;
    setPlacements(prev => [...prev, { blockId, indent: suggestedIndent }]);
  };

  const removeAt = (idx: number) => {
    setGrade(null);
    setPlacements(prev => prev.filter((_, i) => i !== idx));
  };

  const moveAt = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= placements.length) return;
    setGrade(null);
    setPlacements(prev => {
      const next = [...prev];
      const cur = next[idx];
      const other = next[target];
      if (!cur || !other) return prev;
      next[idx] = other;
      next[target] = cur;
      return next;
    });
  };

  const indentAt = (idx: number, delta: -1 | 1) => {
    setGrade(null);
    setPlacements(prev =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, indent: Math.max(0, Math.min(MAX_INDENT, item.indent + delta)) }
          : item,
      ),
    );
  };

  const handleCheck = () => {
    const res = gradeParsonsSubmission(syntheticExercise, placements);
    setGrade(res);
    onEvaluated({
      correct: res.passed,
      summary: res.passed
        ? 'Cấu trúc khối lệnh & mức thụt lề chính xác.'
        : 'Thứ tự dòng lệnh hoặc thụt lề cần điều chỉnh.',
    });
  };

  const handleReset = () => {
    setPlacements([]);
    setGrade(null);
  };

  return (
    <div className="space-y-4">
      {parsonsSpec.note ? <p className="text-sm text-ink-secondary">{parsonsSpec.note}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Source Code Pool */}
        <div className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink">Kho dòng mã (có thể chứa dòng bẫy)</p>
            <Badge tone="neutral" mono>
              {parsonsSpec.language.toUpperCase()}
            </Badge>
          </div>
          {availableBlocks.length === 0 ? (
            <p className="py-3 text-xs text-ink-muted">Đã đưa toàn bộ dòng mã sang khung lắp ráp.</p>
          ) : (
            <div className="space-y-1.5">
              {availableBlocks.map(block => (
                <button
                  key={block.id}
                  type="button"
                  data-parsons-block={block.id}
                  onClick={() => addBlock(block.id)}
                  className="w-full cursor-pointer overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-left font-mono text-xs text-ink transition-colors hover:border-accent hover:bg-accent-subtle/40"
                >
                  <code>{block.code}</code>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assembled Code Canvas */}
        <div className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
          <p className="text-xs font-semibold text-ink">
            Khung mã nguồn lắp ráp ({placements.length}/{parsonsSpec.solutionOrder.length} dòng chuẩn)
          </p>
          {placements.length === 0 ? (
            <p className="py-3 text-xs text-ink-muted">
              Nhấn vào các dòng lệnh bên trái để ghép đúng cấu trúc thực thi trước khi viết giải thích tự luận.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {placements.map((item, idx) => {
                const block = blockById.get(item.blockId);
                const fb = grade?.lineFeedback[idx];
                if (!block) return null;
                return (
                  <li
                    key={`${item.blockId}-${idx}`}
                    style={{ marginLeft: `${item.indent * 16}px` }}
                    className={`rounded-[var(--radius-sm)] border p-2 text-xs ${
                      fb?.status === 'correct'
                        ? 'border-success/55 bg-success-subtle/35'
                        : fb
                          ? 'border-warning/65 bg-warning-subtle/35'
                          : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="overflow-x-auto font-mono text-ink">{block.code}</code>
                      {fb ? (
                        <Badge tone={fb.status === 'correct' ? 'success' : 'warning'}>
                          {fb.status === 'correct'
                            ? 'Đúng'
                            : fb.status === 'wrong-indent'
                              ? 'Sai thụt lề'
                              : fb.status === 'wrong-order'
                                ? 'Sai thứ tự'
                                : 'Dòng bẫy'}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        disabled={item.indent === 0}
                        onClick={() => indentAt(idx, -1)}
                        aria-label={`Giảm thụt lề dòng ${idx + 1}`}
                        className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink disabled:opacity-40"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={item.indent >= MAX_INDENT}
                        onClick={() => indentAt(idx, 1)}
                        aria-label={`Tăng thụt lề dòng ${idx + 1}`}
                        className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink disabled:opacity-40"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveAt(idx, -1)}
                        aria-label={`Đưa dòng ${idx + 1} lên`}
                        className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === placements.length - 1}
                        onClick={() => moveAt(idx, 1)}
                        aria-label={`Đưa dòng ${idx + 1} xuống`}
                        className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink disabled:opacity-40"
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
                    {fb && fb.status !== 'correct' ? (
                      <p className="mt-1 text-[11px] text-ink-secondary">{fb.message}</p>
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
          Kiểm tra cấu trúc mã
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Ghép lại
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
              ? 'Chính xác! Cấu trúc mã nguồn và thụt lề hoàn toàn hợp lệ — hãy trình bày lập luận tự luận ở bước tiếp theo.'
              : grade.missingBlockIds.length > 0
                ? `Bạn còn thiếu ${grade.missingBlockIds.length} dòng lệnh bắt buộc.`
                : 'Hãy kiểm tra các dòng bị đánh dấu sai thứ tự, sai thụt lề hoặc dòng bẫy.'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
