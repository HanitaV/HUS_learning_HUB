import { isValidElement, memo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Link } from 'react-router';
import { slugifyHeading } from '../../core/learning/outline';
import { CheckIcon, CopyIcon } from '../ui/Icons';
import 'katex/dist/katex.min.css';

const REMARK_PLUGINS: NonNullable<Options['remarkPlugins']> = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: NonNullable<Options['rehypePlugins']> = [
  [rehypeKatex, { trust: false, strict: 'warn' }],
  [rehypeHighlight, { detect: false }],
];

function extractPlainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join('');
  if (isValidElement<{ readonly children?: ReactNode }>(node)) {
    return extractPlainText(node.props.children);
  }
  return '';
}

function CodeBlock({ children }: { readonly children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractPlainText(children).replace(/\n$/, '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts; fail quietly.
    }
  };

  return (
    <div className="group relative my-4">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Đã sao chép đoạn mã' : 'Sao chép đoạn mã'}
        className="absolute right-2.5 top-2.5 z-10 inline-flex min-h-[30px] items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface/95 px-2 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
      >
        {copied ? (
          <CheckIcon width={12} height={12} className="text-success" />
        ) : (
          <CopyIcon width={12} height={12} />
        )}
        <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
      </button>
      <pre className="!my-0 pr-24">{children}</pre>
    </div>
  );
}

const Markdown = memo(function Markdown({
  children,
  inline = false,
}: {
  readonly children: string;
  readonly inline?: boolean;
}) {
  const headingCounts = new Map<string, number>();

  const makeHeadingId = (node: ReactNode): string => {
    const base = slugifyHeading(extractPlainText(node));
    const seen = headingCounts.get(base) ?? 0;
    headingCounts.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  const rendered = (
    <ReactMarkdown
      skipHtml
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={{
        p: ({ children: pChildren }) => (inline ? <span>{pChildren}</span> : <p>{pChildren}</p>),
        h2: ({ children: hChildren }) => (
          <h2 id={makeHeadingId(hChildren)} tabIndex={-1}>
            {hChildren}
          </h2>
        ),
        h3: ({ children: hChildren }) => (
          <h3 id={makeHeadingId(hChildren)} tabIndex={-1}>
            {hChildren}
          </h3>
        ),
        pre: ({ children: preChildren }) => <CodeBlock>{preChildren}</CodeBlock>,
        table: ({ children: tableChildren }) => (
          <div className="table-scroll">
            <table>{tableChildren}</table>
          </div>
        ),
        a: ({ href, children: linkChildren }) =>
          href?.startsWith('#/') ? (
            <Link to={href.slice(1)}>{linkChildren}</Link>
          ) : (
            <a href={href} target="_blank" rel="noreferrer">
              {linkChildren}
            </a>
          ),
        img: ({ alt }) => (
          <span className="inline-block rounded-[var(--radius-sm)] border border-border bg-surface-subtle px-2 py-0.5 text-xs text-ink-muted">
            {alt ?? 'Hình ảnh chưa được tích hợp'}
          </span>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );

  return inline ? rendered : <div className="hus-markdown">{rendered}</div>;
});

export default Markdown;
