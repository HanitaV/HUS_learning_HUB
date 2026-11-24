import type { QuestProgressState } from '../../domain/skill-quest';

export const QUEST_PROGRESS_KEY = 'hus-learning-hub:quests:v1';

interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function emptyQuestProgress(): QuestProgressState {
  return {
    schemaVersion: 1,
    milestoneProgress: {},
    completedQuestIds: [],
  };
}

export function parseQuestProgress(raw: string): QuestProgressState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Dữ liệu tiến độ nhiệm vụ không phải định dạng JSON hợp lệ.');
  }

  if (!isPlainRecord(parsed)) {
    throw new Error('Dữ liệu tiến độ nhiệm vụ phải là một đối tượng JSON.');
  }

  if (parsed['schemaVersion'] !== 1) {
    throw new Error('Phiên bản dữ liệu tiến độ nhiệm vụ không được hỗ trợ (yêu cầu schemaVersion = 1).');
  }

  const rawMilestoneProgress = parsed['milestoneProgress'];
  if (!isPlainRecord(rawMilestoneProgress)) {
    throw new Error('Trường milestoneProgress phải là đối tượng ánh xạ questId tới số mốc đã đạt.');
  }

  const milestoneProgress: Record<string, number> = {};
  for (const [questId, count] of Object.entries(rawMilestoneProgress)) {
    if (!questId || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(`Giá trị tiến độ mốc không hợp lệ cho nhiệm vụ "${questId}".`);
    }
    milestoneProgress[questId] = count;
  }

  const rawCompleted = parsed['completedQuestIds'];
  if (
    !Array.isArray(rawCompleted) ||
    !rawCompleted.every((id): id is string => typeof id === 'string' && id.length > 0)
  ) {
    throw new Error('Trường completedQuestIds phải là danh sách chuỗi mã nhiệm vụ hợp lệ.');
  }

  return {
    schemaVersion: 1,
    milestoneProgress,
    completedQuestIds: [...new Set(rawCompleted)],
  };
}

export function createQuestProgressStore(storage: StoragePort) {
  let snapshot: { readonly state: QuestProgressState; readonly error: string | null } = {
    state: emptyQuestProgress(),
    error: null,
  };
  let preserveCorrupt = false;
  const listeners = new Set<() => void>();

  try {
    const raw = storage.getItem(QUEST_PROGRESS_KEY);
    if (raw !== null) {
      try {
        snapshot = { state: parseQuestProgress(raw), error: null };
      } catch {
        preserveCorrupt = true;
        snapshot = {
          ...snapshot,
          error:
            'Dữ liệu tiến độ nhiệm vụ cũ không đọc được và được giữ nguyên. Tiến độ mới chỉ lưu trong bộ nhớ phiên này.',
        };
      }
    }
  } catch {
    snapshot = {
      ...snapshot,
      error: 'Không thể truy cập bộ nhớ trình duyệt. Tiến độ nhiệm vụ chỉ được giữ trong phiên này.',
    };
  }

  function save(nextState: QuestProgressState) {
    let error = snapshot.error;
    if (!preserveCorrupt) {
      try {
        storage.setItem(QUEST_PROGRESS_KEY, JSON.stringify(nextState));
        error = null;
      } catch {
        error =
          'Không thể lưu tiến độ nhiệm vụ vào bộ nhớ trình duyệt. Tiến độ vẫn được giữ trong phiên hiện tại.';
      }
    }
    snapshot = { state: nextState, error };
    listeners.forEach(listener => listener());
  }

  return {
    getState: (): QuestProgressState => snapshot.state,
    getError: (): string | null => snapshot.error,
    recordMilestone: (
      questId: string,
      milestoneCountReached: number,
      totalMilestones: number,
    ): void => {
      const prev = snapshot.state.milestoneProgress[questId] ?? 0;
      const sanitizedReached = Math.max(0, Math.floor(milestoneCountReached));
      const nextCount = Math.max(prev, sanitizedReached);
      const reachedCompletion = totalMilestones > 0 && nextCount >= totalMilestones;
      const nextCompleted =
        reachedCompletion && !snapshot.state.completedQuestIds.includes(questId)
          ? [...snapshot.state.completedQuestIds, questId]
          : snapshot.state.completedQuestIds;

      save({
        schemaVersion: 1,
        milestoneProgress: {
          ...snapshot.state.milestoneProgress,
          [questId]: nextCount,
        },
        completedQuestIds: nextCompleted,
      });
    },
    resetQuest: (questId: string): void => {
      const { [questId]: _removed, ...restProgress } = snapshot.state.milestoneProgress;
      save({
        schemaVersion: 1,
        milestoneProgress: restProgress,
        completedQuestIds: snapshot.state.completedQuestIds.filter(id => id !== questId),
      });
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Access window.localStorage inside the storage port callbacks so blocked/private storage never throws on import or mutation.
export const questProgressStore = createQuestProgressStore({
  getItem: key => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
});
