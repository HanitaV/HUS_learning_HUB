import { Fragment } from 'react';
import { normalizeVietnamese } from '../../core/courses/search';

interface HighlightRange {
  readonly start: number;
  readonly end: number;
}

const nonAsciiCharCache = new Map<string, string>();

function normalizeCharFast(char: string): string {
  const code = char.charCodeAt(0);
  if (code < 128) {
    if (code >= 65 && code <= 90) return String.fromCharCode(code + 32);
    if (code === 32 || code === 9 || code === 10 || code === 13) return '';
    return char;
  }
  const cached = nonAsciiCharCache.get(char);
  if (cached !== undefined) return cached;
  const piece = normalizeVietnamese(char);
  nonAsciiCharCache.set(char, piece);
  return piece;
}

function buildNormalizedMap(text: string): { readonly normalized: string; readonly map: readonly number[] } {
  const chars: string[] = [];
  const map: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const piece = normalizeCharFast(text[index] ?? '');
    for (let offset = 0; offset < piece.length; offset += 1) {
      chars.push(piece[offset] ?? '');
      map.push(index);
    }
  }

  return { normalized: chars.join(''), map };
}

function findFirstMatchIndex(text: string, tokens: readonly string[]): number {
  if (tokens.length === 0 || text.length === 0) return -1;
  const { normalized, map } = buildNormalizedMap(text);
  let earliest = Number.POSITIVE_INFINITY;

  for (const token of tokens) {
    const pos = normalized.indexOf(token);
    if (pos !== -1) {
      const origStart = map[pos];
      if (origStart !== undefined && origStart < earliest) {
        earliest = origStart;
      }
    }
  }

  return Number.isFinite(earliest) ? earliest : -1;
}

function findMatchRanges(text: string, query: string): readonly HighlightRange[] {
  const tokens = normalizeVietnamese(query).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || text.length === 0) return [];

  const { normalized, map } = buildNormalizedMap(text);
  const ranges: HighlightRange[] = [];

  for (const token of tokens) {
    let cursor = normalized.indexOf(token);
    while (cursor !== -1) {
      const origStart = map[cursor];
      const origEnd = map[cursor + token.length - 1];
      if (origStart !== undefined && origEnd !== undefined) {
        ranges.push({ start: origStart, end: origEnd + 1 });
      }
      cursor = normalized.indexOf(token, cursor + token.length);
    }
  }

  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: HighlightRange[] = [];
  for (const range of ranges) {
    const prev = merged.at(-1);
    if (prev && range.start <= prev.end) {
      merged[merged.length - 1] = { start: prev.start, end: Math.max(prev.end, range.end) };
    } else {
      merged.push(range);
    }
  }
  return merged;
}

function cleanSnippetText(text: string): string {
  return text
    .replace(/\$/g, '')
    .replace(/\\t?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\t?frac(\d)(\d)/g, '$1/$2')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\Theta\b/g, 'Θ')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMatchSnippet(text: string, query: string, maxLength = 150): string | null {
  const tokens = normalizeVietnamese(query).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !text) return null;

  const firstRawIndex = findFirstMatchIndex(text, tokens);
  if (firstRawIndex === -1) return null;

  // Slice a bounded raw window around the first match before running regex cleanup
  // so multi-kilobyte lesson bodies never undergo full-document regex passes per keystroke.
  const rawWindowStart = Math.max(0, firstRawIndex - maxLength);
  const rawWindowEnd = Math.min(text.length, firstRawIndex + maxLength * 2);
  const rawSlice = text.slice(rawWindowStart, rawWindowEnd);
  const compact = cleanSnippetText(rawSlice);
  if (!compact) return null;

  const firstCleanIndex = findFirstMatchIndex(compact, tokens);
  const anchor = firstCleanIndex === -1 ? 0 : firstCleanIndex;
  const half = Math.floor(maxLength / 2);
  const start = Math.max(0, anchor - Math.floor(half * 0.6));
  const end = Math.min(compact.length, start + maxLength);
  const prefix = rawWindowStart > 0 || start > 0 ? '…' : '';
  const suffix = rawWindowEnd < text.length || end < compact.length ? '…' : '';
  return `${prefix}${compact.slice(start, end).trim()}${suffix}`;
}

export function SearchHighlight({
  text,
  query,
}: {
  readonly text: string;
  readonly query: string;
}) {
  const ranges = findMatchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;

  const parts: { readonly text: string; readonly highlighted: boolean }[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), highlighted: false });
    }
    parts.push({ text: text.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false });
  }

  return (
    <>
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="search-mark">
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
