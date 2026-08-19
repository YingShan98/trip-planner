import { useState } from 'react';
import { defaultActivity, defaultDay } from '../../state';
import type { Activity, Day, Intensity, Mutate, TripState } from '../../types';

const TIME_OPTIONS = ['清晨', '上午', '午间', '下午', '傍晚', '晚间', '全天'];
const intensityLabel = (i: Intensity) => i === 'light' ? '轻松' : i === 'medium' ? '中等' : '较累';
const intensityClass = (i: Intensity) =>
  i === 'light'  ? 'bg-[#e5f4ec] text-[#2a7d52] border-[#b8ddc7]' :
  i === 'medium' ? 'bg-[#fdf3dc] text-[#9a6e08] border-[#ecd98a]' :
                   'bg-[#fdf0ee] text-[#b53a2a] border-[#f0bdb4]';

function LinkRows({ di, ai, links, editUnlocked, mutate }: {
  di: number; ai: number; links: { label: string; url: string }[];
  editUnlocked: boolean; mutate: Mutate;
}) {
  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-line">
      {editUnlocked ? (
        <>
          {links.map((l, li) => (
            <div key={li} className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_auto] gap-1.5 mb-1.5 items-center">
              <input className="inp editable" value={l.label} placeholder="链接名称"
                onChange={(e) => mutate((d) => { d.days[di].items[ai].link[li].label = e.target.value; })} />
              <input className="inp editable" value={l.url} placeholder="https://..."
                onChange={(e) => mutate((d) => { d.days[di].items[ai].link[li].url = e.target.value; })} />
              <button className="btn-mini edit-only"
                onClick={() => mutate((d) => { d.days[di].items[ai].link.splice(li, 1); })}>×</button>
            </div>
          ))}
          <button className="btn-mini edit-only mt-1"
            onClick={() => mutate((d) => { d.days[di].items[ai].link.push({ label: '链接', url: '' }); })}>
            ＋ 添加链接
          </button>
        </>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {links.filter((l) => l.url.trim()).map((l, li) => (
            <a key={li} href={l.url} target="_blank" rel="noopener noreferrer" className="text-jade text-[12.5px] hover:underline">
              ↗ {l.label || l.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ a, di, ai, total, editUnlocked, mutate }: {
  a: Activity; di: number; ai: number; total: number; editUnlocked: boolean; mutate: Mutate;
}) {
  const moveActivity = (delta: number) => {
    const j = ai + delta;
    if (j < 0 || j >= total) return;
    mutate((s) => { [s.days[di].items[ai], s.days[di].items[j]] = [s.days[di].items[j], s.days[di].items[ai]]; });
  };

  return (
    <div className="bg-surface-2 border border-line rounded p-3 mb-2.5 transition-all duration-150 hover:border-line-strong hover:shadow-xs">
      <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr_auto] gap-2 items-center mb-2">
        <select className="inp editable sm:w-auto"
          value={a.t}
          onChange={(e) => mutate((d) => { d.days[di].items[ai].t = e.target.value; })}>
          {TIME_OPTIONS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <input className="inp editable" value={a.x} placeholder="行程内容"
          onChange={(e) => mutate((d) => { d.days[di].items[ai].x = e.target.value; })} />
        {editUnlocked && (
          <div className="flex gap-1">
            <button className="btn-mini edit-only" disabled={ai === 0} onClick={() => moveActivity(-1)}>↑</button>
            <button className="btn-mini edit-only" disabled={ai === total - 1} onClick={() => moveActivity(1)}>↓</button>
            <button className="btn-mini edit-only"
              onClick={() => mutate((d) => { d.days[di].items.splice(ai, 1); })}>×</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="inp editable" value={a.move} placeholder="🚗 交通"
          onChange={(e) => mutate((d) => { d.days[di].items[ai].move = e.target.value; })} />
        <input className="inp editable" value={a.fee} placeholder="💰 费用"
          onChange={(e) => mutate((d) => { d.days[di].items[ai].fee = e.target.value; })} />
      </div>
      <LinkRows di={di} ai={ai} links={a.link} editUnlocked={editUnlocked} mutate={mutate} />
    </div>
  );
}

function DayCard({ d, i, total, collapsed, editUnlocked, mutate, mutateNoSave }: {
  d: Day; i: number; total: number; collapsed: boolean;
  editUnlocked: boolean; mutate: Mutate; mutateNoSave: Mutate;
}) {
  const [showMap, setShowMap] = useState(false);

  const moveDay = (delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= total) return;
    mutate((s) => {
      [s.days[i], s.days[j]] = [s.days[j], s.days[i]];
      s.days.forEach((day, k) => (day.n = k + 1));
    });
  };

  return (
    <article className="bg-surface border border-line rounded-lg overflow-hidden mb-3.5 shadow-xs transition-shadow duration-150 hover:shadow-sm">
      {/* Day header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-3 border-b border-line flex-wrap">
        <span className="bg-jade-dark text-white rounded-[5px] px-2.5 py-1 font-bold text-[11.5px] tracking-[0.06em] shrink-0">
          D{i + 1}
        </span>
        <input
          className="inp-bare editable flex-1 min-w-[140px] font-bold text-[15px] font-serif py-1"
          value={d.title}
          onChange={(e) => mutate((s) => { s.days[i].title = e.target.value; })}
        />
        <span className={`pill border ${intensityClass(d.intensity)}`}>{intensityLabel(d.intensity)}</span>
        <div className="flex gap-1.5 ml-auto">
          {d.mapUrl && (
            <button
              className={`btn-mini flex items-center gap-1 ${showMap ? 'bg-jade-dark !text-white border-jade-dark' : ''}`}
              onClick={() => setShowMap((v) => !v)}
            >
              🗺️ {showMap ? '收起地图' : '查看地图'}
            </button>
          )}
          <button className="btn-mini"
            onClick={() => mutateNoSave((s) => { s.collapsed[i] = !s.collapsed[i]; })}>
            {collapsed ? '展开' : '折叠'}
          </button>
          {editUnlocked && (
            <>
              <button className="btn-mini edit-only" disabled={i === 0} onClick={() => moveDay(-1)}>↑</button>
              <button className="btn-mini edit-only" disabled={i === total - 1} onClick={() => moveDay(1)}>↓</button>
              <button className="btn-mini edit-only"
                onClick={() => { if (!confirm('删除这个 Day？')) return; mutate((s) => { s.days.splice(i, 1); s.days.forEach((day, k) => (day.n = k + 1)); }); }}>
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* Map panel — independent of collapse, shown when toggled */}
      {showMap && d.mapUrl && (
        <div className="border-b border-line">
          <div className="flex items-center justify-between px-4 py-1.5 bg-surface-2 border-b border-dashed border-line">
            <span className="text-[11.5px] text-muted">地图预览</span>
            <a
              href={d.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-jade text-[12px] hover:underline"
            >
              ↗ 在新标签页打开
            </a>
          </div>
          <iframe
            src={d.mapUrl}
            className="w-full border-0 block"
            style={{ height: '260px' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${d.title} 地图`}
            allowFullScreen
          />
          <p className="px-4 py-2 text-[11px] text-muted bg-surface-2 border-t border-dashed border-line">
            提示：请粘贴 Google Maps 嵌入链接（地图页面 → 分享 → 嵌入地图 → 复制 src 中的 URL），普通链接无法在此预览。
          </p>
        </div>
      )}

      {/* Day body */}
      {!collapsed && (
        <div className="p-4">
          <div className="flex gap-2 flex-wrap mb-3.5">
            <select className="inp editable w-full sm:w-auto" value={d.intensity}
              onChange={(e) => mutate((s) => { s.days[i].intensity = e.target.value as Intensity; })}>
              <option value="light">轻松</option>
              <option value="medium">中等</option>
              <option value="heavy">较累</option>
            </select>
            <input className="inp editable flex-1 min-w-[180px]" value={d.steps} placeholder="步行时长/体力提示"
              onChange={(e) => mutate((s) => { s.days[i].steps = e.target.value; })} />
            <input
              className="inp editable flex-1 min-w-[180px]"
              value={d.mapUrl}
              placeholder="地图嵌入链接（Google Maps → 分享 → 嵌入地图 → 复制 src URL）"
              onChange={(e) => mutate((s) => { s.days[i].mapUrl = e.target.value; })}
            />
          </div>

          {d.items.map((a, j) => (
            <ActivityRow key={j} a={a} di={i} ai={j} total={d.items.length} editUnlocked={editUnlocked} mutate={mutate} />
          ))}

          {editUnlocked && (
            <button className="add-btn edit-only"
              onClick={() => mutate((s) => { s.days[i].items.push(defaultActivity()); })}>
              ＋ 添加行程项目
            </button>
          )}

          <label className="block text-muted text-[12px] font-semibold mt-3 mb-1.5">Day 备注</label>
          <textarea
            className="inp editable w-full min-h-[60px] resize-y"
            value={d.notes || ''}
            placeholder="当天注意事项、老人休息安排、备选方案等"
            onChange={(e) => mutate((s) => { s.days[i].notes = e.target.value; })}
          />
        </div>
      )}
    </article>
  );
}

export default function DaysSection({
  state, editUnlocked, mutate, mutateNoSave,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; mutateNoSave: Mutate;
}) {
  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">🗓️ 行程</h2>
        <span className="text-muted text-[13px]">任意天数 · 可自由调整顺序</span>
      </div>

      {state.days.map((d, i) => (
        <DayCard
          key={i} d={d} i={i} total={state.days.length}
          collapsed={Boolean(state.collapsed[i])}
          editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave}
        />
      ))}

      {editUnlocked && (
        <button className="add-btn edit-only"
          onClick={() => mutate((s) => { s.days.push(defaultDay(s.days.length + 1)); })}>
          ＋ 添加 Day
        </button>
      )}
    </section>
  );
}
