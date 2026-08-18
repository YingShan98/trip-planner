import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import type { Mutate, TripRow, TripState } from '../../types';
import Modal from '../Modal';

export default function SettingsModal({
  trip, slug, editUnlocked, editPassword, state, mutate, onClose, onSaved, onChangePassword,
}: {
  trip: TripRow; slug: string; editUnlocked: boolean; editPassword: string;
  state: TripState; mutate: Mutate;
  onClose: () => void; onSaved: (meta: Partial<TripRow>) => void; onChangePassword: () => void;
}) {
  const [title, setTitle]       = useState(trip.title);
  const [destination, setDest]  = useState(trip.destination);
  const [currency, setCurrency] = useState(trip.currency);
  const [start, setStart]       = useState(trip.start_date || '');
  const [end, setEnd]           = useState(trip.end_date || '');
  const [desc, setDesc]         = useState(trip.description);
  const [freeEdit, setFreeEdit] = useState(state.freeEdit);

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
    if (freeEdit !== state.freeEdit) {
      mutate((d) => { d.freeEdit = freeEdit; });
    }
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

      {editUnlocked && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-[12px] font-semibold text-muted mb-2.5">编辑权限</p>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-jade-dark cursor-pointer"
              checked={freeEdit}
              onChange={(e) => setFreeEdit(e.target.checked)}
            />
            <span className="text-[13.5px]">
              允许自由编辑（任何人无需密码即可编辑）
            </span>
          </label>
          {freeEdit && (
            <p className="text-[12px] text-amber-700 mt-1.5 ml-6">
              开启后任何打开此旅行链接的人都可以直接编辑内容。
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
        <button className="btn-ghost" onClick={onChangePassword}>修改编辑密码</button>
        <button className="btn-primary" onClick={save}>保存设置</button>
      </div>
    </Modal>
  );
}
