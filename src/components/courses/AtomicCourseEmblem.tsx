/**
 * Compact scientific atomic emblem for course cards.
 * Visualizes real chapter count as concentric electron shells and real lesson count as orbital electrons,
 * surrounding a glowing nucleus core. Pure SVG geometry using theme CSS tokens.
 */
export interface AtomicCourseEmblemProps {
  readonly shellCount: number;
  readonly electronCount: number;
  readonly isActive: boolean;
  readonly progressPercent?: number | undefined;
}

export function AtomicCourseEmblem({
  shellCount,
  electronCount,
  isActive,
  progressPercent,
}: AtomicCourseEmblemProps) {
  const visibleShells = Math.max(1, Math.min(shellCount || 1, 3));
  const radii = visibleShells === 1 ? [20] : visibleShells === 2 ? [14, 22] : [12, 18, 24];
  const visibleElectrons = Math.min(electronCount, 6);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 56 56"
      fill="none"
      className="h-12 w-12 shrink-0"
    >
      {/* Concentric electron shells (1 ring per chapter, dashed when awaiting migration) */}
      {radii.map((r, index) => (
        <circle
          key={r}
          cx="28"
          cy="28"
          r={r}
          stroke={isActive ? 'var(--hus-accent)' : 'var(--hus-border-strong)'}
          strokeOpacity={isActive ? 0.38 + index * 0.14 : 0.6}
          strokeWidth="1.1"
          strokeDasharray={isActive ? undefined : '2.5 3.5'}
        />
      ))}

      {/* Subtle inclined orbital plane for atmospheric depth */}
      <ellipse
        cx="28"
        cy="28"
        rx="24"
        ry="9.5"
        transform="rotate(-26 28 28)"
        stroke={isActive ? 'var(--hus-accent)' : 'var(--hus-orbit-strong)'}
        strokeOpacity={isActive ? 0.32 : 0.45}
        strokeWidth="1"
      />

      {/* Electron nodes distributed across shells */}
      {Array.from({ length: visibleElectrons }).map((_, idx) => {
        const ringRadius = radii[idx % radii.length] ?? 20;
        const angle = ((idx * 137.5 - 35) * Math.PI) / 180;
        const cx = 28 + Math.cos(angle) * ringRadius;
        const cy = 28 + Math.sin(angle) * ringRadius;
        const isLit = progressPercent !== undefined && progressPercent > (idx / Math.max(1, visibleElectrons)) * 100;
        return (
          <circle
            key={idx}
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            r="2.4"
            fill={isLit ? 'var(--hus-success)' : 'var(--hus-accent)'}
          />
        );
      })}

      {/* Nucleus (proton + neutron core) */}
      <circle
        cx="28"
        cy="28"
        r="5.5"
        fill={isActive ? 'var(--hus-accent-subtle)' : 'var(--hus-surface-subtle)'}
        stroke={isActive ? 'var(--hus-accent)' : 'var(--hus-border-strong)'}
        strokeWidth="1.2"
      />
      <circle
        cx="26.8"
        cy="27.2"
        r="1.9"
        fill={isActive ? 'var(--hus-accent)' : 'var(--hus-ink-muted)'}
      />
      <circle
        cx="29.6"
        cy="29.1"
        r="1.7"
        fill="var(--hus-starlight)"
        fillOpacity={isActive ? 0.95 : 0.65}
      />
    </svg>
  );
}
