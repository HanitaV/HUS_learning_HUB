import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  WEBMCP_ORIGIN_TRIAL_INFO,
  describeInactiveWebMcpReason,
  detectWebMcpSupport,
  type WebMcpSupportInfo,
} from '../../infrastructure/ai/webmcp-essay-bridge';
import { Badge } from './Badge';
import {
  AlertCircleIcon,
  BookOpenIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  LayersIcon,
} from './Icons';

export const WEBMCP_CHROME_FLAG_URL = 'chrome://flags/#enable-webmcp-testing';

export interface WebMcpOnboardingModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function WebMcpOnboardingModal({ open, onClose }: WebMcpOnboardingModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [closing, setClosing] = useState(false);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [support, setSupport] = useState<WebMcpSupportInfo>(() => detectWebMcpSupport());

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    setSupport(detectWebMcpSupport());
  }, [open]);

  const finishClose = useCallback(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setClosing(false);
      onClose();
      previousFocusRef.current?.focus({ preventScroll: true });
      return;
    }
    setClosing(true);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      onClose();
      previousFocusRef.current?.focus({ preventScroll: true });
    }, 180);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButtonRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, finishClose]);

  if (!open) return null;

  const webMcpAvailable = support.available;

  const handleCopyFlag = async () => {
    try {
      await navigator.clipboard.writeText(WEBMCP_CHROME_FLAG_URL);
      setCopiedFlag(true);
      window.setTimeout(() => setCopiedFlag(false), 2500);
    } catch {
      // Ignore clipboard restrictions silently
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-webmcp-onboarding-modal="true"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          finishClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-3 backdrop-blur-sm transition-opacity duration-200 ease-[var(--hus-ease)] motion-reduce:transition-none sm:p-5 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        ref={dialogRef}
        className={`flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border-strong bg-surface shadow-[var(--hus-shadow-sheet)] transition-[opacity,transform] duration-200 ease-[var(--hus-ease)] motion-reduce:transition-none ${
          closing ? 'translate-y-2 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-ink">
                Khởi đầu HUS Learning Hub
              </span>
              <Badge tone={webMcpAvailable ? 'success' : 'warning'}>
                {webMcpAvailable
                  ? 'Đã kích hoạt WebMCP 2 chiều'
                  : 'WebMCP chưa hoạt động mặc định'}
              </Badge>
              <Badge tone="neutral">
                Origin Trial: đến Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone} ·{' '}
                {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}
              </Badge>
            </div>
            <h2 id={titleId} className="font-display text-lg font-semibold text-ink sm:text-xl">
              Hướng dẫn dùng WebMCP, Cơ chế hoạt động &amp; Gói AI
            </h2>
            <p id={descId} className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
              Website đã tích hợp sẵn <strong>Origin Trial Token cho WebMCP</strong> trên{' '}
              <code className="font-mono text-[11px] text-ink">
                {WEBMCP_ORIGIN_TRIAL_INFO.hostname}
              </code>{' '}
              (hỗ trợ đến <strong>Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}</strong>, kết
              thúc khi phát hành bản Chrome kế tiếp, muộn nhất{' '}
              <strong>{WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}</strong>).
            </p>
          </div>
          <button
            type="button"
            onClick={finishClose}
            aria-label="Đóng hướng dẫn WebMCP và Gói AI"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-canvas/80 text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {/* Live Detection: Flag Activation Required when Default WebMCP Is Inactive, or Ready Banner when Active */}
          {!webMcpAvailable ? (
            <section
              data-webmcp-activation-guide="true"
              aria-label="Hướng dẫn kích hoạt cờ WebMCP khi không hoạt động mặc định"
              className="rounded-[var(--radius-lg)] border border-warning/45 bg-warning-subtle/60 p-3.5 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-warning/15 text-warning">
                    <AlertCircleIcon width={16} height={16} />
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-warning sm:text-sm">
                      WebMCP không hoạt động như mặc định · Bắt buộc bật cờ WebMCP (4 bước)
                    </h3>
                    <p className="text-xs leading-relaxed text-ink-secondary">
                      {describeInactiveWebMcpReason(support)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyFlag()}
                  className="hus-btn hus-btn-secondary min-h-[34px] shrink-0 px-3 py-1 text-xs"
                >
                  {copiedFlag ? (
                    <CheckIcon width={13} height={13} className="text-success" />
                  ) : (
                    <CopyIcon width={13} height={13} />
                  )}
                  <span>{copiedFlag ? 'Đã sao chép địa chỉ cờ' : 'Sao chép cờ bật WebMCP'}</span>
                </button>
              </div>

              <ol className="mt-3 grid grid-cols-1 gap-2 text-xs leading-relaxed text-ink sm:grid-cols-2">
                <li className="rounded-[var(--radius-md)] border border-border bg-surface/90 px-3 py-2">
                  <strong className="font-semibold text-accent-ink">Bước 1:</strong> Mở trình duyệt{' '}
                  <strong>Google Chrome</strong> trên máy tính.
                </li>
                <li className="rounded-[var(--radius-md)] border border-border bg-surface/90 px-3 py-2">
                  <strong className="font-semibold text-accent-ink">Bước 2:</strong> Dán{' '}
                  <code className="break-all font-mono text-[11px]">{WEBMCP_CHROME_FLAG_URL}</code>{' '}
                  vào thanh địa chỉ rồi nhấn <kbd className="font-mono">Enter</kbd>.
                </li>
                <li className="rounded-[var(--radius-md)] border border-border bg-surface/90 px-3 py-2">
                  <strong className="font-semibold text-accent-ink">Bước 3:</strong> Tại mục{' '}
                  <strong>WebMCP for testing</strong>, chuyển tùy chọn từ <em>Default</em> sang{' '}
                  <strong>Enabled</strong>.
                </li>
                <li className="rounded-[var(--radius-md)] border border-border bg-surface/90 px-3 py-2">
                  <strong className="font-semibold text-accent-ink">Bước 4:</strong> Nhấn nút{' '}
                  <strong>Relaunch</strong> góc dưới để khởi động lại Chrome — cầu nối 2 chiều sẽ tự
                  sẵn sàng.
                </li>
              </ol>

              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-muted">
                Trên trình duyệt khác (Safari, Firefox, điện thoại): bạn vẫn học đầy đủ giáo trình,
                trắc nghiệm, sơ đồ tương tác và dùng chế độ dự phòng{' '}
                <strong className="text-ink-secondary">Sao chép lệnh 1-Click &amp; Dán JSON</strong>.
              </p>
            </section>
          ) : (
            <section
              data-webmcp-activation-ready="true"
              aria-label="Trạng thái WebMCP đã hoạt động"
              className="space-y-1.5 rounded-[var(--radius-lg)] border border-success/40 bg-success-subtle/60 px-4 py-3 text-xs leading-relaxed text-ink"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircleIcon width={18} height={18} className="shrink-0 text-success" />
                <span>
                  <strong className="font-semibold text-success">
                    WebMCP đã hoạt động sẵn sàng:
                  </strong>{' '}
                  Trình duyệt đã kích hoạt <code className="font-mono text-[11px]">document.modelContext</code>{' '}
                  (tự động qua Origin Trial đến Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone} /{' '}
                  {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi} hoặc qua cờ trình duyệt).
                </span>
              </div>
              <p className="pl-7 text-[11px] text-ink-secondary">
                Lưu ý: Khi vượt mốc Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}, sau ngày{' '}
                {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi} hoặc mở trên tên miền phụ khác mà WebMCP
                không tự hoạt động mặc định, bạn cần bật cờ{' '}
                <code className="font-mono text-ink">{WEBMCP_CHROME_FLAG_URL}</code>.
              </p>
            </section>
          )}

          {/* 2-Column: How to Use WebMCP & How It Works */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <section
              aria-label="Hướng dẫn sử dụng WebMCP"
              className="space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-canvas/70 p-4"
            >
              <div className="flex items-center gap-2 text-ink">
                <BookOpenIcon width={16} height={16} className="shrink-0 text-accent" />
                <h3 className="text-sm font-semibold">1. Hướng dẫn dùng WebMCP (3 bước)</h3>
              </div>
              <ol className="space-y-2 text-xs leading-relaxed text-ink-secondary">
                <li>
                  <strong className="text-ink">Bước 1 — Viết nháp lập luận:</strong> Mở bài tập tự
                  luận bất kỳ, trình bày hướng giải ban đầu (hỗ trợ gõ ký hiệu toán{' '}
                  <code className="font-mono text-[11px]">\</code>, LaTeX và sơ đồ chuyên ngành).
                </li>
                <li>
                  <strong className="text-ink">Bước 2 — Gọi ✨ Ask Gemini trên Chrome:</strong> Bấm
                  biểu tượng Gemini ở góc trên bên phải Chrome, nhắn{' '}
                  <em>«Gợi mở Socratic bước này theo giáo trình ĐHKHTN»</em> hoặc{' '}
                  <em>«Rà soát bài nháp theo rubric»</em>.
                </li>
                <li>
                  <strong className="text-ink">Bước 3 — Nhận gợi ý trực tiếp trên bài:</strong>{' '}
                  Gemini tự động đẩy câu hỏi gợi mở, cảnh báo điều kiện/ký hiệu và trạng thái từng
                  tiêu chí thẳng vào khung bài làm để bạn tự sửa bài (không chép sẵn lời giải).
                </li>
              </ol>
            </section>

            <section
              aria-label="Giải thích cách hoạt động của WebMCP"
              className="space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-canvas/70 p-4"
            >
              <div className="flex items-center gap-2 text-ink">
                <LayersIcon width={16} height={16} className="shrink-0 text-accent" />
                <h3 className="text-sm font-semibold">2. Giải thích cách hoạt động</h3>
              </div>
              <p className="text-xs leading-relaxed text-ink-secondary">
                <strong className="text-ink">WebMCP</strong> là chuẩn cầu nối cục bộ ngay trong tab
                trình duyệt (<code className="font-mono text-[11px]">document.modelContext</code>),
                cho phép trang tĩnh giao tiếp 2 chiều an toàn với Gemini mà không tốn máy chủ:
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink-secondary">
                <li>
                  <code className="font-mono text-[11px] text-ink">hus_get_essay_context</code>: Đọc
                  đề bài, tiêu chí rubric, quy ước ký hiệu học phần và bản nháp mới nhất.
                </li>
                <li>
                  <code className="font-mono text-[11px] text-ink">hus_search_curriculum</code>: Tra
                  cứu Graph-RAG + BM25 trên giáo trình ĐHKHTN kèm{' '}
                  <strong className="text-ink">rào chắn chống vượt chương</strong> (chặn dùng định
                  lý ở chương chưa học).
                </li>
                <li>
                  <code className="font-mono text-[11px] text-ink">hus_submit_essay_coaching</code>:
                  Kiểm duyệt JSON nghiêm ngặt và hiển thị thẻ nhận xét KaTeX ngay trên giao diện.
                </li>
              </ul>
            </section>
          </div>

          {/* Section 3: AI Plans & Tiers Explained */}
          <section
            data-ai-plans-guide="true"
            aria-label="Giải thích gói AI và chi phí"
            className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/50 p-4"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink">
                3. Giải thích các gói AI &amp; Chi phí sử dụng
              </h3>
              <p className="text-xs leading-relaxed text-ink-secondary">
                <strong className="text-ink">
                  HUS Learning Hub miễn phí 100%, không bán gói cước và không yêu cầu API key.
                </strong>{' '}
                Trợ giảng hoạt động trực tiếp dựa trên tài khoản Google bạn đăng nhập trên Chrome:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-semibold text-ink">Google Miễn phí</span>
                  <Badge tone="neutral">0đ · Mặc định</Badge>
                </div>
                <p className="mt-1.5 text-ink-secondary">
                  Dùng ngay <strong>Ask Gemini</strong> trên Chrome &amp; <strong>NotebookLM</strong>{' '}
                  để nhận gợi mở Socratic và rà soát bài nháp hàng ngày (theo hạn mức lượt hỏi tiêu
                  chuẩn của Google).
                </p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-accent/40 bg-surface p-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-semibold text-ink">Google AI Pro</span>
                  <Badge tone="accent">Khuyên dùng SV</Badge>
                </div>
                <p className="mt-1.5 text-ink-secondary">
                  Gói Google One AI Premium (thường có ưu đãi cho email sinh viên{' '}
                  <code className="font-mono text-[11px]">.edu.vn</code>) mở mô hình suy luận sâu{' '}
                  <strong>Gemini Pro / Deep Think</strong> cho Giải tích, Cơ – Nhiệt, Thuyết MO &amp;
                  Thuật toán chính xác hơn.
                </p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-semibold text-ink">Gói Sổ tay (.md)</span>
                  <Badge tone="success">Ôn thi cả môn</Badge>
                </div>
                <p className="mt-1.5 text-ink-secondary">
                  Mỗi trang Học phần có nút <strong>Xuất Sổ tay NotebookLM (.md)</strong> đóng gói
                  toàn bộ bài học &amp; quy ước ký hiệu để bạn nạp vào NotebookLM hoặc AI Ultra/Pro
                  ôn tập tổng hợp.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="flex flex-col gap-2.5 border-t border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Có thể mở lại hướng dẫn này bất cứ lúc nào tại mục{' '}
            <strong className="text-ink-secondary">Cài đặt</strong> hoặc trong khung{' '}
            <strong className="text-ink-secondary">Trợ giảng Socratic</strong>.
          </p>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={finishClose}
              className="hus-btn hus-btn-primary min-h-[40px] w-full justify-center px-5 text-xs font-semibold sm:w-auto sm:text-sm"
            >
              Đã hiểu, bắt đầu học
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
