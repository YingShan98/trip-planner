import { useState } from 'react';
import type { Mutate, TripState } from '../../types';
import MarkdownText from '../MarkdownText';

/** A small discussion thread attached to one hotel/day card. Shares TripState.notes with the general notes wall. */
export default function CommentThread({
  state, editUnlocked, mutate, targetType, targetIndex, authorName,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate;
  targetType: 'hotel' | 'day'; targetIndex: number; authorName: string;
}) {
  const [text, setText] = useState('');

  const thread = state.notes
    .map((n, idx) => ({ ...n, idx }))
    .filter((n) => n.target?.type === targetType && n.target.index === targetIndex);

  const post = () => {
    const v = text.trim();
    if (!v) return;
    mutate((d) => {
      d.notes.unshift({ author: authorName, text: v, ts: new Date().toLocaleString('zh-CN'), target: { type: targetType, index: targetIndex } });
    });
    setText('');
  };

  const remove = (idx: number) => mutate((d) => { d.notes.splice(idx, 1); });

  if (thread.length === 0 && !editUnlocked) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-line">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-1.5">
        💬 讨论{thread.length > 0 ? ` (${thread.length})` : ''}
      </p>
      {thread.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {thread.map((n) => (
            <div key={n.idx} className="bg-surface-2 rounded px-2.5 py-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <strong className="text-jade-dark text-[12px]">{n.author || '同行者'}</strong>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted text-[10.5px]">{n.ts}</span>
                  {editUnlocked && (
                    <button aria-label="删除这条讨论" className="btn-mini edit-only" onClick={() => remove(n.idx)}>×</button>
                  )}
                </div>
              </div>
              <MarkdownText text={n.text} />
            </div>
          ))}
        </div>
      )}
      {editUnlocked && (
        <div className="flex gap-1.5 edit-only">
          <input
            className="inp flex-1 text-[12.5px]"
            placeholder="留下你的想法…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') post(); }}
          />
          <button className="btn-mini shrink-0" onClick={post}>发送</button>
        </div>
      )}
    </div>
  );
}
