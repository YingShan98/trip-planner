import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { confirmDialog } from '../../lib/confirm';
import { dateRange } from '../../lib/format';
import { downloadJSON } from '../../lib/download';
import { createShare, deleteTrip, getTripRole, loadSharedTrip, loadTrip, saveSharedTrip, saveTrip, verifyEditPassword, type TripMeta } from '../../lib/tripApi';
import { ensureGuestSession, getTripEditEvents, isAnonymousUser, setGuestName, type TripEditEvent } from '../../lib/guestAuth';
import type { TripState } from '../../types';
import { parseRate } from '../../lib/currency';
import Dashboard from './Dashboard';
import Checklist from './Checklist';
import DaysSection from './DaysSection';
import HotelsSection from './HotelsSection';
import CurrencySection from './CurrencySection';
import TransportSection from './TransportSection';
import BudgetSection from './BudgetSection';
import NotesSection from './NotesSection';
import SettingsModal from '../modals/SettingsModal';
import Modal from '../Modal';
import GuestIdentityModal from '../modals/GuestIdentityModal';
import EditHistoryModal from '../modals/EditHistoryModal';

function buildShareLink(token: string): string {
  const u = new URL(location.href);
  u.searchParams.delete('trip');
  u.searchParams.delete('readonly');
  u.searchParams.set('share', token);
  return u.toString();
}

const SECTIONS = [
  ['overview', '概览'], ['prepare', '准备'], ['itinerary', '行程'],
  ['stay', '住宿'], ['currency', '汇率'], ['transport', '交通'], ['budget', '预算'], ['notes', '讨论'],
] as const;

export default function TripView({
  slug, readOnly = false, shareToken, onHome, onDeleted,
}: {
  slug: string; readOnly?: boolean; shareToken?: string | null; onHome: () => void; onDeleted: () => void;
}) {
  const [currentTrip, setCurrentTrip]       = useState<TripMeta | null>(null);
  const [state, setState]                   = useState<TripState | null>(null);
  const [editUnlocked, setEditUnlockedState] = useState(false);
  const [syncStatus, setSyncStatus]         = useState('在线同步中');
  const [showSettings, setShowSettings]     = useState(false);
  const [role, setRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [sharePermission, setSharePermission] = useState<'view' | 'edit' | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareMode, setShareMode] = useState<'view' | 'edit'>('view');
  const [shareExpiry, setShareExpiry] = useState('7');
  const [showTop, setShowTop] = useState(false);
  const [showGuestIdentity, setShowGuestIdentity] = useState(false);
  const [guestName, setGuestNameState] = useState(() => localStorage.getItem(`trip-guest-name:${shareToken || ''}`) || '');
  const [requiresEditPassword, setRequiresEditPassword] = useState(false);
  const [editPassword, setEditPasswordState] = useState(() => sessionStorage.getItem(`trip-edit-pw:${shareToken || ''}`) || '');
  const [editEvents, setEditEvents] = useState<TripEditEvent[] | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0][0]);

  const editUnlockedRef  = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const stateRef         = useRef<TripState | null>(null);
  const saveInFlightRef  = useRef(false);
  const savePendingRef   = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  const setEditUnlocked = (v: boolean) => { editUnlockedRef.current = v; setEditUnlockedState(v); };

  /* ── Load trip ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sb) return;
      try {
        const workspace = shareToken ? await loadSharedTrip(shareToken) : await loadTrip(slug);
        if (cancelled) return;
        setCurrentTrip(workspace.trip);
        setState(workspace.state);
        setSharePermission(workspace.sharePermission || null);
        setRequiresEditPassword(Boolean(workspace.requiresEditPassword));
        if (!shareToken) {
          const { data: userData } = await sb.auth.getUser();
          setRole(userData.user ? await getTripRole(workspace.trip.id) : null);
        } else setRole(null);
      } catch (error) {
        if (!cancelled) toast('无法打开旅行：' + (error as Error).message);
      }
      setEditUnlocked(false);
      setSyncStatus('在线同步中');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, shareToken]);

  /* ── Realtime ──
     `save_trip_workspace` (the only writer for trip_days/activities/budget_items/trip_notes,
     see supabase/schema.sql) always bumps `trips.updated_at` first, so subscribing to this
     trip's `trips` row alone is enough to catch every save — child tables can't be filtered
     by trip here (activities has no trip_id column), so watching them unfiltered would fire
     reload() for every trip in the database, not just this one. Filtering by id rather than
     slug also covers share-link viewers, whose URL has no `slug` to filter on. */
  useEffect(() => {
    const client = sb;
    const tripId = currentTrip?.id;
    if (!client || !tripId) return;
    const reload = async () => {
      if (editUnlockedRef.current && (saveInFlightRef.current || hasUnsavedChangesRef.current)) return;
      try {
        const workspace = shareToken ? await loadSharedTrip(shareToken) : await loadTrip(slug);
        setCurrentTrip(workspace.trip);
        setState(workspace.state);
        toast('行程已更新');
      } catch (error) { toast('同步失败：' + (error as Error).message); }
    };
    const channel = client
      .channel('trip:' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, reload)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [slug, shareToken, currentTrip?.id]);

  /* ── Save ── */
  const saveRemote = useCallback(async () => {
    if (!editUnlockedRef.current || !hasUnsavedChanges || !sb || isSaving) return;
    if (saveInFlightRef.current) { savePendingRef.current = true; return; }
    saveInFlightRef.current = true;
    setIsSaving(true);
    setSyncStatus('保存中…');
    try {
      if (!stateRef.current) throw new Error('没有可保存的行程');
      if (shareToken) await saveSharedTrip(shareToken, stateRef.current, editPassword || undefined);
      else await saveTrip(slug, stateRef.current);
      setHasUnsavedChanges(false);
      setSyncStatus('已同步');
      toast('已同步');
    } catch (e) {
      setSyncStatus('保存失败');
      toast('保存失败：' + (e as Error).message);
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
      if (savePendingRef.current) { savePendingRef.current = false; saveRemote(); }
    }
  }, [hasUnsavedChanges, isSaving, shareToken, slug, editPassword]);

  const mutate = useCallback((fn: (draft: TripState) => void) => {
    setState((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });
    setHasUnsavedChanges(true);
    setSyncStatus('有未保存的修改');
  }, []);

  const mutateNoSave = useCallback((fn: (draft: TripState) => void) => {
    setState((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });
  }, []);

  const toggleEdit = async () => {
    if (editUnlocked) {
      if (hasUnsavedChanges && !await confirmDialog('还有未保存的修改，确定退出编辑模式吗？', { title: '退出编辑模式', confirmLabel: '退出' })) return;
      setEditUnlocked(false);
      return;
    }
    if (!sb || readOnly) return;
    if (shareToken && sharePermission !== 'edit') { toast('此链接仅可查看'); return; }
    if (shareToken && sharePermission === 'edit') {
      try {
        const guest = await ensureGuestSession();
        const needsIdentity = isAnonymousUser(guest) && !guestName;
        const needsPassword = requiresEditPassword && !editPassword;
        if (needsIdentity || needsPassword) { setShowGuestIdentity(true); return; }
      } catch (error) { toast('无法开启访客编辑：' + (error as Error).message); return; }
    }
    if (!shareToken && role !== 'owner' && role !== 'editor') { toast('请先登录并获得这趟旅行的编辑权限'); return; }
    setEditUnlocked(true);
    toast('已进入编辑模式');
  };

  const continueAsGuest = async (name: string, captchaToken: string, password?: string) => {
    if (!shareToken || !currentTrip) return;
    try {
      await ensureGuestSession(captchaToken);
      await setGuestName(currentTrip.id, shareToken, name);
      localStorage.setItem(`trip-guest-name:${shareToken}`, name);
      setGuestNameState(name);
      if (requiresEditPassword && !editPassword) {
        const ok = await verifyEditPassword(shareToken, password || '');
        if (!ok) { toast('密码不正确'); return; }
        sessionStorage.setItem(`trip-edit-pw:${shareToken}`, password || '');
        setEditPasswordState(password || '');
      }
      setShowGuestIdentity(false);
      setEditUnlocked(true);
      toast(`已作为「${name}」进入编辑模式`);
    } catch (error) { toast('访客身份保存失败：' + (error as Error).message); }
  };

  const leaveTrip = async () => {
    if (hasUnsavedChanges && !await confirmDialog('还有未保存的修改，确定离开吗？', { title: '离开旅行', confirmLabel: '离开' })) return;
    onHome();
  };

  const openEditHistory = async () => {
    if (!currentTrip) return;
    try { setEditEvents(await getTripEditEvents(currentTrip.id)); }
    catch (error) { toast('无法读取编辑记录：' + (error as Error).message); }
  };

  const handleDeleteCurrent = async () => {
    if (!currentTrip) return;
    if (!await confirmDialog(`删除「${currentTrip.title}」？此操作不可恢复，所有行程内容都会被永久删除。`, { title: '删除旅行', confirmLabel: '删除', danger: true })) return;
    if (await deleteTrip(slug)) onDeleted();
  };

  const createShareLink = async () => {
    try {
      const expiresAt = shareMode === 'view' || shareExpiry === '0' ? null : new Date(Date.now() + Number(shareExpiry) * 86400000).toISOString();
      const token = await createShare(currentTrip?.id || '', shareMode, expiresAt);
      await navigator.clipboard.writeText(buildShareLink(token));
      toast(`${shareMode === 'edit' ? '可编辑' : '只读'}分享链接已复制${expiresAt ? `，${shareExpiry}天后过期` : ''}`);
      setShowShare(false);
    } catch (error) { toast('分享失败：' + (error as Error).message); }
  };

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Scroll-spy for section nav ──
     IntersectionObserver only reports elements whose intersection just changed, so we
     use it purely as a "something moved" trigger and recompute the active section from
     every section's live position — otherwise a section that stays intersecting across
     a navigation (e.g. jumping back to the top) leaves activeSection stale. */
  useEffect(() => {
    if (!currentTrip || !state) return;
    const ids = SECTIONS.map(([id]) => id);
    const NAV_OFFSET = 150;

    const recompute = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET) current = id;
      }
      setActiveSection(current);
    };

    const observer = new IntersectionObserver(recompute, { rootMargin: '-150px 0px -65% 0px', threshold: [0, 1] });
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    recompute();
    return () => observer.disconnect();
  }, [Boolean(currentTrip), Boolean(state)]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasUnsavedChanges]);

  const exportJSON = () => {
    if (!currentTrip || !state) return;
    downloadJSON((slug || 'trip') + '.json', {
    meta: { title: currentTrip.title, destination: currentTrip.destination, start_date: currentTrip.start_date, end_date: currentTrip.end_date, currency: currentTrip.home_currency, description: currentTrip.description },
      data: state,
    });
  };

  if (!currentTrip || !state) {
    return <main className="flex items-center justify-center min-h-[60vh] text-muted">加载中…</main>;
  }

  const total = state.days.reduce((a, d) => a + d.items.length, 0);
  const done  = state.checklist.filter((x) => x.done).length;

  return (
    <main className={`min-h-[calc(100vh-68px)] bg-bg${editUnlocked ? '' : ' readonly'}`}>

      {/* ── Banners ── */}
      {editUnlocked && (
        <div className="content-gutter py-2.5 bg-gold-tint border-b border-gold-line text-gold text-[13px] font-semibold flex items-center gap-2">
          <span aria-hidden="true">✦</span> 编辑模式已开启 <span className="font-normal">· 修改会自动保存</span>
        </div>
      )}
      {readOnly && (
        <div className="content-gutter py-2.5 bg-sky-tint border-b border-sky-line text-sky text-[13px] font-semibold flex items-center gap-2">
          <span aria-hidden="true">◌</span> 只读分享模式 <span className="font-normal">· 这是一个共享查看版本</span>
        </div>
      )}

      {/* ── Trip hero ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-jade-dark to-jade text-white content-gutter py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,0.07)_0%,transparent_50%)]" />
        <div className="relative z-10">
          <button
            className="btn mb-5 bg-white/10 border-white/22 text-white/88 text-[13px] px-3.5 py-1.5 hover:bg-white/18 hover:border-white/45 hover:text-white hover:-translate-x-0.5"
            onClick={leaveTrip}
          >
            ← 我的旅行
          </button>

          <p className="text-white/60 text-[11px] font-bold tracking-[0.16em] uppercase mb-2">TRIP WORKSPACE</p>
          <h1 className="font-serif text-[32px] font-bold mb-1.5 leading-[1.25]">{currentTrip.title}</h1>
          <p className="text-white/72 text-[14.5px] m-0">
            {currentTrip.destination || '目的地待定'} · {dateRange(currentTrip)}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">
              💰 {currentTrip.home_currency || 'MYR'}
              {state.foreignCurrency
                ? ` · ${state.foreignCurrency}${parseRate(state.exchangeRate) ? ` @ ${parseRate(state.exchangeRate)}` : ' (未设汇率)'}`
                : ''}
            </span>
            <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">
              {editUnlocked ? '✏️ 可编辑' : shareToken ? '🔐 安全分享' : readOnly ? '🔗 只读查看' : '👀 只读查看'}
            </span>
            {!readOnly && !shareToken && (role === 'owner' || role === 'editor') && (
              <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill text-[11.5px]">
                {editUnlocked ? '编辑模式' : syncStatus}
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-white/14">
            {!readOnly && (!shareToken && role === 'owner' || shareToken && sharePermission === 'edit') && (
              <button
                className={`btn text-[13px] px-3.5 py-2 transition-all duration-150 ${
                  editUnlocked
                    ? 'bg-white/10 border-white/20 text-white/88 hover:bg-white/20 hover:border-white/40 hover:text-white'
                    : 'bg-white border-white text-jade-dark font-bold hover:bg-white/90 hover:-translate-y-px hover:shadow-md'
                }`}
                onClick={toggleEdit}
              >
                {editUnlocked ? '🔒 锁定编辑' : '🔓 开始编辑'}
              </button>
            )}

            <span className="w-px h-5 bg-white/15 hidden sm:block" />

            {!readOnly && !shareToken && (
              <button
                className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
                onClick={() => setShowSettings(true)}
              >
                ⚙️ 旅行设置
              </button>
            )}
            {!shareToken && role === 'owner' && <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={() => setShowShare(true)}
            >
              📤 分享行程
            </button>}
            {!shareToken && role === 'owner' && <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={openEditHistory}
            >
              🧾 编辑记录
            </button>}

            <span className="w-px h-5 bg-white/15 hidden sm:block" />

            <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={exportJSON}
            >
              ⬇️ 导出 JSON
            </button>
            <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={() => window.print()}
            >
              🖨 打印
            </button>

            <span className="flex-1" />
            {!readOnly && !shareToken && role === 'owner' && (
              <button
                className="btn bg-red-900/20 border-red-400/35 text-red-200 text-[13px] px-3.5 py-2 hover:bg-red-900/38 hover:border-red-400/60 hover:text-white"
                onClick={handleDeleteCurrent}
              >
                删除旅行
              </button>
            )}
          </div>
        </div>
      </header>

      <nav aria-label="行程目录" className="trip-nav sticky top-[68px] z-40 bg-surface/94 backdrop-blur-md border-b border-line shadow-xs overflow-x-auto">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-1 min-w-max">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={`px-3.5 py-3 text-[12.5px] font-semibold border-b-2 no-underline transition-colors ${
                activeSection === id ? 'text-jade border-jade' : 'text-muted border-transparent hover:text-jade hover:border-jade'
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="trip-layout max-w-[1200px] mx-auto px-6 pb-24">
        <aside className="trip-sidebar" aria-label="行程侧栏">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase mb-2">每天安排</p>
          {state.days.length
            ? state.days.map((day, i) => <a key={i} href={`#day-${i + 1}`}>D{i + 1} · {day.title}</a>)
            : <p className="text-muted text-[12.5px] px-2.5">还没有安排 Day</p>}
        </aside>
        <div className="min-w-0">
          <div id="overview" className="scroll-mt-32"><Dashboard state={state} description={currentTrip.description} total={total} done={done} /></div>
          <div id="prepare" className="scroll-mt-32"><Checklist state={state} editUnlocked={editUnlocked} mutate={mutate} /></div>
          <div id="itinerary" className="scroll-mt-32"><DaysSection state={state} editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave} onCollapseAll={() => mutateNoSave((s) => { s.days.forEach((_, i) => { s.collapsed[i] = true; }); })} /></div>
          <div id="stay" className="scroll-mt-32"><HotelsSection state={state} editUnlocked={editUnlocked} mutate={mutate} /></div>
          <div id="currency" className="scroll-mt-32"><CurrencySection state={state} homeCurrency={currentTrip.home_currency} mutate={mutate} /></div>
          <div id="transport" className="scroll-mt-32"><TransportSection state={state} editUnlocked={editUnlocked} mutate={mutate} homeCurrency={currentTrip.home_currency} /></div>
          <div id="budget" className="scroll-mt-32"><BudgetSection state={state} editUnlocked={editUnlocked} mutate={mutate} currency={currentTrip.home_currency} /></div>
          <div id="notes" className="scroll-mt-32"><NotesSection state={state} editUnlocked={editUnlocked} mutate={mutate} /></div>
        </div>
      </div>

      {/* ── FAB save ── */}
      {editUnlocked && (
        <button
          className={`fixed right-5 bottom-5 z-[60] rounded-full px-5 py-3 text-[13.5px] font-bold shadow-md transition-all duration-150 flex items-center gap-1.5 ${hasUnsavedChanges ? 'bg-coral text-white hover:bg-danger' : 'bg-jade-dark text-white hover:bg-jade'} disabled:opacity-70`}
          onClick={saveRemote}
          disabled={!hasUnsavedChanges || isSaving}
          title={hasUnsavedChanges ? '保存未保存的修改' : '当前没有未保存的修改'}
        >
          {isSaving ? '⏳ 保存中…' : hasUnsavedChanges ? '💾 保存修改' : '✓ 已保存'}
        </button>
      )}

      {showTop && <button className="fixed right-5 bottom-20 z-[60] btn-primary rounded-full shadow-md" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部">↑ 顶部</button>}

      {showSettings && (
        <SettingsModal
          trip={currentTrip}
          onClose={() => setShowSettings(false)}
          onSaved={(changes) => setCurrentTrip((prev) => (prev ? { ...prev, ...changes } : prev))}
        />
      )}

      {showShare && <Modal onClose={() => setShowShare(false)}>
        <h2 className="font-serif text-[22px] text-jade-dark mb-1">分享这趟旅行</h2>
        <p className="text-muted text-[13px] mt-1">链接持有者无需登录。编辑链接只给可信的同行者，并设置较短有效期。</p>
        <div className="grid gap-3.5 mt-5">
          <div className="field"><label>权限</label><select className="inp" value={shareMode} onChange={(e) => setShareMode(e.target.value as 'view' | 'edit')}><option value="view">只读查看</option><option value="edit">可以编辑</option></select></div>
          {shareMode === 'edit' && <div className="field"><label>有效期</label><select className="inp" value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)}><option value="1">1天</option><option value="7">7天</option><option value="30">30天</option><option value="0">不过期，直到撤销</option></select></div>}
        </div>
        {shareMode === 'edit' && (
          <p className="text-muted text-[12.5px] mt-3">
            打开链接的人只需填写名字即可编辑，无需登录。想额外加一道密码？前往「旅行设置 → 编辑密码」设置。
          </p>
        )}
        <div className="flex justify-end mt-5 pt-4 border-t border-line"><button className="btn-primary" onClick={createShareLink}>生成并复制链接</button></div>
      </Modal>}

      {showGuestIdentity && <GuestIdentityModal initialName={guestName} requiresPassword={requiresEditPassword && !editPassword} onClose={() => setShowGuestIdentity(false)} onContinue={continueAsGuest} />}
      {editEvents && <EditHistoryModal events={editEvents} onClose={() => setEditEvents(null)} />}
    </main>
  );
}
