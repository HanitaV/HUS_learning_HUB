export type MoOrdering = 'type-1' | 'type-2';

export type MoSlotId =
  | 's2s'
  | 's2s_star'
  | 's2p'
  | 'p2p_1'
  | 'p2p_2'
  | 'p2p_star_1'
  | 'p2p_star_2'
  | 's2p_star';

export type MoLevelId = 's2s' | 's2s_star' | 's2p' | 'p2p' | 'p2p_star' | 's2p_star';

export type MoSlotCounts = Readonly<Record<MoSlotId, 0 | 1 | 2>>;

export interface MoEnergyLevel {
  readonly id: MoLevelId;
  readonly label: string;
  readonly subLabel: string;
  readonly slots: readonly MoSlotId[];
  readonly bonding: boolean;
  readonly aoOrigin: '2s' | '2p';
  /** Normalized visual row index from bottom (0) to top (5) for smooth FLIP transitions. */
  readonly energyRow: number;
  /** Short dual-coding description for orbital phase shape preview. */
  readonly phaseSummary: string;
}

export interface MoMetrics {
  readonly totalElectrons: number;
  readonly bondingElectrons: number;
  readonly antibondingElectrons: number;
  readonly bondOrder: number;
  readonly unpairedElectrons: number;
  readonly magnetism: 'paramagnetic' | 'diamagnetic';
  readonly configuration: string;
}

export interface MoFillAnimationStep {
  readonly stepIndex: number;
  readonly slotId: MoSlotId;
  readonly levelId: MoLevelId;
  readonly spin: 'up' | 'down';
  readonly rule: 'aufbau' | 'hund' | 'pauli';
  readonly explanation: string;
  readonly countsAfter: MoSlotCounts;
}

export interface MoDiagnosis {
  readonly ok: boolean;
  readonly violation?: 'ordering' | 'count' | 'aufbau' | 'hund';
  readonly highlightSlotIds: readonly MoSlotId[];
  readonly message: string;
}

export const EMPTY_MO_COUNTS: MoSlotCounts = Object.freeze({
  s2s: 0,
  s2s_star: 0,
  s2p: 0,
  p2p_1: 0,
  p2p_2: 0,
  p2p_star_1: 0,
  p2p_star_2: 0,
  s2p_star: 0,
});

const BONDING_SLOTS: ReadonlySet<MoSlotId> = new Set(['s2s', 's2p', 'p2p_1', 'p2p_2']);

export function getMoLevelsInOrder(ordering: MoOrdering): readonly MoEnergyLevel[] {
  const s2pRow = ordering === 'type-1' ? 2 : 3;
  const p2pRow = ordering === 'type-1' ? 3 : 2;

  const levels: readonly MoEnergyLevel[] = [
    {
      id: 's2s',
      label: 'σ2s',
      subLabel: 'Liên kết',
      slots: ['s2s'],
      bonding: true,
      aoOrigin: '2s',
      energyRow: 0,
      phaseSummary: 'Tổ hợp cùng pha 2s + 2s: mật độ electron tập trung giữa hai hạt nhân, không có mặt nút.',
    },
    {
      id: 's2s_star',
      label: 'σ*2s',
      subLabel: 'Phản liên kết',
      slots: ['s2s_star'],
      bonding: false,
      aoOrigin: '2s',
      energyRow: 1,
      phaseSummary: 'Tổ hợp ngược pha 2s − 2s: xuất hiện mặt nút vuông góc trục liên nhân, làm giảm độ bền.',
    },
    {
      id: 's2p',
      label: 'σ2p',
      subLabel: 'Liên kết',
      slots: ['s2p'],
      bonding: true,
      aoOrigin: '2p',
      energyRow: s2pRow,
      phaseSummary: 'Xen phủ dọc trục cùng pha của hai AO 2pz: mật độ electron dày đặc dọc trục liên kết.',
    },
    {
      id: 'p2p',
      label: 'π2p',
      subLabel: 'Liên kết (2 orbital đồng mức)',
      slots: ['p2p_1', 'p2p_2'],
      bonding: true,
      aoOrigin: '2p',
      energyRow: p2pRow,
      phaseSummary: 'Xen phủ bên cùng pha của hai cặp 2px, 2py tạo 2 đám mây π đối xứng trên–dưới trục.',
    },
    {
      id: 'p2p_star',
      label: 'π*2p',
      subLabel: 'Phản liên kết (2 orbital đồng mức)',
      slots: ['p2p_star_1', 'p2p_star_2'],
      bonding: false,
      aoOrigin: '2p',
      energyRow: 4,
      phaseSummary: 'Xen phủ bên ngược pha: xuất hiện mặt nút cắt ngang giữa hai nhân, đẩy nhau và tăng năng lượng.',
    },
    {
      id: 's2p_star',
      label: 'σ*2p',
      subLabel: 'Phản liên kết',
      slots: ['s2p_star'],
      bonding: false,
      aoOrigin: '2p',
      energyRow: 5,
      phaseSummary: 'Xen phủ dọc trục ngược pha của hai AO 2pz: mặt nút nằm chính giữa, năng lượng cao nhất.',
    },
  ];

  return [...levels].sort((a, b) => a.energyRow - b.energyRow);
}

export function cycleMoSlotCount(current: 0 | 1 | 2): 0 | 1 | 2 {
  if (current === 0) return 1;
  if (current === 1) return 2;
  return 0;
}

export function computeMoMetrics(counts: MoSlotCounts, ordering: MoOrdering): MoMetrics {
  let bondingElectrons = 0;
  let antibondingElectrons = 0;
  let unpairedElectrons = 0;

  for (const [slotId, count] of Object.entries(counts) as [MoSlotId, 0 | 1 | 2][]) {
    if (BONDING_SLOTS.has(slotId)) {
      bondingElectrons += count;
    } else {
      antibondingElectrons += count;
    }
    if (count === 1) {
      unpairedElectrons += 1;
    }
  }

  const totalElectrons = bondingElectrons + antibondingElectrons;
  const bondOrder = (bondingElectrons - antibondingElectrons) / 2;
  const magnetism: 'paramagnetic' | 'diamagnetic' =
    unpairedElectrons > 0 ? 'paramagnetic' : 'diamagnetic';

  const levels = getMoLevelsInOrder(ordering);
  const parts: string[] = [];
  for (const level of levels) {
    const levelSum = level.slots.reduce((acc, id) => acc + counts[id], 0);
    if (levelSum > 0) {
      parts.push(`(${level.label})^${levelSum}`);
    }
  }

  return {
    totalElectrons,
    bondingElectrons,
    antibondingElectrons,
    bondOrder,
    unpairedElectrons,
    magnetism,
    configuration: parts.length > 0 ? parts.join(' ') : 'Chưa điền electron',
  };
}

export function buildExpectedMoFillSequence(
  ordering: MoOrdering,
  totalElectrons: number,
): readonly MoFillAnimationStep[] {
  const levels = getMoLevelsInOrder(ordering);
  const clamped = Math.max(0, Math.min(16, Math.round(totalElectrons)));
  const working: Record<MoSlotId, 0 | 1 | 2> = { ...EMPTY_MO_COUNTS };
  const steps: MoFillAnimationStep[] = [];
  let remaining = clamped;

  for (const level of levels) {
    if (remaining <= 0) break;
    const isDegenerate = level.slots.length > 1;

    // Pass 1: put one spin-up electron in each orbital of this level (Aufbau + Hund)
    for (let i = 0; i < level.slots.length && remaining > 0; i += 1) {
      const slotId = level.slots[i];
      if (!slotId) continue;
      working[slotId] = 1;
      remaining -= 1;

      const rule: 'aufbau' | 'hund' = isDegenerate && i > 0 ? 'hund' : 'aufbau';
      const explanation =
        rule === 'hund'
          ? `Quy tắc Hund: điền electron độc thân (↑) vào orbital ${level.label} thứ hai cùng mức năng lượng trước khi ghép đôi.`
          : `Nguyên lý Aufbau: điền electron (↑) vào mức năng lượng thấp nhất còn trống (${level.label}).`;

      steps.push({
        stepIndex: steps.length + 1,
        slotId,
        levelId: level.id,
        spin: 'up',
        rule,
        explanation,
        countsAfter: Object.freeze({ ...working }),
      });
    }

    // Pass 2: pair each orbital with spin-down electron (Pauli)
    for (let i = 0; i < level.slots.length && remaining > 0; i += 1) {
      const slotId = level.slots[i];
      if (!slotId) continue;
      working[slotId] = 2;
      remaining -= 1;

      steps.push({
        stepIndex: steps.length + 1,
        slotId,
        levelId: level.id,
        spin: 'down',
        rule: 'pauli',
        explanation: `Nguyên lý Pauli: ghép cặp electron ngược spin (↓) vào orbital ${level.label} (tối đa 2 e/orbital).`,
        countsAfter: Object.freeze({ ...working }),
      });
    }
  }

  return steps;
}

export function getExpectedMoCounts(ordering: MoOrdering, totalElectrons: number): MoSlotCounts {
  const sequence = buildExpectedMoFillSequence(ordering, totalElectrons);
  return sequence[sequence.length - 1]?.countsAfter ?? EMPTY_MO_COUNTS;
}

export function diagnoseMoFill(
  counts: MoSlotCounts,
  expectedOrdering: MoOrdering,
  chosenOrdering: MoOrdering,
  expectedTotalElectrons: number,
): MoDiagnosis {
  if (chosenOrdering !== expectedOrdering) {
    const expectedLabel =
      expectedOrdering === 'type-1'
        ? 'Loại I (σ2p < π2p)'
        : 'Loại II (π2p < σ2p)';
    return {
      ok: false,
      violation: 'ordering',
      highlightSlotIds: ['s2p', 'p2p_1', 'p2p_2'],
      message: `Chưa đúng thứ tự mức năng lượng. Tiểu phân này dùng sơ đồ ${expectedLabel} — hãy đổi thứ tự mức trước khi kiểm tra.`,
    };
  }

  const levels = getMoLevelsInOrder(chosenOrdering);

  // 1. Check Hund's rule on degenerate levels (one slot has 2 while sibling has 0)
  for (const level of levels) {
    if (level.slots.length === 2) {
      const first = level.slots[0];
      const second = level.slots[1];
      if (first && second) {
        const c1 = counts[first];
        const c2 = counts[second];
        if ((c1 === 2 && c2 === 0) || (c2 === 2 && c1 === 0)) {
          const emptySlot = c1 === 0 ? first : second;
          return {
            ok: false,
            violation: 'hund',
            highlightSlotIds: [emptySlot],
            message: `Vi phạm quy tắc Hund tại mức ${level.label}: hai orbital đồng mức phải được điền [↑][↑] trước khi ghép đôi [↑↓].`,
          };
        }
      }
    }
  }

  // 2. Check Aufbau principle (electrons placed in a higher level while a lower level is not full)
  let foundIncompleteLower: MoEnergyLevel | null = null;
  for (const level of levels) {
    const levelCapacity = level.slots.length * 2;
    const levelFilled = level.slots.reduce((acc, id) => acc + counts[id], 0);
    if (foundIncompleteLower && levelFilled > 0) {
      return {
        ok: false,
        violation: 'aufbau',
        highlightSlotIds: [...foundIncompleteLower.slots],
        message: `Vi phạm nguyên lý Aufbau: mức năng lượng thấp hơn (${foundIncompleteLower.label}) chưa điền đầy nhưng đã có electron ở mức ${level.label}.`,
      };
    }
    if (levelFilled < levelCapacity) {
      foundIncompleteLower = level;
    }
  }

  // 3. Check total valence electron count
  const metrics = computeMoMetrics(counts, chosenOrdering);
  if (metrics.totalElectrons !== expectedTotalElectrons) {
    const diff = expectedTotalElectrons - metrics.totalElectrons;
    const nextIncomplete = levels.find(
      lvl => lvl.slots.reduce((acc, id) => acc + counts[id], 0) < lvl.slots.length * 2,
    );
    return {
      ok: false,
      violation: 'count',
      highlightSlotIds: nextIncomplete ? [...nextIncomplete.slots] : [],
      message:
        diff > 0
          ? `Bạn mới điền ${metrics.totalElectrons}/${expectedTotalElectrons} electron hóa trị (còn thiếu ${diff} e).`
          : `Bạn đã điền ${metrics.totalElectrons}/${expectedTotalElectrons} electron hóa trị (dư ${Math.abs(diff)} e).`,
    };
  }

  return {
    ok: true,
    highlightSlotIds: [],
    message: `Chính xác! Đã điền đủ ${expectedTotalElectrons} electron hóa trị đúng Aufbau, Hund và Pauli.`,
  };
}

/** Parses Vietnamese/international numeric strings (e.g. "1,5", "-669.7", "+176"). */
export function parseNumericInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function isNumericAnswerMatch(
  raw: string,
  expected: number,
  tolerance = 0.05,
): boolean {
  const parsed = parseNumericInput(raw);
  if (parsed === null) return false;
  return Math.abs(parsed - expected) <= tolerance;
}

export function computeGibbsAtTemperature(
  deltaH_kJ: number,
  deltaS_J_per_K: number,
  tempK: number,
): number {
  return deltaH_kJ - tempK * (deltaS_J_per_K / 1000);
}

export function computeCrossoverTemperature(
  deltaH_kJ: number,
  deltaS_J_per_K: number,
): number | null {
  if (deltaS_J_per_K === 0) return null;
  const tStar = deltaH_kJ / (deltaS_J_per_K / 1000);
  return tStar > 0 && Number.isFinite(tStar) ? tStar : null;
}

export type SpontaneityRegime = 'always' | 'never' | 'high-T' | 'low-T';

export function classifySpontaneityRegime(
  deltaH_kJ: number,
  deltaS_J_per_K: number,
): SpontaneityRegime {
  if (deltaH_kJ < 0 && deltaS_J_per_K >= 0) return 'always';
  if (deltaH_kJ >= 0 && deltaS_J_per_K <= 0) return 'never';
  if (deltaH_kJ > 0 && deltaS_J_per_K > 0) return 'high-T';
  return 'low-T';
}

export interface EquationSpecies {
  readonly id: string;
  readonly formula: string;
  readonly state: 'r' | 'l' | 'k' | 'dd';
  readonly coefficient: number;
  readonly side: 'reactant' | 'product';
}

export interface GasSelectionDiagnosis {
  readonly ok: boolean;
  readonly deltaNGas: number;
  readonly message: string;
}

export function diagnoseGasSelection(
  species: readonly EquationSpecies[],
  selectedIds: readonly string[],
): GasSelectionDiagnosis {
  const selectedSet = new Set(selectedIds);
  const wrongNonGases = species.filter(s => selectedSet.has(s.id) && s.state !== 'k');
  const missingGases = species.filter(s => !selectedSet.has(s.id) && s.state === 'k');

  const deltaNGas = species.reduce((acc, item) => {
    if (!selectedSet.has(item.id)) return acc;
    return acc + (item.side === 'product' ? item.coefficient : -item.coefficient);
  }, 0);

  if (wrongNonGases.length > 0) {
    const names = wrongNonGases.map(s => `${s.formula}(${s.state})`).join(', ');
    return {
      ok: false,
      deltaNGas,
      message: `Không đếm chất rắn (r) hoặc chất lỏng (l): hãy bỏ chọn ${names}. Chỉ chọn các chất khí (k).`,
    };
  }

  if (missingGases.length > 0) {
    const names = missingGases.map(s => `${s.formula}(k)`).join(', ');
    return {
      ok: false,
      deltaNGas,
      message: `Bạn còn bỏ sót chất khí: ${names}.`,
    };
  }

  return {
    ok: true,
    deltaNGas,
    message: `Chính xác! Đã chọn đủ chất khí → Δn(khí) = ${deltaNGas > 0 ? `+${deltaNGas}` : deltaNGas} mol.`,
  };
}

export interface HessStepState {
  readonly id: string;
  readonly reversed: boolean;
  readonly multiplier: number;
}

export function computeHessSum(
  baseDeltaHs: Readonly<Record<string, number>>,
  states: readonly HessStepState[],
): number {
  return states.reduce((acc, st) => {
    const base = baseDeltaHs[st.id] ?? 0;
    const sign = st.reversed ? -1 : 1;
    return acc + base * sign * st.multiplier;
  }, 0);
}
