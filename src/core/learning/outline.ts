import { normalizeVietnamese } from '../courses/search';

export interface MarkdownHeading {
  readonly id: string;
  readonly label: string;
  readonly level: 2 | 3;
}

export function slugifyHeading(text: string): string {
  const normalized = normalizeVietnamese(text)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return normalized || 'muc';
}

export function extractMarkdownOutline(markdown: string): readonly MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const counts = new Map<string, number>();
  let inCodeFence = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match) continue;
    const hashes = match[1];
    const label = match[2]?.trim();
    if (!hashes || !label) continue;

    const baseId = slugifyHeading(label);
    const seen = counts.get(baseId) ?? 0;
    counts.set(baseId, seen + 1);
    const id = seen === 0 ? baseId : `${baseId}-${seen + 1}`;
    headings.push({ id, label, level: hashes.length === 2 ? 2 : 3 });
  }

  return headings;
}
