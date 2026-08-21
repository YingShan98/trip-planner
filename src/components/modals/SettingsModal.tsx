import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { confirmDialog } from '../../lib/confirm';
import { revokeShares, setTripEditPassword, type TripMeta } from '../../lib/tripApi';
import { suggestDestinationImage } from '../../lib/destinationImage';
import { fetchExchangeRate } from '../../lib/exchangeRate';
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
  const [coverImageUrl, setCoverImageUrl] = useState(trip.cover_image_url || '');
  const [fetchingImage, setFetchingImage] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchImage = async () => {
    if (!destination.trim()) { toast('请先填写目的地'); return; }
    setFetchingImage(true);
    try {
      const url = await suggestDestinationImage(destination.trim());
      if (url) setCoverImageUrl(url);
      else toast('没有找到合适的图片，可手动粘贴图片链接');
    } finally { setFetchingImage(false); }
  };

  const fetchRate = async () => {
    if (!foreignCurrency.trim()) { toast('请先填写外币代码'); return; }
    setFetchingRate(true);
    try {
      const rate = await fetchExchangeRate(foreignCurrency.trim(), currency.trim() || 'MYR');
      if (rate !== null) { setExchangeRate(String(rate)); toast('已获取最新汇率，出发前建议再次核实'); }
      else toast('没有找到这个货币对的汇率，可手动填写');
    } finally { setFetchingRate(false); }
  };

  const save = async () => {
    if (!sb) return;
    const { error } = await sb.from('trips').update({
      title: title.trim(), destination: destination.trim(), home_currency: currency.trim() || 'MYR',
      foreign_currency: foreignCurrency.trim(), exchange_rate: exchangeRate === '' ? null : Number(exchangeRate),
      start_date: start || null, end_date: end || null, description, cover_image_url: coverImageUrl.trim() || null,
    }).eq('id', trip.id);
    if (error) { toast(`保存失败：${error.message}`); return; }
    onSaved({ title: title.trim(), destination: destination.trim(), home_currency: currency.trim() || 'MYR', foreign_currency: foreignCurrency.trim(), exchange_rate: exchangeRate === '' ? null : Number(exchangeRate), start_date: start || null, end_date: end || null, description, cover_image_url: coverImageUrl.trim() || null });
    toast('旅行设置已更新');
    onClose();
  };

  const handleSaveEditPassword = async () => {
    if (editPassword && editPassword.trim().length < 4) { toast('密码至少需要 4 位'); return; }
    setSavingPassword(true);
    try {
      await setTripEditPassword(trip.id, editPassword.trim());
      toast(editPassword.trim() ? '编辑密码已更新' : '编辑密码已移除');
      setEditPassword('');
    } catch (error) { toast('密码更新失败：' + (error as Error).message); }
    finally { setSavingPassword(false); }
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
        <div className="field">
          <label>汇率（1 外币 = 本地币）</label>
          <div className="flex gap-2">
            <input className="inp flex-1" type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
            <button type="button" className="btn-ghost shrink-0" disabled={fetchingRate} onClick={fetchRate}>{fetchingRate ? '获取中…' : '获取最新'}</button>
          </div>
        </div>
        <div className="field col-span-2">
          <label>封面图片链接（可选）</label>
          <div className="flex gap-2">
            <input className="inp flex-1" placeholder="https://…" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} />
            <button type="button" className="btn-ghost shrink-0" disabled={fetchingImage} onClick={fetchImage}>{fetchingImage ? '获取中…' : '自动获取'}</button>
          </div>
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt=""
              className="mt-2 h-24 w-full object-cover rounded border border-line bg-surface-2"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
        <div className="field col-span-2"><label>简介</label><textarea className="inp min-h-[100px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-line"><button className="btn-primary" onClick={save}>保存设置</button></div>
      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-[12px] font-semibold text-muted mb-2">编辑密码</p>
        <p className="text-muted text-[12.5px] mb-2">为「可编辑」分享链接额外加一道密码。同行者仍无需登录，只需填写名字和这个密码。留空并保存可移除密码。</p>
        <div className="flex gap-2">
          <input className="inp flex-1" type="password" autoComplete="off" placeholder="留空 = 不需要密码" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
          <button className="btn-ghost shrink-0" disabled={savingPassword} onClick={handleSaveEditPassword}>{savingPassword ? '保存中…' : '更新密码'}</button>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-[12px] font-semibold text-muted mb-2">安全分享</p>
        <button className="btn-danger" disabled={revoking} onClick={handleRevokeShares}>{revoking ? '撤销中…' : '撤销所有分享链接'}</button>
      </div>
    </Modal>
  );
}
