import { useRef, useState, type KeyboardEvent } from 'react';
import { useWorkspacePreferences } from '../app/useWorkspacePreferences';
import { useWebMcpActivity } from '../app/useWebMcpActivity';
import { useWebMcpGuide } from '../app/WebMcpGuideContext';
import {
  REGISTERED_CODELAB_TOOL_NAMES,
  REGISTERED_DIAGNOSTICS_TOOL_NAMES,
  REGISTERED_ESSAY_TOOL_NAMES,
  REGISTERED_TOOL_NAMES,
  WEBMCP_ORIGIN_TRIAL_INFO,
  describeInactiveWebMcpReason,
  detectWebMcpSupport,
  getActiveRegisteredToolNames,
  runWebMcpDiagnosticsDryRun,
  type WebMcpDiagnosticsDryRunResult,
} from '../infrastructure/ai/webmcp-essay-bridge';
import { resetWebMcpNotice } from '../infrastructure/preferences/notice';
import type { ReadingSizePreference, ThemePreference } from '../infrastructure/preferences/theme';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { BookOpenIcon, CheckIcon, CopyIcon } from '../components/ui/Icons';
import { ObservatoryHeader } from '../components/ui/ObservatoryHeader';
import { WEBMCP_CHROME_FLAG_URL } from '../components/ui/WebMcpNoticeToast';

const THEME_OPTIONS: readonly {
  readonly value: ThemePreference;
  readonly label: string;
  readonly hint: string;
}[] = [
  { value: 'system', label: 'Theo hệ thống', hint: 'Tự động khớp cài đặt thiết bị' },
  { value: 'light', label: 'Sáng', hint: 'Bầu trời ban mai dịu mắt' },
  { value: 'dark', label: 'Tối', hint: 'Bầu trời đêm sâu cho phiên học tối' },
];

const READING_SIZE_OPTIONS: readonly {
  readonly value: ReadingSizePreference;
  readonly label: string;
  readonly hint: string;
}[] = [
  { value: 'normal', label: 'Tiêu chuẩn (16px)', hint: 'Cân bằng cho đọc dài và xem bảng biểu' },
  {
    value: 'comfortable',
    label: 'Thoải mái (18px)',
    hint: 'Cỡ chữ lớn hơn cho phiên đọc bài giảng',
  },
];

export default function SettingsPage() {
  const { preferences, resolvedTheme, storageWarning, setTheme, setReadingSize } =
    useWorkspacePreferences();
  const { openGuide } = useWebMcpGuide();
  const webMcpActivity = useWebMcpActivity();
  const [flagCopied, setFlagCopied] = useState(false);
  const [noticeRestored, setNoticeRestored] = useState(false);
  const [dryRunReport, setDryRunReport] = useState<WebMcpDiagnosticsDryRunResult | null>(null);
  const webMcpSupport = detectWebMcpSupport();
  const webMcpAvailable = webMcpSupport.available;
  const activeToolNames = getActiveRegisteredToolNames();
  const themeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const readingRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleRadioKeyDown = <T,>(
    event: KeyboardEvent<HTMLButtonElement>,
    options: readonly { readonly value: T }[],
    currentIndex: number,
    onSelect: (value: T) => void,
    refs: (HTMLButtonElement | null)[],
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    }
    if (nextIndex !== null) {
      event.preventDefault();
      const target = options[nextIndex];
      if (target) {
        onSelect(target.value);
        refs[nextIndex]?.focus();
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ObservatoryHeader
        breadcrumbs={<Breadcrumbs items={[{ label: 'Tổng quan', to: '/' }, { label: 'Cài đặt' }]} />}
        title="Cài đặt không gian học"
        description="Tùy chỉnh giao diện hiển thị và trải nghiệm đọc bài giảng. Các tùy chọn này chỉ lưu cục bộ trên trình duyệt của bạn."
      />

      {storageWarning ? (
        <div
          role="status"
          className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning"
        >
          Trình duyệt hiện không cho phép ghi bộ nhớ cục bộ. Tùy chỉnh vẫn áp dụng trong phiên làm
          việc này nhưng có thể không được giữ lại sau khi tải lại trang.
        </div>
      ) : null}

      {/* Two-column Observatory settings panels */}
      <div className="hus-card-surface divide-y divide-border overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface">
        {/* Theme selection */}
        <section className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-12 lg:gap-8 lg:p-7">
          <div className="lg:col-span-4">
            <h2 className="heading-section">Giao diện màu sắc</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              Đang hiển thị: {resolvedTheme === 'dark' ? 'Chế độ tối' : 'Chế độ sáng'}.
            </p>
          </div>

          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-8"
            role="radiogroup"
            aria-label="Chọn giao diện màu sắc"
          >
            {THEME_OPTIONS.map((option, index) => {
              const isSelected = preferences.theme === option.value;
              return (
                <button
                  key={option.value}
                  ref={el => {
                    themeRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setTheme(option.value)}
                  onKeyDown={event =>
                    handleRadioKeyDown(event, THEME_OPTIONS, index, setTheme, themeRefs.current)
                  }
                  className={`flex flex-col items-start rounded-[var(--radius-lg)] border p-4 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.98] ${
                    isSelected
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-canvas/70 text-ink hover:border-border-strong hover:bg-surface-subtle'
                  }`}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 text-xs text-ink-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reading typography scale */}
        <section className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-12 lg:gap-8 lg:p-7">
          <div className="lg:col-span-4">
            <h2 className="heading-section">Cỡ chữ đọc bài giảng</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              Áp dụng cho nội dung lý thuyết và ghi chú học thuật trong không gian bài học.
            </p>
          </div>

          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8"
            role="radiogroup"
            aria-label="Chọn cỡ chữ đọc"
          >
            {READING_SIZE_OPTIONS.map((option, index) => {
              const isSelected = preferences.readingSize === option.value;
              return (
                <button
                  key={option.value}
                  ref={el => {
                    readingRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setReadingSize(option.value)}
                  onKeyDown={event =>
                    handleRadioKeyDown(
                      event,
                      READING_SIZE_OPTIONS,
                      index,
                      setReadingSize,
                      readingRefs.current,
                    )
                  }
                  className={`flex flex-col items-start rounded-[var(--radius-lg)] border p-4 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.98] ${
                    isSelected
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-canvas/70 text-ink hover:border-border-strong hover:bg-surface-subtle'
                  }`}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 text-xs text-ink-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* WebMCP two-way tutor bridge diagnostics */}
        <section className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-12 lg:gap-8 lg:p-7">
          <div className="space-y-2 lg:col-span-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="heading-section">Kết nối WebMCP</h2>
              <Badge tone={webMcpAvailable ? 'success' : 'warning'}>
                {webMcpAvailable ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">
              Cầu nối 2 chiều với Gemini in Chrome. Đã tích hợp Origin Trial trên{' '}
              <code className="font-mono text-[11px]">
                {WEBMCP_ORIGIN_TRIAL_INFO.hostnames.join(', ')}
              </code>{' '}
              (đến Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}, muộn nhất{' '}
              {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}).
            </p>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-ink-secondary lg:col-span-8">
            {webMcpAvailable ? (
              <div className="space-y-3">
                <p className="text-ink">
                  Trình duyệt đã bật{' '}
                  <code className="font-mono text-xs">
                    {webMcpSupport.host === 'navigator'
                      ? 'navigator.modelContext'
                      : 'document.modelContext'}
                  </code>{' '}
                  (tự động qua Origin Trial đến Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}{' '}
                  · {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi} hoặc qua cờ trình duyệt). Đầy đủ{' '}
                  {REGISTERED_TOOL_NAMES.length} công cụ tự động (
                  {REGISTERED_TOOL_NAMES.map((name, idx) => (
                    <span key={name}>
                      {idx > 0 ? ', ' : ''}
                      <code className="font-mono text-xs">{name}</code>
                    </span>
                  ))}
                  ) sẵn sàng hoạt động; nếu về sau WebMCP không tự hoạt động mặc định, hãy bật cờ{' '}
                  <code className="font-mono text-xs">{WEBMCP_CHROME_FLAG_URL}</code>.
                </p>
                <button
                  type="button"
                  onClick={openGuide}
                  className="hus-btn hus-btn-secondary text-xs"
                >
                  <BookOpenIcon width={14} height={14} />
                  <span>Xem hướng dẫn WebMCP &amp; Gói AI</span>
                </button>
              </div>
            ) : (
              <>
                <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning-subtle/65 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
                  <strong className="text-warning">Lưu ý thiếu tính năng:</strong>{' '}
                  {describeInactiveWebMcpReason(webMcpSupport)} Khi chưa kích hoạt WebMCP, trình
                  duyệt không thể tự động truyền bài nháp, tra cứu giáo trình ĐHKHTN trực tiếp hay
                  nhận thẻ đánh giá rubric 2 chiều (chỉ dùng được chế độ sao chép lệnh &amp; dán
                  JSON thủ công).
                </p>
                <p className="text-xs font-medium text-ink">
                  Bắt buộc kích hoạt cờ WebMCP nếu tính năng không tự hoạt động như mặc định:
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-secondary">
                  <li>
                    Mở trình duyệt <strong className="text-ink">Google Chrome</strong> trên máy
                    tính.
                  </li>
                  <li>
                    Dán <code className="font-mono text-ink">{WEBMCP_CHROME_FLAG_URL}</code> vào
                    thanh địa chỉ và nhấn <kbd className="font-mono">Enter</kbd>.
                  </li>
                  <li>
                    Chuyển mục <strong className="text-ink">WebMCP for testing</strong> sang{' '}
                    <strong className="text-ink">Enabled</strong> rồi nhấn{' '}
                    <strong className="text-ink">Relaunch</strong>.
                  </li>
                </ol>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(WEBMCP_CHROME_FLAG_URL);
                        setFlagCopied(true);
                        window.setTimeout(() => setFlagCopied(false), 2500);
                      } catch {
                        // Ignore clipboard failures
                      }
                    }}
                    className="hus-btn hus-btn-secondary text-xs"
                  >
                    {flagCopied ? (
                      <CheckIcon width={14} height={14} className="text-success" />
                    ) : (
                      <CopyIcon width={14} height={14} />
                    )}
                    <span>{flagCopied ? 'Đã sao chép địa chỉ cờ' : 'Sao chép địa chỉ cờ Chrome'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openGuide}
                    className="hus-btn hus-btn-secondary text-xs"
                  >
                    <BookOpenIcon width={14} height={14} />
                    <span>Xem hướng dẫn WebMCP &amp; Gói AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetWebMcpNotice();
                      setNoticeRestored(true);
                    }}
                    className="hus-btn hus-btn-ghost text-xs"
                  >
                    {noticeRestored ? 'Đã bật lại thông báo góc trang' : 'Hiện lại hộp thông báo WebMCP'}
                  </button>
                </div>
              </>
            )}

            {/* WebMCP Ecosystem Diagnostics & Dry-Run Console */}
            <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-canvas/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-ink">
                    Kiểm thử cầu nối WebMCP &amp; Bảng công cụ (10 tool + 2 Form)
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Chạy kiểm tra khép kín (Dry-run) khả năng đăng ký tool, vòng đời kích hoạt và chuẩn JSON hai chiều trên trình duyệt hiện tại.
                  </p>
                </div>
                <button
                  type="button"
                  data-webmcp-dryrun-btn="true"
                  onClick={() => setDryRunReport(runWebMcpDiagnosticsDryRun())}
                  className="hus-btn hus-btn-secondary min-h-[34px] px-3 py-1 text-xs"
                >
                  Kiểm thử cầu nối WebMCP (Dry-run)
                </button>
              </div>

              {webMcpActivity.labelVi ? (
                <p data-webmcp-live-activity="true" className="text-xs font-medium text-accent">
                  Hoạt động đang chạy: {webMcpActivity.labelVi}
                </p>
              ) : null}

              {dryRunReport ? (
                <div
                  data-webmcp-dryrun-result="true"
                  className="space-y-1.5 rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs"
                >
                  <p className="font-semibold text-ink">
                    Kết quả kiểm thử lúc {new Date(dryRunReport.timestamp).toLocaleTimeString('vi-VN')} ·{' '}
                    {dryRunReport.activeToolNames.length > 0
                      ? `${dryRunReport.activeToolNames.length} tool đang hoạt động`
                      : 'Sẵn sàng trên ngữ cảnh trang học/thi'}
                  </p>
                  <ul className="space-y-1">
                    {dryRunReport.checks.map(chk => (
                      <li key={chk.id} className="flex flex-wrap items-center gap-2 text-ink-secondary">
                        <Badge tone={chk.passed ? 'success' : 'warning'}>
                          {chk.passed ? 'ĐẠT' : 'LƯU Ý'}
                        </Badge>
                        <span className="font-medium text-ink">{chk.label}:</span>
                        <span>{chk.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-2">
                  <p className="font-semibold text-ink">Tự luận &amp; Đề thi ({REGISTERED_ESSAY_TOOL_NAMES.length})</p>
                  <p className="mt-0.5 break-words font-mono text-ink-muted">
                    {REGISTERED_ESSAY_TOOL_NAMES.join(', ')}
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-2">
                  <p className="font-semibold text-ink">CodeLab Socratic ({REGISTERED_CODELAB_TOOL_NAMES.length})</p>
                  <p className="mt-0.5 break-words font-mono text-ink-muted">
                    {REGISTERED_CODELAB_TOOL_NAMES.join(', ')}
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-2">
                  <p className="font-semibold text-ink">Chẩn đoán &amp; Ôn tập ({REGISTERED_DIAGNOSTICS_TOOL_NAMES.length})</p>
                  <p className="mt-0.5 break-words font-mono text-ink-muted">
                    {REGISTERED_DIAGNOSTICS_TOOL_NAMES.join(', ')}
                  </p>
                </div>
              </div>

              {activeToolNames.length > 0 ? (
                <p className="font-mono text-[11px] text-ink-muted">
                  Đang đăng ký trên port hiện tại: {activeToolNames.join(', ')}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Accessibility & static privacy info */}
        <section className="grid grid-cols-1 gap-5 bg-surface-subtle/40 p-6 lg:grid-cols-12 lg:gap-8 lg:p-7">
          <div className="lg:col-span-4">
            <h2 className="heading-section">Tiếp cận &amp; quyền riêng tư</h2>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-secondary lg:col-span-8">
            <li>Hỗ trợ điều hướng bàn phím đầy đủ và liên kết bỏ qua để vào thẳng nội dung chính.</li>
            <li>Tự động giảm hiệu ứng chuyển động khi thiết bị bật chế độ Reduce Motion.</li>
            <li>Ứng dụng tĩnh 100%, không thu thập dữ liệu người dùng và không phụ thuộc máy chủ ngoài.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
