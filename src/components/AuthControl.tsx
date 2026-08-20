import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { sb } from '../lib/supabase';
import AuthModal from './modals/AuthModal';
import { isAnonymousUser } from '../lib/guestAuth';

export default function AuthControl({ onUserChange }: { onUserChange?: (user: User | null) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => { setUser(data.user); onUserChange?.(data.user); });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => { const nextUser = session?.user || null; setUser(nextUser); onUserChange?.(nextUser); });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!sb) return null;
  const client = sb;
  if (user && !isAnonymousUser(user)) {
    return (
      <button className="btn-ghost" onClick={() => client.auth.signOut()} title="退出登录">
        {user.email || '已登录'} · 退出
      </button>
    );
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setShowAuth(true)}>登录</button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
