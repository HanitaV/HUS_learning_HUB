import type { ReactNode } from 'react';

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface-subtle/60 p-6 text-left sm:p-7">
      <div className="flex items-start gap-4">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-accent">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-secondary">
            {description}
          </p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
