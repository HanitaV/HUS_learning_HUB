import { useMemo, useSyncExternalStore } from 'react';
import type { SemiEssayExercise } from '../domain/semi-essay';
import { createWrittenDraftStore, type WrittenDraftSnapshot, type WrittenDraftStore } from '../infrastructure/practice/written-drafts';

export function useWrittenDrafts(exercise: SemiEssayExercise): WrittenDraftSnapshot & Pick<WrittenDraftStore, 'updateDraft' | 'resetDrafts'> {
  const store = useMemo(() => createWrittenDraftStore(exercise, {
    getItem: key => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  }), [exercise]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { ...snapshot, updateDraft: store.updateDraft, resetDrafts: store.resetDrafts };
}
