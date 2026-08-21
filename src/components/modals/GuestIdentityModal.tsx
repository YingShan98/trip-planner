import { useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import Modal from '../Modal';

export default function GuestIdentityModal({ onClose, onContinue, initialName, requiresPassword }: {
  onClose: () => void;
  onContinue: (name: string, captchaToken: string, password?: string) => void;
  initialName?: string;
  requiresPassword?: boolean;
}) {
  const [name, setName] = useState(initialName || '');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const ready = Boolean(name.trim() && captchaToken && (!requiresPassword || password));

  const continueAsGuest = () => {
    if (!ready || !captchaToken) return;
    onContinue(name.trim(), captchaToken, requiresPassword ? password : undefined);
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
          onKeyDown={(event) => { if (event.key === 'Enter') continueAsGuest(); }}
        />
      </div>
      {requiresPassword && (
        <div className="field mt-4">
          <label>编辑密码</label>
          <input
            className="inp"
            type="password"
            placeholder="向旅行拥有者获取密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') continueAsGuest(); }}
          />
        </div>
      )}
      <div className="field mt-4">
        <label>安全验证</label>
        <HCaptcha
          sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || 'missing-site-key'}
          size="normal"
          onVerify={(token) => setCaptchaToken(token)}
          onExpire={() => setCaptchaToken(null)}
          onError={() => setCaptchaToken(null)}
        />
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-line">
        <button className="btn-primary" disabled={!ready} onClick={continueAsGuest}>开始参与</button>
      </div>
    </Modal>
  );
}
