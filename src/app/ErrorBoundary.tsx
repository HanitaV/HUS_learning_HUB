import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main
          role="alert"
          className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-start justify-center px-6 py-12"
        >
          <div className="w-full rounded-[var(--radius-lg)] border border-border bg-surface p-6">
            <h1 className="text-xl font-semibold text-ink">Không thể tải nội dung</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              Đã xảy ra sự cố khi tải tài nguyên trang. Vui lòng tải lại trang để thử lại.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[40px] items-center rounded-[var(--radius-md)] bg-accent-solid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-solid-hover"
            >
              Tải lại trang
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
