import { useMemo, useState } from 'react';
import { learningContent } from '../infrastructure/content/learning';
import { normalizeVietnamese } from '../core/courses/search';
import { useLearningProgress } from '../app/useLearningProgress';
import { ResourceList } from '../components/learning/ResourceList';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { BookmarkIcon, LibraryIcon } from '../components/ui/Icons';
import { ObservatoryHeader } from '../components/ui/ObservatoryHeader';
import { SearchInput } from '../components/ui/SearchInput';

export default function ResourcesPage() {
  const [search, setSearch] = useState('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const { progress } = useLearningProgress();

  const matchingResources = useMemo(() => {
    const query = normalizeVietnamese(search).trim();
    return learningContent.resources.filter(resource => {
      if (onlyBookmarked && !progress.bookmarkedResourceIds.includes(resource.id)) return false;
      if (!query) return true;
      return normalizeVietnamese(
        `${resource.title} ${resource.provenance.attribution ?? ''}`,
      ).includes(query);
    });
  }, [search, onlyBookmarked, progress.bookmarkedResourceIds]);

  return (
    <div className="space-y-8">
      <ObservatoryHeader
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Tổng quan', to: '/' }, { label: 'Thư viện tài liệu' }]} />
        }
        title="Thư viện tài liệu"
        description="Danh mục học liệu công khai hiện đang mở trên nền tảng."
        aside={
          <div className="inline-flex items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-canvas/80 px-4 py-2.5 text-xs">
            <div>
              <span className="block font-mono text-base font-semibold tabular-nums text-ink">
                {learningContent.resources.length}
              </span>
              <span className="text-ink-muted">Nguồn tài liệu</span>
            </div>
            <span aria-hidden="true" className="h-7 w-px bg-border" />
            <div>
              <span className="block font-mono text-base font-semibold tabular-nums text-ink">
                {progress.bookmarkedResourceIds.length}
              </span>
              <span className="text-ink-muted">Đã đánh dấu</span>
            </div>
          </div>
        }
      />

      {/* Observatory search + bookmark filter bar */}
      <div className="hus-card-surface flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <SearchInput
          id="resources-search"
          value={search}
          onChange={setSearch}
          placeholder="Tìm theo tên học liệu…"
          label="Tìm kiếm tài liệu"
          className="w-full sm:max-w-md"
        />

        <div className="flex items-center gap-2" role="group" aria-label="Lọc tài liệu">
          <button
            type="button"
            aria-pressed={!onlyBookmarked}
            onClick={() => setOnlyBookmarked(false)}
            className={`min-h-[40px] rounded-[var(--radius-md)] border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98] ${
              !onlyBookmarked
                ? 'border-accent bg-accent-subtle text-accent-ink'
                : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
            }`}
          >
            Tất cả ({learningContent.resources.length})
          </button>
          <button
            type="button"
            aria-pressed={onlyBookmarked}
            onClick={() => setOnlyBookmarked(true)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-[0.98] ${
              onlyBookmarked
                ? 'border-accent bg-accent-subtle text-accent-ink'
                : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink'
            }`}
          >
            <BookmarkIcon width={14} height={14} filled={onlyBookmarked} />
            Đã đánh dấu ({progress.bookmarkedResourceIds.length})
          </button>
        </div>
      </div>

      {/* Public learning resources */}
      <section aria-labelledby="external-resources-heading" className="space-y-4">
        <div className="flex items-baseline gap-2.5">
          <h2 id="external-resources-heading" className="heading-section">
            {onlyBookmarked ? 'Tài liệu đã đánh dấu' : 'Tài liệu học tập'}
          </h2>
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            ({matchingResources.length})
          </span>
        </div>

        {matchingResources.length > 0 ? (
          <ResourceList resources={matchingResources} />
        ) : (
          <EmptyState
            icon={<LibraryIcon width={18} height={18} />}
            title={
              onlyBookmarked
                ? 'Chưa có tài liệu nào được đánh dấu'
                : 'Không tìm thấy nguồn học liệu phù hợp'
            }
            description={
              onlyBookmarked
                ? 'Nhấn “Đánh dấu tài liệu” trên bất kỳ học liệu nào để lưu lại vào danh sách tra cứu nhanh.'
                : 'Thử tìm với từ khóa khác hoặc xóa bộ lọc hiện tại.'
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setOnlyBookmarked(false);
                }}
                className="hus-btn hus-btn-secondary"
              >
                Hiển thị tất cả tài liệu
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}
