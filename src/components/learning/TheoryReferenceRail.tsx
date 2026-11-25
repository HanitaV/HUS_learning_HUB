import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ProblemFigureSpec } from '../../domain/problem-figure';
import type { GivenQuantity, TheoryAnchor } from '../../domain/semi-essay';
import { Badge } from '../ui/Badge';
import { BookOpenIcon, ChevronDownIcon } from '../ui/Icons';
import Markdown from './Markdown';
import { ProblemFigure } from './ProblemFigure';

export interface TheoryReferenceRailProps {
  readonly problemPrompt: string;
  readonly figure?: ProblemFigureSpec | undefined;
  readonly given: readonly GivenQuantity[];
  readonly theoryAnchors: readonly TheoryAnchor[];
  readonly activeAnchorIds: readonly string[];
  readonly activeStepNumber: number;
  readonly lessonTitle: string;
  readonly lessonUrl: string;
}

export const TheoryReferenceRail = memo(function TheoryReferenceRail({
  problemPrompt,
  figure,
  given,
  theoryAnchors,
  activeAnchorIds,
  activeStepNumber,
  lessonTitle,
  lessonUrl,
}: TheoryReferenceRailProps) {
  const [mobilePanel, setMobilePanel] = useState<'none' | 'prompt' | 'theory'>('none');
  const activeSet = useMemo(() => new Set(activeAnchorIds), [activeAnchorIds]);

  const sortedAnchors = useMemo(
    () =>
      [...theoryAnchors].sort((a, b) => {
        const aActive = activeSet.has(a.id) ? 0 : 1;
        const bActive = activeSet.has(b.id) ? 0 : 1;
        return aActive - bActive;
      }),
    [theoryAnchors, activeSet],
  );

  const activeCount = useMemo(
    () => theoryAnchors.filter(a => activeSet.has(a.id)).length,
    [theoryAnchors, activeSet],
  );

  const renderPromptAndGiven = () => (
    <div className="space-y-4">
      <div className="text-sm leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
        <Markdown>{problemPrompt}</Markdown>
      </div>
      {figure ? <ProblemFigure figure={figure} /> : null}
      {given.length > 0 ? (
        <div className="border-t border-border pt-3.5">
          <h3 className="mb-2 text-xs font-semibold text-ink-muted">Dữ kiện đã cho</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {given.map((item, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5">
                <dt className="text-ink-secondary">
                  <Markdown inline>{`$${item.symbolLatex}$`}</Markdown>{' '}
                  <span className="text-ink-muted">({item.label})</span>
                </dt>
                <dd className="shrink-0 font-mono font-semibold tabular-nums text-ink">
                  {item.value}
                  {item.unit ? ` ${item.unit}` : ''}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );

  const renderTheoryList = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          Lý thuyết gắn với Bước {activeStepNumber}
        </h3>
        <Link
          to={lessonUrl}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <BookOpenIcon width={13} height={13} />
          <span className="max-w-[14rem] truncate">{lessonTitle}</span>
        </Link>
      </div>

      <ul className="divide-y divide-border">
        {sortedAnchors.map(anchor => {
          const isHighlighted = activeSet.has(anchor.id);
          return (
            <li
              key={anchor.id}
              className={`py-3 first:pt-1 last:pb-0 transition-colors duration-150 ${
                isHighlighted ? 'opacity-100' : 'opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink">{anchor.title}</h4>
                {isHighlighted ? (
                  <Badge tone="accent">Đang dùng ở Bước {activeStepNumber}</Badge>
                ) : null}
              </div>

              {anchor.formula ? (
                <div
                  className={`mt-2 overflow-x-auto rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${
                    isHighlighted
                      ? 'border-[var(--hus-starlight)]/50 bg-surface'
                      : 'border-border bg-canvas/60'
                  }`}
                >
                  <Markdown inline>{`$$${anchor.formula}$$`}</Markdown>
                </div>
              ) : null}

              <div className="mt-2 text-xs leading-relaxed text-ink-secondary [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                <Markdown>{anchor.summary}</Markdown>
              </div>

              {anchor.conditions.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-muted">
                  {anchor.conditions.map((cond, i) => (
                    <li key={i}>
                      <Markdown inline>{cond}</Markdown>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      {/* Mobile inline disclosure bar (< lg) */}
      <div className="min-w-0 lg:hidden">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-expanded={mobilePanel === 'prompt'}
              onClick={() => setMobilePanel(p => (p === 'prompt' ? 'none' : 'prompt'))}
              className={`inline-flex min-h-[44px] cursor-pointer items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 text-xs font-semibold transition-colors ${
                mobilePanel === 'prompt'
                  ? 'border-accent bg-surface text-accent-ink'
                  : 'border-border bg-surface/80 text-ink'
              }`}
            >
              <span>Đề bài &amp; Dữ kiện</span>
              <ChevronDownIcon
                width={15}
                height={15}
                className={`transition-transform duration-150 ${mobilePanel === 'prompt' ? 'rotate-180' : ''}`}
              />
            </button>
            <button
              type="button"
              aria-expanded={mobilePanel === 'theory'}
              onClick={() => setMobilePanel(p => (p === 'theory' ? 'none' : 'theory'))}
              className={`inline-flex min-h-[44px] cursor-pointer items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 text-xs font-semibold transition-colors ${
                mobilePanel === 'theory'
                  ? 'border-accent bg-surface text-accent-ink'
                  : 'border-border bg-surface/80 text-ink'
              }`}
            >
              <span>Lý thuyết ({activeCount})</span>
              <ChevronDownIcon
                width={15}
                height={15}
                className={`transition-transform duration-150 ${mobilePanel === 'theory' ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {mobilePanel === 'prompt' ? (
            <div className="mt-3 border-t border-border pt-3">{renderPromptAndGiven()}</div>
          ) : null}
          {mobilePanel === 'theory' ? (
            <div className="mt-3 border-t border-border pt-3">{renderTheoryList()}</div>
          ) : null}
        </div>
      </div>

      {/* Desktop sticky reference rail (>= lg) */}
      <aside
        aria-label="Đề bài và lý thuyết tham chiếu"
        className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto"
      >
        <div className="divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface-subtle p-5">
          <section aria-label="Đề bài" className="pb-5">
            <h2 className="mb-3 font-display text-lg font-medium text-ink">Đề bài &amp; Dữ kiện</h2>
            {renderPromptAndGiven()}
          </section>
          <section aria-label="Lý thuyết liên quan" className="pt-5">
            {renderTheoryList()}
          </section>
        </div>
      </aside>
    </>
  );
});
