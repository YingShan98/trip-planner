import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { blankState } from '../../state';
import type { TripRow } from '../../types';
import Modal from '../Modal';

export default function NewTripModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [admin, setAdmin] = useState('');
  const [title, setTitle] = useState('');
  const [dest, setDest] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [slug, setSlug] = useState('');
  const [edit, setEdit] = useState('');
  const [desc, setDesc] = useState('');

  const createTrip = async () => {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !title.trim() || edit.length < 4) {
      toast('请填写名称、Slug 和至少4位编辑密码');
      return;
    }
    if (!sb) return;
    const { data: row, error } = await sb.rpc('create_trip', {
      p_admin_password: admin,
      p_slug: cleanSlug,
      p_title: title.trim(),
      p_destination: dest,
      p_start_date: start || null,
      p_end_date: end || null,
      p_currency: currency || 'MYR',
      p_description: desc,
      p_edit_password: edit,
      p_data: blankState(),
    });
    if (error) {
      toast(error.message);
      return;
    }
    onClose();
    toast('旅行已创建');
    onCreated((row as TripRow).slug);
  };

  return (
    <Modal onClose={onClose}>
      <h2>＋ 创建新旅行</h2>
      <p className="muted">创建旅行需要系统管理密码；同行者之后只需要旅行自己的编辑密码。</p>
      <div className="form-grid">
        <div className="field full">
          <label>系统管理密码</label>
          <input type="password" value={admin} onChange={(e) => setAdmin(e.target.value)} />
        </div>
        <div className="field full">
          <label>旅行名称</label>
          <input placeholder="例如：2027 韩国亲友团" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>目的地</label>
          <input placeholder="Seoul / Tokyo / 广州" value={dest} onChange={(e) => setDest(e.target.value)} />
        </div>
        <div className="field">
          <label>货币</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div className="field">
          <label>开始日期</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>结束日期</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field full">
          <label>旅行 Slug（网址标识，只能英文/数字/短横线）</label>
          <input placeholder="korea-trip-2027" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div className="field full">
          <label>同行者编辑密码</label>
          <input type="password" placeholder="至少4位" value={edit} onChange={(e) => setEdit(e.target.value)} />
        </div>
        <div className="field full">
          <label>简介</label>
          <textarea placeholder="旅行目标、人数、注意事项……" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <div className="modal-actions">
        <button className="primary" onClick={createTrip}>
          创建旅行
        </button>
      </div>
    </Modal>
  );
}
