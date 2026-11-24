import { Link } from 'react-router';
import { ArrowLeftIcon, BookOpenIcon } from '../components/ui/Icons';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 88 88"
        fill="none"
        className="mb-6 h-20 w-20 text-accent"
      >
        <circle cx="44" cy="44" r="36" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.2" />
        <ellipse
          cx="44"
          cy="44"
          rx="36"
          ry="14"
          transform="rotate(-24 44 44)"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <circle cx="44" cy="44" r="3" fill="currentColor" />
        <circle cx="74" cy="30" r="2.5" fill="var(--hus-starlight)" />
      </svg>

      <h1 className="heading-page">Không tìm thấy trang</h1>
      <p className="mt-3 max-w-md text-base text-ink-secondary">
        Đường dẫn bạn yêu cầu không tồn tại trên bản đồ học liệu hiện tại hoặc đã được chuyển vị trí.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="hus-btn hus-btn-primary">
          <ArrowLeftIcon width={15} height={15} />
          Về danh sách học phần
        </Link>
        <Link to="/courses" className="hus-btn hus-btn-secondary">
          <BookOpenIcon width={15} height={15} />
          Mở danh mục học phần
        </Link>
      </div>
    </div>
  );
}
