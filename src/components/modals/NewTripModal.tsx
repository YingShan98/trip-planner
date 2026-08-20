import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { blankState } from '../../state';
import type { ImportedTripMeta, TripRow, TripState } from '../../types';
import Modal from '../Modal';

export default function NewTripModal({
  onClose, onCreated, initialMeta, initialData,
}: {
  onClose: () => void; onCreated: (slug: string) => void;
  initialMeta?: ImportedTripMeta; initialData?: TripState;
}) {
  const [admin, setAdmin]     = useState('');
  const [title, setTitle]     = useState(initialMeta?.title ?? '');
  const [dest, setDest]       = useState(initialMeta?.destination ?? '');
  const [currency, setCur]    = useState(initialMeta?.currency || 'MYR');
  const [start, setStart]     = useState(initialMeta?.start_date ?? '');
  const [end, setEnd]         = useState(initialMeta?.end_date ?? '');
  const [slug, setSlug]       = useState('');
  const [edit, setEdit]       = useState('');
  const [desc, setDesc]       = useState(initialMeta?.description ?? '');
  const [requiresPassword, setRequiresPassword] = useState(true);

  const createTrip = async () => {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !title.trim() || (requiresPassword && edit.length < 4)) {
      toast(requiresPassword ? '请填写名称、Slug 和至少4位编辑密码' : '请填写名称和 Slug'); return;
    }
    if (!sb) return;
    const { data: row, error } = await sb.rpc('create_trip', {
      p_admin_password: admin, p_slug: cleanSlug, p_title: title.trim(),
      p_destination: dest, p_start_date: start || null, p_end_date: end || null,
      p_currency: currency || 'MYR', p_description: desc,
      p_edit_password: edit, p_data: initialData ?? blankState(),
      p_edit_requires_password: requiresPassword,
    });
    if (error) { toast(error.message); return; }
    onClose();
    toast('旅行已创建');
    onCreated((row as TripRow).slug);
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">＋ 创建新旅行</h2>
      <p className="text-muted text-[13px] mt-1">创建旅行需要系统管理密码；同行者之后只需要旅行自己的编辑密码。</p>
      {initialData && (
        <p className="text-muted text-[13px] mt-1">已从 JSON 文件导入行程内容，请填写 Slug 和密码以创建旅行。</p>
      )}

      <div className="grid grid-cols-2 gap-3.5 mt-4">
        <div className="field col-span-2">
          <label>系统管理密码</label>
          <input className="inp" type="password" value={admin} onChange={(e) => setAdmin(e.target.value)} />
        </div>
        <div className="field col-span-2">
          <label>旅行名称</label>
          <input className="inp" placeholder="例如：2027 韩国亲友团" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>目的地</label>
          <input className="inp" placeholder="Seoul / Tokyo / 广州" value={dest} onChange={(e) => setDest(e.target.value)} />
        </div>
        <div className="field">
          <label>货币</label>
          <input className="inp" value={currency} onChange={(e) => setCur(e.target.value)} />
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
          <label>旅行 Slug（网址标识，只能英文/数字/短横线）</label>
          <input className="inp" placeholder="korea-trip-2027" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div className="field col-span-2">
          <label>同行者编辑密码{requiresPassword ? '' : '（可选）'}</label>
          <input className="inp" type="password" placeholder={requiresPassword ? '至少4位' : '无需密码时可留空'} value={edit} onChange={(e) => setEdit(e.target.value)} />
        </div>
        <div className="col-span-2 rounded-sm border border-gold-line bg-gold-tint px-3.5 py-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-jade-dark cursor-pointer" checked={!requiresPassword} onChange={(e) => setRequiresPassword(!e.target.checked)} />
            <span className="text-[13.5px]"><strong>允许无需密码编辑</strong><span className="block text-[12px] text-gold mt-0.5">任何拿到链接的人都可以修改这趟旅程。之后可在旅行设置中更改，但需要系统管理密码。</span></span>
          </label>
        </div>
        <div className="field col-span-2">
          <label>简介</label>
          <textarea className="inp min-h-[80px] resize-y" placeholder="旅行目标、人数、注意事项……" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end mt-5 pt-4 border-t border-line">
        <button className="btn-primary" onClick={createTrip}>创建旅行</button>
      </div>
    </Modal>
  );
}
