import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const onOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return createPortal(
    <div
      className="modal fixed inset-0 bg-ink/50 z-[100] flex items-start justify-center overflow-y-auto px-3 py-6 sm:items-center sm:p-5 backdrop-blur-sm animate-fade-in"
      onClick={onOverlayClick}
    >
      <div className="my-auto w-[min(560px,100%)] max-h-[calc(100dvh-48px)] overflow-y-auto bg-surface rounded-xl p-5 sm:max-h-[90vh] sm:p-7 relative shadow-lg border border-line animate-slide-up">
        <button
          className="absolute right-4 top-3.5 w-7.5 h-7.5 grid place-items-center rounded-full bg-surface-3 text-muted text-lg leading-none transition-all duration-150 hover:bg-danger-tint hover:text-danger"
          onClick={onClose}
        >
          ×
        </button>
        <div>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
