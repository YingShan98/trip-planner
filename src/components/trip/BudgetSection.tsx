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

      <div className="hidden sm:block overflow-auto">
        <table className="budget-table w-full border-separate border-spacing-0 bg-surface border border-line rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr>
              {['预算项目', '数量', '单价', '币种', '原币小计', `折合金额（${home}）`, '备注', ''].map((h) => (
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
                    <span className="text-[13px] font-medium">{formatMoney(raw, x.currency === 'home' ? home : foreign)}</span>,
                    <span className="text-[13px] font-medium text-jade-dark">{conv.home !== null ? formatMoney(conv.home, home) : '未换算'}</span>,
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

      <div className="sm:hidden flex flex-col gap-3">
        {state.budget.length === 0 ? (
          <div className="empty-state">还没有预算项目</div>
        ) : state.budget.map((x, i) => {
          const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
          const conv = convertAmount(raw, x.currency, rate);
          return (
            <article key={i} className="bg-surface border border-line rounded-lg p-4 shadow-xs">
              <div className="flex items-start gap-3 mb-3.5">
                <input
                  aria-label={`预算项目 ${i + 1} 分类`}
                  className="inp editable flex-1 min-w-0 font-bold text-[15px]"
                  value={x.category}
                  placeholder="预算分类"
                  onChange={(e) => mutate((d) => { d.budget[i].category = e.target.value; })}
                />
                {editUnlocked && (
                  <button aria-label={`删除预算项目 ${i + 1}`} className="btn-mini edit-only shrink-0" onClick={() => mutate((d) => { d.budget.splice(i, 1); })}>×</button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <label className="field">
                  <span className="text-[11px] font-semibold text-muted">数量</span>
                  <input aria-label={`预算项目 ${i + 1} 数量`} className="inp editable" type="number" value={x.quantity} onChange={(e) => mutate((d) => { d.budget[i].quantity = e.target.value; })} />
                </label>
                <label className="field">
                  <span className="text-[11px] font-semibold text-muted">单价</span>
                  <input aria-label={`预算项目 ${i + 1} 单价`} className="inp editable" type="number" value={x.unitPrice} onChange={(e) => mutate((d) => { d.budget[i].unitPrice = e.target.value; })} />
                </label>
              </div>

              <div className="flex items-end gap-2.5 mb-3.5">
                <label className="field flex-1">
                  <span className="text-[11px] font-semibold text-muted">币种</span>
                  <select aria-label={`预算项目 ${i + 1} 币种`} className="inp editable" value={x.currency} onChange={(e) => mutate((d) => { d.budget[i].currency = e.target.value as 'home' | 'foreign'; })}>
                    <option value="home">{home}</option>
                    <option value="foreign">{foreign}</option>
                  </select>
                </label>
                <div className="flex-1 min-w-0 rounded-sm bg-jade-light border border-jade-tint px-3 py-2">
                  <span className="block text-[11px] font-semibold text-muted">折合金额（{home}）</span>
                  <strong className="block text-[14px] text-jade-dark truncate">{conv.home !== null ? formatMoney(conv.home, home) : '未换算'}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mb-3 text-[12px]">
                <span className="text-muted">原币小计</span>
                <strong className="text-ink-2">{formatMoney(raw, x.currency === 'home' ? home : foreign)}</strong>
              </div>

              <label className="field">
                <span className="text-[11px] font-semibold text-muted">备注</span>
                <input aria-label={`预算项目 ${i + 1} 备注`} className="inp editable" value={x.note} placeholder="例如：每人、每天、含税" onChange={(e) => mutate((d) => { d.budget[i].note = e.target.value; })} />
              </label>
            </article>
          );
        })}
      </div>

      {editUnlocked && (
        <button className="add-btn edit-only mt-3" onClick={() => mutate((d) => { d.budget.push(defaultBudget()); })}>
          ＋ 添加预算项目
        </button>
      )}
    </section>
  );
}
