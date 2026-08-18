import { useEffect, useRef, useState } from 'react';
import { registerToastListener } from '../lib/toast';

export default function Toast() {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    registerToastListener((msg) => {
      setMessage(msg);
      setShow(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShow(false), 1800);
    });
    return () => registerToastListener(null);
  }, []);

  return (
    <div
      className={`fixed left-1/2 bottom-6 z-[200] bg-ink-2 text-white px-5 py-2.5 rounded-full text-[13.5px] font-medium shadow-md whitespace-nowrap pointer-events-none transition-all duration-[260ms] ${
        show ? 'opacity-100 -translate-x-1/2 translate-y-0' : 'opacity-0 -translate-x-1/2 translate-y-3'
      }`}
    >
      {message}
    </div>
  );
}
