import { defaultBudget } from '../../state';
import { convertAmount, formatMoney, parseRate } from '../../lib/currency';
import type { CurrencyKey, Mutate, TripState } from '../../types';
import MarkdownText from '../MarkdownText';
import AutoGrowTextarea from '../AutoGrowTextarea';

export default function BudgetSection({
  state, editUnlocked, mutate, currency,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; currency: string;
}) {
  const home    = currency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const local   = state.isLocal;
  const rate    = local ? null : parseRate(state.exchangeRate);

  const travelers = Number(state.travelers) || 0;
  let totalHome = 0, unconverted = 0;
  // On a local trip every amount is home currency, whatever an item's stored currency key says.
  const itemCurrency = (c: CurrencyKey): CurrencyKey => (local ? 'home' : c);
  for (const x of state.budget) {
    const raw  = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
    const conv = convertAmount(raw, itemCurrency(x.currency), rate);
    if (conv.home !== null) totalHome += conv.home;
    else unconverted++;
  }
  const perPerson = travelers > 0 ? totalHome / travelers : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 mb-4 bg-jade-light border border-jade-tint rounded-lg px-4 py-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">总计（{home}）</span>
            <strong className="text-[18px] text-jade-dark">{formatMoney(totalHome, home)}</strong>
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">每人</span>
            <strong className="text-[18px] text-jade-dark">{perPerson !== null ? formatMoney(perPerson, home) : '未设置人数'}</strong>
          </div>
        </div>
        <div className="flex items-center gap-2" title="同行人数在「旅行设置」中修改">
          <span className="text-[12px] font-semibold text-muted whitespace-nowrap">同行人数</span>
          <span className="pill">{travelers > 0 ? `${travelers} 人` : '未设置'}</span>
          {editUnlocked && <span className="text-[11.5px] text-muted edit-only">在「旅行设置」中修改</span>}
        </div>
      </div>

      {unconverted > 0 && (
        <p className="text-muted text-[12.5px] mb-3.5">{unconverted} 项未换算（请设置汇率）</p>
      )}

      {state.budget.length === 0 ? (
        <div className="hidden sm:block empty-state">还没有预算项目</div>
      ) : (
      <div className="hidden sm:block overflow-auto">
        <table className="budget-table w-full border-separate border-spacing-0 bg-surface border border-line rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr>
              {(local ? ['预算项目', '数量', '单价', `小计（${home}）`, '备注', ''] : ['预算项目', '数量', '单价', '币种', '原币小计', `折合金额（${home}）`, '备注', '']).map((h) => (
                <th key={h} className="bg-surface-3 text-muted text-[11.5px] font-bold uppercase tracking-[0.08em] px-3 py-[11px] text-left border-b border-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.budget.map((x, i) => {
              const raw  = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
              const conv = convertAmount(raw, itemCurrency(x.currency), rate);
              return (
                <tr key={i} className="group">
                  {[
                    editUnlocked
                      ? <AutoGrowTextarea aria-label={`预算项目 ${i + 1}`} className="editable block w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors" value={x.category} onChange={(v) => mutate((d) => { d.budget[i].category = v; })} />
                      : <span className="block whitespace-pre-wrap break-words">{x.category}</span>,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" value={x.quantity} onChange={(e) => mutate((d) => { d.budget[i].quantity = e.target.value; })} />,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" value={x.unitPrice} onChange={(e) => mutate((d) => { d.budget[i].unitPrice = e.target.value; })} />,
                    ...(local ? [] : [
                      <select className="editable border border-line rounded-[5px] bg-surface px-2 py-1 text-[12.5px] appearance-none" value={x.currency} onChange={(e) => mutate((d) => { d.budget[i].currency = e.target.value as 'home' | 'foreign'; })}>
                        <option value="home">{home}</option>
                        <option value="foreign">{foreign}</option>
                      </select>,
                      <span className="text-[13px] font-medium">{formatMoney(raw, x.currency === 'home' ? home : foreign)}</span>,
                    ]),
                    <span className="text-[13px] font-medium text-jade-dark">{conv.home !== null ? formatMoney(conv.home, home) : '未换算'}</span>,
                    editUnlocked ? <AutoGrowTextarea singleLine={false} aria-label={`预算项目 ${i + 1} 备注`} className="editable block w-full border-none bg-transparent p-1 outline-none group-hover:bg-jade-light rounded transition-colors" value={x.note} onChange={(v) => mutate((d) => { d.budget[i].note = v; })} /> : <MarkdownText text={x.note} className="budget-note" />,
                    editUnlocked ? <button aria-label={`删除预算项目「${x.category || i + 1}」`} className="btn-mini edit-only" onClick={() => mutate((d) => { d.budget.splice(i, 1); })}>×</button> : null,
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
      )}

      <div className="sm:hidden flex flex-col gap-3">
        {state.budget.length === 0 ? (
          <div className="empty-state">还没有预算项目</div>
        ) : state.budget.map((x, i) => {
          const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
          const conv = convertAmount(raw, itemCurrency(x.currency), rate);
          return (
            <article key={i} className="bg-surface border border-line rounded-lg p-4 shadow-xs">
              <div className="flex items-start gap-3 mb-3.5">
                {editUnlocked ? (
                  <AutoGrowTextarea
                    aria-label={`预算项目 ${i + 1} 分类`}
                    className="inp editable flex-1 min-w-0 font-bold text-[15px]"
                    value={x.category}
                    placeholder="预算分类"
                    onChange={(v) => mutate((d) => { d.budget[i].category = v; })}
                  />
                ) : (
                  <h3 className="flex-1 min-w-0 font-bold text-[15px] whitespace-pre-wrap break-words">{x.category || '未命名项目'}</h3>
                )}
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
                {!local && <label className="field flex-1">
                  <span className="text-[11px] font-semibold text-muted">币种</span>
                  <select aria-label={`预算项目 ${i + 1} 币种`} className="inp editable" value={x.currency} onChange={(e) => mutate((d) => { d.budget[i].currency = e.target.value as 'home' | 'foreign'; })}>
                    <option value="home">{home}</option>
                    <option value="foreign">{foreign}</option>
                  </select>
                </label>}
                <div className="flex-1 min-w-0 rounded-sm bg-jade-light border border-jade-tint px-3 py-2">
                  <span className="block text-[11px] font-semibold text-muted">折合金额（{home}）</span>
                  <strong className="block text-[14px] text-jade-dark break-words">{conv.home !== null ? formatMoney(conv.home, home) : '未换算'}</strong>
                </div>
              </div>

              {!local && (
                <div className="flex items-center justify-between gap-3 mb-3 text-[12px]">
                  <span className="text-muted">原币小计</span>
                  <strong className="text-ink-2">{formatMoney(raw, x.currency === 'home' ? home : foreign)}</strong>
                </div>
              )}

              {editUnlocked ? (
                <label className="field">
                  <span className="text-[11px] font-semibold text-muted">备注</span>
                  <AutoGrowTextarea singleLine={false} aria-label={`预算项目 ${i + 1} 备注`} className="inp editable" value={x.note} placeholder="例如：每人、每天、含税" onChange={(v) => mutate((d) => { d.budget[i].note = v; })} />
                </label>
              ) : x.note ? (
                <div className="rich-field"><span className="rich-label">备注</span><MarkdownText text={x.note} /></div>
              ) : null}
            </article>
          );
        })}
      </div>

      {editUnlocked && (
        <button className="add-btn edit-only mt-3" onClick={() => mutate((d) => { d.budget.push(defaultBudget()); })}>
          ＋ 添加预算项目
        </button>
      )}
    </>
  );
}
