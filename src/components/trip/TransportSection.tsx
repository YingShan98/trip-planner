import { defaultTransport } from '../../state';
import { convertAmount, formatMoney, parseRate } from '../../lib/currency';
import type { Mutate, TripState } from '../../types';
import MarkdownText from '../MarkdownText';

export default function TransportSection({
  state, editUnlocked, mutate, homeCurrency,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; homeCurrency: string;
}) {
  const home    = homeCurrency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate    = parseRate(state.exchangeRate);

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">🚐 交通参考</h2>
        <span className="text-muted text-[13px]">可用于包车、火车、地铁、租车等</span>
      </div>

      {state.transport.length === 0 ? (
        <div className="empty-state">暂无交通参考</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {state.transport.map((x, i) => (
            <article key={i} className="bg-surface border border-line rounded-lg p-4 shadow-xs flex flex-col gap-2.5">

              {/* Row 1: type name + delete */}
              <div className="flex items-start gap-2">
                {editUnlocked ? <input
                    className="inp editable flex-1 font-bold text-[15px]"
                    value={x.type}
                    placeholder="交通方式 / 车型"
                    onChange={(e) => mutate((d) => { d.transport[i].type = e.target.value; })}
                  /> : <h3 className="font-serif font-bold text-[17px] text-jade-dark">{x.type}</h3>}
                <button
                  className="btn-mini edit-only shrink-0 mt-0.5"
                  onClick={() => mutate((d) => { d.transport.splice(i, 1); })}
                >
                  ×
                </button>
              </div>

              {/* Description */}
              {editUnlocked ? <textarea
                  className="inp editable min-h-[56px] resize-y text-[13px]"
                  value={x.description}
                  placeholder="说明（路线、时间、安排等）"
                  onChange={(e) => mutate((d) => { d.transport[i].description = e.target.value; })}
                /> : <MarkdownText text={x.description} className="rich-field" />}

              {/* Price label */}
              {editUnlocked ? <input
                  className="inp editable text-[13px]"
                  value={x.price}
                  placeholder="价格说明，如 / 天、/ 人"
                  onChange={(e) => mutate((d) => { d.transport[i].price = e.target.value; })}
                /> : x.price && <div className="rich-field"><span className="rich-label">计价方式</span><MarkdownText text={x.price} /></div>}

              {/* Amount + currency row */}
              {editUnlocked ? (
                <div className="flex gap-1.5">
                  <input
                    className="inp editable flex-1"
                    type="number"
                    value={x.amount}
                    placeholder="金额"
                    onChange={(e) => mutate((d) => { d.transport[i].amount = e.target.value; })}
                  />
                  <select
                    className="inp editable w-auto"
                    value={x.currency}
                    onChange={(e) => mutate((d) => { d.transport[i].currency = e.target.value as 'home' | 'foreign'; })}
                  >
                    <option value="home">{home}</option>
                    <option value="foreign">{foreign}</option>
                  </select>
                </div>
              ) : x.amount !== '' && x.amount !== null && !Number.isNaN(Number(x.amount)) ? (
                <div className="rich-field">
                  <span className="rich-label">金额</span>
                  <span className="text-[14px] font-semibold text-jade-dark">{formatMoney(Number(x.amount), x.currency === 'home' ? home : foreign)}</span>
                </div>
              ) : null}

              {/* Converted amount */}
              {x.amount !== '' && x.amount !== null && !Number.isNaN(Number(x.amount)) && (() => {
                const conv = convertAmount(Number(x.amount), x.currency, rate);
                return (
                  <p className="text-muted text-[12.5px] border-t border-line pt-2">
                    {conv.home !== null && conv.foreign !== null
                      ? `≈ ${formatMoney(conv.home, home)} / ${formatMoney(conv.foreign, foreign)}`
                      : `${formatMoney(x.currency === 'home' ? conv.home : conv.foreign, x.currency === 'home' ? home : foreign)} · 未换算`}
                  </p>
                );
              })()}
            </article>
          ))}
        </div>
      )}

      {editUnlocked && (
        <button
          className="add-btn edit-only mt-3"
          onClick={() => mutate((d) => { d.transport.push(defaultTransport()); })}
        >
          ＋ 添加交通参考
        </button>
      )}
    </section>
  );
}
