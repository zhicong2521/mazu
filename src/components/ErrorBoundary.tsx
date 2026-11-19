import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = '連線或系統發生暫時性異常，請重新整理頁面恢復參拜。';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        friendly = parsed.error.includes('Missing or insufficient permissions')
          ? '雲端殿宇權限驗證未通過，請確認已使用 Google 帳號登入後重試。'
          : `雲端同步暫時中斷（${parsed.operationType ?? 'sync'}），請重新整理恢復。`;
      }
    } catch {
      if (error.message) {
        friendly = error.message;
      }
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error): void {
    console.error('Temple ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#1b0c09] p-6 text-[#fbe7be]">
          <div className="temple-card max-w-md w-full rounded-2xl p-6 text-center flex flex-col items-center gap-4">
            <h1 className="text-xl font-bold font-temple text-[#fbe09c]">
              雲端天后宮 · 連線暫時中斷
            </h1>
            <p className="text-sm text-[#e8d2b0] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="temple-action-btn px-6 py-2.5 rounded-xl text-sm font-bold text-[#fff4d6] cursor-pointer"
            >
              重新整理恢復參拜
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
