import { useCallback, useEffect, useRef, useState } from 'react';

const INTERACTIVE_DRAFT_PREFIX = 'hus-learning-hub:interactive-draft:v1:';
const MAX_SERIALIZED_LENGTH = 24_000;

export function buildInteractiveDraftStorageKey(draftKey: string): string {
  return `${INTERACTIVE_DRAFT_PREFIX}${draftKey}`;
}

export function loadInteractiveStepDraft<T>(
  draftKey: string | undefined,
  validate: (raw: unknown) => T | null,
): T | null {
  if (!draftKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildInteractiveDraftStorageKey(draftKey));
    if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return null;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed);
  } catch {
    return null;
  }
}

export function saveInteractiveStepDraft<T>(draftKey: string | undefined, value: T): void {
  if (!draftKey || typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_SERIALIZED_LENGTH) {
      window.localStorage.setItem(buildInteractiveDraftStorageKey(draftKey), serialized);
    }
  } catch {
    // Ignore blocked / quota-exceeded storage gracefully
  }
}

export function clearInteractiveStepDraft(draftKey: string | undefined): void {
  if (!draftKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(buildInteractiveDraftStorageKey(draftKey));
  } catch {
    // Ignore blocked storage gracefully
  }
}

export function clearInteractiveStepDraftsByPrefix(prefix: string): void {
  if (!prefix || typeof window === 'undefined') return;
  try {
    const fullPrefix = buildInteractiveDraftStorageKey(prefix);
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore blocked storage gracefully
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown, maxLen = 60): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxLen &&
    value.every(item => typeof item === 'string' && item.length <= 200)
  );
}

export function isStringRecord(value: unknown, maxEntries = 100): value is Readonly<Record<string, string>> {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= maxEntries &&
    entries.every(([k, v]) => k.length <= 120 && typeof v === 'string' && v.length <= 500)
  );
}

/**
 * Persists live interactive step or diagram draft state in `localStorage` when `draftKey` is provided,
 * validating untrusted JSON on load and cleaning up cleanly on reset.
 */
export function useInteractiveStepDraft<T>(
  draftKey: string | undefined,
  createInitial: () => T,
  validate: (raw: unknown) => T | null,
): readonly [T, (updater: T | ((prev: T) => T)) => void, () => void] {
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const createInitialRef = useRef(createInitial);
  createInitialRef.current = createInitial;

  const [state, setState] = useState<T>(() => {
    const loaded = loadInteractiveStepDraft(draftKey, validate);
    return loaded !== null ? loaded : createInitial();
  });

  const prevKeyRef = useRef(draftKey);
  useEffect(() => {
    if (prevKeyRef.current === draftKey) return;
    prevKeyRef.current = draftKey;
    const loaded = loadInteractiveStepDraft(draftKey, validateRef.current);
    setState(loaded !== null ? loaded : createInitialRef.current());
  }, [draftKey]);

  const skipRemoveOnNextSyncRef = useRef(false);

  useEffect(() => {
    if (!draftKey) return;
    if (skipRemoveOnNextSyncRef.current) {
      skipRemoveOnNextSyncRef.current = false;
      return;
    }
    saveInteractiveStepDraft(draftKey, state);
  }, [draftKey, state]);

  const reset = useCallback(() => {
    skipRemoveOnNextSyncRef.current = true;
    clearInteractiveStepDraft(draftKey);
    setState(createInitialRef.current());
  }, [draftKey]);

  return [state, setState, reset] as const;
}
