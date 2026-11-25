import { useEffect, useState } from 'react';
import type { DiagramRendererProps } from '../../contracts/diagram-module';
import type { MoDiagramStepSpec } from '../../domain/semi-essay';
import {
  diagnoseMoFill,
  EMPTY_MO_COUNTS,
  getExpectedMoCounts,
  type MoDiagnosis,
  type MoOrdering,
  type MoSlotCounts,
  type MoSlotId,
} from '../../core/chemistry/essay-engine';
import {
  isPlainObject,
  useInteractiveStepDraft,
} from '../../infrastructure/practice/interactive-step-drafts';
import { MoDiagramCanvas } from '../chemistry/MoDiagramCanvas';
import { AlertCircleIcon, CheckCircleIcon, RotateCcwIcon } from '../../components/ui/Icons';

interface MoPersistedDraft {
  readonly ordering: MoOrdering;
  readonly counts: MoSlotCounts;
}

function validateMoDraft(raw: unknown): MoPersistedDraft | null {
  if (!isPlainObject(raw)) return null;
  if (raw.ordering !== 'type-1' && raw.ordering !== 'type-2') return null;
  if (!isPlainObject(raw.counts)) return null;
  const counts: Record<string, number> = { ...EMPTY_MO_COUNTS };
  for (const key of Object.keys(EMPTY_MO_COUNTS)) {
    const val = raw.counts[key];
    if (val !== undefined) {
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 0 || val > 2) return null;
      counts[key] = val;
    }
  }
  return { ordering: raw.ordering, counts: counts as unknown as MoSlotCounts };
}

export default function MoDiagram({ spec, completed, draftKey, onEvaluated }: DiagramRendererProps) {
  const moSpec = spec as MoDiagramStepSpec;
  const [persisted, setPersisted, resetPersisted] = useInteractiveStepDraft<MoPersistedDraft>(
    draftKey,
    () => ({
      ordering: completed ? moSpec.expectedOrdering : 'type-1',
      counts: completed
        ? getExpectedMoCounts(moSpec.expectedOrdering, moSpec.expectedTotalElectrons)
        : EMPTY_MO_COUNTS,
    }),
    validateMoDraft,
  );
  const { ordering, counts } = persisted;
  const setOrdering = (next: MoOrdering) => setPersisted(prev => ({ ...prev, ordering: next }));
  const setCounts = (next: MoSlotCounts) => setPersisted(prev => ({ ...prev, counts: next }));
  const [highlightSlotIds, setHighlightSlotIds] = useState<readonly MoSlotId[]>([]);
  const [shakeSlotIds, setShakeSlotIds] = useState<readonly MoSlotId[]>([]);
  const [diagnosis, setDiagnosis] = useState<MoDiagnosis | null>(null);

  useEffect(() => {
    if (completed) {
      setPersisted({
        ordering: moSpec.expectedOrdering,
        counts: getExpectedMoCounts(moSpec.expectedOrdering, moSpec.expectedTotalElectrons),
      });
    }
  }, [completed, moSpec.expectedOrdering, moSpec.expectedTotalElectrons, setPersisted]);

  const handleCheck = () => {
    const res = diagnoseMoFill(
      counts,
      moSpec.expectedOrdering,
      ordering,
      moSpec.expectedTotalElectrons,
    );
    setDiagnosis(res);
    if (!res.ok) {
      setHighlightSlotIds(res.highlightSlotIds);
      setShakeSlotIds(res.highlightSlotIds);
      window.setTimeout(() => setShakeSlotIds([]), 380);
    } else {
      setHighlightSlotIds([]);
      setShakeSlotIds([]);
    }
    onEvaluated({
      correct: res.ok,
      summary: res.message,
    });
  };

  const handleReset = () => {
    resetPersisted();
    setHighlightSlotIds([]);
    setShakeSlotIds([]);
    setDiagnosis(null);
  };

  return (
    <div className="space-y-4">
      {moSpec.note ? <p className="text-sm text-ink-secondary">{moSpec.note}</p> : null}

      <MoDiagramCanvas
        config={moSpec}
        ordering={ordering}
        counts={counts}
        highlightSlotIds={highlightSlotIds}
        shakeSlotIds={shakeSlotIds}
        onOrderingChange={next => {
          setDiagnosis(null);
          setHighlightSlotIds([]);
          setOrdering(next);
        }}
        onCountsChange={next => {
          setDiagnosis(null);
          setHighlightSlotIds([]);
          setCounts(next);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCheck} className="hus-btn hus-btn-primary">
          Kiểm tra giản đồ MO
        </button>
        <button type="button" onClick={handleReset} className="hus-btn hus-btn-secondary">
          <RotateCcwIcon width={14} height={14} />
          Đặt lại giản đồ
        </button>
      </div>

      {diagnosis ? (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${
            diagnosis.ok
              ? 'border-success/35 bg-success-subtle text-success'
              : 'border-warning/35 bg-warning-subtle text-ink'
          }`}
        >
          {diagnosis.ok ? (
            <CheckCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <AlertCircleIcon width={17} height={17} className="mt-0.5 shrink-0 text-warning" />
          )}
          <span>{diagnosis.message}</span>
        </div>
      ) : null}
    </div>
  );
}
