import { defaultHotel } from '../../state';
import type { Mutate, TripState } from '../../types';

export default function HotelsSection({
  state, editUnlocked, mutate,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate;
}) {
  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">🏨 酒店候选</h2>
        <span className="text-muted text-[13px]">适用于任何目的地</span>
      </div>

      {state.hotels.length === 0 ? (
        <div className="empty-state">暂无酒店候选</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
          {state.hotels.map((h, i) => (
            <article key={i} className="bg-surface border border-line rounded-lg p-4 shadow-xs flex flex-col gap-2">
              <div className="flex gap-1.5">
                <input
                  className="inp editable w-20 shrink-0"
                  value={h.rank}
                  placeholder="排名"
                  onChange={(e) => mutate((d) => { d.hotels[i].rank = e.target.value; })}
                />
                <input
                  className="inp editable flex-1 font-bold"
                  value={h.name}
                  placeholder="酒店名称"
                  onChange={(e) => mutate((d) => { d.hotels[i].name = e.target.value; })}
                />
                <button className="btn-mini edit-only shrink-0" onClick={() => mutate((d) => { d.hotels.splice(i, 1); })}>×</button>
              </div>
              <input className="inp editable" value={h.addr} placeholder="地址 / 地铁 / 区域" onChange={(e) => mutate((d) => { d.hotels[i].addr = e.target.value; })} />
              <input className="inp editable" value={h.warn} placeholder="⚠️ 注意事项" onChange={(e) => mutate((d) => { d.hotels[i].warn = e.target.value; })} />
              <textarea className="inp editable min-h-[70px] resize-y" value={h.pointsText} placeholder="优点 / 缺点 / 适合原因" onChange={(e) => mutate((d) => { d.hotels[i].pointsText = e.target.value; })} />
              <textarea className="inp editable min-h-[52px] resize-y" value={h.notes} placeholder="讨论备注" onChange={(e) => mutate((d) => { d.hotels[i].notes = e.target.value; })} />

              <div className="pt-2 border-t border-dashed border-line">
                {h.link.map((l, li) => (
                  <div key={li} className="grid grid-cols-[1fr_1.6fr_auto] gap-1.5 mb-1.5 items-center">
                    <input className="inp editable" value={l.label} onChange={(e) => mutate((d) => { d.hotels[i].link[li].label = e.target.value; })} />
                    <input className="inp editable" value={l.url} onChange={(e) => mutate((d) => { d.hotels[i].link[li].url = e.target.value; })} />
                    <button className="btn-mini edit-only" onClick={() => mutate((d) => { d.hotels[i].link.splice(li, 1); })}>×</button>
                  </div>
                ))}
                {editUnlocked && (
                  <button className="btn-mini edit-only mt-1" onClick={() => mutate((d) => { d.hotels[i].link.push({ label: '链接', url: '' }); })}>
                    ＋ 添加链接
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editUnlocked && (
        <button className="add-btn edit-only mt-3" onClick={() => mutate((d) => { d.hotels.push(defaultHotel()); })}>
          ＋ 添加酒店
        </button>
      )}
    </section>
  );
}
