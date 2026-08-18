import { useCallback, useEffect, useState } from 'react';
import HomeView from './components/HomeView';
import TripView from './components/trip/TripView';
import Toast from './components/Toast';
import NewTripModal from './components/modals/NewTripModal';
import ConfigMissingModal from './components/modals/ConfigMissingModal';
import { hasConfig } from './lib/supabase';

function getSlugFromURL(): string | null {
  return new URL(location.href).searchParams.get('trip');
}

function setURL(slug: string | null) {
  const u = new URL(location.href);
  if (slug) u.searchParams.set('trip', slug);
  else u.searchParams.delete('trip');
  history.pushState({}, '', u);
}

export default function App() {
  const [slug, setSlug] = useState<string | null>(getSlugFromURL());
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [showConfigMissing, setShowConfigMissing] = useState(!hasConfig);

  useEffect(() => {
    const onPop = () => setSlug(getSlugFromURL());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const goHome = useCallback(() => { setURL(null); setSlug(null); }, []);
  const openTrip = useCallback((newSlug: string) => { setURL(newSlug); setSlug(newSlug); }, []);

  const handleNewTrip = () => {
    if (!hasConfig) { alert('请先配置 .env。'); return; }
    setShowNewTrip(true);
  };

  return (
    <div id="app">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center gap-3 page-gutter h-[60px] bg-white/95 backdrop-blur-md border-b border-line shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-jade-dark to-jade rounded-sm grid place-items-center text-lg shrink-0 shadow-sm">
            ✈️
          </div>
          <div>
            <strong className="block text-[16px] font-bold font-serif text-jade-dark tracking-tight leading-none">
              Trip Planner
            </strong>
            <small className="text-[11px] text-muted leading-none">多人协作旅行规划器</small>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <button className="btn-ghost hidden sm:inline-flex" onClick={goHome}>我的旅行</button>
          <button className="btn-primary" onClick={handleNewTrip}>＋ 新建旅行</button>
        </div>
      </header>

      {slug ? (
        <TripView slug={slug} onHome={goHome} onDeleted={goHome} />
      ) : (
        <HomeView onOpenTrip={openTrip} onNewTrip={handleNewTrip} />
      )}

      {showNewTrip && (
        <NewTripModal
          onClose={() => setShowNewTrip(false)}
          onCreated={(createdSlug) => { setShowNewTrip(false); openTrip(createdSlug); }}
        />
      )}
      {showConfigMissing && <ConfigMissingModal onClose={() => setShowConfigMissing(false)} />}

      <Toast />
    </div>
  );
}
