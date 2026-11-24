import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadWorkspacePreferences,
  saveWorkspacePreferences,
} from '../../src/infrastructure/preferences/theme';

describe('preferences lesson mode', () => {
  let store: Record<string, string> = {};
  let mockStorage: Storage;

  beforeEach(() => {
    store = {};
    mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      localStorage: mockStorage,
    });
  });

  it('defaults to guided when storage is empty', () => {
    const prefs = loadWorkspacePreferences();
    expect(prefs.lessonMode).toBe('guided');
  });

  it('preserves theme/readingSize while defaulting lessonMode to guided on legacy saved state', () => {
    localStorage.setItem(
      'hus-learning-hub:prefs:v1',
      JSON.stringify({ theme: 'dark', readingSize: 'comfortable' }),
    );
    const prefs = loadWorkspacePreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.readingSize).toBe('comfortable');
    expect(prefs.lessonMode).toBe('guided');
  });

  it('falls back to guided when lessonMode is invalid', () => {
    localStorage.setItem(
      'hus-learning-hub:prefs:v1',
      JSON.stringify({ theme: 'light', readingSize: 'normal', lessonMode: 'invalid' }),
    );
    const prefs = loadWorkspacePreferences();
    expect(prefs.lessonMode).toBe('guided');
  });

  it('saves and reloads preferences cleanly', () => {
    const initial = loadWorkspacePreferences();
    expect(initial.lessonMode).toBe('guided');

    saveWorkspacePreferences({
      ...initial,
      theme: 'dark',
      readingSize: 'comfortable',
      lessonMode: 'guided',
    });
    const reloaded = loadWorkspacePreferences();
    expect(reloaded.theme).toBe('dark');
    expect(reloaded.readingSize).toBe('comfortable');
    expect(reloaded.lessonMode).toBe('guided');

    saveWorkspacePreferences({ ...reloaded, lessonMode: 'full' });
    const reloadedLegacy = loadWorkspacePreferences();
    expect(reloadedLegacy.lessonMode).toBe('full');
  });

  it('survives throwing localStorage and defaults to guided', () => {
    vi.spyOn(mockStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('Blocked storage');
    });
    const prefs = loadWorkspacePreferences();
    expect(prefs.lessonMode).toBe('guided');
    vi.restoreAllMocks();
  });
});
