import type { CSSProperties } from 'react';

export interface StarlightBurstProps {
  readonly triggerKey: number;
}

interface SparkVector {
  readonly dx: string;
  readonly dy: string;
  readonly color: string;
  readonly delayMs: number;
}

const SPARKS: readonly SparkVector[] = Array.from({ length: 18 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 18;
  const radius = index % 2 === 0 ? 76 : 52;
  const palette = [
    'var(--hus-starlight)',
    'var(--hus-accent)',
    'var(--hus-success)',
    'var(--hus-starlight)',
  ];
  return {
    dx: `${Math.round(Math.cos(angle) * radius)}px`,
    dy: `${Math.round(Math.sin(angle) * radius)}px`,
    color: palette[index % palette.length] ?? 'var(--hus-starlight)',
    delayMs: (index % 4) * 18,
  };
});

export function StarlightBurst({ triggerKey }: StarlightBurstProps) {
  if (triggerKey <= 0) {
    return null;
  }

  return (
    <div
      key={triggerKey}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {SPARKS.map((spark, index) => {
        const style: CSSProperties = {
          left: '50%',
          top: '42%',
          backgroundColor: spark.color,
          animationDelay: `${spark.delayMs}ms`,
          ['--hus-dx' as string]: spark.dx,
          ['--hus-dy' as string]: spark.dy,
        };
        return <span key={index} className="hus-starlight-spark" style={style} />;
      })}
    </div>
  );
}
