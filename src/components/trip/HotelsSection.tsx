import { defaultHotel } from '../../state';
import type { Mutate, TripState } from '../../types';

export default function HotelsSection({
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
        <h2>🏨 酒店候选</h2>
        <span className="muted">适用于任何目的地</span>
      </div>
      <div className="hotel-grid">
        {state.hotels.length === 0 ? (
          <div className="empty">暂无酒店候选</div>
        ) : (
          state.hotels.map((h, i) => (
            <article className="hotel-card" key={i}>
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  className="editable"
                  value={h.rank}
                  placeholder="排名"
                  onChange={(e) =>
                    mutate((d) => {
                      d.hotels[i].rank = e.target.value;
                    })
                  }
                />
                <input
                  className="editable"
                  value={h.name}
                  placeholder="酒店名称"
                  style={{ flex: 1, fontWeight: 700 }}
                  onChange={(e) =>
                    mutate((d) => {
                      d.hotels[i].name = e.target.value;
                    })
                  }
                />
                {editUnlocked && (
                  <button
                    className="mini edit-only"
                    onClick={() =>
                      mutate((d) => {
                        d.hotels.splice(i, 1);
                      })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
              <input
                className="editable"
                value={h.addr}
                placeholder="地址 / 地铁 / 区域"
                onChange={(e) =>
                  mutate((d) => {
                    d.hotels[i].addr = e.target.value;
                  })
                }
              />
              <input
                className="editable"
                value={h.warn}
                placeholder="⚠️ 注意事项"
                onChange={(e) =>
                  mutate((d) => {
                    d.hotels[i].warn = e.target.value;
                  })
                }
              />
              <textarea
                className="editable"
                value={h.pointsText}
                placeholder="优点 / 缺点 / 适合原因"
                onChange={(e) =>
                  mutate((d) => {
                    d.hotels[i].pointsText = e.target.value;
                  })
                }
              />
              <textarea
                className="editable"
                value={h.notes}
                placeholder="讨论备注"
                onChange={(e) =>
                  mutate((d) => {
                    d.hotels[i].notes = e.target.value;
                  })
                }
              />
              <div className="links">
                {h.link.map((l, li) => (
                  <div className="link-row" key={li}>
                    <input
                      className="editable"
                      value={l.label}
                      onChange={(e) =>
                        mutate((d) => {
                          d.hotels[i].link[li].label = e.target.value;
                        })
                      }
                    />
                    <input
                      className="editable"
                      value={l.url}
                      onChange={(e) =>
                        mutate((d) => {
                          d.hotels[i].link[li].url = e.target.value;
                        })
                      }
                    />
                    <button
                      className="mini edit-only"
                      onClick={() =>
                        mutate((d) => {
                          d.hotels[i].link.splice(li, 1);
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editUnlocked && (
                  <button
                    className="mini edit-only"
                    onClick={() =>
                      mutate((d) => {
                        d.hotels[i].link.push({ label: '链接', url: '' });
                      })
                    }
                  >
                    ＋ 添加链接
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      {editUnlocked && (
        <button
          className="add-btn edit-only"
          onClick={() =>
            mutate((d) => {
              d.hotels.push(defaultHotel());
            })
          }
        >
          ＋ 添加酒店
        </button>
      )}
    </section>
  );
}
