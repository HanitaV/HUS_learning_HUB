import { useState } from 'react';
import { useWebMcpGuide } from '../../app/WebMcpGuideContext';
import { formatScoreVi } from '../../core/learning/webmcp-essay-adapters';
import { WEBMCP_ORIGIN_TRIAL_INFO } from '../../infrastructure/ai/webmcp-essay-bridge';
import { Badge } from '../ui/Badge';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  ClipboardCheckIcon,
  CopyIcon,
  RotateCcwIcon,
} from '../ui/Icons';
import { WEBMCP_CHROME_FLAG_URL } from '../ui/WebMcpNoticeToast';

export interface ExamWebMcpStatusBarProps {
  readonly courseCode: string;
  readonly webMcpAvailable: boolean;
  readonly draftedStepCount: number;
  readonly totalWrittenSteps: number;
  readonly paperScoreOn10?: number | null | undefined;
  readonly paperPassed?: boolean | undefined;
  readonly passedQuestionCount?: number | undefined;
  readonly totalQuestionCount?: number | undefined;
  readonly activeQuestionNumber?: number | undefined;
  readonly lastCoachedQuestionNumber?: number | null | undefined;
  readonly weakQuestionCount?: number | undefined;
  readonly isDrillMode?: boolean | undefined;
  readonly copyFeedbackMessage: string | null;
  readonly presentationCheckpoints?: readonly string[] | undefined;
  readonly onCopyWholePaperPrompt: () => void;
  readonly onImportWholePaperText?:
    | ((rawText: string) => {
        readonly ok: boolean;
        readonly count?: number | undefined;
        readonly error?: string | undefined;
      })
    | undefined;
  readonly onJumpToQuestion?: ((questionNumber: number) => void) | undefined;
  readonly onStartWeakQuestionDrill?: (() => void) | undefined;
  readonly onExitWeakQuestionDrill?: (() => void) | undefined;
}

export function ExamWebMcpStatusBar({
  courseCode,
  webMcpAvailable,
  draftedStepCount,
  totalWrittenSteps,
  paperScoreOn10,
  paperPassed = false,
  passedQuestionCount,
  totalQuestionCount,
  activeQuestionNumber,
  lastCoachedQuestionNumber,
  weakQuestionCount = 0,
  isDrillMode = false,
  copyFeedbackMessage,
  presentationCheckpoints = [],
  onCopyWholePaperPrompt,
  onImportWholePaperText,
  onJumpToQuestion,
  onStartWeakQuestionDrill,
  onExitWeakQuestionDrill,
}: ExamWebMcpStatusBarProps) {
  const { openGuide } = useWebMcpGuide();
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [batchRawText, setBatchRawText] = useState('');
  const [batchStatus, setBatchStatus] = useState<{
    readonly tone: 'success' | 'danger';
    readonly text: string;
  } | null>(null);

  const applyWholePaperRaw = (raw: string) => {
    if (!onImportWholePaperText) return;
    const res = onImportWholePaperText(raw);
    if (res.ok) {
      setBatchRawText('');
      setBatchImportOpen(false);
      setBatchStatus({
        tone: 'success',
        text: `Đã đồng bộ nhận xét từ ✨ Ask Gemini cho ${res.count ?? 1} ý tự luận trong đề!`,
      });
    } else {
      setBatchStatus({
        tone: 'danger',
        text: res.error ?? 'Chưa tìm thấy khối JSON hợp lệ trong câu trả lời.',
      });
    }
  };

  const handlePasteWholePaperFromClipboard = async () => {
    if (!onImportWholePaperText) return;
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setBatchImportOpen(true);
        setBatchStatus({
          tone: 'danger',
          text: 'Clipboard đang trống. Hãy sao chép câu trả lời kèm JSON của Gemini trước.',
        });
        return;
      }
      setBatchRawText(clip);
      applyWholePaperRaw(clip);
    } catch {
      setBatchImportOpen(true);
      setBatchStatus({
        tone: 'danger',
        text: 'Trình duyệt yêu cầu dán thủ công: nhấn Ctrl+V vào ô bên dưới rồi chọn Đồng bộ toàn đề.',
      });
    }
  };

  return (
    <div
      data-exam-webmcp-bar="true"
      className="space-y-2 rounded-[var(--radius-lg)] border border-accent/30 bg-accent-subtle/25 px-3.5 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <ClipboardCheckIcon width={15} height={15} className="shrink-0 text-accent" />
            <span className="font-semibold text-ink">
              Điều phối chấm trình bày WebMCP
            </span>
            <span className="font-mono text-[11px] tabular-nums text-ink-muted">
              ({draftedStepCount}/{totalWrittenSteps} tờ A4 đã viết)
            </span>
            {paperScoreOn10 !== null && paperScoreOn10 !== undefined ? (
              <span data-exam-live-score="true">
                <Badge tone={paperPassed ? 'success' : 'warning'} mono>
                  {paperPassed ? 'ĐẠT ĐỀ' : 'Điểm đề'}: {formatScoreVi(paperScoreOn10)}/10
                  {passedQuestionCount !== undefined && totalQuestionCount !== undefined
                    ? ` (${passedQuestionCount}/${totalQuestionCount} PASS)`
                    : ''}
                </Badge>
              </span>
            ) : null}
            {activeQuestionNumber !== undefined ? (
              <Badge tone="accent" mono>
                Đích đọc: Câu {activeQuestionNumber}
              </Badge>
            ) : null}
            {isDrillMode ? (
              <Badge tone="warning">Chế độ luyện lại câu cần sửa</Badge>
            ) : null}
          </div>

          {presentationCheckpoints.length > 0 ? (
            <p className="text-[11px] leading-relaxed text-ink-secondary">
              <strong className="font-semibold text-ink">Chuẩn {courseCode}:</strong>{' '}
              {presentationCheckpoints.join(' · ')}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {lastCoachedQuestionNumber && onJumpToQuestion ? (
            <button
              type="button"
              data-last-coached-jump="true"
              onClick={() => onJumpToQuestion(lastCoachedQuestionNumber)}
              className="hus-btn hus-btn-secondary min-h-[32px] border-accent/45 bg-surface px-2.5 py-1 text-xs text-accent-ink"
            >
              <span>Vừa chấm Câu {lastCoachedQuestionNumber}</span>
              <ArrowRightIcon width={12} height={12} />
            </button>
          ) : null}

          {!isDrillMode && weakQuestionCount > 0 && onStartWeakQuestionDrill ? (
            <button
              type="button"
              data-drill-weak-questions-btn="true"
              onClick={onStartWeakQuestionDrill}
              className="hus-btn hus-btn-secondary min-h-[32px] px-2.5 py-1 text-xs"
            >
              <RotateCcwIcon width={12} height={12} />
              <span>Luyện riêng {weakQuestionCount} câu cần sửa</span>
            </button>
          ) : null}

          {isDrillMode && onExitWeakQuestionDrill ? (
            <button
              type="button"
              onClick={onExitWeakQuestionDrill}
              className="hus-btn hus-btn-secondary min-h-[32px] px-2.5 py-1 text-xs"
            >
              <span>Quay lại toàn đề</span>
            </button>
          ) : null}

          <button
            type="button"
            data-whole-exam-webmcp-btn="true"
            disabled={draftedStepCount === 0}
            onClick={onCopyWholePaperPrompt}
            className="hus-btn hus-btn-primary min-h-[32px] px-3 py-1 text-xs"
          >
            {copyFeedbackMessage ? (
              <CheckIcon width={13} height={13} />
            ) : (
              <CopyIcon width={13} height={13} />
            )}
            <span>Nhờ WebMCP kiểm tra toàn đề</span>
          </button>

          {onImportWholePaperText ? (
            <button
              type="button"
              data-whole-exam-import-btn="true"
              onClick={() => void handlePasteWholePaperFromClipboard()}
              className={
                copyFeedbackMessage
                  ? 'hus-btn hus-btn-secondary min-h-[32px] border-accent/55 bg-surface px-2.5 py-1 text-xs font-semibold text-accent-ink'
                  : 'hus-btn hus-btn-secondary min-h-[32px] bg-surface px-2.5 py-1 text-xs'
              }
            >
              <span>Nhập toàn đề từ Gemini</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={openGuide}
            className="hus-btn hus-btn-secondary min-h-[32px] px-2.5 py-1 text-xs"
          >
            <BookOpenIcon width={13} height={13} />
            <span>Hướng dẫn</span>
          </button>
        </div>
      </div>

      {copyFeedbackMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="text-xs font-medium leading-relaxed text-accent-ink"
        >
          {copyFeedbackMessage}
        </p>
      ) : null}

      {batchStatus ? (
        <p
          role={batchStatus.tone === 'danger' ? 'alert' : 'status'}
          className={`text-xs font-medium leading-relaxed ${
            batchStatus.tone === 'danger' ? 'text-danger' : 'text-success'
          }`}
        >
          {batchStatus.text}
        </p>
      ) : null}

      {batchImportOpen && onImportWholePaperText ? (
        <div className="written-practice-reveal space-y-2 rounded-[var(--radius-md)] border border-border bg-surface p-3">
          <label
            htmlFor="whole-exam-gemini-import"
            className="block text-xs font-semibold text-ink"
          >
            Dán phản hồi chấm toàn đề từ ✨ Ask Gemini (có khối JSON `items` ở cuối)
          </label>
          <textarea
            id="whole-exam-gemini-import"
            value={batchRawText}
            onChange={e => setBatchRawText(e.target.value)}
            rows={4}
            placeholder='Dán toàn bộ câu trả lời hoặc khối ```json { "items": [...] } ``` vào đây…'
            className="written-practice-input font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!batchRawText.trim()}
              onClick={() => applyWholePaperRaw(batchRawText)}
              className="hus-btn hus-btn-primary text-xs"
            >
              Đồng bộ toàn đề
            </button>
            <button
              type="button"
              onClick={() => {
                setBatchImportOpen(false);
                setBatchStatus(null);
              }}
              className="hus-btn hus-btn-secondary text-xs"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      {!webMcpAvailable ? (
        <div
          data-exam-webmcp-fallback-hint="true"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-warning/35 bg-warning-subtle/50 px-3 py-1.5 text-[11px] text-ink-secondary"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <AlertCircleIcon width={13} height={13} className="shrink-0 text-warning" />
            <span>
              Chưa bật WebMCP 2 chiều (Chrome ≤ {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}) — bạn
              vẫn dùng được nút Sao chép &amp; «Nhập từ Gemini» trên từng câu, hoặc bật cờ để tự đồng
              bộ.
            </span>
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(WEBMCP_CHROME_FLAG_URL);
                  setCopiedFlag(true);
                  window.setTimeout(() => setCopiedFlag(false), 2500);
                } catch {
                  // Ignore clipboard restrictions
                }
              }}
              className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline"
            >
              {copiedFlag ? 'Đã chép cờ' : 'Chép cờ Chrome'}
            </button>
            <span aria-hidden="true" className="text-border-strong">·</span>
            <button
              type="button"
              onClick={openGuide}
              className="cursor-pointer font-medium text-accent-ink underline-offset-2 hover:underline"
            >
              Cách bật
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
