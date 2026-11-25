import { memo, useDeferredValue, useMemo } from 'react';
import katex from 'katex';
import type { MathSymbolInsertMode } from '../../domain/math-symbols';
import { parseLineToRealtimeSegments } from '../../core/learning/realtime-math-preview';
import 'katex/dist/katex.min.css';

const MAX_LINE_CACHE = 600;
const lineHtmlCache = new Map<string, string>();

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLineHtmlCached(line: string, mode: MathSymbolInsertMode): string {
  if (!line.trim()) return '&nbsp;';
  const cacheKey = `${mode}\0${line}`;
  const hit = lineHtmlCache.get(cacheKey);
  if (hit !== undefined) return hit;

  const segments = parseLineToRealtimeSegments(line, mode);
  let html = '';
  for (const seg of segments) {
    if (seg.kind === 'text') {
      // Support lightweight **bold** markers from scaffolds without full Markdown AST cost
      const escaped = escapeHtml(seg.value).replace(
        /\*\*([^*]+)\*\*/g,
        '<strong class="font-semibold text-ink">$1</strong>',
      );
      html += escaped;
    } else {
      html += katex.renderToString(seg.latex, {
        throwOnError: false,
        trust: false,
        strict: 'ignore',
        output: 'html',
        displayMode: seg.display,
      });
    }
  }

  if (lineHtmlCache.size >= MAX_LINE_CACHE) {
    const oldestKey = lineHtmlCache.keys().next().value;
    if (oldestKey !== undefined) {
      lineHtmlCache.delete(oldestKey);
    }
  }
  lineHtmlCache.set(cacheKey, html);
  return html;
}

export interface RealtimeMathPreviewProps {
  readonly value: string;
  readonly mode: MathSymbolInsertMode;
  readonly inline?: boolean | undefined;
}

/**
 * Zero-lag realtime math & prose renderer:
 * - Defers updates via `useDeferredValue` so `<textarea>` input stays at 0ms latency.
 * - Caches KaTeX HTML per line so editing 1 line in a long A4 derivation never re-renders unchanged lines.
 * - Bypasses heavy unified/remark/rehype/highlight AST parsing during live typing.
 */
export const RealtimeMathPreview = memo(function RealtimeMathPreview({
  value,
  mode,
  inline = false,
}: RealtimeMathPreviewProps) {
  const deferredValue = useDeferredValue(value);

  const renderedLines = useMemo(() => {
    if (!deferredValue.trim()) return [];
    if (inline) {
      return [renderLineHtmlCached(deferredValue.replace(/\n+/g, ' '), mode)];
    }
    return deferredValue.split('\n').map(line => renderLineHtmlCached(line, mode));
  }, [deferredValue, mode, inline]);

  if (renderedLines.length === 0) return null;

  if (inline) {
    return (
      <span
        className="leading-relaxed text-ink"
        dangerouslySetInnerHTML={{ __html: renderedLines[0]! }}
      />
    );
  }

  return (
    <div className="space-y-1 text-sm leading-relaxed text-ink">
      {renderedLines.map((lineHtml, index) => (
        <div
          key={index}
          className="min-h-[1.5rem] overflow-x-auto break-words"
          dangerouslySetInnerHTML={{ __html: lineHtml }}
        />
      ))}
    </div>
  );
});
