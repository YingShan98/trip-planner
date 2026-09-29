import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const MENU_MAX_HEIGHT = 224;

/** Pick an existing category or type a new one. Unlike a <datalist>, focusing it lists every option
    even when the field already holds a value; typing then filters. The value is only committed on
    pick / Enter / blur, so an item doesn't jump to another category group mid-typing. */
export default function CategoryCombobox({
  value, options, onCommit, placeholder = '分类…', className = '', ariaLabel,
}: {
  value: string; options: string[]; onCommit: (value: string) => void;
  placeholder?: string; className?: string; ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [openUp, setOpenUp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => { if (!open) setDraft(value); }, [value, open]);

  const query = draft.trim();
  const shown = typed && query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options;
  const canCreate = Boolean(query) && !options.includes(query);
  const entries = canCreate ? [...shown, query] : shown;

  const commit = (next: string) => {
    const v = next.trim();
    setOpen(false);
    setTyped(false);
    setHighlight(-1);
    if (!v) { setDraft(value); return; }
    setDraft(v);
    if (v !== value) onCommit(v);
  };

  const openMenu = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    setOpenUp(Boolean(rect && rect.bottom + MENU_MAX_HEIGHT > window.innerHeight && rect.top > MENU_MAX_HEIGHT));
    setOpen(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { openMenu(); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (entries.length ? (h + step + entries.length) % entries.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(open && highlight >= 0 && highlight < entries.length ? entries[highlight] : draft);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setDraft(value);
      setOpen(false);
      setTyped(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        className="inp w-full text-[13px]"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={draft}
        onFocus={(e) => { e.currentTarget.select(); openMenu(); }}
        onClick={() => { if (!open) openMenu(); }}
        onChange={(e) => { setDraft(e.target.value); setTyped(true); setHighlight(-1); if (!open) openMenu(); }}
        onBlur={() => commit(draft)}
        onKeyDown={onKeyDown}
      />
      {open && entries.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute left-0 z-30 min-w-full w-max max-w-[260px] overflow-y-auto bg-surface border border-line rounded shadow-md py-1 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ maxHeight: MENU_MAX_HEIGHT }}
        >
          {entries.map((opt, i) => {
            const isNew = canCreate && i === entries.length - 1;
            return (
              <li
                key={isNew ? `new:${opt}` : opt}
                role="option"
                aria-selected={opt === value}
                className={`px-3 py-1.5 text-[13px] cursor-pointer whitespace-nowrap ${i === highlight ? 'bg-jade-light text-jade-dark' : 'hover:bg-surface-3'} ${opt === value && !isNew ? 'font-semibold text-jade-dark' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(opt)}
              >
                {isNew ? <>＋ 新建分类「{opt}」</> : <>{opt === value ? '✓ ' : ''}{opt}</>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
