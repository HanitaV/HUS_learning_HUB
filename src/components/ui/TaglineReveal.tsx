import { useEffect, useMemo, useRef, useState } from 'react';

export interface TaglineRevealProps {
  readonly text: string;
  readonly className?: string;
}

/**
 * Scroll-activated word-by-word illumination.
 * Words rest at subtle muted opacity and illuminate sequentially in reading order
 * as the block glides across the viewport. Instant full ink under prefers-reduced-motion.
 */
export function TaglineReveal({ text, className = '' }: TaglineRevealProps) {
  const containerRef = useRef<HTMLParagraphElement | null>(null);
  const words = useMemo(() => text.trim().split(/\s+/), [text]);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') {
      setProgress(1);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    let rafId = 0;
    let active = false;

    const update = () => {
      rafId = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const start = vh * 0.88;
      const end = vh * 0.34;
      const raw = (start - rect.top) / Math.max(1, start - end);
      const clamped = Math.max(0, Math.min(1, raw));
      setProgress(prev => (Math.abs(prev - clamped) > 0.005 ? clamped : prev));
    };

    const scheduleUpdate = () => {
      if (!rafId && active) {
        rafId = window.requestAnimationFrame(update);
      }
    };

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        active = Boolean(entry?.isIntersecting);
        if (active) {
          update();
          window.addEventListener('scroll', scheduleUpdate, { passive: true });
          window.addEventListener('resize', scheduleUpdate, { passive: true });
        } else {
          window.removeEventListener('scroll', scheduleUpdate);
          window.removeEventListener('resize', scheduleUpdate);
          if (entry && entry.boundingClientRect.top < 0) {
            setProgress(1);
          }
        }
      },
      { rootMargin: '80px 0px 80px 0px', threshold: 0 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  const activeWordCount = reducedMotion ? words.length : Math.round(progress * words.length);

  return (
    <p ref={containerRef} className={`heading-tagline ${className}`.trim()}>
      {words.map((word, index) => {
        const isLit = index < activeWordCount;
        return (
          <span
            key={`${index}-${word}`}
            className="inline-block transition-opacity duration-500 ease-[var(--hus-ease)]"
            style={{ opacity: isLit ? 1 : 0.28 }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </span>
        );
      })}
    </p>
  );
}
