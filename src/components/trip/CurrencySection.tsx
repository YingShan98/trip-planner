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
    <>
      <p className="text-muted text-[12.5px] mb-3.5">本地货币在「旅行设置」中修改</p>
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
    </>
  );
}
