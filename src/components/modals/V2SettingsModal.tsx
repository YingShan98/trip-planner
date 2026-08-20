import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import type { V2TripMeta } from '../../lib/v2Trip';
import Modal from '../Modal';

export default function V2SettingsModal({ trip, onClose, onSaved }: {
  trip: V2TripMeta;
  onClose: () => void;
  onSaved: (changes: Partial<V2TripMeta>) => void;
}) {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [currency, setCurrency] = useState(trip.home_currency);
  const [foreignCurrency, setForeignCurrency] = useState(trip.foreign_currency || '');
  const [exchangeRate, setExchangeRate] = useState(String(trip.exchange_rate ?? ''));
  const [start, setStart] = useState(trip.start_date || '');
  const [end, setEnd] = useState(trip.end_date || '');
  const [description, setDescription] = useState(trip.description);

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
    </Modal>
  );
}
