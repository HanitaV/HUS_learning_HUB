import type { ReactNode } from 'react';

export type GuidingBeaconState = 'act' | 'nudge' | 'advance';

export interface GuidingBeaconProps {
  readonly state: GuidingBeaconState;
  readonly message: ReactNode;
  readonly stepLabel?: string;
}

const STATE_STYLES: Readonly<
  Record<
    GuidingBeaconState,
    {
      readonly container: string;
      readonly badge: string;
      readonly symbol: string;
    }
  >
> = {
  act: {
    container: 'border-starlight/45 bg-warning-subtle/80 text-ink',
    badge: 'bg-starlight text-canvas',
    symbol: '☞',
  },
  nudge: {
    container: 'border-warning/45 bg-warning-subtle text-ink',
    badge: 'bg-warning text-canvas',
    symbol: '✦',
  },
  advance: {
    container: 'border-success/45 bg-success-subtle text-ink',
    badge: 'bg-success text-canvas',
    symbol: '✓',
  },
};

export function GuidingBeacon({ state, message, stepLabel }: GuidingBeaconProps) {
  const style = STATE_STYLES[state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-[var(--radius-lg)] border px-3.5 py-2.5 text-sm transition-colors duration-300 ease-[var(--hus-ease)] sm:items-center ${style.container}`}
    >
      <span
        aria-hidden="true"
        className={`hus-beacon-hand mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:mt-0 ${style.badge}`}
      >
        {style.symbol}
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        {stepLabel ? (
          <span className="mr-2 inline-block font-mono text-xs font-semibold text-ink-secondary">
            {stepLabel} ·
          </span>
        ) : null}
        <span className="font-medium text-ink">{message}</span>
      </div>
    </div>
  );
}
