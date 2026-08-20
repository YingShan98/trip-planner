import { useState } from 'react';
import { toast } from '../../lib/toast';
import { blankState } from '../../state';
import { createV2Trip } from '../../lib/v2Trip';
import type { ImportedTripMeta, TripState } from '../../types';
import Modal from '../Modal';

export default function V2NewTripModal({ onClose, onCreated, initialMeta, initialData }: {
  onClose: () => void;
  onCreated: (slug: string) => void;
  initialMeta?: ImportedTripMeta;
  initialData?: TripState;
}) {
  const [title, setTitle] = useState(initialMeta?.title || '');
  const [destination, setDestination] = useState(initialMeta?.destination || '');
  const [currency, setCurrency] = useState(initialMeta?.currency || 'MYR');
  const [start, setStart] = useState(initialMeta?.start_date || '');
  const [end, setEnd] = useState(initialMeta?.end_date || '');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState(initialMeta?.description || '');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !title.trim()) { toast('请填写旅行名称和 Slug'); return; }
    setBusy(true);
    try {
      const createdSlug = await createV2Trip({
        slug: cleanSlug, title: title.trim(), destination: destination.trim(), start_date: start || null,
        end_date: end || null, home_currency: currency.trim() || 'MYR', description, state: initialData || blankState(),
      });
      toast('旅行已创建');
      onClose();
      onCreated(createdSlug);
    } catch (error) { toast('创建失败：' + (error as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">创建新旅行</h2>
      <p className="text-muted text-[13px] mt-1">规范化旅行需要登录账户；你将成为这趟旅行的拥有者。</p>
      {initialData && <p className="text-muted text-[13px] mt-1">已从 JSON 文件载入行程内容。</p>}
      <div className="grid grid-cols-2 gap-3.5 mt-4">
        <div className="field col-span-2"><label>旅行名称</label><input className="inp" placeholder="例如：2027 广州亲友团" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>目的地</label><input className="inp" placeholder="广州 / Seoul / Tokyo" value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
        <div className="field"><label>本地货币</label><input className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
        <div className="field"><label>开始日期</label><input className="inp" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label>结束日期</label><input className="inp" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="field col-span-2"><label>Slug（网址标识，只能英文/数字/短横线）</label><input className="inp" placeholder="guangzhou-family-trip-2027" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="field col-span-2"><label>简介</label><textarea className="inp min-h-[100px] resize-y" placeholder="旅行目标、人数、注意事项……" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-line"><button className="btn-primary" disabled={busy} onClick={create}>{busy ? '创建中…' : '创建旅行'}</button></div>
    </Modal>
  );
}
