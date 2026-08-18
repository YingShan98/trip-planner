import type { MouseEvent, ReactNode } from 'react';

export default function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const onOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return (
    <div className="modal" onClick={onOverlayClick}>
      <div className="modal-card">
        <button className="modal-x" onClick={onClose}>
          ×
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
}
