import { useState } from 'react';
import { defaultTransport } from '../../state';
import { convertAmount, formatMoney, parseRate } from '../../lib/currency';
import type { Mutate, TransportItem, TripState } from '../../types';
import MarkdownText from '../MarkdownText';

function TransportCard({
  x, i, editUnlocked, mutate, home, foreign, rate, local, printOnlyIndex,
}: {
  x: TransportItem; i: number; editUnlocked: boolean; mutate: Mutate;
  home: string; foreign: string; rate: number | null; local: boolean; printOnlyIndex: number | null;
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <article
      className={`bg-surface border border-line rounded-lg p-4 shadow-xs flex flex-col gap-2.5 print-keep${printOnlyIndex != null && printOnlyIndex !== i ? ' print-hide' : ''}`}
    >

      {/* Row 1: type name + final-choice toggle + delete */}
      <div className="flex items-start gap-2 flex-wrap">
        {editUnlocked ? <input
            className="inp editable flex-1 font-bold text-[15px]"
            value={x.type}
            placeholder="交通方式 / 车型"
            onChange={(e) => mutate((d) => { d.transport[i].type = e.target.value; })}
          /> : <h3 className="flex-1 font-serif font-bold text-[17px] text-jade-dark">{x.type}</h3>}
        {x.chosen && <span className="pill bg-jade-dark !text-white border-jade-dark">✓ 最终决定</span>}
        {editUnlocked && (
          <button
            aria-label={x.chosen ? '取消设为最终决定' : `将「${x.type || i + 1}」设为最终决定`}
            className={`btn-mini edit-only shrink-0 mt-0.5 ${x.chosen ? 'bg-jade-dark !text-white border-jade-dark' : ''}`}
            onClick={() => mutate((d) => { d.transport.forEach((tt, ti) => { tt.chosen = ti === i ? !tt.chosen : false; }); })}
          >
            {x.chosen ? '★ 已选定' : '☆ 定为最终决定'}
          </button>
        )}
        <button
          aria-label={`删除交通参考「${x.type || i + 1}」`}
          className="btn-mini edit-only shrink-0 mt-0.5"
          onClick={() => mutate((d) => { d.transport.splice(i, 1); })}
        >
          ×
        </button>
      </div>

      {/* Amount + currency row — the number people care about, always visible */}
      {editUnlocked ? (
        <div className="flex gap-1.5">
          <input
            className="inp editable flex-1"
            type="number"
            value={x.amount}
            placeholder="金额"
            onChange={(e) => mutate((d) => { d.transport[i].amount = e.target.value; })}
          />
          {local ? (
            <span className="self-center text-[13px] text-muted px-1">{home}</span>
          ) : (
            <select
              className="inp editable w-auto"
              value={x.currency}
              onChange={(e) => mutate((d) => { d.transport[i].currency = e.target.value as 'home' | 'foreign'; })}
            >
              <option value="home">{home}</option>
              <option value="foreign">{foreign}</option>
            </select>
          )}
        </div>
      ) : x.amount !== '' && x.amount !== null && !Number.isNaN(Number(x.amount)) ? (
        <div className="rich-field">
          <span className="rich-label">金额</span>
          <span className="text-[14px] font-semibold text-jade-dark">{formatMoney(Number(x.amount), local || x.currency === 'home' ? home : foreign)}</span>
        </div>
      ) : null}

      {!editUnlocked && x.description && <MarkdownText text={x.description} className="rich-field" />}
      {!editUnlocked && x.price && <div className="rich-field"><span className="rich-label">计价方式</span><MarkdownText text={x.price} /></div>}

      {/* Converted amount */}
      {!local && x.amount !== '' && x.amount !== null && !Number.isNaN(Number(x.amount)) && (() => {
        const conv = convertAmount(Number(x.amount), x.currency, rate);
        return (
          <p className="text-muted text-[12.5px] border-t border-line pt-2">
            {conv.home !== null && conv.foreign !== null
              ? `≈ ${formatMoney(conv.home, home)} / ${formatMoney(conv.foreign, foreign)}`
              : `${formatMoney(x.currency === 'home' ? conv.home : conv.foreign, x.currency === 'home' ? home : foreign)} · 未换算`}
          </p>
        );
      })()}

      {editUnlocked && (
        <>
          <button className="no-print text-jade text-[12.5px] font-medium text-left hover:underline" aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}>
            {showMore ? '收起字段 ▴' : '更多字段 ▾'}
          </button>
          <div className={showMore ? 'flex flex-col gap-2.5' : 'hidden'}>
            <textarea
              className="inp editable min-h-[56px] resize-y text-[13px]"
              value={x.description}
              placeholder="说明（路线、时间、安排等）"
              onChange={(e) => mutate((d) => { d.transport[i].description = e.target.value; })}
            />
            <input
              className="inp editable text-[13px]"
              value={x.price}
              placeholder="价格说明，如 / 天、/ 人"
              onChange={(e) => mutate((d) => { d.transport[i].price = e.target.value; })}
            />
          </div>
        </>
      )}
    </article>
  );
}

export default function TransportSection({
  state, editUnlocked, mutate, homeCurrency, printOnlyIndex = null,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; homeCurrency: string;
  printOnlyIndex?: number | null;
}) {
  const home    = homeCurrency || 'MYR';
  const foreign = state.foreignCurrency || '外币';
  const local   = state.isLocal;
  const rate    = local ? null : parseRate(state.exchangeRate);

  return (
    <>
      {state.transport.length === 0 ? (
        <div className="empty-state">暂无交通参考</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {state.transport.map((x, i) => (
            <TransportCard
              key={i} x={x} i={i} editUnlocked={editUnlocked} mutate={mutate}
              home={home} foreign={foreign} rate={rate} local={local} printOnlyIndex={printOnlyIndex}
            />
          ))}
        </div>
      )}

      {editUnlocked && (
        <button
          className="add-btn edit-only mt-3"
          onClick={() => mutate((d) => { d.transport.push(defaultTransport()); })}
        >
          ＋ 添加交通参考
        </button>
      )}
    </>
  );
}
