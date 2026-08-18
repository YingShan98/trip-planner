import { defaultTransport } from '../../state';
import { convertAmount, formatMoney, parseRate } from '../../lib/currency';
import type { Mutate, TripState } from '../../types';

export default function TransportSection({
  state,
  editUnlocked,
  mutate,
  homeCurrency,
}: {
  state: TripState;
  editUnlocked: boolean;
  mutate: Mutate;
  homeCurrency: string;
}) {
  const home = homeCurrency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate = parseRate(state.exchangeRate);

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
                placeholder="价格说明，如 /天、/人"
                onChange={(e) =>
                  mutate((d) => {
                    d.transport[i].price = e.target.value;
                  })
                }
              />
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  className="editable"
                  type="number"
                  value={x.amount}
                  placeholder="金额"
                  style={{ flex: 1 }}
                  onChange={(e) =>
                    mutate((d) => {
                      d.transport[i].amount = e.target.value;
                    })
                  }
                />
                <select
                  className="editable"
                  value={x.currency}
                  onChange={(e) =>
                    mutate((d) => {
                      d.transport[i].currency = e.target.value as 'home' | 'foreign';
                    })
                  }
                >
                  <option value="home">{home}</option>
                  <option value="foreign">{foreign}</option>
                </select>
              </div>
              {x.amount !== '' &&
                x.amount !== null &&
                !Number.isNaN(Number(x.amount)) &&
                (() => {
                  const conv = convertAmount(Number(x.amount), x.currency, rate);
                  return (
                    <div className="muted" style={{ marginTop: 4 }}>
                      {conv.home !== null && conv.foreign !== null
                        ? `≈ ${formatMoney(conv.home, home)} / ${formatMoney(conv.foreign, foreign)}`
                        : `${formatMoney(x.currency === 'home' ? conv.home : conv.foreign, x.currency === 'home' ? home : foreign)} · 设置汇率后换算`}
                    </div>
                  );
                })()}
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
