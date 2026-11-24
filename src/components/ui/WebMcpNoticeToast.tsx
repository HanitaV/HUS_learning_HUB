import { useEffect, useState } from 'react';
import { useWebMcpGuide } from '../../app/WebMcpGuideContext';
import {
  WEBMCP_ORIGIN_TRIAL_INFO,
  describeInactiveWebMcpReason,
  detectWebMcpSupport,
  type WebMcpSupportInfo,
} from '../../infrastructure/ai/webmcp-essay-bridge';
import {
  acknowledgeWebMcpNotice,
  hasAcknowledgedWebMcpNotice,
} from '../../infrastructure/preferences/notice';
import { AlertCircleIcon, BookOpenIcon, CheckIcon, CloseIcon, CopyIcon } from './Icons';
import { WEBMCP_CHROME_FLAG_URL } from './WebMcpOnboardingModal';

export { WEBMCP_CHROME_FLAG_URL };

export function WebMcpNoticeToast() {
  const { isGuideOpen, openGuide } = useWebMcpGuide();
  const [support, setSupport] = useState<WebMcpSupportInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        available: true,
        host: 'none',
        hasOriginTrialToken: false,
        isTrialOriginMatch: false,
        detectedChromeMajor: null,
      };
    }
    return detectWebMcpSupport();
  });
  const [dismissed, setDismissed] = useState<boolean>(() => hasAcknowledgedWebMcpNotice());
  const [copiedFlag, setCopiedFlag] = useState(false);

  useEffect(() => {
    setSupport(detectWebMcpSupport());
    const syncAck = () => setDismissed(hasAcknowledgedWebMcpNotice());
    window.addEventListener('hus:webmcp-notice-change', syncAck);
    return () => window.removeEventListener('hus:webmcp-notice-change', syncAck);
  }, []);

  if (support.available || dismissed || isGuideOpen) {
    return null;
  }

  const handleCopyFlag = async () => {
    try {
      await navigator.clipboard.writeText(WEBMCP_CHROME_FLAG_URL);
      setCopiedFlag(true);
      window.setTimeout(() => setCopiedFlag(false), 2500);
    } catch {
      // Ignore clipboard permission restrictions silently
    }
  };

  const handleDismiss = () => {
    acknowledgeWebMcpNotice();
    setDismissed(true);
  };

  return (
    <aside
      aria-label="Thông báo trạng thái WebMCP"
      data-webmcp-toast="missing"
      className="hus-panel-enter fixed bottom-4 right-3 z-40 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-xl)] border border-warning/45 bg-surface/98 p-4 shadow-[var(--hus-shadow-sheet)] sm:right-5 sm:w-[26.5rem]"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2 text-warning">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-warning-subtle">
            <AlertCircleIcon width={16} height={16} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.04em]">
            Chưa kích hoạt WebMCP · Thiếu tính năng
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Đóng thông báo WebMCP"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted hover:bg-surface-subtle hover:text-ink"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
        {describeInactiveWebMcpReason(support)} Khi chưa bật{' '}
        <code className="font-mono text-[11px] text-ink">document.modelContext</code>, Gemini in
        Chrome thiếu tính năng đọc nháp &amp; đồng bộ rubric 2 chiều tự động.
      </p>

      <div className="mt-2 rounded-[var(--radius-md)] border border-border bg-surface-subtle/75 px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">
        <p className="font-semibold text-ink">
          Nếu WebMCP không hoạt động như mặc định (Origin Trial đến Chrome{' '}
          {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone} · {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}
          ), hãy bật cờ:
        </p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>
            Sao chép <code className="font-mono text-ink">{WEBMCP_CHROME_FLAG_URL}</code> và dán lên
            thanh địa chỉ Google Chrome.
          </li>
          <li>
            Đổi mục <strong className="text-ink">WebMCP for testing</strong> sang{' '}
            <strong className="text-ink">Enabled</strong>.
          </li>
          <li>
            Nhấn <strong className="text-ink">Relaunch</strong> để khởi động lại trình duyệt.
          </li>
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={openGuide}
          className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs font-medium text-accent-ink hover:bg-accent-subtle"
        >
          <BookOpenIcon width={13} height={13} />
          <span>Hướng dẫn &amp; Gói AI</span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyFlag()}
            className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
          >
            {copiedFlag ? (
              <CheckIcon width={13} height={13} className="text-success" />
            ) : (
              <CopyIcon width={13} height={13} />
            )}
            <span>{copiedFlag ? 'Đã sao chép địa chỉ cờ' : 'Sao chép cờ bật WebMCP'}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="hus-btn hus-btn-primary min-h-[34px] px-3.5 py-1 text-xs"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </aside>
  );
}
