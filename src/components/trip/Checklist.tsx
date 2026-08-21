import { useState } from 'react';
import { uid } from '../../state';
import type { Mutate, TripState } from '../../types';
import PackingModal from '../modals/PackingModal';

const DEFAULT_CATEGORIES = ['日期与机票', '预约与订票', '证件与长者优惠', '交通与包车', '支付与人数', '出发前复核'];
const FALLBACK_CATEGORY = '其他';

const CATEGORY_ICONS: Record<string, string> = {
  '日期与机票': '📅',
  '预约与订票': '📝',
  '证件与长者优惠': '🪪',
  '交通与包车': '🚐',
  '支付与人数': '💳',
  '出发前复核': '🔎',
  [FALLBACK_CATEGORY]: '📌',
};

export default function Checklist({
  state, editUnlocked, mutate,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate;
}) {
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState(DEFAULT_CATEGORIES[0]);
  const [showPacking, setShowPacking] = useState(false);

  const checklist = state.checklist;
  const doneCount = checklist.filter((x) => x.done).length;
  const total = checklist.length;

  const presentCategories = Array.from(new Set(checklist.map((x) => x.category || FALLBACK_CATEGORY)));
  const knownCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...presentCategories]));
  const orderedCategories = [
    ...DEFAULT_CATEGORIES.filter((cat) => presentCategories.includes(cat)),
    ...presentCategories.filter((cat) => !DEFAULT_CATEGORIES.includes(cat)),
  ];
  const grouped = orderedCategories.map((cat) => ({
    cat,
    items: checklist.map((x, i) => ({ ...x, idx: i })).filter((x) => (x.category || FALLBACK_CATEGORY) === cat),
  })).filter((g) => g.items.length > 0);

  const add = () => {
    const v = newText.trim();
    if (!v) return;
    const cat = newCat.trim() || FALLBACK_CATEGORY;
    mutate((d) => { d.checklist.push({ id: uid('c'), text: v, done: false, category: cat }); });
    setNewText('');
  };

  const packedCount = state.packing.filter((x) => x.done).length;
  const packingTotal = state.packing.length;

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">☑️ 出发准备</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-muted text-[13px]">
            出发前要完成的事项{total > 0 ? ` (${doneCount}/${total})` : ''}
          </span>
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

      {total === 0 ? (
        <div className="empty-state">暂无事项</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <p className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.06em] mb-1.5">
                {CATEGORY_ICONS[cat] ?? '📌'} {cat}
                <span className="ml-1.5 normal-case font-normal">
                  ({items.filter((x) => x.done).length}/{items.length})
                </span>
              </p>
              <div className="flex flex-col gap-2">
                {items.map((x) => (
                  <div
                    key={x.id}
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
                      onChange={(e) => mutate((d) => { d.checklist[x.idx].done = e.target.checked; })}
                    />
                    <span className={`flex-1 text-[14px] ${x.done ? 'line-through text-muted' : ''}`}>{x.text}</span>
                    <button
                      aria-label={`删除事项「${x.text || cat}」`}
                      className="btn-mini edit-only"
                      onClick={() => mutate((d) => { d.checklist.splice(x.idx, 1); })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editUnlocked && (
        <div className="flex gap-2 mt-3 edit-only">
          <input
            className="inp w-[150px] shrink-0 text-[13px]"
            placeholder="分类…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            list="checklist-categories"
          />
          <datalist id="checklist-categories">
            {knownCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
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
