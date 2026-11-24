import { useCallback, useEffect, useState } from 'react';
import {
  applyWorkspacePreferences,
  loadWorkspacePreferences,
  saveWorkspacePreferences,
  type LessonModePreference,
  type ReadingSizePreference,
  type ThemePreference,
  type WorkspacePreferences,
} from '../infrastructure/preferences/theme';

const PREFS_EVENT = 'hus:prefs-changed';

export function useWorkspacePreferences() {
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() =>
    loadWorkspacePreferences(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    applyWorkspacePreferences(loadWorkspacePreferences()),
  );
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    setResolvedTheme(applyWorkspacePreferences(preferences));
  }, [preferences]);

  useEffect(() => {
    const handleSync = () => {
      const next = loadWorkspacePreferences();
      setPreferences(next);
    };
    window.addEventListener(PREFS_EVENT, handleSync);
    window.addEventListener('storage', handleSync);

    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const handleMedia = () => {
      setResolvedTheme(applyWorkspacePreferences(loadWorkspacePreferences()));
    };
    media?.addEventListener('change', handleMedia);

    return () => {
      window.removeEventListener(PREFS_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
      media?.removeEventListener('change', handleMedia);
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<WorkspacePreferences>) => {
    setPreferences(current => {
      const next: WorkspacePreferences = { ...current, ...patch };
      const saved = saveWorkspacePreferences(next);
      setStorageWarning(!saved);
      setResolvedTheme(applyWorkspacePreferences(next));
      window.dispatchEvent(new Event(PREFS_EVENT));
      return next;
    });
  }, []);

  const setTheme = useCallback(
    (theme: ThemePreference) => updatePreferences({ theme }),
    [updatePreferences],
  );

  const setReadingSize = useCallback(
    (readingSize: ReadingSizePreference) => updatePreferences({ readingSize }),
    [updatePreferences],
  );

  const setLessonMode = useCallback(
    (lessonMode: LessonModePreference) => updatePreferences({ lessonMode }),
    [updatePreferences],
  );

  const cycleTheme = useCallback(() => {
    const next: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: next });
  }, [resolvedTheme, updatePreferences]);

  return {
    preferences,
    resolvedTheme,
    storageWarning,
    setTheme,
    setReadingSize,
    setLessonMode,
    cycleTheme,
  };
}
