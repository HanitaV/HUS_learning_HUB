import { Link } from 'react-router';
import { ChevronRightIcon } from './Icons';

export interface BreadcrumbItem {
  readonly label: string;
  readonly to?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Đường dẫn" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 min-w-0">
              {index > 0 ? (
                <ChevronRightIcon width={14} height={14} className="shrink-0 text-ink-muted/70" />
              ) : null}
              {!isLast && item.to ? (
                <Link
                  to={item.to}
                  className="truncate text-ink-muted no-underline transition-colors hover:text-ink hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="truncate font-medium text-ink-secondary"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
