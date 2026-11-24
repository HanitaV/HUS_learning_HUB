export function PageSkeleton({ label = 'Đang tải nội dung…' }: { readonly label?: string }) {
  return (
    <div className="w-full space-y-8">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="space-y-3" aria-hidden="true">
        <div className="hus-skeleton h-4 w-32" />
        <div className="hus-skeleton h-9 w-64 max-w-full" />
        <div className="hus-skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
        <div className="hus-skeleton h-32 w-full" />
        <div className="hus-skeleton h-32 w-full" />
      </div>
    </div>
  );
}

export function LessonSkeleton({ label = 'Đang tải bài học…' }: { readonly label?: string }) {
  return (
    <div className="space-y-4 py-4">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="space-y-3" aria-hidden="true">
        <div className="hus-skeleton h-8 w-3/4" />
        <div className="hus-skeleton h-4 w-full" />
        <div className="hus-skeleton h-4 w-11/12" />
        <div className="hus-skeleton h-4 w-4/5" />
        <div className="hus-skeleton mt-6 h-24 w-full" />
        <div className="hus-skeleton h-4 w-full" />
        <div className="hus-skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}
