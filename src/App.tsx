import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import HomeView from './components/HomeView';
import TripView from './components/trip/TripView';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import NewTripModal from './components/modals/NewTripModal';
import ConfigMissingModal from './components/modals/ConfigMissingModal';
import AuthControl from './components/AuthControl';
import { hasConfig, sb } from './lib/supabase';
import { isAnonymousUser } from './lib/guestAuth';
import { toast } from './lib/toast';

function getSlugFromURL(): string | null {
  return new URL(location.href).searchParams.get('trip');
}

function getReadOnlyFromURL(): boolean {
  return new URL(location.href).searchParams.get('readonly') === '1';
}

function getShareTokenFromURL(): string | null {
  return new URL(location.href).searchParams.get('share');
}

function setURL(slug: string | null) {
  const u = new URL(location.href);
  u.searchParams.delete('readonly');
  u.searchParams.delete('share');
  if (slug) u.searchParams.set('trip', slug);
  else u.searchParams.delete('trip');
  history.pushState({}, '', u);
}

export default function App() {
  const [slug, setSlug] = useState<string | null>(getSlugFromURL());
  const [readOnly, setReadOnly] = useState(getReadOnlyFromURL());
  const [shareToken, setShareToken] = useState<string | null>(getShareTokenFromURL());
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [showConfigMissing, setShowConfigMissing] = useState(!hasConfig);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!hasConfig);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => { setUser(isAnonymousUser(data.user) ? null : data.user); setAuthReady(true); });
  }, []);

  useEffect(() => {
    const onPop = () => { setSlug(getSlugFromURL()); setReadOnly(getReadOnlyFromURL()); setShareToken(getShareTokenFromURL()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const goHome = useCallback(() => { setURL(null); setSlug(null); }, []);
  const openTrip = useCallback((newSlug: string) => { setURL(newSlug); setSlug(newSlug); }, []);

  const handleNewTrip = () => {
    if (!hasConfig) { toast('请先配置 .env。'); return; }
    if (!user) return;
    setShowNewTrip(true);
  };

  return (
    <div id="app">
      {/* ── Topbar ── */}
      <header className="no-print sticky top-0 z-50 flex justify-between items-center gap-3 page-gutter min-h-17 bg-white/92 backdrop-blur-md border-b border-line shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-jade-dark rounded-sm grid place-items-center text-white text-[18px] shrink-0 shadow-sm" aria-hidden="true">
            ↗
          </div>
          <div>
            <strong className="block text-[16px] font-bold font-serif text-jade-dark tracking-tight leading-none">
              Trip Planner
            </strong>
            <small className="text-[11px] text-muted leading-none">一起把旅程安排好</small>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {user && !slug && !shareToken && <button className="btn-ghost hidden sm:inline-flex" onClick={goHome}>我的旅行</button>}
          <AuthControl onUserChange={(nextUser) => setUser(isAnonymousUser(nextUser) ? null : nextUser)} />
          {user && <button className="btn-primary" onClick={handleNewTrip}>＋ 新建行程</button>}
        </div>
      </header>

      {!authReady ? (
        <main className="flex items-center justify-center min-h-[60vh] text-muted">正在检查登录状态…</main>
      ) : slug || shareToken ? (
        shareToken || user ? (
        <TripView slug={slug || ''} readOnly={readOnly} shareToken={shareToken} onHome={goHome} onDeleted={goHome} />
        ) : (
          <main className="content-gutter py-20 text-center"><h1 className="font-serif text-2xl text-jade-dark">这趟旅行需要分享链接</h1><p className="text-muted mt-2">请使用旅行拥有者发给你的有效链接查看。</p></main>
        )
      ) : (
        <HomeView onOpenTrip={openTrip} onNewTrip={handleNewTrip} isAuthenticated={Boolean(user)} />
      )}

      {showNewTrip && (
        <NewTripModal
          onClose={() => setShowNewTrip(false)}
          onCreated={(createdSlug) => { setShowNewTrip(false); openTrip(createdSlug); }}
        />
      )}
      {showConfigMissing && <ConfigMissingModal onClose={() => setShowConfigMissing(false)} />}

      <Toast />
      <ConfirmDialog />
    </div>
  );
}
