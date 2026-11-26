import { useState } from 'react';
import type { EntityId } from '../../domain/learning';
import type { NotebookLmExportMode } from '../../infrastructure/ai/notebooklm-exporter';
import { CheckIcon, CopyIcon, DownloadIcon } from '../ui/Icons';

export interface NotebookLmExportControlProps {
  readonly courseId: EntityId;
  readonly courseCode?: string | undefined;
  readonly filterChapterId?: EntityId | undefined;
  readonly chapterLabel?: string | undefined;
  readonly variant?: 'card' | 'compact' | undefined;
}

const BUNDLE_MODE_OPTIONS: readonly {
  readonly id: NotebookLmExportMode;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: 'syllabus',
    label: 'Giáo trình',
    description: 'Bài giảng, sơ đồ tiên quyết & quy ước ĐHKHTN',
  },
  {
    id: 'study-pack',
    label: 'Ôn thi + Rubric',
    description: 'Giáo trình kèm ngân hàng đề & tiêu chí chấm A4',
  },
  {
    id: 'mistake-ledger',
    label: 'Sổ lỗi sai',
    description: 'Tổng hợp lỗi sai & nhắc ký hiệu cá nhân của bạn',
  },
];

export function NotebookLmExportControl({
  courseId,
  courseCode,
  filterChapterId,
  chapterLabel,
  variant = 'card',
}: NotebookLmExportControlProps) {
  const [bundleMode, setBundleMode] = useState<NotebookLmExportMode>('syllabus');
  const [status, setStatus] = useState<'idle' | 'loading' | 'downloaded' | 'copied' | 'error'>(
    'idle',
  );
  const [statusDetail, setStatusDetail] = useState<string>('');

  const handleExport = async (mode: 'download' | 'copy') => {
    setStatus('loading');
    setStatusDetail('');
    try {
      const { downloadMarkdownBundle, generateCourseNotebookBundle } = await import(
        '../../infrastructure/ai/notebooklm-exporter'
      );
      const bundle = await generateCourseNotebookBundle(courseId, {
        filterChapterId,
        mode: variant === 'compact' ? 'syllabus' : bundleMode,
      });
      if (mode === 'download') {
        downloadMarkdownBundle(bundle.filename, bundle.markdown);
        setStatus('downloaded');
        setStatusDetail(
          `Đã tải ${bundle.filename} (${bundle.lessonCount} bài học chuẩn hóa). Bạn có thể nạp thẳng vào NotebookLM hoặc Gemini Gems.`,
        );
      } else {
        await navigator.clipboard.writeText(bundle.markdown);
        setStatus('copied');
        setStatusDetail(
          `Đã sao chép trọn bộ ${bundle.lessonCount} bài học vào bộ nhớ tạm để dán vào NotebookLM / Gemini.`,
        );
      }
    } catch (err) {
      setStatus('error');
      setStatusDetail(
        err instanceof Error ? err.message : 'Không thể xuất gói giáo trình lúc này.',
      );
    }
  };

  if (variant === 'compact') {
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void handleExport('download')}
          className="hus-btn hus-btn-secondary text-xs"
          title="Tải tệp Markdown tổng hợp giáo trình chuẩn ĐHKHTN để nạp vào Google NotebookLM hoặc Gemini Gems"
        >
          {status === 'downloaded' ? (
            <CheckIcon width={13} height={13} className="text-success" />
          ) : (
            <DownloadIcon width={13} height={13} />
          )}
          <span>
            {status === 'loading'
              ? 'Đang đóng gói…'
              : filterChapterId
                ? 'Tải sổ tay chương (.md)'
                : 'Sổ tay NotebookLM (.md)'}
          </span>
        </button>
        {statusDetail ? (
          <span role="status" aria-live="polite" className="text-xs text-ink-secondary">
            {statusDetail}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hus-card-surface space-y-3 rounded-[var(--radius-xl)] border border-border bg-surface p-5">
      <div className="space-y-1">
        <h3 className="font-display text-base font-medium text-ink">
          Sổ tay Giáo trình cho NotebookLM &amp; Gemini
        </h3>
        <p className="text-xs leading-relaxed text-ink-secondary">
          Đóng gói toàn bộ bài học đã xác minh, sơ đồ tiên quyết và quy ước ký hiệu của{' '}
          <strong className="font-medium text-ink">
            {chapterLabel ?? courseCode ?? courseId.toUpperCase()}
          </strong>{' '}
          thành một tệp <code className="font-mono text-[11px]">.md</code> duy nhất để nạp vào{' '}
          <strong className="font-medium text-ink">Google NotebookLM (@Gemini Notebook)</strong>{' '}
          hoặc <strong className="font-medium text-ink">Gemini Gems</strong>.
        </p>
      </div>

      <div role="group" aria-label="Chế độ gói NotebookLM" className="grid grid-cols-3 gap-1.5">
        {BUNDLE_MODE_OPTIONS.map(opt => {
          const active = bundleMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              title={opt.description}
              onClick={() => setBundleMode(opt.id)}
              className={`min-h-[34px] rounded-[var(--radius-md)] border px-2 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent bg-accent-subtle text-accent-ink font-semibold'
                  : 'border-border bg-canvas text-ink-secondary hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void handleExport('download')}
          className="hus-btn hus-btn-secondary flex-1 justify-center text-xs"
        >
          {status === 'downloaded' ? (
            <CheckIcon width={14} height={14} className="text-success" />
          ) : (
            <DownloadIcon width={14} height={14} />
          )}
          <span>{status === 'loading' ? 'Đang đóng gói…' : 'Tải tệp .md chuẩn'}</span>
        </button>
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void handleExport('copy')}
          className="hus-btn hus-btn-ghost border border-border px-3 text-xs"
          aria-label="Sao chép nội dung sổ tay giáo trình"
          title="Sao chép nội dung Markdown vào Clipboard"
        >
          {status === 'copied' ? (
            <CheckIcon width={14} height={14} className="text-success" />
          ) : (
            <CopyIcon width={14} height={14} />
          )}
          <span>Sao chép</span>
        </button>
      </div>

      {statusDetail ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-xs leading-relaxed ${
            status === 'error' ? 'text-danger' : 'text-ink-secondary'
          }`}
        >
          {statusDetail}
        </p>
      ) : null}
    </div>
  );
}
