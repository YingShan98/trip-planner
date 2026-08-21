import { useEffect, useState } from 'react';
import { registerConfirmListener, type ConfirmRequest } from '../lib/confirm';
import Modal from './Modal';

export default function ConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerConfirmListener(setRequest);
    return () => registerConfirmListener(null);
  }, []);

  const settle = (value: boolean) => { request?.resolve(value); setRequest(null); };

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request) return null;

  return (
    <Modal onClose={() => settle(false)}>
      <h2 className="font-serif text-[19px] font-bold text-jade-dark mb-2">{request.options.title || '请确认'}</h2>
      <p className="text-ink-2 text-[13.5px] leading-[1.65] m-0">{request.message}</p>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
        <button className="btn-ghost" onClick={() => settle(false)}>{request.options.cancelLabel || '取消'}</button>
        <button className={request.options.danger ? 'btn-danger' : 'btn-primary'} onClick={() => settle(true)}>
          {request.options.confirmLabel || '确认'}
        </button>
      </div>
    </Modal>
  );
}
