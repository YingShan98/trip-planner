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

  return <div className={`toast${show ? ' show' : ''}`}>{message}</div>;
}
