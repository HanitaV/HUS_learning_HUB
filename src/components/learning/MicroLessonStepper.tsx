import { lazy, Suspense, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { LessonAnimationSpec } from '../../domain/code-lesson';
import type { MicroLessonCard, ParsedMicroLesson } from '../../domain/micro-lesson';
import { buildCodeWalkthrough, splitMarkdownWithCodeBlocks } from '../../core/learning/code-walkthrough';
import { Badge } from '../ui/Badge';
import { GuidingBeacon, type GuidingBeaconState } from '../ui/GuidingBeacon';
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon } from '../ui/Icons';
import { StarlightBurst } from '../ui/StarlightBurst';
import { CodeWalkthroughPlayer } from './CodeWalkthroughPlayer';
import Markdown from './Markdown';

const LessonAnimationPlayer = lazy(() => import('./LessonAnimationPlayer'));

export interface MicroLessonStepperProps {
  readonly lessonId: string;
  readonly parsed: ParsedMicroLesson;
  readonly animationSpec?: LessonAnimationSpec | undefined;
  readonly practiceLabUrl?: string | undefined;
  readonly onJumpToCodeLab?: (() => void) | undefined;
  readonly activeHeadingId?: string | null | undefined;
  readonly isLessonCompleted?: boolean | undefined;
  readonly onCompleteLesson?: (() => void) | undefined;
  readonly onSwitchToFullMode?: (() => void) | undefined;
  readonly onAllCardsCompleted?: (() => void) | undefined;
  readonly onActiveCardChange?: ((card: MicroLessonCard, index: number) => void) | undefined;
  readonly afterCardContent?: ReactNode;
}

export function MicroLessonStepper(props: MicroLessonStepperProps): JSX.Element {
  return <MicroLessonStepperInner key={props.lessonId} {...props} />;
}

function MicroLessonStepperInner({
  lessonId,
  parsed,
  animationSpec,
  practiceLabUrl,
  onJumpToCodeLab,
  activeHeadingId,
  isLessonCompleted = false,
  onCompleteLesson,
  onAllCardsCompleted,
  onActiveCardChange,
  afterCardContent,
}: MicroLessonStepperProps): JSX.Element {
  const cards = parsed.cards;
  const stepperTopRef = useRef<HTMLElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCardIds, setCompletedCardIds] = useState<readonly string[]>([]);
  const [revealedCheckIds, setRevealedCheckIds] = useState<readonly string[]>([]);
  const [burstKey, setBurstKey] = useState(0);
  const onActiveCardChangeRef = useRef(onActiveCardChange);
  onActiveCardChangeRef.current = onActiveCardChange;

  const scrollToStepperTop = () => {
    if (typeof window === 'undefined' || !stepperTopRef.current) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    stepperTopRef.current.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    if (!activeHeadingId) return;
    const matchedIndex = cards.findIndex((card) => card.headingId === activeHeadingId);
    if (matchedIndex >= 0) {
      setCurrentIndex(matchedIndex);
    }
  }, [activeHeadingId, cards]);

  const safeIndex = cards.length > 0 ? Math.min(currentIndex, cards.length - 1) : 0;
  const currentCard: MicroLessonCard | undefined = cards[safeIndex];

  useEffect(() => {
    if (currentCard) {
      onActiveCardChangeRef.current?.(currentCard, safeIndex);
    }
  }, [currentCard, safeIndex]);

  const animationCardIndex = useMemo(() => {
    if (!animationSpec) return -1;
    const explainIdx = cards.findIndex((c) => c.role === 'explain');
    if (explainIdx >= 0) return explainIdx;
    return cards.length > 1 ? 1 : 0;
  }, [animationSpec, cards]);

  const codeSegments = useMemo(() => {
    if (!currentCard || currentCard.role !== 'code' || currentCard.isDeepDiveCard) return null;
    const segments = splitMarkdownWithCodeBlocks(currentCard.bodyMarkdown);
    return segments.some((s) => s.kind === 'code') ? segments : null;
  }, [currentCard]);

  if (!currentCard) {
    return (
      <section
        aria-label="Học từng chặng"
        className="space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-5 hus-card-surface"
      >
        <p className="text-sm text-ink-secondary">Bài học này chưa có chặng nội dung để hiển thị.</p>
        {afterCardContent}
      </section>
    );
  }

  const isFinalCard = safeIndex === cards.length - 1;
  const allSelfChecksRevealed = currentCard.selfChecks.every((sc) =>
    revealedCheckIds.includes(sc.id),
  );
  const hasUnrevealedSelfChecks = currentCard.selfChecks.length > 0 && !allSelfChecksRevealed;
  const isCurrentCardCompleted = completedCardIds.includes(currentCard.id);
  const allCardsCompleted = cards.length > 0 && completedCardIds.length === cards.length;

  let beaconState: GuidingBeaconState = 'advance';
  let beaconMessage = 'Đã hiểu chặng này · Kéo xuống làm bài tập rồi mở khóa chặng tiếp theo →';

  if (hasUnrevealedSelfChecks) {
    beaconState = 'act';
    beaconMessage =
      'Đọc nhanh ý chính bên dưới, tự nhẩm câu trả lời rồi bấm mở thẻ kiểm tra để nhận điểm chặng!';
  } else if (isFinalCard) {
    beaconState = 'advance';
    beaconMessage =
      'Tuyệt vời! Bạn đã đi hết các chặng lý thuyết — kéo xuống làm bài tập rồi bấm hoàn thành chặng cuối ở cuối trang nhé!';
  }

  const handleRevealCheck = (checkId: string) => {
    if (!revealedCheckIds.includes(checkId)) {
      setRevealedCheckIds((prev) => [...prev, checkId]);
      setBurstKey((prev) => prev + 1);
    }
  };

  const handleCompleteAndAdvance = () => {
    if (!completedCardIds.includes(currentCard.id)) {
      setCompletedCardIds((prev) => [...prev, currentCard.id]);
    }
    setBurstKey((prev) => prev + 1);

    if (isFinalCard) {
      onAllCardsCompleted?.();
      return;
    }

    setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1));
    scrollToStepperTop();
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    scrollToStepperTop();
  };

  return (
    <section
      ref={stepperTopRef}
      aria-label="Học từng chặng"
      className="min-w-0 scroll-mt-24 space-y-4"
    >
      {/* Segmented Dopamine Progress Header */}
      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-4 hus-card-surface">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">
              Chặng {safeIndex + 1} / {cards.length}
            </span>
            <Badge
              tone={completedCardIds.length === cards.length ? 'success' : 'accent'}
              mono
            >
              {completedCardIds.length}/{cards.length} đã nắm
            </Badge>
            {currentCard.isDeepDiveCard ? (
              <Badge tone="warning">🔬 Đào sâu</Badge>
            ) : null}
          </div>
        </div>

        {/* Segmented Progress Bar */}
        <div
          role="list"
          aria-label="Tiến độ các chặng"
          className="mt-3 flex w-full items-center gap-1.5"
        >
          {cards.map((card, index) => {
            const done = completedCardIds.includes(card.id);
            const active = index === safeIndex;
            const segmentColor = done
              ? 'bg-success'
              : active
                ? 'bg-starlight'
                : 'bg-surface-subtle';

            return (
              <button
                key={card.id}
                type="button"
                role="listitem"
                onClick={() => setCurrentIndex(index)}
                aria-label={`Chuyển tới chặng ${index + 1}: ${card.title}`}
                aria-current={active ? 'step' : undefined}
                title={`${index + 1}. ${card.title}`}
                className="group flex min-h-[24px] min-w-0 flex-1 items-center py-1 focus-visible:rounded-sm"
              >
                <span
                  className={`block h-2 w-full rounded-full transition-colors duration-300 ease-[var(--hus-ease)] ${segmentColor} ${
                    active ? 'ring-2 ring-starlight/35 ring-offset-1 ring-offset-surface' : ''
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Clickable Step Pills */}
        {cards.length > 1 ? (
          <nav
            aria-label="Chọn nhanh chặng bài học"
            className="mt-2.5 flex flex-wrap items-center gap-1.5"
          >
            {cards.map((card, index) => {
              const done = completedCardIds.includes(card.id);
              const active = index === safeIndex;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-current={active ? 'step' : undefined}
                  className={`inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1 text-left text-xs font-medium transition-colors ${
                    active
                      ? 'border-starlight/60 bg-warning-subtle/75 text-ink'
                      : done
                        ? 'border-success/35 bg-success-subtle/60 text-success'
                        : 'border-border bg-surface-subtle/60 text-ink-secondary hover:border-border-strong hover:text-ink'
                  }`}
                >
                  <span className="shrink-0 font-mono tabular-nums">{index + 1}.</span>
                  <span className="truncate">{card.title}</span>
                  {done ? <CheckIcon width={12} height={12} className="shrink-0" /> : null}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>

      {/* Guiding Starlight Pointer */}
      <GuidingBeacon
        state={beaconState}
        stepLabel={`Chặng ${safeIndex + 1}`}
        message={beaconMessage}
      />

      {/* Active Micro-Card */}
      <article
        aria-labelledby={`micro-card-title-${currentCard.id}`}
        className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-6 hus-card-surface"
      >
        <StarlightBurst triggerKey={burstKey} />

        {currentCard.isDeepDiveCard ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">🔬 Đào sâu bản chất</Badge>
              {isCurrentCardCompleted ? (
                <Badge tone="success">
                  <CheckCircleIcon width={12} height={12} />
                  Đã nắm
                </Badge>
              ) : null}
            </div>

            <h3
              id={`micro-card-title-${currentCard.id}`}
              className="font-display text-xl font-medium text-ink sm:text-2xl"
            >
              {currentCard.title}
            </h3>

            <p className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle/75 px-4 py-3 text-sm leading-relaxed text-ink-secondary">
              Chặng này là phần mở rộng chuyên sâu. Người mới bắt đầu có thể mở xem nếu tò mò hoặc
              bấm qua thẳng chặng tiếp theo mà không lo hổng kiến thức nền!
            </p>

            <details className="rounded-[var(--radius-lg)] border border-border bg-canvas/50 p-3.5">
              <summary className="cursor-pointer select-none text-sm font-semibold text-accent-ink">
                🔬 Mở góc nhìn chuyên sâu: {currentCard.title}
              </summary>
              <div className="academic-prose mt-3 border-t border-border pt-3">
                <Markdown>{currentCard.bodyMarkdown}</Markdown>
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                id={`micro-card-title-${currentCard.id}`}
                className="font-display text-xl font-medium text-ink sm:text-2xl"
              >
                {currentCard.title}
              </h3>
              {isCurrentCardCompleted ? (
                <Badge tone="success">
                  <CheckCircleIcon width={12} height={12} />
                  Đã nắm
                </Badge>
              ) : null}
            </div>

            {currentCard.bodyMarkdown.trim().length > 0 ? (
              codeSegments ? (
                <div className="space-y-5">
                  {codeSegments.map((seg, segIdx) =>
                    seg.kind === 'markdown' ? (
                      <div key={`md-${segIdx}`} className="academic-prose">
                        <Markdown>{seg.content}</Markdown>
                      </div>
                    ) : (
                      <CodeWalkthroughPlayer
                        key={`cw-${currentCard.id}-${seg.index}`}
                        walkthrough={buildCodeWalkthrough(
                          seg.code,
                          seg.language,
                          seg.index === 0
                            ? 'Hướng dẫn lắp ghép code từng bước'
                            : `Hướng dẫn code từng bước (Phần ${seg.index + 1})`,
                          `${lessonId}-${currentCard.id}-cw-${seg.index}`,
                        )}
                      />
                    ),
                  )}
                  {onJumpToCodeLab || practiceLabUrl ? (
                    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-accent/30 bg-accent-subtle/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          Sẵn sàng tự gõ lại hoặc biến tấu đoạn code này?
                        </p>
                        <p className="mt-0.5 text-xs text-ink-secondary">
                          {onJumpToCodeLab
                            ? 'Khung soạn thảo và chạy thử (Java & Python WASM) đã tích hợp sẵn ngay trong mục Bài tập tự luyện bên dưới.'
                            : 'Mở phòng thực hành Code Lab (Java & Python WASM) để tự viết và chạy thử ngay trên trình duyệt.'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {onJumpToCodeLab ? (
                          <button
                            type="button"
                            onClick={onJumpToCodeLab}
                            className="hus-btn hus-btn-primary text-xs"
                          >
                            <span>Thực hành code ngay bên dưới</span>
                            <ArrowRightIcon width={14} height={14} />
                          </button>
                        ) : null}
                        {practiceLabUrl ? (
                          <Link
                            to={practiceLabUrl}
                            className={`hus-btn shrink-0 !no-underline text-xs ${
                              onJumpToCodeLab ? 'hus-btn-ghost' : 'hus-btn-primary'
                            }`}
                          >
                            <span>
                              {onJumpToCodeLab ? 'Kho đề cả môn' : 'Mở phòng thực hành Code Lab'}
                            </span>
                            <ArrowRightIcon width={14} height={14} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="academic-prose">
                  <Markdown>{currentCard.bodyMarkdown}</Markdown>
                </div>
              )
            ) : null}

            {animationSpec && safeIndex === animationCardIndex ? (
              <div className="pt-2">
                <Suspense
                  fallback={
                    <div
                      role="status"
                      className="rounded-[var(--radius-xl)] border border-border bg-surface-subtle/60 p-5 text-xs text-ink-muted"
                    >
                      Đang tải hoạt ảnh mô phỏng trực quan…
                    </div>
                  }
                >
                  <LessonAnimationPlayer spec={animationSpec} />
                </Suspense>
              </div>
            ) : null}

            {currentCard.deepDiveMarkdown ? (
              <details className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle/60 p-3.5">
                <summary className="cursor-pointer select-none text-sm font-semibold text-accent-ink">
                  🔬 Đào sâu bản chất
                  {currentCard.deepDiveTitle ? `: ${currentCard.deepDiveTitle}` : ''}
                </summary>
                <div className="academic-prose mt-3 border-t border-border pt-3">
                  <Markdown>{currentCard.deepDiveMarkdown}</Markdown>
                </div>
              </details>
            ) : null}
          </div>
        )}

        {/* Interactive Self-Check Spoiler Gate */}
        {currentCard.selfChecks.length > 0 ? (
          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Tự kiểm tra nhanh ({currentCard.selfChecks.length})
              </p>
            </div>

            {currentCard.selfChecks.map((sc, scIndex) => {
              const revealed = revealedCheckIds.includes(sc.id);
              return (
                <div
                  key={sc.id}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle/55 p-3.5 sm:p-4"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle font-mono text-xs font-semibold text-accent-ink">
                      {scIndex + 1}
                    </span>
                    <div className="academic-prose min-w-0 flex-1 text-sm">
                      <Markdown>{sc.promptMarkdown}</Markdown>
                    </div>
                  </div>

                  {revealed ? (
                    <div className="mt-3 rounded-[var(--radius-md)] border border-success/35 bg-success-subtle/60 p-3.5">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-success">
                        <CheckCircleIcon width={14} height={14} />
                        <span>Đáp án đối chiếu</span>
                      </div>
                      <div className="academic-prose text-sm">
                        <Markdown>{sc.answerMarkdown}</Markdown>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleRevealCheck(sc.id)}
                        className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-starlight/50 bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-starlight hover:bg-warning-subtle/60 sm:w-auto"
                      >
                        ☞ Tự nhẩm xong · Bấm đối chiếu đáp án
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </article>

      {afterCardContent}

      {/* Step Controls */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-3.5 sm:p-4">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={safeIndex === 0}
          className="hus-btn hus-btn-secondary min-h-[44px]"
        >
          <ArrowLeftIcon width={15} height={15} />
          Chặng trước
        </button>

        <button
          type="button"
          onClick={handleCompleteAndAdvance}
          className="hus-btn hus-btn-primary min-h-[44px] w-full sm:w-auto"
        >
          {isFinalCard ? (
            <>
              <CheckCircleIcon width={16} height={16} />
              <span>Hoàn thành chặng {safeIndex + 1} · Về đích</span>
            </>
          ) : (
            <>
              <span>Hoàn thành chặng {safeIndex + 1} &amp; Tiếp tục</span>
              <ArrowRightIcon width={15} height={15} />
            </>
          )}
        </button>
      </div>

      {allCardsCompleted ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-success/40 bg-success-subtle/60 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircleIcon width={16} height={16} className="shrink-0" />
              <span>
                Chúc mừng! Bạn đã nắm trọn vẹn {cards.length}/{cards.length} chặng lý thuyết
              </span>
            </div>
            <p className="text-xs leading-relaxed text-ink-secondary">
              ☞ Bạn đã hoàn tất các chặng lý thuyết và phần{' '}
              <strong className="font-semibold text-ink">Bài tập tự luyện</strong>
              {!isLessonCompleted && onCompleteLesson
                ? ' — hãy xác nhận hoàn thành trạm bài học này hoặc chuyển sang bài tiếp theo bên dưới.'
                : ' — hãy tiếp tục sang bài tiếp theo bên dưới nhé!'}
            </p>
          </div>
          {!isLessonCompleted && onCompleteLesson ? (
            <button
              type="button"
              onClick={onCompleteLesson}
              className="hus-btn hus-btn-primary min-h-[40px] shrink-0 text-xs"
            >
              <CheckCircleIcon width={15} height={15} />
              <span>Hoàn thành trạm bài học</span>
            </button>
          ) : isLessonCompleted ? (
            <Badge tone="success">
              <CheckCircleIcon width={12} height={12} />
              Đã hoàn thành trạm
            </Badge>
          ) : null}
        </div>
      ) : null}

      {parsed.attributionFooter ? (
        <footer className="rounded-[var(--radius-lg)] border border-border bg-surface-subtle/40 px-4 py-3 text-xs text-ink-muted">
          <div className="academic-prose text-xs">
            <Markdown>{parsed.attributionFooter}</Markdown>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
