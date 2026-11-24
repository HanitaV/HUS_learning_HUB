import { useEffect, useMemo, useState } from 'react';
import type { SubjectToolProps } from '../../contracts/subject-module';
import type {
  ProofBlockItem,
  ProofBlocksExercise,
  ProofGradeResult,
  ProofStepDiagnostic,
} from '../../domain/block-logic';
import { proofBlocksExercises } from '../../content/blocks/proof-bank';
import { gradeProofBlocks } from '../../core/blocks/proof-dag';
import Markdown from '../../components/learning/Markdown';
import { Badge, type BadgeTone } from '../../components/ui/Badge';

const DIAGNOSTIC_META: Record<
  ProofStepDiagnostic['status'],
  { readonly label: string; readonly tone: BadgeTone; readonly borderClass: string }
> = {
  valid: {
    label: 'Hợp lệ',
    tone: 'success',
    borderClass: 'border-success/60 bg-success-subtle/40',
  },
  'missing-prereq': {
    label: 'Thiếu tiền đề',
    tone: 'warning',
    borderClass: 'border-dashed border-warning/70 bg-warning-subtle/40',
  },
  duplicate: {
    label: 'Trùng lặp',
    tone: 'warning',
    borderClass: 'border-dashed border-warning/70 bg-warning-subtle/40',
  },
  distractor: {
    label: 'Bước gây nhiễu',
    tone: 'danger',
    borderClass: 'border-dotted border-danger/70 bg-danger-subtle/40',
  },
};

export default function ProofBlocksStudio({ courseId, initialPreset }: SubjectToolProps) {
  const exercises = useMemo<readonly ProofBlocksExercise[]>(() => {
    const matched = proofBlocksExercises.filter(ex => ex.courseId === courseId);
    return matched.length > 0 ? matched : proofBlocksExercises;
  }, [courseId]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(() => {
    if (initialPreset && exercises.some(ex => ex.id === initialPreset)) {
      return initialPreset;
    }
    return exercises[0]?.id ?? '';
  });

  const activeExercise = useMemo(
    () => exercises.find(ex => ex.id === selectedExerciseId) ?? exercises[0],
    [exercises, selectedExerciseId],
  );

  const [selectedBlockIds, setSelectedBlockIds] = useState<readonly string[]>([]);
  const [gradeResult, setGradeResult] = useState<ProofGradeResult | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (initialPreset && exercises.some(ex => ex.id === initialPreset)) {
      setSelectedExerciseId(initialPreset);
      setSelectedBlockIds([]);
      setGradeResult(null);
      setShowHint(false);
    }
  }, [initialPreset, exercises]);

  useEffect(() => {
    if (!exercises.some(ex => ex.id === selectedExerciseId)) {
      setSelectedExerciseId(exercises[0]?.id ?? '');
      setSelectedBlockIds([]);
      setGradeResult(null);
      setShowHint(false);
    }
  }, [exercises, selectedExerciseId]);

  if (!activeExercise) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-sm text-ink-muted">
        Chưa có bài tập khối chứng minh nào khả dụng.
      </div>
    );
  }

  const blockById = new Map<string, ProofBlockItem>(
    activeExercise.blocks.map(block => [block.id, block]),
  );
  const selectedSet = new Set(selectedBlockIds);
  const availableBlocks = activeExercise.blocks.filter(block => !selectedSet.has(block.id));

  const handleSelectExercise = (id: string) => {
    setSelectedExerciseId(id);
    setSelectedBlockIds([]);
    setGradeResult(null);
    setShowHint(false);
  };

  const handleAddBlock = (blockId: string) => {
    setSelectedBlockIds(prev => [...prev, blockId]);
    setGradeResult(null);
  };

  const handleRemoveBlock = (index: number) => {
    setSelectedBlockIds(prev => prev.filter((_, i) => i !== index));
    setGradeResult(null);
  };

  const handleMoveBlock = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= selectedBlockIds.length) return;
    setSelectedBlockIds(prev => {
      const next = [...prev];
      const currentId = next[index];
      const targetId = next[target];
      if (!currentId || !targetId) return prev;
      next[index] = targetId;
      next[target] = currentId;
      return next;
    });
    setGradeResult(null);
  };

  const handleCheck = () => {
    setGradeResult(gradeProofBlocks(activeExercise, selectedBlockIds));
  };

  const handleReset = () => {
    setSelectedBlockIds([]);
    setGradeResult(null);
  };

  return (
    <section
      aria-label="Phòng thực hành khối chứng minh Toán học"
      className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5"
    >
      {/* Header & exercise selector */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              {activeExercise.title}
            </h3>
            <Badge tone="accent">Chứng minh DAG</Badge>
          </div>
        </div>

        {exercises.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn bài chứng minh">
            {exercises.map((ex, idx) => {
              const isActive = ex.id === activeExercise.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelectExercise(ex.id)}
                  aria-pressed={isActive}
                  className={`min-h-[34px] rounded-[var(--radius-sm)] border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-surface-subtle text-ink-secondary hover:border-border-strong hover:text-ink'
                  }`}
                >
                  Định lý {idx + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Theorem statement & collapsible hint */}
      <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-subtle/50 p-3.5">
        <div className="prose-sm min-w-0 text-sm text-ink [&_.katex-display]:overflow-x-auto">
          <Markdown>{activeExercise.theoremStatement}</Markdown>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowHint(prev => !prev)}
            aria-expanded={showHint}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
          >
            <span>{showHint ? 'Ẩn gợi ý' : 'Xem gợi ý'}</span>
          </button>

          {showHint && (
            <div className="mt-2 rounded-[var(--radius-sm)] border border-accent/25 bg-accent-subtle/40 p-3 text-xs text-ink-secondary [&_.katex-display]:overflow-x-auto">
              <Markdown>{activeExercise.hint}</Markdown>
            </div>
          )}
        </div>
      </div>

      {/* Two-column workspace */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Scrambled proof blocks */}
        <div className="min-w-0 space-y-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">Kho khối lập luận</h4>
            <Badge tone="neutral" mono>
              {availableBlocks.length} khối
            </Badge>
          </div>

          {availableBlocks.length === 0 ? (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-surface p-4 text-center text-xs text-ink-muted">
              Đã đưa toàn bộ khối lập luận vào chuỗi chứng minh.
            </p>
          ) : (
            <ul className="space-y-2">
              {availableBlocks.map(block => (
                <li
                  key={block.id}
                  className="flex items-start justify-between gap-2.5 rounded-[var(--radius-sm)] border border-border bg-surface p-2.5"
                >
                  <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink sm:text-sm [&_.katex-display]:overflow-x-auto">
                    <Markdown inline>{block.text}</Markdown>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddBlock(block.id)}
                    aria-label="Thêm bước vào lập luận"
                    className="shrink-0 rounded-[var(--radius-sm)] border border-accent/30 bg-accent-subtle px-2.5 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:border-accent hover:bg-accent hover:text-white"
                  >
                    + Thêm
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Ordered proof construction */}
        <div className="min-w-0 space-y-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">Chuỗi lập luận của bạn</h4>
            <Badge tone="neutral" mono>
              {selectedBlockIds.length} bước
            </Badge>
          </div>

          {selectedBlockIds.length === 0 ? (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-surface p-4 text-center text-xs text-ink-muted">
              Chọn các khối bên trái theo đúng thứ tự suy diễn logic. Hệ thống chấp nhận mọi thứ tự topo hợp lệ.
            </p>
          ) : (
            <ol className="space-y-2">
              {selectedBlockIds.map((blockId, index) => {
                const block = blockById.get(blockId);
                if (!block) return null;
                const diagnostic = gradeResult?.diagnostics[index];
                const meta = diagnostic ? DIAGNOSTIC_META[diagnostic.status] : null;

                return (
                  <li
                    key={`${blockId}-${index}`}
                    className={`rounded-[var(--radius-sm)] border p-2.5 transition-colors ${
                      meta ? meta.borderClass : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="shrink-0 font-mono text-xs font-semibold text-ink-muted">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink sm:text-sm [&_.katex-display]:overflow-x-auto">
                          <Markdown inline>{block.text}</Markdown>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(index, -1)}
                          disabled={index === 0}
                          aria-label={`Di chuyển bước ${index + 1} lên`}
                          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(index, 1)}
                          disabled={index === selectedBlockIds.length - 1}
                          aria-label={`Di chuyển bước ${index + 1} xuống`}
                          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(index)}
                          aria-label={`Bỏ bước ${index + 1}`}
                          className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-subtle/60 px-2 py-1 text-xs font-medium text-danger hover:border-danger"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {diagnostic && meta && (
                      <div className="mt-2 space-y-1 border-t border-border/70 pt-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="text-ink-secondary">{diagnostic.message}</span>
                        </div>
                        {diagnostic.missingPrereqIds.length > 0 && (
                          <div className="text-warning">
                            Cần có trước:{' '}
                            {diagnostic.missingPrereqIds
                              .map(pid => blockById.get(pid)?.text ?? pid)
                              .join('; ')}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Controls & overall result */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheck}
            disabled={selectedBlockIds.length === 0}
            className="min-h-[38px] rounded-[var(--radius-md)] bg-accent-solid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-solid-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kiểm tra lập luận
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={selectedBlockIds.length === 0 && gradeResult === null}
            className="min-h-[38px] rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Làm lại
          </button>
        </div>

        {gradeResult && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <Badge tone={gradeResult.passed ? 'success' : 'warning'} mono>
              {gradeResult.passed ? 'Chứng minh hợp lệ' : 'Chưa hoàn chỉnh'} ·{' '}
              {gradeResult.validCount}/{gradeResult.requiredCount} bước hợp lệ
            </Badge>
            {gradeResult.missingRequiredIds.length > 0 && (
              <span className="text-xs font-medium text-warning">
                Còn thiếu {gradeResult.missingRequiredIds.length} bước bắt buộc
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
