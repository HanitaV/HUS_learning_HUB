import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildInteractiveDraftStorageKey,
  clearInteractiveStepDraft,
  clearInteractiveStepDraftsByPrefix,
  isPlainObject,
  isStringArray,
  isStringRecord,
  loadInteractiveStepDraft,
  saveInteractiveStepDraft,
} from '../../src/infrastructure/practice/interactive-step-drafts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('interactive-step-drafts persistence helper', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: { localStorage: storage },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  });

  it('saves, validates, loads, and clears individual interactive step drafts', () => {
    const key = 'phy1159-se-3-1:step-fbd';
    saveInteractiveStepDraft(key, { A: [{ id: 'arr-1', type: 'P', angle: 270 }] });

    const loaded = loadInteractiveStepDraft(key, raw =>
      isPlainObject(raw) && Array.isArray(raw.A) ? raw : null,
    );
    expect(loaded).toEqual({ A: [{ id: 'arr-1', type: 'P', angle: 270 }] });

    clearInteractiveStepDraft(key);
    expect(loadInteractiveStepDraft(key, raw => raw)).toBeNull();
  });

  it('rejects malformed JSON, failed validation, and oversized payloads safely', () => {
    const key = 'corrupt-step';
    window.localStorage.setItem(buildInteractiveDraftStorageKey(key), '{not-valid-json');
    expect(loadInteractiveStepDraft(key, raw => raw)).toBeNull();

    saveInteractiveStepDraft(key, { wrongShape: 123 });
    expect(loadInteractiveStepDraft(key, raw => (isStringArray(raw) ? raw : null))).toBeNull();

    const hugeKey = 'oversized-step';
    saveInteractiveStepDraft(hugeKey, 'x'.repeat(30_000));
    expect(loadInteractiveStepDraft(hugeKey, raw => raw)).toBeNull();
  });

  it('clears only drafts matching a scoped exam prefix', () => {
    saveInteractiveStepDraft('chapter-exam:phy1159:ch3:s1', ['a']);
    saveInteractiveStepDraft('chapter-exam:phy1159:ch3:s2', ['b']);
    saveInteractiveStepDraft('chapter-exam:phy1159:ch4:s1', ['keep-other-chapter']);
    saveInteractiveStepDraft('phy1159-se-3-1:s2', ['keep-lesson']);

    clearInteractiveStepDraftsByPrefix('chapter-exam:phy1159:ch3:');

    expect(loadInteractiveStepDraft('chapter-exam:phy1159:ch3:s1', raw => raw)).toBeNull();
    expect(loadInteractiveStepDraft('chapter-exam:phy1159:ch3:s2', raw => raw)).toBeNull();
    expect(
      loadInteractiveStepDraft('chapter-exam:phy1159:ch4:s1', raw =>
        isStringArray(raw) ? raw : null,
      ),
    ).toEqual(['keep-other-chapter']);
    expect(
      loadInteractiveStepDraft('phy1159-se-3-1:s2', raw => (isStringArray(raw) ? raw : null)),
    ).toEqual(['keep-lesson']);
  });

  it('validates string arrays and string records strictly', () => {
    expect(isStringArray(['0-0', '1-0'])).toBe(true);
    expect(isStringArray([1, 2])).toBe(false);
    expect(isStringRecord({ a: '0,47', T: '18,7' })).toBe(true);
    expect(isStringRecord({ a: 47 })).toBe(false);
  });
});
