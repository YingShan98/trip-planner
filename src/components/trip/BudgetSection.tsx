import { defaultBudget } from '../../state';
import { formatMoney } from '../../lib/currency';
import { budgetBreakdown, splitCount } from '../../lib/budget';
import type { Mutate, TripState } from '../../types';
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
  const b = budgetBreakdown(state);
  const { travelers } = b;
  const hasPartial = b.partial.length > 0;

  /** For a line shared by only some travelers: how many, and "每人 RM 1,019.83". Null for everyone-lines. */
  const shareOf = (i: number): { people: number; each: string } | null => {
    const people = splitCount(state.budget[i], travelers);
    const amount = b.itemHome[i];
    return people !== null && travelers > 0 && amount !== null ? { people, each: `每人 ${formatMoney(amount / people, home)}` } : null;
  };
  const splitPlaceholder = travelers > 0 ? `全员（${travelers}）` : '全员';
  const setSplit = (i: number, v: string) => mutate((d) => { d.budget[i].splitAmong = v; });

  return (
    <>
      {/* ── Summary: total on top; per-person as label/amount rows, which stay readable on a phone ── */}
      <div className="mb-4 bg-jade-light border border-jade-tint rounded-lg px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">总计（{home}）</span>
            <strong className="text-[20px] text-jade-dark break-words">{formatMoney(b.totalHome, home)}</strong>
          </div>
          <div className="shrink-0 text-right" title="同行人数在「旅行设置」中修改">
            <span className="block text-[11px] font-semibold text-muted">同行人数</span>
            <span className="pill mt-0.5">{travelers > 0 ? `${travelers} 人` : '未设置'}</span>
          </div>
        </div>

        <dl className="mt-2.5 pt-2.5 border-t border-jade-tint text-[13px] m-0">
          {travelers <= 0 ? (
            <div className="flex justify-between gap-3"><dt className="text-muted">每人</dt><dd className="m-0 text-muted">未设置人数</dd></div>
          ) : !hasPartial ? (
            <div className="flex justify-between items-baseline gap-3">
              <dt className="text-ink-2 font-semibold">每人</dt>
              <dd className="m-0 text-[17px] font-bold text-jade-dark whitespace-nowrap">{formatMoney(b.everyone, home)}</dd>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-baseline gap-3">
                <dt className="min-w-0 text-ink-2">全员共同项目<span className="block text-[11.5px] text-muted">{travelers}人平分</span></dt>
                <dd className="m-0 shrink-0 font-semibold text-ink whitespace-nowrap">{formatMoney(b.everyone, home)}<span className="text-muted font-normal">/人</span></dd>
              </div>
              {b.partial.map((p) => (
                <div key={p.index} className="flex justify-between items-baseline gap-3">
                  <dt className="min-w-0 text-ink-2 break-words">＋ {p.label}<span className="block text-[11.5px] text-muted">只算 {p.people} 人</span></dt>
                  <dd className="m-0 shrink-0 font-semibold text-ink whitespace-nowrap">+{formatMoney(p.perPerson, home)}<span className="text-muted font-normal">/人</span></dd>
                </div>
              ))}
              <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-jade-tint">
                <dt className="min-w-0 font-semibold text-jade-dark">参加全部项目的人</dt>
                <dd className="m-0 shrink-0 text-[17px] font-bold text-jade-dark whitespace-nowrap">{formatMoney(b.fullParticipant, home)}<span className="text-[13px] font-normal text-muted">/人</span></dd>
              </div>
            </div>
          )}
        </dl>
        {editUnlocked && (
          <p className="edit-only text-[11.5px] text-muted mt-2.5 mb-0">
            同行人数在「旅行设置」中修改。只有部分人参加的项目（例如只帮 6 人订的机票），填「分摊人数」，每人金额就只分给这些人。
          </p>
        )}
      </div>

      {b.unconverted > 0 && (
        <p className="text-muted text-[12.5px] mb-3.5">{b.unconverted} 项未换算（请设置汇率）</p>
      )}

      {state.budget.length === 0 ? (
        <div className="hidden sm:block empty-state">还没有预算项目</div>
      ) : (
      <div className="hidden sm:block overflow-auto">
        <table className="budget-table w-full border-separate border-spacing-0 bg-surface border border-line rounded-lg overflow-hidden shadow-xs">
          <thead>
            <tr>
              {(local ? ['预算项目', '数量', '单价', '分摊人数', `小计（${home}）`, '备注', ''] : ['预算项目', '数量', '单价', '分摊人数', '币种', '原币小计', `折合金额（${home}）`, '备注', '']).map((h) => (
                <th key={h} className="bg-surface-3 text-muted text-[11.5px] font-bold uppercase tracking-[0.08em] px-3 py-[11px] text-left border-b border-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.budget.map((x, i) => {
              const raw  = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
              const amount = b.itemHome[i];
              const share = shareOf(i);
              return (
                <tr key={i} className="group">
                  {[
                    editUnlocked
                      ? <AutoGrowTextarea aria-label={`预算项目 ${i + 1}`} className="editable block w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors" value={x.category} onChange={(v) => mutate((d) => { d.budget[i].category = v; })} />
                      : <span className="block whitespace-pre-wrap break-words">{x.category}</span>,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" value={x.quantity} onChange={(e) => mutate((d) => { d.budget[i].quantity = e.target.value; })} />,
                    <input className="editable w-full border-none bg-transparent p-1 outline-none min-w-[60px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" value={x.unitPrice} onChange={(e) => mutate((d) => { d.budget[i].unitPrice = e.target.value; })} />,
                    editUnlocked
                      ? <input aria-label={`预算项目 ${i + 1} 分摊人数`} className="editable w-full border-none bg-transparent p-1 outline-none min-w-[64px] group-hover:bg-jade-light rounded transition-colors text-center" type="number" min={1} step={1} placeholder={splitPlaceholder} value={x.splitAmong ?? ''} onChange={(e) => setSplit(i, e.target.value)} />
                      : <span className={`text-[12.5px] whitespace-nowrap ${share ? 'font-semibold text-ink-2' : 'text-muted'}`}>{share ? `${share.people} 人` : '全员'}</span>,
                    ...(local ? [] : [
                      <select className="editable border border-line rounded-[5px] bg-surface px-2 py-1 text-[12.5px] appearance-none" value={x.currency} onChange={(e) => mutate((d) => { d.budget[i].currency = e.target.value as 'home' | 'foreign'; })}>
                        <option value="home">{home}</option>
                        <option value="foreign">{foreign}</option>
                      </select>,
                      <span className="text-[13px] font-medium">{formatMoney(raw, x.currency === 'home' ? home : foreign)}</span>,
                    ]),
                    <span className="text-[13px] font-medium text-jade-dark">
                      {amount !== null ? formatMoney(amount, home) : '未换算'}
                      {share && <span className="block text-[11.5px] font-normal text-muted whitespace-nowrap">{share.each}</span>}
                    </span>,
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

      {/* ── Phones: one card per line ── */}
      <div className="sm:hidden flex flex-col gap-3">
        {state.budget.length === 0 ? (
          <div className="empty-state">还没有预算项目</div>
        ) : state.budget.map((x, i) => {
          const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
          const amount = b.itemHome[i];
          const share = shareOf(i);
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

              {/* Two columns: 数量 | 单价, then 币种 | 分摊人数 (分摊人数 alone on a local trip). */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <label className="field">
                  <span className="text-[11px] font-semibold text-muted">数量</span>
                  <input aria-label={`预算项目 ${i + 1} 数量`} className="inp editable" type="number" value={x.quantity} onChange={(e) => mutate((d) => { d.budget[i].quantity = e.target.value; })} />
                </label>
                <label className="field">
                  <span className="text-[11px] font-semibold text-muted">单价</span>
                  <input aria-label={`预算项目 ${i + 1} 单价`} className="inp editable" type="number" value={x.unitPrice} onChange={(e) => mutate((d) => { d.budget[i].unitPrice = e.target.value; })} />
                </label>
                {!local && <label className="field">
                  <span className="text-[11px] font-semibold text-muted">币种</span>
                  <select aria-label={`预算项目 ${i + 1} 币种`} className="inp editable" value={x.currency} onChange={(e) => mutate((d) => { d.budget[i].currency = e.target.value as 'home' | 'foreign'; })}>
                    <option value="home">{home}</option>
                    <option value="foreign">{foreign}</option>
                  </select>
                </label>}
                {(editUnlocked || share) && <label className="field">
                  <span className="text-[11px] font-semibold text-muted">分摊人数</span>
                  <input aria-label={`预算项目 ${i + 1} 分摊人数`} className="inp editable" type="number" min={1} step={1} inputMode="numeric"
                    placeholder={splitPlaceholder} value={x.splitAmong ?? ''} onChange={(e) => setSplit(i, e.target.value)} />
                </label>}
              </div>

              <div className="rounded-sm bg-jade-light border border-jade-tint px-3 py-2 mb-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-semibold text-muted">{local ? '小计' : '折合金额'}（{home}）</span>
                  <strong className="text-[14px] text-jade-dark text-right break-words">{amount !== null ? formatMoney(amount, home) : '未换算'}</strong>
                </div>
                {share && <div className="text-right text-[12px] text-ink-2 mt-0.5">{share.people}人分摊 · {share.each}</div>}
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
