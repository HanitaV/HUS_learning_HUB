import type { ProgressAction, ProgressState } from '../../domain/workspace';
import { emptyProgress, parseProgress, updateProgress } from '../../core/learning/progress';

export const PROGRESS_KEY = 'hus-learning-hub:progress:v1';
interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function createProgressStore(storage: StoragePort) {
  let snapshot: { readonly progress: ProgressState; readonly error: string | null } = { progress: emptyProgress(), error: null };
  let preserveCorrupt = false;
  const listeners = new Set<() => void>();
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw !== null) {
      try { snapshot = { progress: parseProgress(raw), error: null }; }
      catch { preserveCorrupt = true; snapshot = { ...snapshot, error: 'Dữ liệu cũ không đọc được và được giữ nguyên. Tiến độ mới chỉ lưu trong bộ nhớ; hãy xuất bản sao lưu trước khi khôi phục.' }; }
    }
  } catch { snapshot = { ...snapshot, error: 'Không thể truy cập bộ nhớ trình duyệt. Tiến độ chỉ được giữ trong phiên này.' }; }
  function save(progress: ProgressState, replace = false) {
    let error = snapshot.error;
    if (!preserveCorrupt || replace) {
      try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); error = null; preserveCorrupt = false; }
      catch { error = 'Không thể lưu tiến độ vào bộ nhớ trình duyệt. Hãy xuất bản sao lưu JSON trước khi đóng trang.'; }
    }
    snapshot = { progress, error };
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch: (action: ProgressAction) => save(updateProgress(snapshot.progress, action)),
    restore: (json: string) => save(parseProgress(json), true),
  };
}

// Access localStorage inside the port so privacy/security exceptions are recoverable.
export const progressStore = createProgressStore({ getItem: key => typeof window === 'undefined' ? null : window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
