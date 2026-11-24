import type { EntityId } from '../../domain/learning';
import type {
  MathSymbolInsertMode,
  MathSymbolPreferences,
  MathSymbolScope,
} from '../../domain/math-symbols';
import { createDefaultMathSymbolPreferences } from '../../core/learning/math-symbols';

const STORAGE_KEY = 'hus-learning-hub:math-symbols:v1';

let memoryFallback: MathSymbolPreferences = createDefaultMathSymbolPreferences();

function isScope(value: unknown): value is MathSymbolScope {
  return value === 'chapter' || value === 'course' || value === 'all';
}

function isInsertMode(value: unknown): value is MathSymbolInsertMode {
  return value === 'unicode' || value === 'mathlib' || value === 'latex';
}

function parseIdRecord(raw: unknown): Readonly<Record<EntityId, readonly EntityId[]>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const result: Record<EntityId, readonly EntityId[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !Array.isArray(value)) continue;
    const validIds = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    if (validIds.length > 0) {
      result[key] = validIds;
    }
  }
  return result;
}

export function loadMathSymbolPreferences(): MathSymbolPreferences {
  const defaults = createDefaultMathSymbolPreferences();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryFallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaults;
    const record = parsed as Record<string, unknown>;
    const loaded: MathSymbolPreferences = {
      schemaVersion: 1,
      defaultScope: isScope(record['defaultScope']) ? record['defaultScope'] : defaults.defaultScope,
      insertMode: isInsertMode(record['insertMode']) ? record['insertMode'] : defaults.insertMode,
      byCourse: parseIdRecord(record['byCourse']),
      byChapter: parseIdRecord(record['byChapter']),
    };
    memoryFallback = loaded;
    return loaded;
  } catch {
    return memoryFallback;
  }
}

export function saveMathSymbolPreferences(prefs: MathSymbolPreferences): boolean {
  memoryFallback = prefs;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
