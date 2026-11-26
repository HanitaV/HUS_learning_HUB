import { useId, type ReactNode } from 'react';
import type { DisciplineTone } from '../../contracts/subject-module';

export interface ObservatoryHeaderProps {
  readonly breadcrumbs?: ReactNode;
  readonly badges?: ReactNode;
  readonly title: string;
  readonly description?: ReactNode;
  readonly aside?: ReactNode;
  readonly footer?: ReactNode;
  readonly disciplineTone?: DisciplineTone | undefined;
}

/**
 * Shared Atmospheric Observatory masthead for inner pages.
 * Echoes the landing page's orbital geometry in a restrained, top-right celestial horizon arc
 * while keeping inner Operate/Read screens calm, scannable, and high-contrast.
 */
export function ObservatoryHeader({
  breadcrumbs,
  badges,
  title,
  description,
  aside,
  footer,
  disciplineTone,
}: ObservatoryHeaderProps) {
  const haloId = useId();

  return (
    <header
      data-discipline={disciplineTone}
      className="hus-card-surface relative isolate overflow-hidden rounded-[var(--radius-xl)] border border-[var(--disc-border,var(--hus-border))] bg-surface px-5 py-6 sm:px-8 sm:py-8"
    >
      {/* Subtle cropped celestial horizon arc */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      >
        <svg
          viewBox="0 0 960 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMaxYMin slice"
          className="h-full w-full"
        >
          <defs>
            <radialGradient id={haloId} cx="88%" cy="18%" r="44%">
              <stop offset="0%" stopColor="var(--disc-glow, var(--hus-glow-core))" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="840" cy="40" r="300" fill={`url(#${haloId})`} />
          <circle
            cx="840"
            cy="40"
            r="240"
            stroke={disciplineTone ? 'var(--disc-accent)' : 'var(--hus-orbit)'}
            strokeOpacity={disciplineTone ? 0.2 : undefined}
            strokeWidth="1"
          />
          <circle
            cx="840"
            cy="40"
            r="164"
            stroke={disciplineTone ? 'var(--disc-accent)' : 'var(--hus-orbit-strong)'}
            strokeOpacity={disciplineTone ? 0.32 : undefined}
            strokeWidth="1"
            strokeDasharray="3 7"
          />
          <ellipse
            cx="840"
            cy="40"
            rx="310"
            ry="108"
            transform="rotate(-16 840 40)"
            stroke={disciplineTone ? 'var(--disc-accent)' : 'var(--hus-orbit)'}
            strokeOpacity={disciplineTone ? 0.18 : undefined}
            strokeWidth="1"
          />
          <circle
            cx="678"
            cy="64"
            r="3"
            fill="var(--disc-accent, var(--hus-accent))"
            fillOpacity="0.72"
          />
          <circle
            cx="776"
            cy="192"
            r="2.5"
            fill="var(--disc-accent, var(--hus-starlight))"
            fillOpacity="0.8"
          />
        </svg>
      </div>

      <div className="relative z-10 space-y-4">
        {breadcrumbs ? <div>{breadcrumbs}</div> : null}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-[680px] space-y-3">
            {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
            <h1 className="heading-page">{title}</h1>
            {description ? (
              <div className="text-sm leading-relaxed text-ink-secondary sm:text-base">
                {description}
              </div>
            ) : null}
          </div>

          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>

        {footer ? <div className="pt-2">{footer}</div> : null}
      </div>
    </header>
  );
}
