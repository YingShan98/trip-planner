import type { ReactNode } from 'react';

/**
 * Accordion shell for a trip section: header (icon + title + summary + chevron) always
 * visible, body shown only when `open`. Body stays mounted (hidden, not unmounted) so
 * print (`print-show`) and the scroll-spy's `#id` anchor keep working while collapsed.
 */
export default function CollapsibleSection({
  id, icon, title, summary, open, onToggle, printVisible = true, children,
}: {
  id: string; icon: string; title: string; summary?: string;
  open: boolean; onToggle: () => void; printVisible?: boolean; children: ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-32 border-b border-line${printVisible ? '' : ' print-hide'}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={onToggle}
        className="no-print w-full flex justify-between items-center gap-2.5 py-6 text-left"
      >
        <span className="min-w-0">
          <h2 className="font-serif text-[19px] font-bold text-jade-dark flex items-center gap-2">
            <span aria-hidden="true">{icon}</span> <span className="truncate">{title}</span>
          </h2>
          {summary && <span className="block text-muted text-[12.5px] mt-0.5">{summary}</span>}
        </span>
        <span className="text-jade text-[12px] font-semibold whitespace-nowrap shrink-0">{open ? '收起 ▴' : '展开 ▾'}</span>
      </button>
      <div id={`${id}-body`} className={`${open ? '' : 'hidden'} print-show pb-7`}>
        {children}
      </div>
    </section>
  );
}
