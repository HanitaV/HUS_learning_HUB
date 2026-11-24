import type { Resource } from '../../domain/learning';
import { useLearningProgress } from '../../app/useLearningProgress';
import { progressStore } from '../../infrastructure/progress/store';
import { resolveResourceUrl } from '../../infrastructure/content/resource-url';
import { Badge } from '../ui/Badge';
import { BookmarkIcon, ExternalLinkIcon } from '../ui/Icons';

const KIND_LABEL: Record<Resource['kind'], string> = {
  pdf: 'PDF',
  image: 'Hình ảnh',
  diagram: 'Sơ đồ',
  markdown: 'Ghi chú',
  json: 'Dữ liệu',
  external: 'Liên kết',
  youtube: 'Video',
};

export function ResourceList({ resources }: { readonly resources: readonly Resource[] }) {
  const { progress, error } = useLearningProgress();

  if (resources.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-subtle/60 px-4 py-3 text-xs text-ink-muted">
        Không có tài liệu nào trong mục này.
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p
          role="status"
          className="mb-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning-subtle px-3.5 py-2 text-xs text-warning"
        >
          {error}
        </p>
      ) : null}
      <ul className="hus-card-surface !my-0 !list-none !pl-0 overflow-hidden divide-y divide-border rounded-[var(--radius-xl)] border border-border bg-surface">
        {resources.map(resource => {
          const isBookmarked = progress.bookmarkedResourceIds.includes(resource.id);
          const url = resolveResourceUrl(resource, import.meta.env.BASE_URL);
          const isApproved = resource.provenance.rights === 'approved';
          return (
            <li
              key={resource.id}
              className="!my-0 flex flex-col gap-3 px-4 py-4 transition-colors duration-200 hover:bg-surface-subtle/50 sm:flex-row sm:items-start sm:justify-between sm:px-5"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{KIND_LABEL[resource.kind]}</Badge>
                  <Badge tone={isApproved ? 'success' : 'warning'}>
                    {isApproved ? 'Nguồn có giấy phép' : 'Nguồn ngoài'}
                  </Badge>
                  {resource.pages && resource.pages.length > 0 ? (
                    <Badge tone="neutral" mono>
                      Trang {resource.pages.join(', ')}
                    </Badge>
                  ) : null}
                </div>

                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-baseline gap-1.5 text-sm font-semibold text-ink !no-underline transition-colors hover:text-accent hover:!underline"
                >
                  <span className="break-words">{resource.title}</span>
                  <ExternalLinkIcon width={13} height={13} className="shrink-0 text-ink-muted" />
                </a>

                {resource.provenance.attribution ? (
                  <p className="!my-0 break-words text-xs leading-relaxed text-ink-secondary">
                    {resource.provenance.attribution}
                  </p>
                ) : null}

                {!isApproved ? (
                  <p className="!my-0 text-xs text-ink-muted">
                    Mở tại nguồn gốc · chưa cấp quyền phát hành lại trực tiếp.
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-pressed={isBookmarked}
                  onClick={() =>
                    progressStore.dispatch({ type: 'bookmark', resourceId: resource.id })
                  }
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98] ${
                    isBookmarked
                      ? 'border-accent bg-accent-subtle text-accent-ink'
                      : 'border-border bg-canvas text-ink-secondary hover:border-border-strong hover:text-ink'
                  }`}
                >
                  <BookmarkIcon width={14} height={14} filled={isBookmarked} />
                  <span>{isBookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu tài liệu'}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
