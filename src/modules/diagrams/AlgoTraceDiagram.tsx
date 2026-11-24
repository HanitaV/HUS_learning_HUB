import { useMemo, useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { AlgoTraceCellSpec, AlgoTraceStepSpec } from '../../domain/semi-essay';
import { gradeAlgoTraceStep, type AlgoTraceGradeResult } from '../../core/learning/hybrid-diagrams';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

export default function AlgoTraceDiagram({ spec, completed, onEvaluated }: DiagramRendererProps) {
  const traceSpec = spec as AlgoTraceStepSpec;

  const cellMap = useMemo(() => {
    const map = new Map<string, AlgoTraceCellSpec>();
    for (const cell of traceSpec.cells) {
      map.set(`${cell.row}-${cell.col}`, cell);
    }
    return map;
  }, [traceSpec.cells]);

  const [values, setValues] = useState<Readonly<Record<string, string>>>(() => {
    if (!completed) return {};
    const prefilled: Record<string, string> = {};
    for (const cell of traceSpec.cells) {
      const key = `${cell.row}-${cell.col}`;
      if (cell.expectedAnswers && cell.expectedAnswers[0] !== undefined) {
        prefilled[key] = cell.expectedAnswers[0];
      } else if (cell.numericExpected !== undefined) {
        prefilled[key] = String(cell.numericExpected);
      }
    }
    return prefilled;
  });

  const [grade, setGrade] = useState<AlgoTraceGradeResult | null>(null);

  const handleCheck = () => {
    const res = gradeAlgoTraceStep(values, traceSpec);
    setGrade(res);
    onEvaluated({
      correct: res.correct,
      summary: res.correct
        ? `Bảng truy vết "${traceSpec.structureLabel}" chính xác (${res.matchedCount}/${res.totalExpected} ô).`
        : `Đúng ${res.matchedCount}/${res.totalExpected} ô truy vết.`,
    });
  };

  const handleReset = () => {
    setValues({});
    setGrade(null);
  };

  const errorKeys = new Set(grade?.diagnostics.map(d => d.cellKey) ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {traceSpec.structureLabel}
        </p>
        <span className="text-xs text-ink-muted">Điền giá trị trạng thái vào các ô trống</span>
      </div>
      {traceSpec.note ? <p className="text-sm text-ink-secondary">{traceSpec.note}</p> : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-canvas p-3">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="border border-border bg-surface-subtle px-2.5 py-2 text-left font-mono font-semibold text-ink-muted">
                Trạng thái \ Chỉ số
              </th>
              {traceSpec.colLabels.map((colLabel, cIdx) => (
                <th
                  key={cIdx}
                  className="min-w-[54px] border border-border bg-surface-subtle px-2 py-2 font-mono font-semibold text-ink"
                >
                  {colLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traceSpec.rowLabels.map((rowLabel, rIdx) => (
              <tr key={rIdx}>
                <th
                  scope="row"
                  className="border border-border bg-surface-subtle/70 px-2.5 py-2 text-left font-mono font-medium text-ink"
                >
                  {rowLabel}
                </th>
                {traceSpec.colLabels.map((colLabel, cIdx) => {
                  const key = `${rIdx}-${cIdx}`;
                  const cell = cellMap.get(key);
                  const isInteractive =
                    cell !== undefined &&
                    ((cell.expectedAnswers && cell.expectedAnswers.length > 0) ||
                      cell.numericExpected !== undefined);
                  const hasError = errorKeys.has(key);

                  return (
                    <td
                      key={key}
                      className={`border border-border p-1.5 font-mono ${
                        cell?.highlightTone === 'accent'
                          ? 'bg-accent-subtle/40'
                          : cell?.highlightTone === 'warning'
                            ? 'bg-warning-subtle/40'
                            : 'bg-surface'
                      }`}
                    >
                      {isInteractive ? (
                        <input
                          type="text"
                          data-trace-cell={key}
                          aria-label={`Ô truy vết ${rowLabel}, ${colLabel}`}
                          value={values[key] ?? ''}
                          placeholder={cell?.givenValue ?? '?'}
                          onChange={e => {
                            setGrade(null);
                            setValues(prev => ({ ...prev, [key]: e.target.value }));
                          }}
                          className={`min-h-[36px] w-full min-w-[46px] rounded border px-1.5 py-1 text-center font-mono text-xs font-semibold text-ink focus:outline-none ${
                            hasError
                              ? 'border-danger bg-danger-subtle/35'
                              : grade?.correct
                                ? 'border-success bg-success-subtle/35'
                                : 'border-accent/55 bg-canvas focus:border-accent'
                          }`}
                        />
                      ) : (
                        <span className="inline-block px-1.5 py-1 text-ink-secondary">
                          {cell?.givenValue ?? '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra bảng truy vết
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Đặt lại bảng
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
                ? `Chính xác (${grade.matchedCount}/${grade.totalExpected} ô)! Kết quả truy vết đã khớp hoàn toàn.`
                : `Đúng ${grade.matchedCount}/${grade.totalExpected} ô truy vết:`}
            </span>
          </div>
          {!grade.correct && grade.diagnostics.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-xs text-ink-secondary">
              {grade.diagnostics.map(d => (
                <li key={d.cellKey}>{d.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
