import { memo, useMemo, useRef, useState } from 'react';
import { useWebMcpActivity } from '../../app/useWebMcpActivity';
import type {
  CoachingHistoryEntry,
  CoachingPromptMode,
  GroundedEssayContextPacket,
  ReasoningScaffoldTemplate,
  StepCoachingLifecycleState,
  TutorCoachingFeedback,
  TutorCriterionStatus,
} from '../../domain/curriculum-tutor';
import type { WrittenReasoningStep } from '../../domain/semi-essay';
import { useWebMcpGuide } from '../../app/WebMcpGuideContext';
import { formatAskGeminiPromptPacket } from '../../core/learning/curriculum-rag';
import { formatScoreVi } from '../../core/learning/webmcp-essay-adapters';
import { WEBMCP_ORIGIN_TRIAL_INFO } from '../../infrastructure/ai/webmcp-essay-bridge';
import { Badge } from '../ui/Badge';
import { AlertCircleIcon, BookOpenIcon, CheckCircleIcon, CheckIcon, CopyIcon } from '../ui/Icons';
import { WEBMCP_CHROME_FLAG_URL } from '../ui/WebMcpNoticeToast';
import Markdown from './Markdown';

export const CRITERION_STATUS_META: Readonly<
  Record<TutorCriterionStatus, { readonly label: string; readonly tone: 'success' | 'warning' | 'neutral' }>
> = {
  met: { label: 'Đạt ý', tone: 'success' },
  partial: { label: 'Cần làm rõ', tone: 'warning' },
  missing: { label: 'Chưa nêu', tone: 'neutral' },
};

export interface EssayWebMcpCoachPanelProps {
  readonly stepId: string;
  readonly rubric: WrittenReasoningStep['rubric'];
  readonly hasDraft: boolean;
  readonly modelRevealed?: boolean | undefined;
  readonly webMcpAvailable?: boolean | undefined;
  readonly variant?: 'full' | 'exam-sheet' | undefined;
  readonly lifecycleState?: StepCoachingLifecycleState | undefined;
  readonly scaffolds?: readonly ReasoningScaffoldTemplate[] | undefined;
  readonly onInsertScaffold?: ((scaffold: ReasoningScaffoldTemplate) => void) | undefined;
  readonly emphasizePresentationCheck?: boolean | undefined;
  readonly hideRubricPrompts?: boolean | undefined;
  readonly isActiveTarget?: boolean | undefined;
  readonly onActivateTarget?: (() => void) | undefined;
  readonly coachingFeedback?: TutorCoachingFeedback | undefined;
  readonly coachingHistory?: readonly CoachingHistoryEntry[] | undefined;
  readonly getGroundedPacket: (mode: CoachingPromptMode) => GroundedEssayContextPacket;
  readonly onImportFeedbackText?:
    | ((rawText: string) => { readonly ok: boolean; readonly error?: string | undefined })
    | undefined;
  readonly onClearFeedback?: (() => void) | undefined;
}

function areCoachPanelPropsEqual(
  prev: EssayWebMcpCoachPanelProps,
  next: EssayWebMcpCoachPanelProps,
): boolean {
  return (
    prev.stepId === next.stepId &&
    prev.rubric === next.rubric &&
    prev.hasDraft === next.hasDraft &&
    prev.modelRevealed === next.modelRevealed &&
    prev.webMcpAvailable === next.webMcpAvailable &&
    prev.variant === next.variant &&
    prev.lifecycleState === next.lifecycleState &&
    prev.scaffolds === next.scaffolds &&
    prev.emphasizePresentationCheck === next.emphasizePresentationCheck &&
    prev.hideRubricPrompts === next.hideRubricPrompts &&
    prev.isActiveTarget === next.isActiveTarget &&
    prev.coachingFeedback === next.coachingFeedback &&
    prev.coachingHistory === next.coachingHistory &&
    Boolean(prev.onInsertScaffold) === Boolean(next.onInsertScaffold) &&
    Boolean(prev.onImportFeedbackText) === Boolean(next.onImportFeedbackText) &&
    Boolean(prev.onClearFeedback) === Boolean(next.onClearFeedback)
  );
}

export const EssayWebMcpCoachPanel = memo(function EssayWebMcpCoachPanel({
  stepId,
  rubric,
  hasDraft,
  modelRevealed = false,
  webMcpAvailable = false,
  variant = 'full',
  lifecycleState,
  scaffolds,
  onInsertScaffold,
  emphasizePresentationCheck = false,
  hideRubricPrompts = false,
  isActiveTarget,
  onActivateTarget,
  coachingFeedback,
  coachingHistory,
  getGroundedPacket,
  onImportFeedbackText,
  onClearFeedback,
}: EssayWebMcpCoachPanelProps) {
  const { openGuide } = useWebMcpGuide();
  const webMcpActivity = useWebMcpActivity();
  const isExamSheet = variant === 'exam-sheet';
  const callbacksRef = useRef({
    onActivateTarget,
    onInsertScaffold,
    getGroundedPacket,
    onImportFeedbackText,
    onClearFeedback,
  });
  callbacksRef.current = {
    onActivateTarget,
    onInsertScaffold,
    getGroundedPacket,
    onImportFeedbackText,
    onClearFeedback,
  };

  const [copyStatus, setCopyStatus] = useState<{
    readonly mode: CoachingPromptMode;
    readonly message: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedWebMcpFlag, setCopiedWebMcpFlag] = useState(false);

  const handleCopyPrompt = async (mode: CoachingPromptMode) => {
    callbacksRef.current.onActivateTarget?.();
    const packet = callbacksRef.current.getGroundedPacket(mode);
    const promptText = formatAskGeminiPromptPacket(packet, { webMcpAvailable });
    try {
      await navigator.clipboard.writeText(promptText);
      setCopyStatus({
        mode,
        message: webMcpAvailable
          ? 'Đã chép Prompt Kép! Dán vào thanh bên ✨ Ask Gemini — nếu thanh bên trả lời kèm JSON (không tự đẩy WebMCP), bấm Sao chép câu trả lời rồi nhấn «Nhập từ Gemini» để đồng bộ 1-click lên giấy A4.'
          : 'Đã chép Prompt Kép! Dán vào thanh bên ✨ Ask Gemini, sao chép câu trả lời của Gemini rồi nhấn «Nhập từ Gemini» để hiện ngay lên giấy A4.',
      });
    } catch {
      setCopyStatus({
        mode,
        message: 'Không truy cập được Clipboard tự động. Mở mục ngữ cảnh bên dưới để sao chép thủ công.',
      });
    }
  };

  const handleApplyImportedText = (raw: string) => {
    const importFn = callbacksRef.current.onImportFeedbackText;
    if (!importFn) return;
    callbacksRef.current.onActivateTarget?.();
    const res = importFn(raw);
    if (res.ok) {
      setImportError(null);
      setImportRawText('');
      setImportOpen(false);
      setCopyStatus({
        mode: copyStatus?.mode ?? 'presentation-review',
        message: 'Đã đồng bộ kết quả chấm, trạng thái PASS / CHƯA PASS & Rubric từ ✨ Ask Gemini lên giấy A4.',
      });
    } else {
      setImportError(res.error ?? 'Dữ liệu JSON chưa đúng định dạng.');
    }
  };

  const handlePasteFromClipboard = async () => {
    callbacksRef.current.onActivateTarget?.();
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setImportError(
          'Bộ nhớ tạm (Clipboard) đang trống. Hãy sao chép câu trả lời của Gemini trước.',
        );
        setImportOpen(true);
        return;
      }
      setImportRawText(clip);
      handleApplyImportedText(clip);
    } catch {
      setImportOpen(true);
      setImportError(
        'Trình duyệt yêu cầu dán thủ công: hãy nhấn Ctrl+V vào ô bên dưới rồi chọn Áp dụng.',
      );
    }
  };

  const liveGroundedPreview = useMemo(
    () => (isExamSheet ? null : callbacksRef.current.getGroundedPacket('socratic-hint')),
    // Recompute static syllabus preview only when step, variant, or reveal state changes
    [stepId, modelRevealed, isExamSheet],
  );

  const primaryScaffold = scaffolds?.[0];
  const presentationButtonLabel =
    lifecycleState === 'revised-pending-recheck'
      ? 'Chấm lại bản sửa'
      : 'Chấm điểm & trình bày';

  const scoreLabel =
    coachingFeedback && typeof coachingFeedback.score === 'number'
      ? `${formatScoreVi(coachingFeedback.score)}/${coachingFeedback.maxScore ?? 10}`
      : null;

  return (
    <section
      data-essay-webmcp-panel={stepId}
      aria-labelledby={`${stepId}-socratic-tutor-heading`}
      onClick={() => callbacksRef.current.onActivateTarget?.()}
      className={
        isExamSheet
          ? 'space-y-2 rounded-[var(--radius-md)] border border-border/85 bg-surface-subtle/40 px-3 py-2'
          : 'space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/50 px-3.5 py-3'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 id={`${stepId}-socratic-tutor-heading`} className="text-xs font-semibold text-ink">
            {isExamSheet ? 'Chấm điểm & gợi mở (Gemini)' : 'Trợ giảng & Chấm điểm (Gemini)'}
          </h3>
          {!isExamSheet ? (
            <Badge tone={webMcpAvailable ? 'success' : 'warning'}>
              {webMcpAvailable ? 'WebMCP 2 chiều sẵn sàng' : 'Chưa bật WebMCP'}
            </Badge>
          ) : null}
          {coachingFeedback?.verdict === 'pass' ? (
            <span data-tutor-verdict="pass">
              <Badge tone="success" mono>
                PASS{scoreLabel ? ` · ${scoreLabel} điểm` : ''}
              </Badge>
            </span>
          ) : coachingFeedback?.verdict === 'not-pass' ? (
            <span data-tutor-verdict="not-pass">
              <Badge tone="danger" mono>
                CHƯA PASS{scoreLabel ? ` · ${scoreLabel} điểm` : ''}
              </Badge>
            </span>
          ) : lifecycleState === 'verified' ? (
            <Badge tone="success">Đạt chuẩn trình bày</Badge>
          ) : null}
          {lifecycleState === 'revised-pending-recheck' ? (
            <Badge tone="warning">Đã sửa · Chờ chấm lại</Badge>
          ) : coachingFeedback?.verdict !== 'not-pass' && lifecycleState === 'needs-revision' ? (
            <Badge tone="warning">Cần bổ sung ý / ký hiệu</Badge>
          ) : null}
          {isActiveTarget ? <Badge tone="accent">Đang chọn</Badge> : null}
          {webMcpActivity.labelVi && (isActiveTarget || !isExamSheet) ? (
            <span data-webmcp-live-activity="true">
              <Badge tone="accent">{webMcpActivity.labelVi}</Badge>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!hasDraft && primaryScaffold && onInsertScaffold ? (
            <button
              type="button"
              onClick={() => {
                callbacksRef.current.onActivateTarget?.();
                callbacksRef.current.onInsertScaffold?.(primaryScaffold);
              }}
              title={primaryScaffold.description}
              className="hus-btn hus-btn-secondary min-h-[30px] px-2.5 py-1 text-xs"
            >
              <span>+ Khung sườn</span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={!hasDraft}
            onClick={() => void handleCopyPrompt('presentation-review')}
            className={
              emphasizePresentationCheck && hasDraft
                ? 'hus-btn hus-btn-primary min-h-[30px] px-2.5 py-1 text-xs'
                : 'hus-btn hus-btn-secondary min-h-[30px] px-2.5 py-1 text-xs'
            }
          >
            {copyStatus?.mode === 'presentation-review' ? (
              <CheckIcon
                width={13}
                height={13}
                className={emphasizePresentationCheck && hasDraft ? '' : 'text-success'}
              />
            ) : (
              <CopyIcon width={13} height={13} />
            )}
            <span>{presentationButtonLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyPrompt('socratic-hint')}
            className={
              !hasDraft && isExamSheet
                ? 'hus-btn hus-btn-primary min-h-[30px] px-2.5 py-1 text-xs'
                : 'hus-btn hus-btn-secondary min-h-[30px] px-2.5 py-1 text-xs'
            }
          >
            {copyStatus?.mode === 'socratic-hint' ? (
              <CheckIcon
                width={13}
                height={13}
                className={!hasDraft && isExamSheet ? '' : 'text-success'}
              />
            ) : (
              <CopyIcon width={13} height={13} />
            )}
            <span>{!hasDraft && isExamSheet ? 'Gợi mở hướng đi' : 'Gợi mở Socratic'}</span>
          </button>

          {onImportFeedbackText ? (
            <button
              type="button"
              data-import-gemini-clipboard-btn="true"
              onClick={() => void handlePasteFromClipboard()}
              className={
                copyStatus && !coachingFeedback
                  ? 'hus-btn hus-btn-secondary min-h-[30px] border-accent/55 bg-accent-subtle/35 px-2.5 py-1 text-xs font-semibold text-accent-ink'
                  : 'hus-btn hus-btn-secondary min-h-[30px] px-2.5 py-1 text-xs'
              }
            >
              Nhập từ Gemini
            </button>
          ) : null}

          {onImportFeedbackText ? (
            <button
              type="button"
              aria-expanded={importOpen}
              onClick={() => {
                callbacksRef.current.onActivateTarget?.();
                setImportOpen(v => !v);
                setImportError(null);
              }}
              className="min-h-[30px] cursor-pointer rounded-[var(--radius-sm)] px-2 text-xs font-medium text-ink-secondary hover:text-ink hover:underline"
            >
              {importOpen ? 'Đóng ô dán' : isExamSheet ? 'Dán JSON' : 'Dán JSON thủ công'}
            </button>
          ) : null}

          {!isExamSheet ? (
            <button
              type="button"
              onClick={openGuide}
              title="Hướng dẫn dùng WebMCP & Gói AI"
              className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-xs text-ink-secondary transition-colors hover:border-accent hover:text-accent-ink"
            >
              <BookOpenIcon width={13} height={13} />
              <span className="hidden sm:inline">Hướng dẫn</span>
            </button>
          ) : null}
        </div>
      </div>

      {!webMcpAvailable && !isExamSheet ? (
        <div
          data-webmcp-missing-inline="true"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-warning/35 bg-warning-subtle/55 px-3 py-1.5 text-[11px] leading-relaxed text-ink-secondary"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <AlertCircleIcon width={13} height={13} className="shrink-0 text-warning" />
            <span>
              <strong className="font-semibold text-warning">
                Không kích hoạt WebMCP sẽ thiếu tính năng:
              </strong>{' '}
              chưa tự đồng bộ 2 chiều (Chrome ≤ {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone}).
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(WEBMCP_CHROME_FLAG_URL);
                  setCopiedWebMcpFlag(true);
                  window.setTimeout(() => setCopiedWebMcpFlag(false), 2500);
                } catch {
                  // Ignore clipboard errors silently
                }
              }}
              className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline"
            >
              {copiedWebMcpFlag ? 'Đã chép cờ' : 'Chép cờ Chrome'}
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

      {copyStatus ? (
        <p role="status" aria-live="polite" className="text-xs leading-relaxed text-accent-ink">
          {copyStatus.message}
        </p>
      ) : null}

      {importOpen && onImportFeedbackText ? (
        <div className="written-practice-reveal space-y-2 rounded-[var(--radius-md)] border border-border bg-surface p-3">
          <label
            htmlFor={`${stepId}-gemini-import`}
            className="block text-xs font-semibold text-ink"
          >
            Dán câu trả lời của Gemini (có chứa khối JSON ở cuối)
          </label>
          <textarea
            id={`${stepId}-gemini-import`}
            value={importRawText}
            onChange={e => setImportRawText(e.target.value)}
            rows={4}
            placeholder='Dán toàn bộ phản hồi hoặc khối ```json { "stepId": ... } ``` từ Gemini vào đây…'
            className="written-practice-input font-mono text-xs"
          />
          {importError ? (
            <p role="alert" className="text-xs text-danger">
              {importError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!importRawText.trim()}
              onClick={() => handleApplyImportedText(importRawText)}
              className="hus-btn hus-btn-primary text-xs"
            >
              Áp dụng phản hồi vào bài làm
            </button>
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportError(null);
              }}
              className="hus-btn hus-btn-secondary text-xs"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      {/* Coaching Feedback Card (populated automatically by WebMCP or via JSON import) */}
      {coachingFeedback ? (
        <div
          data-tutor-coaching-card="true"
          role="region"
          aria-label="Nhận xét từ trợ giảng Gemini"
          className="written-practice-reveal space-y-3 rounded-[var(--radius-md)] border border-accent/40 bg-surface p-4 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircleIcon
                width={16}
                height={16}
                className={
                  coachingFeedback.verdict === 'pass'
                    ? 'text-success'
                    : coachingFeedback.verdict === 'not-pass'
                      ? 'text-danger'
                      : 'text-accent'
                }
              />
              <span className="font-semibold text-ink">
                {coachingFeedback.verdict
                  ? 'Kết quả chấm điểm & đối chiếu ĐHKHTN'
                  : 'Gợi ý hướng dẫn bám giáo trình'}
              </span>
              {coachingFeedback.verdict === 'pass' ? (
                <Badge tone="success" mono>
                  ĐẠT (PASS){scoreLabel ? ` · ${scoreLabel}` : ''}
                </Badge>
              ) : coachingFeedback.verdict === 'not-pass' ? (
                <Badge tone="danger" mono>
                  CHƯA ĐẠT{scoreLabel ? ` · ${scoreLabel}` : ''}
                </Badge>
              ) : null}
              <Badge tone="accent">
                {coachingFeedback.source === 'webmcp' ? 'Truyền qua WebMCP' : 'Đồng bộ từ Gemini'}
              </Badge>
            </div>
            {onClearFeedback ? (
              <button
                type="button"
                onClick={() => callbacksRef.current.onClearFeedback?.()}
                className="text-xs text-ink-muted hover:text-ink hover:underline"
              >
                Xóa gợi ý
              </button>
            ) : null}
          </div>

          {coachingFeedback.verdict === 'not-pass' ? (
            <p className="!my-0 rounded-[var(--radius-sm)] border border-danger/35 bg-danger-subtle/50 px-3 py-1.5 text-xs text-ink">
              <strong className="font-semibold text-danger">Chưa qua ngưỡng Mức 1 (≥ 7,0/10 &amp; đủ ý bắt buộc):</strong>{' '}
              Hãy bổ sung các ý còn thiếu trên tờ giấy A4 rồi bấm <strong>«Chấm lại bản sửa»</strong>.
            </p>
          ) : coachingFeedback.verdict === 'pass' ? (
            <p className="!my-0 rounded-[var(--radius-sm)] border border-success/35 bg-success-subtle/50 px-3 py-1.5 text-xs text-ink">
              <strong className="font-semibold text-success">Đã vượt qua câu hỏi (Mức 1 ≥ 7,0/10):</strong>{' '}
              Hệ thống đã tự động ghi nhận hoàn thành câu hỏi này vào tiến độ học tập của bạn.
            </p>
          ) : null}

          <div className="leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
            <Markdown>{coachingFeedback.summary}</Markdown>
          </div>

          {coachingHistory && coachingHistory.length >= 2 ? (
            <div
              data-coaching-history-timeline="true"
              className="space-y-1.5 rounded-[var(--radius-sm)] border border-border/80 bg-canvas/65 px-3 py-2 text-xs"
            >
              <p className="!my-0 font-semibold text-ink">
                Tiến trình sửa bài ({coachingHistory.length} lần chấm):
              </p>
              <ol className="!my-0 flex flex-wrap items-center gap-2 !list-none !pl-0">
                {coachingHistory.map((entry, idx) => (
                  <li
                    key={`${entry.receivedAt}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink-secondary"
                    title={entry.summary}
                  >
                    <span className="font-semibold text-ink">Lần {idx + 1}:</span>
                    {typeof entry.score === 'number' ? (
                      <span>{formatScoreVi(entry.score)}/10</span>
                    ) : (
                      <span>Đã gợi mở</span>
                    )}
                    {entry.verdict === 'pass' ? (
                      <span className="font-semibold text-success">· PASS</span>
                    ) : entry.verdict === 'not-pass' ? (
                      <span className="text-danger">· Chưa đạt</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {coachingFeedback.conventionWarnings.length > 0 ? (
            <div className="space-y-1 rounded-[var(--radius-sm)] border border-warning/40 bg-warning-subtle/70 px-3 py-2.5 text-xs text-ink">
              <div className="flex items-center gap-1.5 font-semibold text-warning">
                <AlertCircleIcon width={14} height={14} />
                <span>Lưu ý điều kiện &amp; ký hiệu giáo trình ĐHKHTN:</span>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-ink-secondary">
                {coachingFeedback.conventionWarnings.map((warn, idx) => (
                  <li key={idx}>
                    <Markdown inline>{warn}</Markdown>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {coachingFeedback.socraticQuestions.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-ink">Câu hỏi gợi mở bước tiếp theo:</p>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-secondary">
                {coachingFeedback.socraticQuestions.map((q, idx) => (
                  <li key={idx}>
                    <Markdown inline>{q}</Markdown>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {coachingFeedback.criterionFeedback.length > 0 ? (
            <div className="space-y-1.5 border-t border-border pt-2.5">
              <p className="text-xs font-semibold text-ink">Nhận xét theo từng tiêu chí:</p>
              <ul className="space-y-1.5 text-xs">
                {coachingFeedback.criterionFeedback.map(cf => {
                  const meta = CRITERION_STATUS_META[cf.status];
                  const criterionObj = rubric.find(r => r.id === cf.criterionId);
                  return (
                    <li
                      key={cf.criterionId}
                      className="flex flex-wrap items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-canvas/65 px-3 py-2"
                    >
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {criterionObj && !hideRubricPrompts ? (
                          <p className="font-medium text-ink">
                            <Markdown inline>{criterionObj.prompt}</Markdown>
                          </p>
                        ) : null}
                        <div className="text-ink-secondary">
                          <Markdown inline>{cf.comment}</Markdown>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {coachingFeedback.citedSections.length > 0 ? (
            <p className="text-[11px] text-ink-muted">
              Nguồn giáo trình đối chiếu: {coachingFeedback.citedSections.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Semantic Context Disclosure readable by Chrome Ask Gemini Accessibility Tree (single-essay mode) */}
      {liveGroundedPreview ? (
        <details className="rounded-[var(--radius-md)] border border-border/75 bg-canvas/55 px-3 py-1.5 text-xs">
          <summary className="cursor-pointer font-medium text-ink-muted select-none hover:text-ink">
            Ngữ cảnh giáo trình &amp; Rà soát Rubric ({liveGroundedPreview.course.code} ·{' '}
            {liveGroundedPreview.groundedExcerpts.length} trích đoạn)
          </summary>
          <div className="mt-2 space-y-2 border-t border-border pt-2 text-ink-secondary">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="!my-0">
                <strong className="text-ink">Phạm vi:</strong>{' '}
                {liveGroundedPreview.syllabusHorizon.currentLesson} (
                {liveGroundedPreview.syllabusHorizon.currentChapter})
              </p>
              <button
                type="button"
                disabled={!hasDraft}
                onClick={() => void handleCopyPrompt('rubric-review')}
                className="hus-btn hus-btn-secondary min-h-[28px] px-2.5 py-0.5 text-[11px]"
              >
                {copyStatus?.mode === 'rubric-review' ? (
                  <CheckIcon width={12} height={12} className="text-success" />
                ) : (
                  <CopyIcon width={12} height={12} />
                )}
                <span>Sao chép lệnh Rà soát Rubric</span>
              </button>
            </div>
            {liveGroundedPreview.syllabusHorizon.unlearnedChaptersDoNotUse.length > 0 ? (
              <p className="!my-0">
                <strong className="text-ink">Chặn vượt chương:</strong>{' '}
                {liveGroundedPreview.syllabusHorizon.unlearnedChaptersDoNotUse.join('; ')}
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-4">
              {liveGroundedPreview.course.notationRules.map((rule, idx) => (
                <li key={idx}>
                  <Markdown inline>{rule}</Markdown>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </section>
  );
}, areCoachPanelPropsEqual);
