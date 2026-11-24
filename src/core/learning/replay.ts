export interface ReplayStep {
  readonly values: readonly number[];
  readonly explanation: string;
  readonly compared?: readonly [number, number];
  readonly swapped?: boolean;
  readonly sortedFrom?: number;
}

export function bubbleSortSteps(input: readonly number[]): readonly ReplayStep[] {
  const values = [...input];
  const steps: ReplayStep[] = [
    { values: [...values], explanation: 'Bắt đầu với dãy ban đầu.', sortedFrom: values.length },
  ];
  for (let end = values.length - 1; end > 0; end--) {
    for (let i = 0; i < end; i++) {
      const a = values[i]; const b = values[i + 1];
      if (a === undefined || b === undefined) continue;
      const swap = a > b;
      if (swap) { values[i] = b; values[i + 1] = a; }
      steps.push({
        values: [...values],
        explanation: `So sánh ${a} và ${b}: ${swap ? 'đổi chỗ' : 'giữ nguyên'}.`,
        compared: [i, i + 1],
        swapped: swap,
        sortedFrom: end + 1,
      });
    }
  }
  steps.push({ values: [...values], explanation: 'Hoàn tất sắp xếp tăng dần.', sortedFrom: 0 });
  return steps;
}
