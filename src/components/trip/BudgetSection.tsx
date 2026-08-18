import { defaultBudget } from '../../state';
import { convertAmount, formatMoney, parseRate } from '../../lib/currency';
import type { Mutate, TripState } from '../../types';

export default function BudgetSection({
  state,
  editUnlocked,
  mutate,
  currency,
}: {
  state: TripState;
  editUnlocked: boolean;
  mutate: Mutate;
  currency: string;
}) {
  const home = currency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate = parseRate(state.exchangeRate);

  let totalHome = 0;
  let unconverted = 0;
  for (const x of state.budget) {
    const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
    const conv = convertAmount(raw, x.currency, rate);
    if (conv.home !== null) totalHome += conv.home;
    else unconverted++;
  }
  const totalForeign = rate !== null ? totalHome / rate : null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>💰 预算</h2>
        <span className="muted">
          {home} · 估算总额 {formatMoney(totalHome, '')}
          {totalForeign !== null ? ` ≈ ${formatMoney(totalForeign, foreign)}` : ''}
          {unconverted > 0 ? ` · ${unconverted} 项未换算（请设置汇率）` : ''}
        </span>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table className="budget-table">
          <thead>
            <tr>
              <th>分类</th>
              <th>数量</th>
              <th>单价</th>
              <th>币种</th>
              <th>小计</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.budget.map((x, i) => {
              const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
              const conv = convertAmount(raw, x.currency, rate);
              return (
              <tr key={i}>
                <td>
                  <input
                    className="editable"
                    value={x.category}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].category = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="editable"
                    type="number"
                    value={x.quantity}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].quantity = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="editable"
                    type="number"
                    value={x.unitPrice}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].unitPrice = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    className="editable"
                    value={x.currency}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].currency = e.target.value as 'home' | 'foreign';
                      })
                    }
                  >
                    <option value="home">{home}</option>
                    <option value="foreign">{foreign}</option>
                  </select>
                </td>
                <td>
                  {conv.home !== null && conv.foreign !== null ? (
                    <>
                      {formatMoney(conv.home, home)}
                      <br />
                      <span className="muted">≈ {formatMoney(conv.foreign, foreign)}</span>
                    </>
                  ) : (
                    <>
                      {formatMoney(x.currency === 'home' ? conv.home : conv.foreign, x.currency === 'home' ? home : foreign)}
                      <br />
                      <span className="muted">设置汇率后换算</span>
                    </>
                  )}
                </td>
                <td>
                  <input
                    className="editable"
                    value={x.note}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].note = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  {editUnlocked && (
                    <button
                      className="mini edit-only"
                      onClick={() =>
                        mutate((d) => {
                          d.budget.splice(i, 1);
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editUnlocked && (
        <button
          className="add-btn edit-only"
          onClick={() =>
            mutate((d) => {
              d.budget.push(defaultBudget());
            })
          }
        >
          ＋ 添加预算项目
        </button>
      )}
    </section>
  );
}
