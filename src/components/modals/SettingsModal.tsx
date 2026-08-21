import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { confirmDialog } from '../../lib/confirm';
import { revokeShares, type TripMeta } from '../../lib/tripApi';
import Modal from '../Modal';

export default function SettingsModal({ trip, onClose, onSaved }: {
  trip: TripMeta;
  onClose: () => void;
  onSaved: (changes: Partial<TripMeta>) => void;
}) {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [currency, setCurrency] = useState(trip.home_currency);
  const [foreignCurrency, setForeignCurrency] = useState(trip.foreign_currency || '');
  const [exchangeRate, setExchangeRate] = useState(String(trip.exchange_rate ?? ''));
  const [start, setStart] = useState(trip.start_date || '');
  const [end, setEnd] = useState(trip.end_date || '');
  const [description, setDescription] = useState(trip.description);
  const [revoking, setRevoking] = useState(false);

  const save = async () => {
    if (!sb) return;
    const { error } = await sb.from('trips').update({
      title: title.trim(), destination: destination.trim(), home_currency: currency.trim() || 'MYR',
      foreign_currency: foreignCurrency.trim(), exchange_rate: exchangeRate === '' ? null : Number(exchangeRate),
      start_date: start || null, end_date: end || null, description,
    }).eq('id', trip.id);
    if (error) { toast(`保存失败：${error.message}`); return; }
    onSaved({ title: title.trim(), destination: destination.trim(), home_currency: currency.trim() || 'MYR', foreign_currency: foreignCurrency.trim(), exchange_rate: exchangeRate === '' ? null : Number(exchangeRate), start_date: start || null, end_date: end || null, description });
    toast('旅行设置已更新');
    onClose();
  };

  const handleRevokeShares = async () => {
    if (!await confirmDialog('撤销这趟旅行的所有安全分享链接？已复制的链接将立即失效。', { title: '撤销分享链接', confirmLabel: '撤销', danger: true })) return;
    setRevoking(true);
    try { const count = await revokeShares(trip.id); toast(count ? `已撤销 ${count} 个分享链接` : '没有需要撤销的分享链接'); }
    catch (error) { toast('撤销失败：' + (error as Error).message); }
    finally { setRevoking(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">旅行设置</h2>
      <div className="grid grid-cols-2 gap-3.5 mt-4">
        <div className="field col-span-2"><label>旅行名称</label><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>目的地</label><input className="inp" value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
        <div className="field"><label>本地货币</label><input className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
        <div className="field"><label>开始日期</label><input className="inp" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label>结束日期</label><input className="inp" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="field"><label>外币</label><input className="inp" placeholder="例如 CNY" value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value)} /></div>
        <div className="field"><label>汇率（1 外币 = 本地币）</label><input className="inp" type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} /></div>
        <div className="field col-span-2"><label>简介</label><textarea className="inp min-h-[100px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-line"><button className="btn-primary" onClick={save}>保存设置</button></div>
      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-[12px] font-semibold text-muted mb-2">安全分享</p>
        <button className="btn-danger" disabled={revoking} onClick={handleRevokeShares}>{revoking ? '撤销中…' : '撤销所有分享链接'}</button>
      </div>
    </Modal>
  );
}
