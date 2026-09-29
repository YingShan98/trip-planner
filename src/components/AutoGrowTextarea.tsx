import { useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, TextareaHTMLAttributes } from 'react';

/** A drop-in for a text <input> whose value can be long: it wraps and grows to fit instead of clipping,
    so the whole text stays readable on narrow screens. With `singleLine` (the default) Enter doesn't
    add line breaks and pasted ones become spaces, so the value stays one line like the input it
    replaces; pass `singleLine={false}` for fields shown as Markdown, which may hold line breaks. */
export default function AutoGrowTextarea({
  value, onChange, onKeyDown, singleLine = true, className = '', ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  singleLine?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  };

  useLayoutEffect(fit, [value]);

  // Wrapping, and so the height needed, also changes when the field's width does.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) { width = el.clientWidth; fit(); }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`resize-none overflow-hidden break-words ${className}`}
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(singleLine ? e.target.value.replace(/\r?\n/g, ' ') : e.target.value)}
      onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (singleLine && e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault();
        onKeyDown?.(e);
      }}
      {...rest}
    />
  );
}
