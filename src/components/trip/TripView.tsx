import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { dateRange } from '../../lib/format';
import { downloadJSON } from '../../lib/download';
import { deleteV2Trip, getV2TripRole, loadV2Trip, saveV2Trip, type V2TripMeta } from '../../lib/v2Trip';
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
import V2SettingsModal from '../modals/V2SettingsModal';

function buildShareLink(slug: string): string {
  const u = new URL(location.href);
  u.searchParams.set('trip', slug);
  u.searchParams.set('readonly', '1');
  return u.toString();
}

export default function TripView({
  slug, readOnly = false, onHome, onDeleted,
}: {
  slug: string; readOnly?: boolean; onHome: () => void; onDeleted: () => void;
}) {
  const [currentTrip, setCurrentTrip]       = useState<V2TripMeta | null>(null);
  const [state, setState]                   = useState<TripState | null>(null);
  const [editUnlocked, setEditUnlockedState] = useState(false);
  const [syncStatus, setSyncStatus]         = useState('在线同步中');
  const [showSettings, setShowSettings]     = useState(false);

  const editUnlockedRef  = useRef(false);
  const stateRef         = useRef<TripState | null>(null);
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout>>();
  const saveInFlightRef  = useRef(false);
  const savePendingRef   = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  const setEditUnlocked = (v: boolean) => { editUnlockedRef.current = v; setEditUnlockedState(v); };

  /* ── Load trip ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sb) return;
      try {
        const workspace = await loadV2Trip(slug);
        if (cancelled) return;
        setCurrentTrip(workspace.trip);
        setState(workspace.state);
      } catch (error) {
        if (!cancelled) toast('无法打开旅行：' + (error as Error).message);
      }
      setEditUnlocked(false);
      setSyncStatus('在线同步中');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /* ── Realtime ── */
  useEffect(() => {
    const client = sb;
    if (!client) return;
    const reload = async () => {
      if (editUnlockedRef.current && saveInFlightRef.current) return;
      try {
        const workspace = await loadV2Trip(slug);
        setCurrentTrip(workspace.trip);
        setState(workspace.state);
        toast('行程已更新');
      } catch (error) { toast('同步失败：' + (error as Error).message); }
    };
    const channel = client
      .channel('v2-trip:' + slug)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `slug=eq.${slug}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_days' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_notes' }, reload)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [slug]);

  /* ── Save ── */
  const saveRemote = useCallback(async () => {
    if (!editUnlockedRef.current || !sb) return;
    if (saveInFlightRef.current) { savePendingRef.current = true; return; }
    saveInFlightRef.current = true;
    setSyncStatus('保存中…');
    try {
      if (!stateRef.current) throw new Error('没有可保存的行程');
      await saveV2Trip(slug, stateRef.current);
      setSyncStatus('已同步');
      toast('已同步');
    } catch (e) {
      setSyncStatus('保存失败');
      toast('保存失败：' + (e as Error).message);
    } finally {
      saveInFlightRef.current = false;
      if (savePendingRef.current) { savePendingRef.current = false; saveRemote(); }
    }
  }, [slug]);

  const scheduleSave = useCallback(() => {
    if (!editUnlockedRef.current) return;
    clearTimeout(saveTimerRef.current);
    setSyncStatus('等待保存…');
    saveTimerRef.current = setTimeout(saveRemote, 650);
  }, [saveRemote]);

  const mutate = useCallback((fn: (draft: TripState) => void) => {
    setState((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });
    scheduleSave();
  }, [scheduleSave]);

  const mutateNoSave = useCallback((fn: (draft: TripState) => void) => {
    setState((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });
  }, []);

  const toggleEdit = async () => {
    if (editUnlocked) { setEditUnlocked(false); return; }
    if (!sb || readOnly) return;
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) { toast('请先登录后编辑'); return; }
    const role = currentTrip ? await getV2TripRole(currentTrip.id) : null;
    if (role !== 'owner' && role !== 'editor') { toast('你没有这趟旅行的编辑权限'); return; }
    setEditUnlocked(true);
    toast('已进入编辑模式');
  };

  const handleDeleteCurrent = async () => { if (await deleteV2Trip(slug)) onDeleted(); };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(buildShareLink(slug));
    toast('只读分享链接已复制');
  };

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
            onClick={onHome}
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
              {editUnlocked ? '✏️ 可编辑' : readOnly ? '🔗 只读分享' : '👀 只读查看'}
            </span>
            {!readOnly && (
              <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill text-[11.5px]">
                {editUnlocked ? '编辑模式' : syncStatus}
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/14">
            {!readOnly && (
              <button
                className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
                onClick={toggleEdit}
              >
                {editUnlocked ? '🔒 锁定编辑' : '🔓 编辑'}
              </button>
            )}
            {!readOnly && (
              <button
                className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
                onClick={() => setShowSettings(true)}
              >
                ⚙️ 旅行设置
              </button>
            )}
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
            <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={copyShareLink}
            >
              📤 复制分享链接
            </button>
            <span className="flex-1" />
            {!readOnly && (
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

      <nav aria-label="行程目录" className="sticky top-[68px] z-40 bg-surface/94 backdrop-blur-md border-b border-line shadow-xs overflow-x-auto">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-1 min-w-max">
          {[
            ['overview', '概览'], ['prepare', '准备'], ['itinerary', '行程'],
            ['stay', '住宿'], ['currency', '汇率'], ['transport', '交通'], ['budget', '预算'], ['notes', '讨论'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="px-3.5 py-3 text-[12.5px] font-semibold text-muted border-b-2 border-transparent hover:text-jade hover:border-jade no-underline transition-colors">
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="max-w-[1200px] mx-auto px-6 pb-24">
        <div id="overview" className="scroll-mt-32"><Dashboard state={state} description={currentTrip.description} total={total} done={done} /></div>
        <div id="prepare" className="scroll-mt-32"><Checklist state={state} editUnlocked={editUnlocked} mutate={mutate} /></div>
        <div id="itinerary" className="scroll-mt-32"><DaysSection state={state} editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave} /></div>
        <div id="stay" className="scroll-mt-32"><HotelsSection state={state} editUnlocked={editUnlocked} mutate={mutate} /></div>
        <div id="currency" className="scroll-mt-32"><CurrencySection state={state} homeCurrency={currentTrip.home_currency} mutate={mutate} /></div>
        <div id="transport" className="scroll-mt-32"><TransportSection state={state} editUnlocked={editUnlocked} mutate={mutate} homeCurrency={currentTrip.home_currency} /></div>
        <div id="budget" className="scroll-mt-32"><BudgetSection state={state} editUnlocked={editUnlocked} mutate={mutate} currency={currentTrip.home_currency} /></div>
        <div id="notes" className="scroll-mt-32"><NotesSection state={state} editUnlocked={editUnlocked} mutate={mutate} /></div>
      </div>

      {/* ── FAB save ── */}
      {editUnlocked && (
        <button
          className="fixed right-5 bottom-5 z-[60] bg-jade-dark text-white rounded-full px-5 py-3 text-[13.5px] font-bold shadow-[0_4px_20px_rgba(26,74,57,0.40)] transition-all duration-150 flex items-center gap-1.5 hover:bg-jade hover:shadow-[0_8px_30px_rgba(26,74,57,0.50)] hover:-translate-y-0.5 active:translate-y-0"
          onClick={saveRemote}
        >
          💾 保存同步
        </button>
      )}

      {showSettings && (
        <V2SettingsModal
          trip={currentTrip}
          onClose={() => setShowSettings(false)}
          onSaved={(changes) => setCurrentTrip((prev) => (prev ? { ...prev, ...changes } : prev))}
        />
      )}
    </main>
  );
}
