import { defaultTransport } from '../../state';
import type { Mutate, TripState } from '../../types';

export default function TransportSection({
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
        <h2>🚐 交通参考</h2>
        <span className="muted">可用于包车、火车、地铁、租车等</span>
      </div>
      <div className="transport-grid">
        {state.transport.length === 0 ? (
          <div className="empty">暂无交通参考</div>
        ) : (
          state.transport.map((x, i) => (
            <article className="transport-card" key={i}>
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  className="editable"
                  value={x.type}
                  placeholder="交通方式 / 车型"
                  style={{ flex: 1, fontWeight: 700 }}
                  onChange={(e) =>
                    mutate((d) => {
                      d.transport[i].type = e.target.value;
                    })
                  }
                />
                {editUnlocked && (
                  <button
                    className="mini edit-only"
                    onClick={() =>
                      mutate((d) => {
                        d.transport.splice(i, 1);
                      })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
              <textarea
                className="editable"
                value={x.description}
                placeholder="说明"
                onChange={(e) =>
                  mutate((d) => {
                    d.transport[i].description = e.target.value;
                  })
                }
              />
              <input
                className="editable"
                value={x.price}
                placeholder="参考价格"
                onChange={(e) =>
                  mutate((d) => {
                    d.transport[i].price = e.target.value;
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
              d.transport.push(defaultTransport());
            })
          }
        >
          ＋ 添加交通参考
        </button>
      )}
    </section>
  );
}
