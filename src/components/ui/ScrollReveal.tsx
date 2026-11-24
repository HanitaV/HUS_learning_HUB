import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ScrollRevealProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * One-shot IntersectionObserver reveal: rises gently and fades in once when entering the viewport.
 * Never hides content under prefers-reduced-motion or without IntersectionObserver.
 */
export function ScrollReveal({ children, className = '' }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -48px 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-[var(--hus-ease)] ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
}
