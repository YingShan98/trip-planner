import type { Mutate, TripState } from '../../types';
import MarkdownText from '../MarkdownText';

export default function NotesSection({
  state, editUnlocked, mutate, authorName,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; authorName: string;
}) {
  const targetLabel = (target: TripState['notes'][number]['target']) => {
    if (!target) return null;
    if (target.type === 'hotel') {
      const h = state.hotels[target.index];
      return h ? { text: `🏨 ${h.name || '未命名酒店'}`, href: `#hotel-${target.index}` } : null;
    }
    const d = state.days[target.index];
    return d ? { text: `🗓️ D${target.index + 1} · ${d.title}`, href: `#day-${target.index + 1}` } : null;
  };

  return (
    <section className="py-7">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">💬 留言板</h2>
        <span className="text-muted text-[13px]">无需注册即可参与，留下你的显示名称</span>
      </div>

      {editUnlocked && (
        <button
          className="add-btn edit-only mb-4"
          onClick={() => mutate((d) => {
            d.notes.unshift({ author: authorName, text: '', ts: new Date().toLocaleString('zh-CN') });
          })}
        >
          ＋ 写留言
        </button>
      )}

      <div className="flex flex-col gap-2.5">
        {state.notes.length === 0 ? (
          <div className="empty-state">还没有留言</div>
        ) : (
          state.notes.map((n, i) => {
            const target = targetLabel(n.target);
            return (
            <article
              key={i}
              className="bg-surface border border-line border-l-[3px] border-l-jade rounded-lg px-4 py-3.5 shadow-xs transition-shadow duration-150 hover:shadow-sm"
            >
              <div className="flex gap-2.5 items-center mb-2.5 pb-2.5 border-b border-line flex-wrap">
                {editUnlocked ? <input
                    className="inp-bare editable font-bold text-[14px] text-jade-dark flex-1"
                    value={n.author}
                    placeholder="姓名"
                    onChange={(e) => mutate((d) => { d.notes[i].author = e.target.value; })}
                  /> : <strong className="text-[14px] text-jade-dark flex-1">{n.author || '同行者'}</strong>}
                {target && (
                  <a href={target.href} className="pill text-[11px] no-underline shrink-0 hover:bg-jade-light">{target.text}</a>
                )}
                <span className="text-muted text-[12px] shrink-0">{n.ts || ''}</span>
                <button
                  aria-label={`删除留言（${n.author || '同行者'}）`}
                  className="btn-mini edit-only"
                  onClick={() => mutate((d) => { d.notes.splice(i, 1); })}
                >
                  ×
                </button>
              </div>
              {editUnlocked ? <textarea
                  className="editable w-full border-none bg-transparent resize-y min-h-[52px] p-0 outline-none text-ink leading-[1.65]"
                  value={n.text}
                  placeholder="留言"
                  onChange={(e) => mutate((d) => { d.notes[i].text = e.target.value; })}
                /> : <MarkdownText text={n.text} className="note-copy" />}
            </article>
            );
          })
        )}
      </div>
    </section>
  );
}
