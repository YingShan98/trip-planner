import { useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import Modal from '../Modal';
import { toast } from '../../lib/toast';

export default function GuestIdentityModal({ onClose, onContinue, initialName }: {
  onClose: () => void;
  onContinue: (name: string, captchaToken: string) => void;
  initialName?: string;
}) {
  const [name, setName] = useState(initialName || '');
  const [busy, setBusy] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const continueAsGuest = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (!import.meta.env.VITE_HCAPTCHA_SITE_KEY) throw new Error('未配置 hCaptcha site key');
      const result = await captchaRef.current?.execute({ async: true });
      if (!result?.response) throw new Error('请完成 hCaptcha 验证');
      onContinue(name.trim(), result.response);
    } catch (error) {
      setBusy(false);
      toast((error as Error).message);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">你想用什么名字参与？</h2>
      <p className="text-muted text-[13px] mt-1">不需要注册。这个名字会显示在旅行拥有者的编辑记录里，你之后也可以登录来保留这段记录。</p>
      <div className="field mt-5">
        <label>显示名称</label>
        <input
          className="inp"
          autoFocus
          maxLength={80}
          placeholder="例如：Mei 阿姨"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void continueAsGuest(); }}
        />
      </div>
      <HCaptcha ref={captchaRef} sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || 'missing-site-key'} size="invisible" />
      <div className="flex justify-end mt-5 pt-4 border-t border-line">
        <button className="btn-primary" disabled={!name.trim() || busy} onClick={() => void continueAsGuest()}>{busy ? '验证中…' : '开始参与'}</button>
      </div>
    </Modal>
  );
}
