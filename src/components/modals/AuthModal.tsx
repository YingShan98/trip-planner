import { useEffect, useRef, useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import Modal from '../Modal';
import { isAnonymousUser } from '../../lib/guestAuth';
import HCaptcha from '@hcaptcha/react-hcaptcha';

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [guestSession, setGuestSession] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  useEffect(() => {
    if (sb) sb.auth.getUser().then(({ data }) => setGuestSession(isAnonymousUser(data.user)));
  }, []);

  const submit = async () => {
    if (!sb || !email.trim() || password.length < 6) {
      toast('请输入邮箱和至少6位密码');
      return;
    }
    setBusy(true);
    let captchaToken: string | undefined;
    if (!guestSession) {
      try {
        if (!import.meta.env.VITE_HCAPTCHA_SITE_KEY) throw new Error('未配置 hCaptcha site key');
        const result = await captchaRef.current?.execute({ async: true });
        if (!result?.response) throw new Error('请完成 hCaptcha 验证');
        captchaToken = result.response;
      } catch (error) {
        setBusy(false);
        toast((error as Error).message);
        return;
      }
    }
    const response = mode === 'signIn'
      ? await sb.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } })
      : guestSession
        ? await sb.auth.updateUser({ email: email.trim(), password })
        : await sb.auth.signUp({ email: email.trim(), password, options: { captchaToken } });
    setBusy(false);
    if (response.error) { toast(response.error.message); return; }
    toast(mode === 'signIn' ? '已登录' : guestSession ? '访客身份已升级，请检查邮箱确认' : '注册成功，请检查邮箱确认');
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">{mode === 'signIn' ? '登录 Trip Planner' : '创建账户'}</h2>
      <p className="text-muted text-[13px] mt-1">{guestSession ? '升级访客身份后，你的编辑记录会继续保留。' : '登录后可以创建和编辑自己的规范化旅程。'}</p>
      <div className="flex flex-col gap-3.5 mt-5">
        <div className="field"><label>邮箱</label><input className="inp" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>密码</label><input className="inp" type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
      </div>
      <HCaptcha ref={captchaRef} sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || 'missing-site-key'} size="invisible" />
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-line">
        <button className="text-jade text-[13px] font-semibold hover:underline" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? '还没有账户？注册' : guestSession ? '使用其他账户登录' : '已有账户？登录'}
        </button>
        <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? '处理中…' : mode === 'signIn' ? '登录' : '注册'}</button>
      </div>
    </Modal>
  );
}
