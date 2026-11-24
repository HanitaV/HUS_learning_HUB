import { useSyncExternalStore } from 'react';
import { questProgressStore } from '../infrastructure/quests/store';

export function useQuestProgress() {
  const questProgress = useSyncExternalStore(
    questProgressStore.subscribe,
    questProgressStore.getState,
  );
  const questStorageError = useSyncExternalStore(
    questProgressStore.subscribe,
    questProgressStore.getError,
  );
  return { questProgress, questStorageError };
}
