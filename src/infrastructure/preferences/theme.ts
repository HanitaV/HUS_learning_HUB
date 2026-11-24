export type ThemePreference = 'system' | 'light' | 'dark';
export type ReadingSizePreference = 'normal' | 'comfortable';
export type LessonModePreference = 'full' | 'guided';

export interface WorkspacePreferences {
  readonly theme: ThemePreference;
  readonly readingSize: ReadingSizePreference;
  readonly lessonMode: LessonModePreference;
}

const STORAGE_KEY = 'hus-learning-hub:prefs:v1';

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  theme: 'system',
  readingSize: 'normal',
  lessonMode: 'guided',
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isReadingSizePreference(value: unknown): value is ReadingSizePreference {
  return value === 'normal' || value === 'comfortable';
}

function isLessonModePreference(value: unknown): value is LessonModePreference {
  return value === 'full' || value === 'guided';
}

export function loadWorkspacePreferences(): WorkspacePreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const record = parsed as Record<string, unknown>;
    return {
      theme: isThemePreference(record['theme']) ? record['theme'] : DEFAULT_PREFERENCES.theme,
      readingSize: isReadingSizePreference(record['readingSize'])
        ? record['readingSize']
        : DEFAULT_PREFERENCES.readingSize,
      lessonMode: isLessonModePreference(record['lessonMode'])
        ? record['lessonMode']
        : DEFAULT_PREFERENCES.lessonMode,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveWorkspacePreferences(prefs: WorkspacePreferences): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyWorkspacePreferences(prefs: WorkspacePreferences): 'light' | 'dark' {
  const resolved = resolveTheme(prefs.theme);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset['theme'] = resolved;
    document.documentElement.dataset['readingSize'] = prefs.readingSize;
  }
  return resolved;
}
