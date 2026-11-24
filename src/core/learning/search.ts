import { normalizeVietnamese } from '../courses/search';

export interface SearchEntry {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly kind: 'subject' | 'course' | 'chapter' | 'topic' | 'lesson' | 'resource';
  readonly to: string;
  readonly courseId: string;
  readonly subjectId: string;
}

const normalizedEntryCache = new WeakMap<SearchEntry, string>();

function getNormalizedEntryText(entry: SearchEntry): string {
  const cached = normalizedEntryCache.get(entry);
  if (cached !== undefined) return cached;
  const normalized = normalizeVietnamese(`${entry.title} ${entry.text}`);
  normalizedEntryCache.set(entry, normalized);
  return normalized;
}

export function searchContent(entries: readonly SearchEntry[], query: string): readonly SearchEntry[] {
  const tokens = normalizeVietnamese(query).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return entries.filter(entry => {
    const text = getNormalizedEntryText(entry);
    return tokens.every(token => text.includes(token));
  });
}
