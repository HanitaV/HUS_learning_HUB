import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  acknowledgeSmallScreen,
  hasAcknowledgedSmallScreen,
} from '../../infrastructure/preferences/notice';
import { AlertCircleIcon } from './Icons';

const SMALL_SCREEN_QUERY = '(max-width: 767px)';

export interface SmallScreenNoticeModalProps {
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

export function SmallScreenNoticeModal({ onOpenChange }: SmallScreenNoticeModalProps = {}) {
  const titleId = useId();
  const descId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(SMALL_SCREEN_QUERY).matches && !hasAcknowledgedSmallScreen();
  });
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(SMALL_SCREEN_QUERY);

    const syncViewport = () => {
      if (media.matches && !hasAcknowledgedSmallScreen()) {
        setClosing(false);
        setOpen(true);
      } else if (!media.matches) {
        setOpen(false);
        setClosing(false);
      }
    };

    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => {
      media.removeEventListener('change', syncViewport);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    confirmButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        confirmButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleConfirm = useCallback(() => {
    acknowledgeSmallScreen();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setOpen(false);
      return;
    }
    setClosing(true);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
      setClosing(false);
    }, 180);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-canvas/78 p-4 backdrop-blur-sm transition-opacity duration-200 ease-[var(--hus-ease)] motion-reduce:transition-none ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`w-full max-w-sm rounded-[var(--radius-xl)] border border-border-strong bg-surface p-6 shadow-[var(--hus-shadow-sheet)] transition-[opacity,transform] duration-200 ease-[var(--hus-ease)] motion-reduce:transition-none ${
          closing ? 'translate-y-2 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'
        }`}
      >
        <div className="flex items-center gap-2.5 text-warning">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-warning-subtle">
            <AlertCircleIcon width={18} height={18} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.06em]">
            Khuyến nghị hiển thị
          </span>
        </div>

        <h2 id={titleId} className="mt-4 font-display text-xl font-medium text-ink">
          Website tối ưu cho màn hình lớn
        </h2>

        <p id={descId} className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
          HUS Learning Hub gồm nhiều sơ đồ kiến thức, công thức toán học và khu vực thực hành được
          thiết kế tối ưu cho màn hình lớn (máy tính, máy tính bảng). Trên màn hình nhỏ như điện
          thoại, một số bố cục và thao tác có thể bị thu gọn.
        </p>

        <div className="mt-6">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            className="hus-btn hus-btn-primary min-h-[44px] w-full justify-center text-sm font-medium"
          >
            Tôi đã hiểu, tiếp tục trên màn hình nhỏ
          </button>
        </div>
      </div>
    </div>
  );
}
