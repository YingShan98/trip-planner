import { defaultHotel } from '../../state';
import type { Mutate, TripState } from '../../types';
import MarkdownText from '../MarkdownText';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {state.hotels.map((h, i) => (
            <article key={i} className="bg-surface border border-line rounded-lg p-4 shadow-xs flex flex-col gap-2.5">

              {/* Row 1: rank badge + delete */}
              <div className="flex items-center justify-between gap-2">
                {editUnlocked ? <input
                    className="inp editable w-[90px] text-[12px] shrink-0"
                    value={h.rank}
                    placeholder="排名 / 状态"
                    onChange={(e) => mutate((d) => { d.hotels[i].rank = e.target.value; })}
                  /> : <span className="pill">{h.rank || '未排名'}</span>}
                <button
                  className="btn-mini edit-only shrink-0"
                  onClick={() => mutate((d) => { d.hotels.splice(i, 1); })}
                >
                  ×
                </button>
              </div>

              {/* Row 2: hotel name — full width, prominent */}
              {editUnlocked ? <input
                  className="inp editable font-bold text-[15px]"
                  value={h.name}
                  placeholder="酒店名称"
                  onChange={(e) => mutate((d) => { d.hotels[i].name = e.target.value; })}
                /> : <h3 className="font-serif font-bold text-[18px] text-jade-dark">{h.name}</h3>}

              {/* Row 3+: detail fields */}
              {editUnlocked ? <>
                <input className="inp editable text-[13px]" value={h.addr} placeholder="地址 / 地铁站 / 区域" onChange={(e) => mutate((d) => { d.hotels[i].addr = e.target.value; })} />
                <input className="inp editable text-[13px]" value={h.warn} placeholder="注意事项" onChange={(e) => mutate((d) => { d.hotels[i].warn = e.target.value; })} />
                <textarea className="inp editable min-h-[72px] resize-y text-[13px]" value={h.pointsText} placeholder="优点 / 缺点 / 适合原因" onChange={(e) => mutate((d) => { d.hotels[i].pointsText = e.target.value; })} />
                <textarea className="inp editable min-h-[52px] resize-y text-[13px]" value={h.notes} placeholder="讨论备注" onChange={(e) => mutate((d) => { d.hotels[i].notes = e.target.value; })} />
              </> : <div className="flex flex-col gap-3">
                {h.addr && <div className="rich-field"><span className="rich-label">位置</span><MarkdownText text={h.addr} /></div>}
                {h.warn && <div className="rich-field warning-field"><span className="rich-label">注意事项</span><MarkdownText text={h.warn} /></div>}
                {h.pointsText && <div className="rich-field"><span className="rich-label">选择理由</span><MarkdownText text={h.pointsText} /></div>}
                {h.notes && <div className="rich-field"><span className="rich-label">备注</span><MarkdownText text={h.notes} /></div>}
              </div>}

              {/* Links */}
              <div className="pt-2 border-t border-dashed border-line">
                {editUnlocked ? (
                  <>
                    {h.link.map((l, li) => (
                      <div key={li} className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_auto] gap-1.5 mb-1.5 items-center">
                        <input
                          className="inp editable text-[12px]"
                          value={l.label}
                          placeholder="名称"
                          onChange={(e) => mutate((d) => { d.hotels[i].link[li].label = e.target.value; })}
                        />
                        <input
                          className="inp editable text-[12px]"
                          value={l.url}
                          placeholder="https://..."
                          onChange={(e) => mutate((d) => { d.hotels[i].link[li].url = e.target.value; })}
                        />
                        <button
                          className="btn-mini edit-only"
                          onClick={() => mutate((d) => { d.hotels[i].link.splice(li, 1); })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {h.link.filter((l) => l.url.trim()).map((l, li) => (
                      <a
                        key={li}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-jade text-[12.5px] hover:underline"
                      >
                        ↗ {l.label || l.url}
                      </a>
                    ))}
                  </div>
                )}
                {editUnlocked && (
                  <button
                    className="btn-mini edit-only mt-1"
                    onClick={() => mutate((d) => { d.hotels[i].link.push({ label: '链接', url: '' }); })}
                  >
                    ＋ 添加链接
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editUnlocked && (
        <button
          className="add-btn edit-only mt-3"
          onClick={() => mutate((d) => { d.hotels.push(defaultHotel()); })}
        >
          ＋ 添加酒店
        </button>
      )}
    </section>
  );
}
