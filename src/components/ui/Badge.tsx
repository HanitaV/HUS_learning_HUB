import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-secondary border-border',
  accent: 'bg-accent-subtle text-accent-ink border-accent/20',
  success: 'bg-success-subtle text-success border-success/25',
  warning: 'bg-warning-subtle text-warning border-warning/25',
  danger: 'bg-danger-subtle text-danger border-danger/25',
};

export interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly mono?: boolean;
  readonly children: ReactNode;
}

export function Badge({ tone = 'neutral', mono = false, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium leading-4 ${
        mono ? 'font-mono tabular-nums tracking-tight' : ''
      } ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
