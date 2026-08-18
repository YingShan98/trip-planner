import { defaultBudget } from '../../state';
import { convertAmount, formatMoney, parseRate } from '../../lib/currency';
import type { Mutate, TripState } from '../../types';

export default function BudgetSection({
  state, editUnlocked, mutate, currency,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; currency: string;
}) {
  const home    = currency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const rate    = parseRate(state.exchangeRate);

  let totalHome = 0, unconverted = 0;
  for (const x of state.budget) {
    const raw  = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
    const conv = convertAmount(raw, x.currency, rate);
    if (conv.home !== null) totalHome += conv.home;
    else unconverted++;
  }
  const totalForeign = rate !== null ? totalHome / rate : null;

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">💰 预算</h2>
        <span className="text-muted text-[13px]">
          {home} · 估算总额 {formatMoney(totalHome, '')}
          {totalForeign !== null ? ` ≈ ${formatMoney(totalForeign, foreign)}` : ''}
          {unconverted > 0 ? ` · ${unconverted} 项未换算（请设置汇率）` : ''}
        </span>
      </div>

      <div className="overflow-auto">
        <table className="budget-table w-full border-separate border-spacing-0 bg-surface border border-line rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr>
              {['分类', '数量', '单价', '币种', '小计', '备注', ''].map((h) => (
                <th key={h} className="bg-surface-3 text-muted text-[11.5px] font-bold uppercase tracking-[0.08em] px-3 py-[11px] text-left border-b border-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.budget.map((x, i) => {
              const raw  = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
              const conv = convertAmount(raw, x.currency, rate);
              return (
                <tr key={i} className="group">
                  {[
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors" value={x.category} onChange={(e) => mutate((d) => { d.budget[i].category = e.target.value; })} />,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" value={x.quantity} onChange={(e) => mutate((d) => { d.budget[i].quantity = e.target.value; })} />,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" value={x.unitPrice} onChange={(e) => mutate((d) => { d.budget[i].unitPrice = e.target.value; })} />,
                    <select className="editable border border-line rounded-[5px] bg-surface px-2 py-1 text-[12.5px] appearance-none" value={x.currency} onChange={(e) => mutate((d) => { d.budget[i].currency = e.target.value as 'home' | 'foreign'; })}>
                      <option value="home">{home}</option>
                      <option value="foreign">{foreign}</option>
                    </select>,
                    <span className="text-[13px]">
                      {conv.home !== null && conv.foreign !== null ? (
                        <>{formatMoney(conv.home, home)}<br /><span className="text-muted text-[12px]">≈ {formatMoney(conv.foreign, foreign)}</span></>
                      ) : (
                        <>{formatMoney(x.currency === 'home' ? conv.home : conv.foreign, x.currency === 'home' ? home : foreign)}<br /><span className="text-muted text-[12px]">设置汇率后换算</span></>
                      )}
                    </span>,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none group-hover:bg-jade-light rounded transition-colors" value={x.note} onChange={(e) => mutate((d) => { d.budget[i].note = e.target.value; })} />,
                    editUnlocked ? <button className="btn-mini edit-only" onClick={() => mutate((d) => { d.budget.splice(i, 1); })}>×</button> : null,
                  ].map((cell, ci) => (
                    <td key={ci} className="px-3 py-2.5 border-b border-line align-middle text-[13.5px] last:border-r-0">
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editUnlocked && (
        <button className="add-btn edit-only mt-3" onClick={() => mutate((d) => { d.budget.push(defaultBudget()); })}>
          ＋ 添加预算项目
        </button>
      )}
    </section>
  );
}
