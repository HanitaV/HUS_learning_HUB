import { useMemo, useState } from 'react';
import type {
  CoachingPromptMode,
  GroundedEssayContextPacket,
  ReasoningScaffoldTemplate,
  TutorCoachingFeedback,
  TutorCriterionStatus,
} from '../../domain/curriculum-tutor';
import type { MathSymbolContext } from '../../domain/math-symbols';
import type { WrittenReasoningStep, WrittenStepDraft } from '../../domain/semi-essay';
import { useMathSymbolPreferences } from '../../app/useMathSymbolPreferences';
import { useWebMcpGuide } from '../../app/WebMcpGuideContext';
import { formatAskGeminiPromptPacket } from '../../core/learning/curriculum-rag';
import { renderTextByMathMode } from '../../core/learning/math-shorthand';
import { evaluateWrittenReasoningReview } from '../../core/learning/semi-essay';
import { WEBMCP_ORIGIN_TRIAL_INFO } from '../../infrastructure/ai/webmcp-essay-bridge';
import { Badge } from '../ui/Badge';
import { AlertCircleIcon, BookOpenIcon, CheckCircleIcon, CheckIcon, CopyIcon } from '../ui/Icons';
import { WEBMCP_CHROME_FLAG_URL } from '../ui/WebMcpNoticeToast';
import Markdown from './Markdown';
import { RuledA4Sheet } from './RuledA4Sheet';

const CRITERION_STATUS_META: Record<
  TutorCriterionStatus,
  { readonly label: string; readonly tone: 'success' | 'warning' | 'neutral' }
> = {
  met: { label: 'Đạt ý', tone: 'success' },
  partial: { label: 'Cần làm rõ', tone: 'warning' },
  missing: { label: 'Chưa nêu', tone: 'neutral' },
};

export interface WrittenReasoningStepViewProps {
  readonly step: WrittenReasoningStep;
  readonly draft: WrittenStepDraft;
  readonly symbolContext?: MathSymbolContext | undefined;
  readonly scaffolds?: readonly ReasoningScaffoldTemplate[] | undefined;
  readonly webMcpAvailable?: boolean | undefined;
  readonly coachingFeedback?: TutorCoachingFeedback | undefined;
  readonly getGroundedPacket?: ((mode: CoachingPromptMode) => GroundedEssayContextPacket) | undefined;
  readonly onImportFeedbackText?:
    | ((rawText: string) => { readonly ok: boolean; readonly error?: string | undefined })
    | undefined;
  readonly onClearFeedback?: (() => void) | undefined;
  readonly update: (changes: Partial<WrittenStepDraft>) => void;
  readonly onReviewed: () => void;
}

export function WrittenReasoningStepView({
  step,
  draft,
  symbolContext,
  scaffolds,
  webMcpAvailable = false,
  coachingFeedback,
  getGroundedPacket,
  onImportFeedbackText,
  onClearFeedback,
  update,
  onReviewed,
}: WrittenReasoningStepViewProps) {
  const { preferences } = useMathSymbolPreferences();
  const { openGuide } = useWebMcpGuide();
  const activeMathMode = preferences.insertMode;

  const [hintCount, setHintCount] = useState(0);
  const [showKeyOrientation, setShowKeyOrientation] = useState(false);
  const [copyStatus, setCopyStatus] = useState<{
    readonly mode: CoachingPromptMode;
    readonly message: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedWebMcpFlag, setCopiedWebMcpFlag] = useState(false);

  const handleInsertScaffold = (scaffold: ReasoningScaffoldTemplate) => {
    const current = draft.response.trim();
    const nextValue = current ? `${draft.response.trimEnd()}\n\n${scaffold.template}` : scaffold.template;
    update({ response: nextValue });
    requestAnimationFrame(() => {
      document.getElementById(`${step.id}-response`)?.focus();
    });
  };

  const handleCopyPrompt = async (mode: CoachingPromptMode) => {
    if (!getGroundedPacket) return;
    const packet = getGroundedPacket(mode);
    const promptText = formatAskGeminiPromptPacket(packet, { webMcpAvailable });
    try {
      await navigator.clipboard.writeText(promptText);
      setCopyStatus({
        mode,
        message: webMcpAvailable
          ? 'Đã sao chép lệnh ngắn! Mở ✨ Ask Gemini trên góc phải Chrome và dán lệnh — Gemini sẽ tự gọi WebMCP đọc giáo trình & truyền gợi ý về khung này.'
          : 'Đã sao chép gói giáo trình ĐHKHTN & bài nháp! Mở ✨ Ask Gemini ở thanh bên Chrome, dán vào, rồi bấm «Nhập phản hồi từ Gemini» để hiển thị nhận xét tại đây.',
      });
    } catch {
      setCopyStatus({
        mode,
        message: 'Không truy cập được Clipboard tự động. Bạn có thể mở phần ngữ cảnh giáo trình bên dưới để sao chép thủ công.',
      });
    }
  };

  const handleApplyImportedText = (raw: string) => {
    if (!onImportFeedbackText) return;
    const res = onImportFeedbackText(raw);
    if (res.ok) {
      setImportError(null);
      setImportRawText('');
      setImportOpen(false);
    } else {
      setImportError(res.error ?? 'Dữ liệu JSON chưa đúng định dạng.');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setImportError('Bộ nhớ tạm (Clipboard) đang trống. Hãy sao chép câu trả lời của Gemini trước.');
        setImportOpen(true);
        return;
      }
      setImportRawText(clip);
      handleApplyImportedText(clip);
    } catch {
      setImportOpen(true);
      setImportError('Trình duyệt yêu cầu dán thủ công: hãy nhấn Ctrl+V vào ô bên dưới rồi chọn Áp dụng.');
    }
  };

  const review = evaluateWrittenReasoningReview(step, draft);
  const hints = [...(step.hint ? [step.hint] : []), ...(step.hints ?? [])];
  const stage = review.complete
    ? 4
    : draft.revision.trim()
      ? 3
      : draft.modelRevealed
        ? 2
        : draft.response.trim()
          ? 1
          : 0;
  const stages = ['Viết nháp', 'Đối chiếu', 'Sửa bài', 'Tự rà soát'];

  const criterionFeedbackById = new Map(
    (coachingFeedback?.criterionFeedback ?? []).map(item => [item.criterionId, item]),
  );

  const liveGroundedPreview = useMemo(
    () => (getGroundedPacket ? getGroundedPacket('socratic-hint') : null),
    // Recompute static syllabus preview only when step or reveal state changes; copy buttons pull live draft on click
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Boolean(getGroundedPacket), step.id, draft.modelRevealed],
  );

  return (
    <div className="written-practice space-y-4">
      <div aria-label="Các giai đoạn tự viết và đối chiếu">
        <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
          {stages.map((label, index) => (
            <li
              key={label}
              aria-current={Math.min(stage, 3) === index ? 'step' : undefined}
              className={index < stage ? 'font-semibold text-accent' : 'text-ink-muted'}
            >
              {label}
            </li>
          ))}
        </ol>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true">
          <div
            className="written-practice-progress h-full bg-accent-solid"
            style={{ width: `${stage * 25}%` }}
          />
        </div>
        <span className="sr-only">Đã thực hiện {stage} trên 4 giai đoạn</span>
      </div>

      <p className="text-sm text-ink-secondary">
        Viết cách lập luận của bạn trước khi xem lời giải tham khảo. Nội dung viết không được chấm tự động.
      </p>

      {/* Optional Reasoning Scaffolds to overcome blank-page paralysis */}
      {scaffolds && scaffolds.length > 0 && !draft.modelRevealed ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/65 px-3 py-2">
          <span className="text-xs font-medium text-ink-secondary">Khung sườn gợi mở:</span>
          {scaffolds.map(scaffold => (
            <button
              key={scaffold.id}
              type="button"
              onClick={() => handleInsertScaffold(scaffold)}
              title={scaffold.description}
              className="min-h-[30px] cursor-pointer rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              + {scaffold.label}
            </button>
          ))}
        </div>
      ) : null}

      <RuledA4Sheet
        id={`${step.id}-response`}
        label="Lập luận của bạn"
        sheetTag="Giấy A4 · Bản nháp"
        value={draft.response}
        onChange={val => update({ response: val })}
        symbolContext={symbolContext}
        toolbarLabel="Bảng chèn ký hiệu toán học cho lập luận"
        previewKey="response"
      />

      {/* Hints & Pre-Reveal Orientation Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {hints.length > 0 ? (
          <button
            type="button"
            className="hus-btn hus-btn-secondary"
            disabled={hintCount >= hints.length}
            onClick={() => setHintCount(count => count + 1)}
          >
            Xem gợi ý tiếp theo ({hintCount}/{hints.length})
          </button>
        ) : null}
        {!draft.modelRevealed && step.rubric.length > 0 ? (
          <button
            type="button"
            aria-expanded={showKeyOrientation}
            onClick={() => setShowKeyOrientation(v => !v)}
            className="hus-btn hus-btn-secondary"
          >
            {showKeyOrientation ? 'Ẩn trọng tâm cần nêu' : 'Xem trọng tâm cần nêu'}
          </button>
        ) : null}
      </div>

      {hints.slice(0, hintCount).map((hint, index) => (
        <div
          key={index}
          className="written-practice-reveal rounded-[var(--radius-md)] border border-border bg-surface-subtle p-3 text-sm text-ink-secondary"
        >
          <Markdown>{hint}</Markdown>
        </div>
      ))}

      {!draft.modelRevealed && showKeyOrientation ? (
        <div className="written-practice-reveal space-y-2 rounded-[var(--radius-md)] border border-accent/35 bg-accent-subtle/30 p-3.5 text-xs">
          <p className="font-semibold text-ink">
            Các ý cốt lõi cần có trong bài viết trước khi mở lời giải:
          </p>
          <ul className="list-disc space-y-1 pl-4 text-ink-secondary">
            {step.rubric.map(item => (
              <li key={item.id}>{item.prompt}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Curriculum-Grounded Gemini / WebMCP Socratic Tutor Panel */}
      {getGroundedPacket ? (
        <section
          aria-labelledby={`${step.id}-socratic-tutor-heading`}
          className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/55 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id={`${step.id}-socratic-tutor-heading`}
                className="text-sm font-semibold text-ink"
              >
                Trợ giảng Socratic bám giáo trình (Gemini in Chrome)
              </h3>
              <Badge tone={webMcpAvailable ? 'success' : 'warning'}>
                {webMcpAvailable
                  ? 'WebMCP 2 chiều sẵn sàng'
                  : 'Chưa bật WebMCP · Thiếu tính năng tự động'}
              </Badge>
            </div>
            <button
              type="button"
              onClick={openGuide}
              className="inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-accent-ink transition-colors hover:border-accent hover:bg-accent-subtle"
            >
              <BookOpenIcon width={13} height={13} />
              <span>Hướng dẫn WebMCP &amp; Gói AI</span>
            </button>
          </div>

          {!webMcpAvailable ? (
            <div
              data-webmcp-missing-inline="true"
              className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-warning/40 bg-warning-subtle/65 px-3.5 py-2.5 text-xs leading-relaxed text-ink sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2">
                <AlertCircleIcon width={15} height={15} className="mt-0.5 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="!my-0">
                    <strong className="font-semibold text-warning">
                      Không kích hoạt WebMCP sẽ thiếu tính năng:
                    </strong>{' '}
                    Gemini in Chrome chưa thể tự đọc bài nháp, tra cứu giáo trình ĐHKHTN theo thời
                    gian thực hay tự điền nhận xét rubric 2 chiều (phải sao chép &amp; dán JSON thủ
                    công).
                  </p>
                  <p className="!my-0 text-[11px] text-ink-secondary">
                    <strong className="text-ink">
                      Bắt buộc bật cờ nếu WebMCP không hoạt động mặc định
                    </strong>{' '}
                    (Origin Trial hỗ trợ đến Chrome {WEBMCP_ORIGIN_TRIAL_INFO.maxChromeMilestone},
                    muộn nhất {WEBMCP_ORIGIN_TRIAL_INFO.expiryDisplayVi}): mở{' '}
                    <code className="font-mono text-ink">{WEBMCP_CHROME_FLAG_URL}</code> trên Google
                    Chrome → chọn <strong className="text-ink">Enabled</strong> → nhấn{' '}
                    <strong className="text-ink">Relaunch</strong>.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
                  className="hus-btn hus-btn-secondary min-h-[32px] px-2.5 py-1 text-xs"
                >
                  {copiedWebMcpFlag ? (
                    <CheckIcon width={13} height={13} className="text-success" />
                  ) : (
                    <CopyIcon width={13} height={13} />
                  )}
                  <span>{copiedWebMcpFlag ? 'Đã chép cờ' : 'Sao chép cờ WebMCP'}</span>
                </button>
                <button
                  type="button"
                  onClick={openGuide}
                  className="hus-btn hus-btn-secondary min-h-[32px] px-2.5 py-1 text-xs"
                >
                  Hướng dẫn kích hoạt
                </button>
              </div>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-ink-secondary">
            {webMcpAvailable
              ? 'Trình duyệt đã bật WebMCP: mở ✨ Ask Gemini bên cạnh để trợ giảng tự đọc trích đoạn giáo trình ĐHKHTN, kiểm tra phạm vi chương và bắn gợi ý thẳng về khung bài làm.'
              : 'Chế độ dự phòng (khi tắt WebMCP): đóng gói trích đoạn giáo trình chuẩn ĐHKHTN, quy ước ký hiệu học phần và rào chắn chống vượt chương để sao chép sang ✨ Ask Gemini rồi dán phản hồi ngược về trang.'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyPrompt('socratic-hint')}
              className="hus-btn hus-btn-secondary text-xs"
            >
              {copyStatus?.mode === 'socratic-hint' ? (
                <CheckIcon width={14} height={14} className="text-success" />
              ) : (
                <CopyIcon width={14} height={14} />
              )}
              <span>Sao chép lệnh Gợi mở Socratic</span>
            </button>

            <button
              type="button"
              disabled={!draft.response.trim()}
              onClick={() => void handleCopyPrompt('rubric-review')}
              className="hus-btn hus-btn-secondary text-xs"
            >
              {copyStatus?.mode === 'rubric-review' ? (
                <CheckIcon width={14} height={14} className="text-success" />
              ) : (
                <CopyIcon width={14} height={14} />
              )}
              <span>Sao chép lệnh Rà soát theo Rubric</span>
            </button>

            {onImportFeedbackText ? (
              <button
                type="button"
                onClick={() => void handlePasteFromClipboard()}
                className="hus-btn hus-btn-secondary text-xs"
              >
                Nhập phản hồi từ Gemini
              </button>
            ) : null}

            {onImportFeedbackText ? (
              <button
                type="button"
                aria-expanded={importOpen}
                onClick={() => {
                  setImportOpen(v => !v);
                  setImportError(null);
                }}
                className="min-h-[36px] cursor-pointer rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-ink-secondary hover:text-ink hover:underline"
              >
                {importOpen ? 'Đóng ô dán thủ công' : 'Dán JSON thủ công'}
              </button>
            ) : null}
          </div>

          {copyStatus ? (
            <p role="status" aria-live="polite" className="text-xs leading-relaxed text-accent-ink">
              {copyStatus.message}
            </p>
          ) : null}

          {importOpen && onImportFeedbackText ? (
            <div className="written-practice-reveal space-y-2 rounded-[var(--radius-md)] border border-border bg-surface p-3">
              <label
                htmlFor={`${step.id}-gemini-import`}
                className="block text-xs font-semibold text-ink"
              >
                Dán câu trả lời của Gemini (có chứa khối JSON ở cuối)
              </label>
              <textarea
                id={`${step.id}-gemini-import`}
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
                  <CheckCircleIcon width={16} height={16} className="text-accent" />
                  <span className="font-semibold text-ink">Gợi ý hướng dẫn bám giáo trình</span>
                  <Badge tone="accent">
                    {coachingFeedback.source === 'webmcp' ? 'Truyền qua WebMCP' : 'Đồng bộ từ Gemini'}
                  </Badge>
                </div>
                {onClearFeedback ? (
                  <button
                    type="button"
                    onClick={onClearFeedback}
                    className="text-xs text-ink-muted hover:text-ink hover:underline"
                  >
                    Xóa gợi ý
                  </button>
                ) : null}
              </div>

              <div className="leading-relaxed text-ink [&>p:first-child]:!mt-0 [&>p:last-child]:!mb-0">
                <Markdown>{coachingFeedback.summary}</Markdown>
              </div>

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
                      const criterionObj = step.rubric.find(r => r.id === cf.criterionId);
                      return (
                        <li
                          key={cf.criterionId}
                          className="flex flex-wrap items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-canvas/65 px-3 py-2"
                        >
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            {criterionObj ? (
                              <p className="font-medium text-ink">{criterionObj.prompt}</p>
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

          {/* Semantic Context Disclosure readable by Chrome Ask Gemini Accessibility Tree */}
          {liveGroundedPreview ? (
            <details className="rounded-[var(--radius-md)] border border-border/80 bg-canvas/60 px-3 py-2 text-xs">
              <summary className="cursor-pointer font-medium text-ink-secondary select-none hover:text-ink">
                Ngữ cảnh giáo trình ĐHKHTN đính kèm ({liveGroundedPreview.course.code} ·{' '}
                {liveGroundedPreview.groundedExcerpts.length} trích đoạn chuẩn)
              </summary>
              <div className="mt-2.5 space-y-2 border-t border-border pt-2.5 text-ink-secondary">
                <p>
                  <strong className="text-ink">Phạm vi hiện tại:</strong>{' '}
                  {liveGroundedPreview.syllabusHorizon.currentLesson} (
                  {liveGroundedPreview.syllabusHorizon.currentChapter})
                </p>
                {liveGroundedPreview.syllabusHorizon.unlearnedChaptersDoNotUse.length > 0 ? (
                  <p>
                    <strong className="text-ink">Chặn vượt chương (chưa học):</strong>{' '}
                    {liveGroundedPreview.syllabusHorizon.unlearnedChaptersDoNotUse.join('; ')}
                  </p>
                ) : null}
                <ul className="list-disc space-y-1 pl-4">
                  {liveGroundedPreview.course.notationRules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {!draft.modelRevealed ? (
        <button
          type="button"
          disabled={!draft.response.trim()}
          onClick={() => update({ modelRevealed: true })}
          className="hus-btn hus-btn-primary"
        >
          Xem lời giải tham khảo
        </button>
      ) : (
        <div className="written-practice-reveal space-y-4 border-t border-border pt-4">
          {/* Side-by-Side Comparison on desktop: Initial Student Draft vs Verified Reference Solution */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <section
              aria-labelledby={`${step.id}-student-draft-compare`}
              className="rounded-[var(--radius-md)] border border-border bg-canvas/75 p-4"
            >
              <h3 id={`${step.id}-student-draft-compare`} className="font-semibold text-ink">
                Bản nháp ban đầu của bạn
              </h3>
              <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
                <Markdown>{renderTextByMathMode(draft.response, activeMathMode)}</Markdown>
              </div>
            </section>

            <section
              aria-labelledby={`${step.id}-reference`}
              className="rounded-[var(--radius-md)] border border-border bg-surface-subtle p-4"
            >
              <h3 id={`${step.id}-reference`} className="font-semibold text-ink">
                Lời giải tham khảo
              </h3>
              <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
                <Markdown>{step.modelAnswer}</Markdown>
              </div>
            </section>
          </div>

          <fieldset data-written-review className="space-y-2 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold text-ink">Tự đối chiếu bài làm</legend>
            {step.rubric.map(criterion => {
              const tutorItem = criterionFeedbackById.get(criterion.id);
              const meta = tutorItem ? CRITERION_STATUS_META[tutorItem.status] : null;
              return (
                <label
                  key={criterion.id}
                  className="flex min-h-[44px] items-start gap-3 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--hus-accent)]"
                    checked={draft.reviewedCriterionIds.includes(criterion.id)}
                    onChange={event =>
                      update({
                        reviewedCriterionIds: event.target.checked
                          ? [...draft.reviewedCriterionIds, criterion.id]
                          : draft.reviewedCriterionIds.filter(id => id !== criterion.id),
                      })
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span>{criterion.prompt}</span>
                    {meta ? <Badge tone={meta.tone}>Gợi ý AI: {meta.label}</Badge> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <RuledA4Sheet
            id={`${step.id}-revision`}
            label="Bản sửa của bạn"
            sheetTag="Giấy A4 · Bản hoàn chỉnh"
            value={draft.revision}
            onChange={val => update({ revision: val })}
            symbolContext={symbolContext}
            toolbarLabel="Bảng chèn ký hiệu toán học cho bản sửa"
            previewKey="revision"
          />

          <button
            type="button"
            disabled={!review.readyToComplete || review.complete}
            onClick={onReviewed}
            className="hus-btn hus-btn-primary"
          >
            Hoàn tất tự đối chiếu
          </button>
          {review.complete ? (
            <p role="status" className="text-sm font-semibold text-success">
              Đã tự đối chiếu
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
