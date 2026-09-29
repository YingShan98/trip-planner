import { useState } from 'react';
import { convertToLocalTrip, hasForeignAmounts, parseRate } from '../../lib/currency';
import { fetchExchangeRate } from '../../lib/exchangeRate';
import { confirmDialog } from '../../lib/confirm';
import { toast } from '../../lib/toast';
import type { Mutate, TripState } from '../../types';

export default function CurrencySection({
  state, homeCurrency, editUnlocked, mutate,
}: {
  state: TripState; homeCurrency: string; editUnlocked: boolean; mutate: Mutate;
}) {
  const [fetchingRate, setFetchingRate] = useState(false);
  const home    = homeCurrency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate    = parseRate(state.exchangeRate);

  // A local trip has nothing to convert, so viewers don't see the section at all.
  if (state.isLocal && !editUnlocked) return null;

  const setLocal = async (local: boolean) => {
    if (local === state.isLocal) return;
    if (!local) { mutate((d) => { d.isLocal = false; }); return; }
    if (hasForeignAmounts(state) && !await confirmDialog(
      rate
        ? `交通和预算中以 ${foreign} 填写的金额，将按当前汇率（1 ${foreign} = ${rate} ${home}）换算成 ${home}。确定改为本地旅行？`
        : `交通和预算中以 ${foreign} 填写的金额会直接改标为 ${home}（没有汇率，数值不换算）。确定改为本地旅行？`,
      { title: '改为本地旅行', confirmLabel: '改为本地旅行' },
    )) return;
    mutate(convertToLocalTrip);
  };

  const fetchRate = async () => {
    const code = state.foreignCurrency.trim();
    if (!code) { toast('请先填写目的地货币代码'); return; }
    setFetchingRate(true);
    try {
      const latest = await fetchExchangeRate(code, home);
      if (latest === null) { toast(`没有找到 ${code} → ${home} 的汇率，请手动填写`); return; }
      const rounded = Number(latest.toPrecision(6));
      mutate((d) => { d.exchangeRate = rounded; });
      toast(`已填入最新汇率：1 ${code} = ${rounded} ${home}，可再手动调整`);
    } finally { setFetchingRate(false); }
  };

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">💱 货币换算</h2>
        <span className="text-muted text-[13px]">本地货币在「旅行设置」中修改</span>
      </div>

      {editUnlocked && (
        <div className="flex gap-1.5 mb-4 p-1 bg-surface-2 rounded-lg w-fit" role="radiogroup" aria-label="旅行类型">
          {([[false, '✈️ 出国旅行（需要换算）'], [true, '🏠 本地旅行（无需换算）']] as const).map(([local, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={state.isLocal === local}
              className={`btn-mini !border-transparent ${state.isLocal === local ? 'bg-surface shadow-xs !text-jade-dark font-bold' : ''}`}
              onClick={() => setLocal(local)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {state.isLocal ? (
        <p className="text-muted text-[13px]">本地旅行不需要货币换算，交通和预算金额都以 {home} 计算。</p>
      ) : (
        <>
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
                readOnly={!editUnlocked}
                onChange={(e) => mutate((d) => { d.foreignCurrency = e.target.value.toUpperCase(); })}
              />
            </div>
            <div className="field min-w-[160px]">
              <label>汇率：1 {foreign} = ? {home}</label>
              <div className="flex gap-2">
                <input
                  className="inp editable flex-1 min-w-[110px]"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="例如 0.62"
                  value={state.exchangeRate}
                  readOnly={!editUnlocked}
                  onChange={(e) => mutate((d) => { d.exchangeRate = e.target.value; })}
                />
                {editUnlocked && (
                  <button type="button" className="btn-ghost shrink-0" disabled={fetchingRate} onClick={fetchRate}>
                    {fetchingRate ? '获取中…' : '🔄 获取最新汇率'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {editUnlocked && (
            <p className="text-muted text-[12.5px] mt-2">在线汇率仅作参考（欧洲央行参考汇率），填入后可手动修改，以输入框中的数值为准。</p>
          )}
          {!rate && (
            <p className="text-muted text-[13px] mt-2">
              设置汇率后，交通与预算项目可自动换算显示 {home} / {foreign} 双币金额。
            </p>
          )}
        </>
      )}
    </section>
  );
}
