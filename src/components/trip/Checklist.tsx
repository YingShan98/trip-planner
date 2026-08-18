import { useState } from 'react';
import { uid } from '../../state';
import type { Mutate, TripState } from '../../types';

export default function Checklist({
  state,
  editUnlocked,
  mutate,
}: {
  state: TripState;
  editUnlocked: boolean;
  mutate: Mutate;
}) {
  const [newText, setNewText] = useState('');

  const add = () => {
    const v = newText.trim();
    if (!v) return;
    mutate((d) => {
      d.checklist.push({ id: uid('c'), text: v, done: false });
    });
    setNewText('');
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2>☑️ Checklist</h2>
        <span className="muted">出发前要完成的事项</span>
      </div>
      <div className="checklist">
        {state.checklist.length === 0 ? (
          <div className="empty">暂无事项</div>
        ) : (
          state.checklist.map((x, i) => (
            <div className={`check-row${x.done ? ' done' : ''}`} key={i}>
              <input
                className="editable"
                type="checkbox"
                checked={x.done}
                onChange={(e) =>
                  mutate((d) => {
                    d.checklist[i].done = e.target.checked;
                  })
                }
              />
              <span className="grow">{x.text}</span>
              <button
                className="mini edit-only"
                onClick={() =>
                  mutate((d) => {
                    d.checklist.splice(i, 1);
                  })
                }
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      {editUnlocked && (
        <div className="inline-add edit-only">
          <input placeholder="添加 Checklist 项目" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <button className="primary" onClick={add}>
            添加
          </button>
        </div>
      )}
    </section>
  );
}
