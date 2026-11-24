import { useSyncExternalStore } from 'react';
import { progressStore } from '../infrastructure/progress/store';

export function useLearningProgress() {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getSnapshot);
}
