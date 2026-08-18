import type { Mutate, TripState } from '../../types';

export default function NotesSection({
  state, editUnlocked, mutate,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate;
}) {
  return (
    <section className="py-7">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">💬 留言板</h2>
        <span className="text-muted text-[13px]">一起讨论，不需要注册账号</span>
      </div>

      {editUnlocked && (
        <button
          className="add-btn edit-only mb-4"
          onClick={() => mutate((d) => {
            d.notes.unshift({ author: '', text: '', ts: new Date().toLocaleString('zh-CN') });
          })}
        >
          ＋ 写留言
        </button>
      )}

      <div className="flex flex-col gap-2.5">
        {state.notes.length === 0 ? (
          <div className="empty-state">还没有留言</div>
        ) : (
          state.notes.map((n, i) => (
            <article
              key={i}
              className="bg-surface border border-line border-l-[3px] border-l-jade rounded-lg px-4 py-3.5 shadow-xs transition-shadow duration-150 hover:shadow-sm"
            >
              <div className="flex gap-2.5 items-center mb-2.5 pb-2.5 border-b border-line">
                <input
                  className="inp-bare editable font-bold text-[14px] text-jade-dark flex-1"
                  value={n.author}
                  placeholder="姓名"
                  onChange={(e) => mutate((d) => { d.notes[i].author = e.target.value; })}
                />
                <span className="text-muted text-[12px]">{n.ts || ''}</span>
                <button
                  className="btn-mini edit-only"
                  onClick={() => mutate((d) => { d.notes.splice(i, 1); })}
                >
                  ×
                </button>
              </div>
              <textarea
                className="editable w-full border-none bg-transparent resize-y min-h-[52px] p-0 outline-none text-ink leading-[1.65]"
                value={n.text}
                placeholder="留言"
                onChange={(e) => mutate((d) => { d.notes[i].text = e.target.value; })}
              />
            </article>
          ))
        )}
      </div>
    </section>
  );
}
