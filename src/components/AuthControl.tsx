import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { sb } from '../lib/supabase';
import AuthModal from './modals/AuthModal';

export default function AuthControl() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!sb) return null;
  const client = sb;
  if (user) {
    return (
      <button className="btn-ghost hidden sm:inline-flex" onClick={() => client.auth.signOut()} title="退出登录">
        {user.email || '已登录'} · 退出
      </button>
    );
  }

  return (
    <>
      <button className="btn-ghost hidden sm:inline-flex" onClick={() => setShowAuth(true)}>登录</button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
