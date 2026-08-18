import { parseRate } from '../../lib/currency';
import type { Mutate, TripState } from '../../types';

export default function CurrencySection({
  state, homeCurrency, mutate,
}: {
  state: TripState; homeCurrency: string; mutate: Mutate;
}) {
  const home    = homeCurrency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate    = parseRate(state.exchangeRate);

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">💱 货币换算</h2>
        <span className="text-muted text-[13px]">本地货币在「旅行设置」中修改</span>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="field min-w-[160px]">
          <label>本地货币（家乡）</label>
          <input className="inp editable" value={home} readOnly />
        </div>
        <div className="field min-w-[160px]">
          <label>目的地货币</label>
          <input
            className="inp editable"
            placeholder="例如 CNY"
            value={state.foreignCurrency}
            onChange={(e) => mutate((d) => { d.foreignCurrency = e.target.value.toUpperCase(); })}
          />
        </div>
        <div className="field min-w-[160px]">
          <label>汇率：1 {foreign} = ? {home}</label>
          <input
            className="inp editable"
            type="number"
            step="0.0001"
            min="0"
            placeholder="例如 0.62"
            value={state.exchangeRate}
            onChange={(e) => mutate((d) => { d.exchangeRate = e.target.value; })}
          />
        </div>
      </div>

      {!rate && (
        <p className="text-muted text-[13px] mt-2">
          设置汇率后，交通与预算项目可自动换算显示 {home} / {foreign} 双币金额。
        </p>
      )}
    </section>
  );
}
