import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { EntityId } from '../../domain/learning';
import type { SubjectModule, SubjectToolKind } from '../../contracts/subject-module';
import { ErrorBoundary } from '../../app/ErrorBoundary';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { LayersIcon } from '../ui/Icons';

export interface SubjectToolHostProps {
  readonly courseId: EntityId;
  readonly subjectModule?: SubjectModule | undefined;
  readonly autoOpenDefault?: boolean | undefined;
}

const KIND_LABELS: Record<SubjectToolKind, string> = {
  visualization: 'Trực quan hóa',
  simulation: 'Mô phỏng',
  exercise: 'Thực hành',
  'code-lab': 'Gõ code WASM',
};

export function SubjectToolHost({
  courseId,
  subjectModule,
  autoOpenDefault = false,
}: SubjectToolHostProps) {
  const baseId = useId();
  const [searchParams] = useSearchParams();
  const requestedToolId = searchParams.get('tool');
  const requestedPreset = searchParams.get('preset') ?? undefined;
  const tools = useMemo(
    () =>
      (subjectModule?.tools ?? []).filter(
        tool => !tool.courseIds || tool.courseIds.includes(courseId),
      ),
    [subjectModule?.tools, courseId],
  );
  const [activeToolId, setActiveToolId] = useState<EntityId | null>(() => {
    if (requestedToolId && tools.some(t => t.id === requestedToolId)) {
      return requestedToolId;
    }
    if (autoOpenDefault && tools.length > 0) {
      if (subjectModule?.defaultToolId && tools.some(t => t.id === subjectModule.defaultToolId)) {
        return subjectModule.defaultToolId;
      }
      return tools[0]?.id ?? null;
    }
    return null;
  });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (requestedToolId && tools.some(t => t.id === requestedToolId)) {
      setActiveToolId(requestedToolId);
      return;
    }
    if (autoOpenDefault) {
      const defaultId =
        subjectModule?.defaultToolId && tools.some(t => t.id === subjectModule.defaultToolId)
          ? subjectModule.defaultToolId
          : (tools[0]?.id ?? null);
      setActiveToolId(defaultId);
      return;
    }
    setActiveToolId(prev => (prev && tools.some(t => t.id === prev) ? prev : null));
  }, [requestedToolId, tools, autoOpenDefault, subjectModule?.defaultToolId]);

  const activeTool = useMemo(
    () => tools.find(tool => tool.id === activeToolId) ?? null,
    [tools, activeToolId],
  );

  const LazyToolComponent = useMemo(
    () => (activeTool ? lazy(activeTool.load) : null),
    [activeTool],
  );

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (tools.length <= 1) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tools.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tools.length) % tools.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tools.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      const targetTool = tools[nextIndex];
      if (targetTool) {
        setActiveToolId(targetTool.id);
        tabRefs.current[nextIndex]?.focus();
      }
    }
  };

  if (tools.length === 0) {
    return (
      <EmptyState
        icon={<LayersIcon width={18} height={18} />}
        title="Chưa có công cụ tương tác cho học phần này"
        description="Các công cụ trực quan hóa, mô phỏng hoặc bài tập tương tác theo môn học sẽ được tải theo yêu cầu tại đây khi nội dung học phần được chuyển đổi."
      />
    );
  }

  return (
    <div ref={containerRef} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Công cụ môn học">
        {tools.map((tool, index) => {
          const isSelected = activeToolId === tool.id;
          const tabId = `${baseId}-tab-${tool.id}`;
          const panelId = `${baseId}-panel-${tool.id}`;
          return (
            <button
              key={tool.id}
              ref={element => {
                tabRefs.current[index] = element;
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected || (activeToolId === null && index === 0) ? 0 : -1}
              onClick={() => setActiveToolId(isSelected ? null : tool.id)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              className={`inline-flex min-h-[42px] items-center gap-2.5 rounded-[var(--radius-md)] border px-4 py-2 text-sm font-medium transition-[border-color,background-color,transform] duration-200 active:scale-[0.98] ${
                isSelected
                  ? 'border-accent bg-accent-subtle text-accent-ink'
                  : 'border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-subtle'
              }`}
            >
              <span>{tool.title}</span>
              <Badge tone="neutral">{KIND_LABELS[tool.kind]}</Badge>
            </button>
          );
        })}
      </div>

      {activeTool && LazyToolComponent ? (
        <div
          id={`${baseId}-panel-${activeTool.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeTool.id}`}
        >
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
                  <p role="status" className="text-sm text-ink-muted">
                    Đang tải công cụ {activeTool.title}…
                  </p>
                </div>
              }
            >
              <LazyToolComponent courseId={courseId} initialPreset={requestedPreset} />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}
    </div>
  );
}
