import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import type { TripRow } from '../../types';
import Modal from '../Modal';

export default function SettingsModal({
  trip, slug, editUnlocked, editPassword, onClose, onSaved, onChangePassword,
}: {
  trip: TripRow; slug: string; editUnlocked: boolean; editPassword: string;
  onClose: () => void; onSaved: (meta: Partial<TripRow>) => void; onChangePassword: () => void;
}) {
  const [title, setTitle]           = useState(trip.title);
  const [destination, setDest]      = useState(trip.destination);
  const [currency, setCurrency]     = useState(trip.currency);
  const [start, setStart]           = useState(trip.start_date || '');
  const [end, setEnd]               = useState(trip.end_date || '');
  const [desc, setDesc]             = useState(trip.description);

  const save = async () => {
    if (!editUnlocked) { toast('请先解锁编辑'); return; }
    if (!sb) return;
    const { data, error } = await sb.rpc('update_trip_meta', {
      p_slug: slug, p_password: editPassword,
      p_title: title, p_destination: destination,
      p_start_date: start || null, p_end_date: end || null,
      p_currency: currency, p_description: desc,
    });
    if (error || data !== true) { toast(error?.message || '保存失败'); return; }
    onSaved({ title, destination, start_date: start || null, end_date: end || null, currency, description: desc });
    onClose();
    toast('旅行设置已更新');
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">⚙️ 旅行设置</h2>
      <div className="grid grid-cols-2 gap-3.5 mt-4">
        <div className="field col-span-2">
          <label>旅行名称</label>
          <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>目的地</label>
          <input className="inp" value={destination} onChange={(e) => setDest(e.target.value)} />
        </div>
        <div className="field">
          <label>货币</label>
          <input className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div className="field">
          <label>开始日期</label>
          <input className="inp" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>结束日期</label>
          <input className="inp" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field col-span-2">
          <label>简介</label>
          <textarea className="inp min-h-[80px] resize-y" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
        <button className="btn-ghost" onClick={onChangePassword}>修改编辑密码</button>
        <button className="btn-primary" onClick={save}>保存设置</button>
      </div>
    </Modal>
  );
}
