import { useState } from 'react';
import type { DisciplineTone } from '../../contracts/subject-module';
import type { CourseConventionCanon } from '../../domain/curriculum-tutor';
import { AlertCircleIcon, ChevronDownIcon, SparkLightbulbIcon } from '../ui/Icons';

export interface CourseStudyGuideBannerProps {
  readonly canon: CourseConventionCanon;
  readonly disciplineTone?: DisciplineTone | undefined;
  readonly defaultExpanded?: boolean | undefined;
}

/**
 * Discipline-tinted study method guide banner for CoursePage.
 * Surfaces the 3 core learning pillars and common pitfall for a course without switching on subject IDs.
 */
export function CourseStudyGuideBanner({
  canon,
  disciplineTone,
  defaultExpanded = true,
}: CourseStudyGuideBannerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!canon.studyGuide) return null;

  const { studyGuide } = canon;

  return (
    <section
      aria-label="Phương pháp và lưu ý khi học"
      data-course-study-guide={canon.courseId}
      data-discipline={disciplineTone ?? 'sapphire'}
      className="hus-disc-card rounded-[var(--radius-xl)] border p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="hus-disc-badge inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
          >
            <SparkLightbulbIcon width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-medium text-[var(--disc-ink)] sm:text-xl">
                Lưu ý khi học {canon.academicCode}
              </h2>
              <span className="hus-disc-pill inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                {studyGuide.badgeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--disc-ink-secondary)] sm:text-sm">
              {studyGuide.headline}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(prev => !prev)}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 self-start rounded-[var(--radius-md)] border border-[var(--disc-border-strong)] bg-surface/90 px-3 py-1.5 text-xs font-medium text-[var(--disc-ink)] transition-colors hover:bg-surface"
        >
          <span>{expanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
          <ChevronDownIcon
            width={14}
            height={14}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {studyGuide.methodPillars.map((pillar, index) => (
              <div
                key={pillar.title}
                className="rounded-[var(--radius-lg)] border border-[var(--disc-border)] bg-surface/92 p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--disc-solid)] font-mono text-[11px] font-semibold text-white"
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold leading-snug text-ink">{pillar.title}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{pillar.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-warning/30 bg-warning-subtle/80 px-3.5 py-2.5 text-xs leading-relaxed text-ink-secondary">
            <AlertCircleIcon width={15} height={15} className="mt-0.5 shrink-0 text-warning" />
            <p>
              <strong className="font-semibold text-ink">Lưu ý tránh sai cách học:</strong>{' '}
              {studyGuide.commonPitfall}
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
