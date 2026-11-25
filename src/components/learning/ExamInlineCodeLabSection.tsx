import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { InjectedCodeSnippet, SubjectToolDefinition } from '../../contracts/subject-module';
import type { CodePlaygroundSnippet } from '../../domain/code-lab';
import type { EntityId } from '../../domain/learning';
import { ErrorBoundary } from '../../app/ErrorBoundary';
import { Badge } from '../ui/Badge';
import { ChevronDownIcon, PlayIcon } from '../ui/Icons';

export interface ExamInlineCodeLabSectionProps {
  readonly courseId: EntityId;
  readonly tool: SubjectToolDefinition;
  readonly playgroundSnippets?: readonly CodePlaygroundSnippet[] | undefined;
  readonly injectedSnippet?: InjectedCodeSnippet | undefined;
}

export function ExamInlineCodeLabSection({
  courseId,
  tool,
  playgroundSnippets,
  injectedSnippet,
}: ExamInlineCodeLabSectionProps) {
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const LazyTool = useMemo(() => lazy(tool.load), [tool]);

  useEffect(() => {
    if (!injectedSnippet) return;
    setOpen(true);
    setHasOpenedOnce(true);
    if (typeof window !== 'undefined' && containerRef.current) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    }
  }, [injectedSnippet]);

  return (
    <div
      ref={containerRef}
      data-exam-inline-code-lab="true"
      className="scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-5"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(prev => {
            const next = !prev;
            if (next) setHasOpenedOnce(true);
            return next;
          });
        }}
        className="flex min-h-[42px] w-full cursor-pointer flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PlayIcon width={15} height={15} className="shrink-0 text-accent" />
          <span className="text-sm font-semibold text-ink">
            Khung chạy thử Code ngay trong đề: {tool.title}
          </span>
          <Badge tone="accent">Không chuyển trang</Badge>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <span>{open ? 'Thu gọn khung code' : 'Mở khung chạy thử'}</span>
          <ChevronDownIcon
            width={15}
            height={15}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {hasOpenedOnce ? (
        <div hidden={!open} className="mt-4 border-t border-border pt-4">
          <ErrorBoundary>
            <Suspense
              fallback={
                <p role="status" className="text-sm text-ink-muted">
                  Đang tải {tool.title}…
                </p>
              }
            >
              <LazyTool
                courseId={courseId}
                playgroundSnippets={playgroundSnippets}
                injectedSnippet={injectedSnippet}
                embeddedSurface="practice"
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}
    </div>
  );
}
