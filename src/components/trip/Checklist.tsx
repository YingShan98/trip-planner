import { useState } from 'react';
import { uid } from '../../state';
import type { Mutate, TripState } from '../../types';
import PackingModal from '../modals/PackingModal';

export default function Checklist({
  state, editUnlocked, mutate,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate;
}) {
  const [newText, setNewText] = useState('');
  const [showPacking, setShowPacking] = useState(false);

  const add = () => {
    const v = newText.trim();
    if (!v) return;
    mutate((d) => { d.checklist.push({ id: uid('c'), text: v, done: false }); });
    setNewText('');
  };

  const packedCount = state.packing.filter((x) => x.done).length;
  const packingTotal = state.packing.length;

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">☑️ 出发准备</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-muted text-[13px]">出发前要完成的事项</span>
          <button
            className="btn text-[12.5px] px-3 py-1.5 bg-surface-3 border-line hover:bg-surface hover:border-line-strong flex items-center gap-1.5"
            onClick={() => setShowPacking(true)}
          >
            🧳 打包清单
            {packingTotal > 0 && (
              <span className="text-[11px] text-muted">({packedCount}/{packingTotal})</span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {state.checklist.length === 0 ? (
          <div className="empty-state">暂无事项</div>
        ) : (
          state.checklist.map((x, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 border-[1.5px] rounded px-3.5 py-[11px] transition-all duration-150 ${
                x.done
                  ? 'bg-surface-3 border-transparent'
                  : 'bg-surface border-line hover:border-line-strong'
              }`}
            >
              <input
                type="checkbox"
                className="custom-check editable"
                checked={x.done}
                onChange={(e) => mutate((d) => { d.checklist[i].done = e.target.checked; })}
              />
              <span className={`flex-1 text-[14px] ${x.done ? 'line-through text-muted' : ''}`}>{x.text}</span>
              <button
                aria-label={`删除事项「${x.text || i + 1}」`}
                className="btn-mini edit-only"
                onClick={() => mutate((d) => { d.checklist.splice(i, 1); })}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {editUnlocked && (
        <div className="flex gap-2 mt-3 edit-only">
          <input
            className="inp flex-1"
            placeholder="添加 Checklist 项目"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn-primary" onClick={add}>添加</button>
        </div>
      )}

      {showPacking && (
        <PackingModal
          state={state}
          editUnlocked={editUnlocked}
          mutate={mutate}
          onClose={() => setShowPacking(false)}
        />
      )}
    </section>
  );
}
