import type { MouseEvent, ReactNode } from 'react';

export default function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const onOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return (
    <div
      className="modal fixed inset-0 bg-ink/50 z-[100] grid place-items-center p-3 sm:p-5 backdrop-blur-sm animate-fade-in"
      onClick={onOverlayClick}
    >
      <div className="w-[min(560px,100%)] max-h-[calc(100vh-24px)] sm:max-h-[90vh] overflow-y-auto bg-surface rounded-xl p-5 sm:p-7 relative shadow-lg border border-line animate-slide-up">
        <button
          className="absolute right-4 top-3.5 w-[30px] h-[30px] grid place-items-center rounded-full bg-surface-3 text-muted text-lg leading-none transition-all duration-150 hover:bg-danger-tint hover:text-danger"
          onClick={onClose}
        >
          ×
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
}
