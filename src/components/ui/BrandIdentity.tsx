import type { DisciplineEmblemKind, DisciplineTone } from '../../contracts/subject-module';
import { CheckIcon } from './Icons';

export interface HusBrandCrestProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

/**
 * Signature HUS Learning Hub Quad-Discipline Astrolabe Crest.
 * Combines the VNU-HUS natural-science astrolabe meridian ("H") with 4 orbital nodes
 * representing Computer Science (Sapphire), Chemistry (Emerald), Physics (Amber), and Mathematics (Violet).
 */
export function HusBrandCrest({ size = 'md', className = '' }: HusBrandCrestProps) {
  const dimensions =
    size === 'sm'
      ? 'h-9 w-9 rounded-[0.625rem]'
      : size === 'lg'
        ? 'h-14 w-14 rounded-2xl'
        : 'h-10 w-10 rounded-xl';
  const svgSize = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7';

  return (
    <span
      aria-hidden="true"
      data-brand-crest="hus-observatory"
      className={`relative inline-flex shrink-0 items-center justify-center border border-white/18 bg-[#0e2147] text-white shadow-[0_6px_18px_-6px_rgb(14_33_71/0.45)] transition-transform duration-300 ease-[var(--hus-ease)] group-hover:scale-[1.04] ${dimensions} ${className}`}
    >
      <svg viewBox="0 0 36 36" fill="none" className={svgSize}>
        {/* Outer meridian ring */}
        <circle cx="18" cy="18" r="13.2" stroke="#dbeafe" strokeOpacity="0.32" strokeWidth="1.15" />
        {/* Inclined natural-science orbital planes */}
        <ellipse
          cx="18"
          cy="18"
          rx="14.2"
          ry="5.6"
          transform="rotate(-28 18 18)"
          stroke="#93c5fd"
          strokeOpacity="0.72"
          strokeWidth="1.15"
        />
        <ellipse
          cx="18"
          cy="18"
          rx="14.2"
          ry="5.6"
          transform="rotate(32 18 18)"
          stroke="#cbd5e1"
          strokeOpacity="0.32"
          strokeWidth="1"
          strokeDasharray="2.2 2.4"
        />
        {/* 4 Natural-Science Discipline Stars: Sapphire (CS), Emerald (Chem), Amber (Phys), Violet (Math) */}
        <circle cx="29.4" cy="11.9" r="1.95" fill="#60a5fa" />
        <circle cx="6.8" cy="24.1" r="1.85" fill="#34d399" />
        <circle cx="26.5" cy="26.4" r="1.85" fill="#fbbf24" />
        <circle cx="9.6" cy="9.7" r="1.75" fill="#c4b5fd" />
        {/* Crisp central HUS architectural H */}
        <path
          d="M13 12v12M23 12v12M13 18h10"
          stroke="#ffffff"
          strokeWidth="2.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Geometric 1.65-stroke SVG emblem for each natural science discipline.
 *Shared components render this via `SubjectModule.visualTheme.emblemKind` without switching on subject names.
 */
export function DisciplineEmblem({
  kind,
  tone = 'sapphire',
  size = 'md',
}: {
  readonly kind?: DisciplineEmblemKind | undefined;
  readonly tone?: DisciplineTone | undefined;
  readonly size?: 'sm' | 'md';
}) {
  const boxClass = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
  const iconClass = size === 'sm' ? 'h-4.5 w-4.5' : 'h-5.5 w-5.5';

  return (
    <span
      aria-hidden="true"
      data-discipline={tone}
      className={`hus-disc-badge inline-flex shrink-0 items-center justify-center border ${boxClass}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
      >
        {kind === 'circuit-tree' ? (
          <>
            <circle cx="12" cy="5.5" r="2" />
            <circle cx="6.5" cy="17.5" r="2" />
            <circle cx="17.5" cy="17.5" r="2" />
            <path d="M10.7 7.2 7.6 15.6" />
            <path d="M13.3 7.2 16.4 15.6" />
            <path d="M8.5 17.5h7" strokeDasharray="1.8 2.2" />
          </>
        ) : kind === 'hex-orbital' ? (
          <>
            <polygon points="12 3.5 19 7.5 19 16.5 12 20.5 5 16.5 5 7.5" />
            <circle cx="12" cy="12" r="3.2" />
            <circle cx="19" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
          </>
        ) : kind === 'wave-pendulum' ? (
          <>
            <path d="M6 4.5h12" />
            <path d="M12 4.5 16.2 15" />
            <circle cx="16.8" cy="16.5" r="2.3" />
            <path d="M5.5 18.2c3.8 2.4 9.2 2.4 13 0" strokeDasharray="2 2.2" />
          </>
        ) : kind === 'manifold-curve' ? (
          <>
            <path d="M4.5 19.5V5" />
            <path d="M4.5 19.5H20" />
            <path d="M6.5 16.5C9.5 16 11 7.5 18.5 6.5" />
            <circle cx="12.6" cy="11.2" r="1.8" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8" />
            <ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(-26 12 12)" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * Tactile checkable selection indicator for colored subject/chapter/topic tiles.
 */
export function SelectableCheckIndicator({
  checked,
  tone = 'sapphire',
}: {
  readonly checked: boolean;
  readonly tone?: DisciplineTone | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      data-discipline={tone}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-200 ease-[var(--hus-ease)] ${
        checked
          ? 'scale-105 border-transparent bg-[var(--disc-solid)] text-white'
          : 'border-[var(--disc-border-strong)] bg-surface/80 text-transparent group-hover:border-[var(--disc-accent)]'
      }`}
    >
      <CheckIcon width={13} height={13} strokeWidth={2.4} />
    </span>
  );
}
