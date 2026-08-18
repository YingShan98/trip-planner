import { useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import Modal from '../Modal';

export default function ChangePasswordModal({
  slug,
  onClose,
  onChanged,
}: {
  slug: string;
  onClose: () => void;
  onChanged: (newPassword: string) => void;
}) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const doChange = async () => {
    if (!sb) return;
    const { data, error } = await sb.rpc('change_trip_password', {
      p_slug: slug,
      p_current_password: oldPw,
      p_new_password: newPw,
    });
    if (error || data !== true) { toast(error?.message || '密码修改失败'); return; }
    onChanged(newPw);
    onClose();
    toast('编辑密码已修改');
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-4">🔐 修改编辑密码</h2>
      <div className="flex flex-col gap-3">
        <div className="field">
          <label>当前密码</label>
          <input className="inp" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div className="field">
          <label>新密码（至少4位）</label>
          <input className="inp" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-line">
        <button className="btn-primary" onClick={doChange}>修改</button>
      </div>
    </Modal>
  );
}
