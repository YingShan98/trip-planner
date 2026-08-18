import { parseRate } from '../../lib/currency';
import type { Mutate, TripState } from '../../types';

export default function CurrencySection({
  state,
  homeCurrency,
  mutate,
}: {
  state: TripState;
  homeCurrency: string;
  mutate: Mutate;
}) {
  const home = homeCurrency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate = parseRate(state.exchangeRate);

  return (
    <section className="section">
      <div className="section-head">
        <h2>💱 货币换算</h2>
        <span className="muted">本地货币在「旅行设置」中修改</span>
      </div>
      <div className="currency-row">
        <div className="field">
          <label>本地货币（家乡）</label>
          <input className="editable" value={home} readOnly />
        </div>
        <div className="field">
          <label>目的地货币</label>
          <input
            className="editable"
            placeholder="例如 CNY"
            value={state.foreignCurrency}
            onChange={(e) =>
              mutate((d) => {
                d.foreignCurrency = e.target.value.toUpperCase();
              })
            }
          />
        </div>
        <div className="field">
          <label>
            汇率：1 {foreign} = ? {home}
          </label>
          <input
            className="editable"
            type="number"
            step="0.0001"
            min="0"
            placeholder="例如 0.62"
            value={state.exchangeRate}
            onChange={(e) =>
              mutate((d) => {
                d.exchangeRate = e.target.value;
              })
            }
          />
        </div>
      </div>
      {!rate && (
        <div className="muted" style={{ marginTop: 8 }}>
          设置汇率后，交通与预算项目可自动换算显示 {home} / {foreign} 双币金额。
        </div>
      )}
    </section>
  );
}
