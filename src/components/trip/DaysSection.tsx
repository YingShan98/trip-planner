import { defaultActivity, defaultDay } from '../../state';
import type { Activity, Day, Intensity, Mutate, TripState } from '../../types';

const TIME_OPTIONS = ['清晨', '上午', '午间', '下午', '傍晚', '晚间', '全天'];
const intensityLabel = (i: Intensity) => (i === 'light' ? '轻松' : i === 'medium' ? '中等' : '较累');

function ActivityRow({
  a,
  di,
  ai,
  editUnlocked,
  mutate,
}: {
  a: Activity;
  di: number;
  ai: number;
  editUnlocked: boolean;
  mutate: Mutate;
}) {
  return (
    <div className="activity">
      <div className="activity-top">
        <select
          className="editable"
          value={a.t}
          onChange={(e) =>
            mutate((d) => {
              d.days[di].items[ai].t = e.target.value;
            })
          }
        >
          {TIME_OPTIONS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          className="editable"
          value={a.x}
          placeholder="行程内容"
          onChange={(e) =>
            mutate((d) => {
              d.days[di].items[ai].x = e.target.value;
            })
          }
        />
        {editUnlocked && (
          <button
            className="mini edit-only"
            onClick={() =>
              mutate((d) => {
                d.days[di].items.splice(ai, 1);
              })
            }
          >
            ×
          </button>
        )}
      </div>
      <div className="activity-extra">
        <input
          className="editable"
          value={a.move}
          placeholder="🚗 交通"
          onChange={(e) =>
            mutate((d) => {
              d.days[di].items[ai].move = e.target.value;
            })
          }
        />
        <input
          className="editable"
          value={a.fee}
          placeholder="💰 费用"
          onChange={(e) =>
            mutate((d) => {
              d.days[di].items[ai].fee = e.target.value;
            })
          }
        />
      </div>
      <div className="links">
        {a.link.map((l, li) => (
          <div className="link-row" key={li}>
            <input
              className="editable"
              value={l.label}
              placeholder="链接名称"
              onChange={(e) =>
                mutate((d) => {
                  d.days[di].items[ai].link[li].label = e.target.value;
                })
              }
            />
            <input
              className="editable"
              value={l.url}
              placeholder="https://..."
              onChange={(e) =>
                mutate((d) => {
                  d.days[di].items[ai].link[li].url = e.target.value;
                })
              }
            />
            <button
              className="mini edit-only"
              onClick={() =>
                mutate((d) => {
                  d.days[di].items[ai].link.splice(li, 1);
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
                d.days[di].items[ai].link.push({ label: '链接', url: '' });
              })
            }
          >
            ＋ 添加链接
          </button>
        )}
      </div>
    </div>
  );
}

function DayCard({
  d,
  i,
  total,
  collapsed,
  editUnlocked,
  mutate,
  mutateNoSave,
}: {
  d: Day;
  i: number;
  total: number;
  collapsed: boolean;
  editUnlocked: boolean;
  mutate: Mutate;
  mutateNoSave: Mutate;
}) {
  const moveDay = (delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= total) return;
    mutate((s) => {
      [s.days[i], s.days[j]] = [s.days[j], s.days[i]];
      s.days.forEach((day, k) => (day.n = k + 1));
    });
  };

  return (
    <article className={`day-card${collapsed ? ' collapsed' : ''}`}>
      <div className="day-head">
        <span className="day-num">D{i + 1}</span>
        <input
          className="day-title editable"
          value={d.title}
          onChange={(e) =>
            mutate((s) => {
              s.days[i].title = e.target.value;
            })
          }
        />
        <span className="pill">{intensityLabel(d.intensity)}</span>
        <div className="day-actions">
          <button
            className="mini"
            onClick={() =>
              mutateNoSave((s) => {
                s.collapsed[i] = !s.collapsed[i];
              })
            }
          >
            {collapsed ? '展开' : '折叠'}
          </button>
          {editUnlocked && (
            <>
              <button className="mini edit-only" disabled={i === 0} onClick={() => moveDay(-1)}>
                ↑
              </button>
              <button className="mini edit-only" disabled={i === total - 1} onClick={() => moveDay(1)}>
                ↓
              </button>
              <button
                className="mini edit-only"
                onClick={() => {
                  if (!confirm('删除这个 Day？')) return;
                  mutate((s) => {
                    s.days.splice(i, 1);
                    s.days.forEach((day, k) => (day.n = k + 1));
                  });
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
      <div className="day-body">
        <div className="subline">
          <select
            className="editable"
            value={d.intensity}
            onChange={(e) =>
              mutate((s) => {
                s.days[i].intensity = e.target.value as Intensity;
              })
            }
          >
            <option value="light">轻松</option>
            <option value="medium">中等</option>
            <option value="heavy">较累</option>
          </select>
          <input
            className="wide editable"
            value={d.steps}
            placeholder="步行时长/体力提示"
            onChange={(e) =>
              mutate((s) => {
                s.days[i].steps = e.target.value;
              })
            }
          />
          <input
            className="wide editable"
            value={d.mapUrl}
            placeholder="Google Maps / 地图链接"
            onChange={(e) =>
              mutate((s) => {
                s.days[i].mapUrl = e.target.value;
              })
            }
          />
        </div>
        {d.mapUrl && (
          <div>
            <a href={d.mapUrl} target="_blank" rel="noopener noreferrer">
              🗺️ 打开路线地图
            </a>
          </div>
        )}
        <div>
          {d.items.map((a, j) => (
            <ActivityRow key={j} a={a} di={i} ai={j} editUnlocked={editUnlocked} mutate={mutate} />
          ))}
        </div>
        {editUnlocked && (
          <button
            className="add-btn edit-only"
            onClick={() =>
              mutate((s) => {
                s.days[i].items.push(defaultActivity());
              })
            }
          >
            ＋ 添加行程项目
          </button>
        )}
        <label className="muted" style={{ display: 'block', marginTop: 10 }}>
          Day 备注
        </label>
        <textarea
          className="editable"
          value={d.notes || ''}
          placeholder="当天注意事项、老人休息安排、备选方案等"
          onChange={(e) =>
            mutate((s) => {
              s.days[i].notes = e.target.value;
            })
          }
        />
      </div>
    </article>
  );
}

export default function DaysSection({
  state,
  editUnlocked,
  mutate,
  mutateNoSave,
}: {
  state: TripState;
  editUnlocked: boolean;
  mutate: Mutate;
  mutateNoSave: Mutate;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>🗓️ 行程</h2>
        <span className="muted">任意天数 · 可自由调整顺序</span>
      </div>
      {state.days.map((d, i) => (
        <DayCard
          key={i}
          d={d}
          i={i}
          total={state.days.length}
          collapsed={Boolean(state.collapsed[i])}
          editUnlocked={editUnlocked}
          mutate={mutate}
          mutateNoSave={mutateNoSave}
        />
      ))}
      {editUnlocked && (
        <button
          className="add-btn edit-only"
          onClick={() =>
            mutate((s) => {
              s.days.push(defaultDay(s.days.length + 1));
            })
          }
        >
          ＋ 添加 Day
        </button>
      )}
    </section>
  );
}
