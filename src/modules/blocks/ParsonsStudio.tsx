import { useEffect, useMemo, useState } from 'react';
import type { SubjectToolProps } from '../../contracts/subject-module';
import type {
  ParsonsBlock,
  ParsonsExercise,
  ParsonsGradeResult,
  ParsonsLineFeedback,
  ParsonsPlacement,
} from '../../domain/block-logic';
import { parsonsExercises } from '../../content/blocks/parsons-bank';
import { gradeParsonsSubmission } from '../../core/blocks/parsons';
import { Badge, type BadgeTone } from '../../components/ui/Badge';

const STATUS_META: Record<
  ParsonsLineFeedback['status'],
  { readonly label: string; readonly tone: BadgeTone; readonly borderClass: string }
> = {
  correct: {
    label: 'Đúng',
    tone: 'success',
    borderClass: 'border-success/60 bg-success-subtle/40',
  },
  'wrong-indent': {
    label: 'Sai thụt lề',
    tone: 'warning',
    borderClass: 'border-dashed border-warning/70 bg-warning-subtle/40',
  },
  'wrong-order': {
    label: 'Sai thứ tự',
    tone: 'warning',
    borderClass: 'border-dashed border-danger/60 bg-warning-subtle/40',
  },
  distractor: {
    label: 'Khối gây nhiễu',
    tone: 'danger',
    borderClass: 'border-dotted border-danger/70 bg-danger-subtle/40',
  },
};

const MAX_INDENT = 4;

export default function ParsonsStudio({ courseId, initialPreset, lessonId }: SubjectToolProps) {
  const exercises = useMemo<readonly ParsonsExercise[]>(() => {
    const matched = parsonsExercises.filter(ex => ex.courseId === courseId);
    return matched.length > 0 ? matched : parsonsExercises;
  }, [courseId]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(() => {
    if (initialPreset && exercises.some(ex => ex.id === initialPreset)) {
      return initialPreset;
    }
    if (lessonId) {
      const lessonMatch = exercises.find(ex => ex.lessonId === lessonId);
      if (lessonMatch) return lessonMatch.id;
    }
    return exercises[0]?.id ?? '';
  });

  const activeExercise = useMemo(
    () => exercises.find(ex => ex.id === selectedExerciseId) ?? exercises[0],
    [exercises, selectedExerciseId],
  );

  const [placements, setPlacements] = useState<readonly ParsonsPlacement[]>([]);
  const [gradeResult, setGradeResult] = useState<ParsonsGradeResult | null>(null);

  useEffect(() => {
    if (initialPreset && exercises.some(ex => ex.id === initialPreset)) {
      setSelectedExerciseId(initialPreset);
      setPlacements([]);
      setGradeResult(null);
      return;
    }
    if (lessonId) {
      const lessonMatch = exercises.find(ex => ex.lessonId === lessonId);
      if (lessonMatch) {
        setSelectedExerciseId(lessonMatch.id);
        setPlacements([]);
        setGradeResult(null);
      }
    }
  }, [initialPreset, lessonId, exercises]);

  useEffect(() => {
    if (!exercises.some(ex => ex.id === selectedExerciseId)) {
      setSelectedExerciseId(exercises[0]?.id ?? '');
      setPlacements([]);
      setGradeResult(null);
    }
  }, [exercises, selectedExerciseId]);

  if (!activeExercise) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-sm text-ink-muted">
        Chưa có bài tập ghép khối mã nguồn nào khả dụng.
      </div>
    );
  }

  const blockById = new Map<string, ParsonsBlock>(
    activeExercise.blocks.map(block => [block.id, block]),
  );
  const placedIds = new Set(placements.map(p => p.blockId));
  const availableBlocks = activeExercise.blocks.filter(block => !placedIds.has(block.id));

  const handleSelectExercise = (id: string) => {
    setSelectedExerciseId(id);
    setPlacements([]);
    setGradeResult(null);
  };

  const handleAddBlock = (blockId: string) => {
    setPlacements(prev => [...prev, { blockId, indent: 0 }]);
    setGradeResult(null);
  };

  const handleRemoveBlock = (index: number) => {
    setPlacements(prev => prev.filter((_, i) => i !== index));
    setGradeResult(null);
  };

  const handleMoveBlock = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= placements.length) return;
    setPlacements(prev => {
      const next = [...prev];
      const currentItem = next[index];
      const targetItem = next[target];
      if (!currentItem || !targetItem) return prev;
      next[index] = targetItem;
      next[target] = currentItem;
      return next;
    });
    setGradeResult(null);
  };

  const handleIndentChange = (index: number, delta: -1 | 1) => {
    setPlacements(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const nextIndent = Math.max(0, Math.min(MAX_INDENT, item.indent + delta));
        return { ...item, indent: nextIndent };
      }),
    );
    setGradeResult(null);
  };

  const handleCheck = () => {
    setGradeResult(gradeParsonsSubmission(activeExercise, placements));
  };

  const handleReset = () => {
    setPlacements([]);
    setGradeResult(null);
  };

  return (
    <section
      aria-label="Phòng thực hành ghép khối mã nguồn"
      className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              {activeExercise.title}
            </h3>
            <Badge tone="accent" mono>
              {activeExercise.language}
            </Badge>
          </div>
          <p className="text-sm text-ink-secondary">{activeExercise.prompt}</p>
        </div>

        {exercises.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn bài tập Parsons">
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
                  Bài {idx + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column: Available blocks */}
        <div className="min-w-0 space-y-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">Kho khối mã nguồn</h4>
            <Badge tone="neutral" mono>
              {availableBlocks.length} khối
            </Badge>
          </div>

          {availableBlocks.length === 0 ? (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-surface p-4 text-center text-xs text-ink-muted">
              Đã đưa toàn bộ khối vào bài làm.
            </p>
          ) : (
            <ul className="space-y-2">
              {availableBlocks.map(block => (
                <li
                  key={block.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-surface p-2.5"
                >
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs text-ink sm:text-[13px]">
                    {block.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleAddBlock(block.id)}
                    aria-label={`Thêm khối ${block.code}`}
                    className="shrink-0 rounded-[var(--radius-sm)] border border-accent/30 bg-accent-subtle px-2.5 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:border-accent hover:bg-accent hover:text-white"
                  >
                    + Thêm
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: Solution construction */}
        <div className="min-w-0 space-y-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">Bài làm của bạn</h4>
            <Badge tone="neutral" mono>
              {placements.length} dòng
            </Badge>
          </div>

          {placements.length === 0 ? (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-surface p-4 text-center text-xs text-ink-muted">
              Chọn &ldquo;+ Thêm&rdquo; từ kho bên trái để sắp xếp thứ tự và thụt lề cho lời giải.
            </p>
          ) : (
            <ol className="space-y-2">
              {placements.map((placement, index) => {
                const block = blockById.get(placement.blockId);
                if (!block) return null;
                const feedback = gradeResult?.lineFeedback[index];
                const statusMeta = feedback ? STATUS_META[feedback.status] : null;

                return (
                  <li
                    key={placement.blockId}
                    className={`rounded-[var(--radius-sm)] border p-2.5 transition-colors ${
                      statusMeta ? statusMeta.borderClass : 'border-border bg-surface'
                    }`}
                  >
                    <div
                      className="min-w-0 overflow-x-auto"
                      style={{ paddingLeft: `${placement.indent * 18}px` }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="shrink-0 font-mono text-[11px] text-ink-muted">
                          {index + 1}.
                        </span>
                        <code className="whitespace-pre font-mono text-xs text-ink sm:text-[13px]">
                          {block.code}
                        </code>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/70 pt-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(index, -1)}
                          disabled={index === 0}
                          aria-label={`Di chuyển dòng ${index + 1} lên`}
                          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(index, 1)}
                          disabled={index === placements.length - 1}
                          aria-label={`Di chuyển dòng ${index + 1} xuống`}
                          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIndentChange(index, -1)}
                          disabled={placement.indent === 0}
                          aria-label={`Giảm thụt lề dòng ${index + 1}`}
                          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ← Giảm thụt lề
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIndentChange(index, 1)}
                          disabled={placement.indent >= MAX_INDENT}
                          aria-label={`Tăng thụt lề dòng ${index + 1}`}
                          className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          → Tăng thụt lề
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-ink-muted">
                          Thụt lề: {placement.indent}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(index)}
                          aria-label={`Bỏ dòng ${index + 1} khỏi bài làm`}
                          className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-subtle/60 px-2 py-1 text-xs font-medium text-danger hover:border-danger"
                        >
                          × Bỏ
                        </button>
                      </div>
                    </div>

                    {feedback && statusMeta && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        <span className="text-ink-secondary">{feedback.message}</span>
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
            disabled={placements.length === 0}
            className="min-h-[38px] rounded-[var(--radius-md)] bg-accent-solid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-solid-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kiểm tra cấu trúc
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={placements.length === 0 && gradeResult === null}
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
              {gradeResult.passed ? 'Đạt chuẩn' : 'Chưa đạt'} · {gradeResult.correctCount}/
              {gradeResult.expectedCount} dòng đúng
            </Badge>
            {gradeResult.missingBlockIds.length > 0 && (
              <span className="text-xs font-medium text-warning">
                Còn thiếu {gradeResult.missingBlockIds.length} khối bắt buộc
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
