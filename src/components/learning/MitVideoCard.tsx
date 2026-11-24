import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { ExternalLinkIcon } from '../ui/Icons';

export type MitSupplementResourceType =
  | 'video-lesson'
  | 'video-lecture'
  | 'textbook-pdf'
  | 'notes-slides-pdf'
  | 'exercise-pdf'
  | 'solution-pdf';

export interface MitSupplementItem {
  readonly id: string;
  readonly courseCode: string;
  readonly resourceType: MitSupplementResourceType;
  readonly title: string;
  readonly relevanceVi: string;
  readonly url: string;
  readonly youtubeId?: string;
}

const MIT_TYPE_LABEL: Record<MitSupplementResourceType, string> = {
  'video-lesson': 'Bài học (có video)',
  'video-lecture': 'Video bài giảng',
  'textbook-pdf': 'Giáo trình PDF',
  'notes-slides-pdf': 'Notes & Slides (PDF)',
  'exercise-pdf': 'Bài tập (PDF)',
  'solution-pdf': 'Lời giải (PDF)',
};

export function MitVideoCard({ resource }: { readonly resource: MitSupplementItem }) {
  const [playerOpen, setPlayerOpen] = useState(false);

  return (
    <li className="!my-0 rounded-[var(--radius-lg)] border border-border bg-canvas/60 p-3.5 space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" mono>
              MIT {resource.courseCode}
            </Badge>
            <Badge tone="neutral">{MIT_TYPE_LABEL[resource.resourceType]}</Badge>
          </div>
          <p className="!my-0 text-sm font-medium text-ink">{resource.title}</p>
          <p className="!my-0 text-xs leading-relaxed text-ink-secondary">{resource.relevanceVi}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          {resource.youtubeId ? (
            <button
              type="button"
              aria-expanded={playerOpen}
              onClick={() => setPlayerOpen(prev => !prev)}
              className={`hus-btn text-xs ${playerOpen ? 'hus-btn-secondary' : 'hus-btn-primary'}`}
            >
              {playerOpen ? 'Đóng video' : 'Xem video tại đây'}
            </button>
          ) : null}
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hus-btn hus-btn-secondary text-xs !no-underline"
          >
            <span>Mở trên MIT OCW</span>
            <ExternalLinkIcon width={13} height={13} />
          </a>
        </div>
      </div>

      {playerOpen && resource.youtubeId ? (
        <div className="space-y-1.5">
          <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-md)] border border-border bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(resource.youtubeId)}?rel=0`}
              title={`${resource.title} — MIT ${resource.courseCode}`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <p className="!my-0 text-[11px] text-ink-muted">
            Nguồn phát: YouTube / MIT OpenCourseWare (tiếng Anh). Nếu trình phát không tải được,
            hãy mở trực tiếp trang bài học MIT OCW ở nút bên trên.
          </p>
        </div>
      ) : null}
    </li>
  );
}
