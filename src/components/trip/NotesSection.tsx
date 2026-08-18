import type { Mutate, TripState } from '../../types';

export default function NotesSection({
  state,
  editUnlocked,
  mutate,
}: {
  state: TripState;
  editUnlocked: boolean;
  mutate: Mutate;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>💬 留言板</h2>
        <span className="muted">一起讨论，不需要注册账号</span>
      </div>
      <div className="notes">
        {state.notes.length === 0 ? (
          <div className="empty">还没有留言</div>
        ) : (
          state.notes.map((n, i) => (
            <article className="note-card" key={i}>
              <div className="note-head">
                <input
                  className="editable"
                  value={n.author}
                  placeholder="姓名"
                  onChange={(e) =>
                    mutate((d) => {
                      d.notes[i].author = e.target.value;
                    })
                  }
                />
                <span className="muted">{n.ts || ''}</span>
                {editUnlocked && (
                  <button
                    className="mini edit-only"
                    onClick={() =>
                      mutate((d) => {
                        d.notes.splice(i, 1);
                      })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
              <textarea
                className="editable"
                value={n.text}
                placeholder="留言"
                onChange={(e) =>
                  mutate((d) => {
                    d.notes[i].text = e.target.value;
                  })
                }
              />
            </article>
          ))
        )}
      </div>
      {editUnlocked && (
        <button
          className="add-btn edit-only"
          onClick={() =>
            mutate((d) => {
              d.notes.unshift({ author: '', text: '', ts: new Date().toLocaleString('zh-CN') });
            })
          }
        >
          ＋ 写留言
        </button>
      )}
    </section>
  );
}
