import type { SemiEssayStep } from '../../domain/semi-essay';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Produces a concise Vietnamese summary of what a student actually drew, selected,
 * or entered in a non-written interactive step (`FBD`, `MO`, `Heatmap`, `Curve2d`, etc.)
 * so downstream WebMCP written-reasoning checks can verify cross-step consistency.
 */
export function summarizeStudentInteractiveDraft(
  step: SemiEssayStep,
  rawDraft: unknown,
): string | null {
  if (step.kind === 'written-reasoning' || rawDraft === null || rawDraft === undefined) {
    return null;
  }

  try {
    if (step.kind === 'choice-reasoning') {
      if (!Array.isArray(rawDraft) || rawDraft.length === 0) return null;
      const labels = rawDraft
        .filter((id): id is string => typeof id === 'string')
        .map(id => step.choices.find(c => c.id === id)?.label ?? id);
      if (labels.length === 0) return null;
      return `${step.title}: sinh viên đã chọn ${labels.join('; ')}.`;
    }

    if (step.kind === 'axis-projection') {
      if (!isRecord(rawDraft)) return null;
      const parts: string[] = [];
      for (const axis of step.axes) {
        const axisMap = rawDraft[axis.id];
        if (!isRecord(axisMap)) continue;
        const rowParts: string[] = [];
        for (const row of axis.rows) {
          const cell = axisMap[row.forceId];
          if (!isRecord(cell)) continue;
          const sign = typeof cell.sign === 'string' ? cell.sign : '';
          const comp = typeof cell.component === 'string' ? cell.component : '';
          if (!sign && !comp) continue;
          const compLabel =
            comp === '0'
              ? '0'
              : row.componentOptions.find(o => o.id === comp)?.latex ?? comp;
          rowParts.push(`${row.forceId}: ${sign}${compLabel ? compLabel : ''}`);
        }
        if (rowParts.length > 0) {
          parts.push(`${axis.label} [${rowParts.join(', ')}]`);
        }
      }
      if (parts.length === 0) return null;
      return `${step.title}: sinh viên chiếu ${parts.join(' | ')}.`;
    }

    if (step.kind === 'equation-transform') {
      if (!isRecord(rawDraft) || !Array.isArray(rawDraft.history) || rawDraft.history.length === 0) {
        return null;
      }
      const stepsText = rawDraft.history
        .filter(isRecord)
        .map(item => (typeof item.label === 'string' ? item.label : ''))
        .filter(Boolean)
        .join(' → ');
      if (!stepsText) return null;
      return `${step.title}: đã thực hiện ${rawDraft.history.length} phép biến đổi (${stepsText}).`;
    }

    if (step.kind === 'numeric-unit') {
      if (!isRecord(rawDraft)) return null;
      const valParts: string[] = [];
      if (isRecord(rawDraft.values)) {
        for (const field of step.fields) {
          const val = rawDraft.values[field.id];
          if (typeof val === 'string' && val.trim() !== '') {
            valParts.push(`${field.label} = ${val.trim()} ${field.unit}`.trim());
          }
        }
      }
      const limitStr =
        typeof rawDraft.limitChoice === 'string' && rawDraft.limitChoice
          ? step.limitingCheck?.choices.find(c => c.id === rawDraft.limitChoice)?.label ??
            rawDraft.limitChoice
          : '';
      if (valParts.length === 0 && !limitStr) return null;
      const details = [...valParts, ...(limitStr ? [`kiểm tra biên: ${limitStr}`] : [])].join('; ');
      return `${step.title}: sinh viên nhập ${details}.`;
    }

    // step.kind === 'diagram'
    const spec = step.spec;
    if (spec.kind === 'fbd') {
      if (!isRecord(rawDraft)) return null;
      const bodyParts: string[] = [];
      for (const body of spec.bodies) {
        const arrows = rawDraft[body.id];
        if (!Array.isArray(arrows) || arrows.length === 0) continue;
        const arrowDescs = arrows
          .filter(isRecord)
          .map(arr => {
            const type = typeof arr.type === 'string' ? arr.type : '';
            const angle = typeof arr.angle === 'number' ? Math.round(arr.angle) : 0;
            const def = spec.forceCatalog[type];
            const label = def ? `${def.label}${def.subscript ?? ''}` : type;
            return `${label} (${angle}°)`;
          })
          .filter(Boolean);
        if (arrowDescs.length > 0) {
          bodyParts.push(`${body.label}: [${arrowDescs.join(', ')}]`);
        }
      }
      if (bodyParts.length === 0) return null;
      return `${step.title} (FBD): sinh viên đã vẽ ${bodyParts.join('; ')}.`;
    }

    if (spec.kind === 'mo-diagram') {
      if (!isRecord(rawDraft) || !isRecord(rawDraft.counts)) return null;
      const orderingLabel = rawDraft.ordering === 'type-2' ? 'Loại II (π2p < σ2p)' : 'Loại I (σ2p < π2p)';
      let totalE = 0;
      const slotEntries: string[] = [];
      for (const [slot, val] of Object.entries(rawDraft.counts)) {
        if (typeof val === 'number' && val > 0) {
          totalE += val;
          slotEntries.push(`${slot}:${val}e`);
        }
      }
      if (totalE === 0 && rawDraft.ordering !== 'type-2') return null;
      return `${step.title} (MO ${spec.speciesLabel}): chọn ${orderingLabel}, đã điền ${totalE}e (${slotEntries.join(', ')}).`;
    }

    if (spec.kind === 'heatmap') {
      if (!isRecord(rawDraft)) return null;
      const parts: string[] = [];
      if (Array.isArray(rawDraft.selectedCells) && rawDraft.selectedCells.length > 0) {
        parts.push(`chọn ${rawDraft.selectedCells.length} ô (${rawDraft.selectedCells.slice(0, 6).join(', ')})`);
      }
      if (isRecord(rawDraft.flowAngles) && Object.keys(rawDraft.flowAngles).length > 0) {
        const flows = Object.entries(rawDraft.flowAngles).map(([k, v]) => `${k}: ${String(v)}°`);
        parts.push(`hướng truyền nhiệt [${flows.join(', ')}]`);
      }
      if (isRecord(rawDraft.paintedTrends) && Object.keys(rawDraft.paintedTrends).length > 0) {
        parts.push(`tô xu hướng ${Object.keys(rawDraft.paintedTrends).length} ô`);
      }
      if (parts.length === 0) return null;
      return `${step.title} (Heatmap): sinh viên ${parts.join('; ')}.`;
    }

    if (spec.kind === 'curve-2d') {
      if (!isRecord(rawDraft)) return null;
      const parts: string[] = [];
      if (Array.isArray(rawDraft.selectedIds) && rawDraft.selectedIds.length > 0) {
        parts.push(`chọn miền [${rawDraft.selectedIds.join(', ')}]`);
      }
      if (isRecord(rawDraft.signMatrix)) {
        const rows: string[] = [];
        for (const [segId, cols] of Object.entries(rawDraft.signMatrix)) {
          if (!isRecord(cols)) continue;
          const colDesc = Object.entries(cols)
            .filter(([, sign]) => sign === '+' || sign === '-' || sign === '0')
            .map(([colId, sign]) => `${colId}=${String(sign)}`)
            .join(', ');
          if (colDesc) rows.push(`${segId}(${colDesc})`);
        }
        if (rows.length > 0) {
          parts.push(`bảng dấu [${rows.join('; ')}]`);
        }
      }
      if (parts.length === 0) return null;
      return `${step.title} (Đồ thị 2D): sinh viên ${parts.join('; ')}.`;
    }

    if (spec.kind === 'balance-flow') {
      if (!isRecord(rawDraft)) return null;
      const transfer = typeof rawDraft.transferSign === 'string' ? rawDraft.transferSign : '';
      const initSum = isRecord(rawDraft.initialLevels)
        ? Object.values(rawDraft.initialLevels).reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0)
        : 0;
      const finalSum = isRecord(rawDraft.finalLevels)
        ? Object.values(rawDraft.finalLevels).reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0)
        : 0;
      if (!transfer && initSum === 0 && finalSum === 0) return null;
      return `${step.title} (Cân bằng năng lượng): tổng cột đầu=${initSum}, cuối=${finalSum}, dấu truyền ${spec.transferLabel}='${transfer || '?'}'.`;
    }

    if (spec.kind === 'prob-tree') {
      if (!isRecord(rawDraft)) return null;
      const branchParts: string[] = [];
      for (const b of spec.branches) {
        const entry = rawDraft[b.id];
        if (!isRecord(entry)) continue;
        const p = typeof entry.prior === 'string' ? entry.prior.trim() : '';
        const c = typeof entry.conditional === 'string' ? entry.conditional.trim() : '';
        if (p || c) {
          branchParts.push(`${b.label}: P=${p || '?'}, P(E|H)=${c || '?'}`);
        }
      }
      if (branchParts.length === 0) return null;
      return `${step.title} (Cây xác suất): sinh viên điền [${branchParts.join('; ')}].`;
    }

    if (spec.kind === 'algo-trace') {
      if (!isRecord(rawDraft)) return null;
      const filled = Object.entries(rawDraft).filter(
        ([, val]) => typeof val === 'string' && val.trim() !== '',
      );
      if (filled.length === 0) return null;
      const preview = filled
        .slice(0, 6)
        .map(([k, v]) => `${k}=${String(v).trim()}`)
        .join(', ');
      return `${step.title} (Bảng truy vết): đã điền ${filled.length} ô (${preview}${
        filled.length > 6 ? ', …' : ''
      }).`;
    }

    if (spec.kind === 'proof-dag') {
      if (!Array.isArray(rawDraft) || rawDraft.length === 0) return null;
      const labels = rawDraft
        .filter((id): id is string => typeof id === 'string')
        .map(id => spec.blocks.find(b => b.id === id)?.text ?? id);
      if (labels.length === 0) return null;
      return `${step.title} (Sơ đồ chứng minh): đã chọn ${labels.length} mệnh đề (${labels.slice(0, 3).join(' → ')}${
        labels.length > 3 ? '…' : ''
      }).`;
    }

    if (spec.kind === 'parsons-flow') {
      if (!Array.isArray(rawDraft) || rawDraft.length === 0) return null;
      return `${step.title} (Sắp xếp mã): đã ghép ${rawDraft.length} dòng lệnh.`;
    }
  } catch {
    return null;
  }

  return null;
}
