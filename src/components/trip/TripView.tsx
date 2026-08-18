import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { dateRange } from '../../lib/format';
import { downloadJSON } from '../../lib/download';
import { normalize } from '../../state';
import { deleteTripBySlug } from '../../lib/tripActions';
import type { TripRow, TripState } from '../../types';
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
import ChangePasswordModal from '../modals/ChangePasswordModal';

export default function TripView({
  slug, onHome, onDeleted,
}: {
  slug: string; onHome: () => void; onDeleted: () => void;
}) {
  const [currentTrip, setCurrentTrip]       = useState<TripRow | null>(null);
  const [state, setState]                   = useState<TripState | null>(null);
  const [editUnlocked, setEditUnlockedState] = useState(false);
  const [syncStatus, setSyncStatus]         = useState('在线同步中');
  const [showSettings, setShowSettings]     = useState(false);
  const [showChangePw, setShowChangePw]     = useState(false);

  const editUnlockedRef  = useRef(false);
  const editPasswordRef  = useRef('');
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
      const { data, error } = await sb.from('trip_documents').select('*').eq('slug', slug).single();
      if (cancelled) return;
      if (error) { toast('无法打开旅行：' + error.message); return; }
      setCurrentTrip(data as TripRow);
      setState(normalize((data as TripRow).data));
      setEditUnlocked(false);
      editPasswordRef.current = '';
      setSyncStatus('在线同步中');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /* ── Realtime ── */
  useEffect(() => {
    const client = sb;
    if (!client) return;
    const channel = client
      .channel('trip:' + slug)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trip_documents', filter: `slug=eq.${slug}` }, (payload) => {
        if (editUnlockedRef.current && saveInFlightRef.current) return;
        const row = payload.new as TripRow;
        setCurrentTrip(row);
        setState(normalize(row.data));
        toast('🔄 行程已更新');
      })
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
      const { data, error } = await sb.rpc('save_trip', {
        p_slug: slug, p_password: editPasswordRef.current, p_data: stateRef.current,
      });
      if (error || data !== true) throw new Error(error?.message || '保存失败');
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
    if (editUnlocked) { setEditUnlocked(false); editPasswordRef.current = ''; return; }
    if (stateRef.current?.freeEdit) {
      editPasswordRef.current = '';
      setEditUnlocked(true);
      toast('已进入编辑模式（自由编辑）');
      return;
    }
    const pw = prompt('请输入该旅行的编辑密码');
    if (!pw || !sb) return;
    const { data, error } = await sb.rpc('verify_trip_password', { p_slug: slug, p_password: pw });
    if (error) { toast(error.message); return; }
    if (data === true) { editPasswordRef.current = pw; setEditUnlocked(true); toast('已进入编辑模式'); }
    else toast('编辑密码不正确');
  };

  const handleDeleteCurrent = async () => { if (await deleteTripBySlug(slug)) onDeleted(); };

  const exportJSON = () => {
    if (!currentTrip || !state) return;
    downloadJSON((slug || 'trip') + '.json', {
      meta: { title: currentTrip.title, destination: currentTrip.destination, start_date: currentTrip.start_date, end_date: currentTrip.end_date, currency: currentTrip.currency, description: currentTrip.description },
      data: state,
    });
  };

  if (!currentTrip || !state) {
    return <main className="flex items-center justify-center min-h-[60vh] text-muted">加载中…</main>;
  }

  const total = state.days.reduce((a, d) => a + d.items.length, 0);
  const done  = state.checklist.filter((x) => x.done).length;

  return (
    <main className={`min-h-[calc(100vh-60px)] bg-bg${editUnlocked ? '' : ' readonly'}`}>

      {/* ── Edit mode banner ── */}
      {editUnlocked && (
        <div className="content-gutter py-2 bg-gold-tint border-b border-gold-line text-gold text-[13px] font-semibold flex items-center gap-2">
          ✏️ 编辑模式已开启 — 修改将在 0.65 秒后自动保存
        </div>
      )}

      {/* ── Trip hero ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-jade-dark to-jade text-white content-gutter py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,0.07)_0%,transparent_50%)]" />
        <div className="relative z-10">
          <button
            className="btn mb-4 bg-white/10 border-white/22 text-white/88 text-[13px] px-3.5 py-1.5 hover:bg-white/18 hover:border-white/45 hover:text-white hover:-translate-x-0.5"
            onClick={onHome}
          >
            ← 我的旅行
          </button>

          <h1 className="font-serif text-[28px] font-bold mb-1.5 leading-[1.3]">{currentTrip.title}</h1>
          <p className="text-white/72 text-[14.5px] m-0">
            {currentTrip.destination || '目的地待定'} · {dateRange(currentTrip)}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">
              💰 {currentTrip.currency || 'MYR'}
              {state.foreignCurrency
                ? ` · ${state.foreignCurrency}${parseRate(state.exchangeRate) ? ` @ ${parseRate(state.exchangeRate)}` : ' (未设汇率)'}`
                : ''}
            </span>
            <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">
              {editUnlocked ? '✏️ 可编辑' : '👀 只读查看'}
            </span>
            <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill text-[11.5px]">
              {editUnlocked ? '编辑模式' : syncStatus}
            </span>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/14">
            {[
              { label: editUnlocked ? '🔒 锁定编辑' : '🔓 编辑', action: toggleEdit, danger: false },
              { label: '⚙️ 旅行设置', action: () => setShowSettings(true), danger: false },
              { label: '⬇️ 导出 JSON', action: exportJSON, danger: false },
              { label: '🖨 打印', action: () => window.print(), danger: false },
            ].map(({ label, action }) => (
              <button
                key={label}
                className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
                onClick={action}
              >
                {label}
              </button>
            ))}
            <span className="flex-1" />
            <button
              className="btn bg-red-900/20 border-red-400/35 text-red-200 text-[13px] px-3.5 py-2 hover:bg-red-900/38 hover:border-red-400/60 hover:text-white"
              onClick={handleDeleteCurrent}
            >
              删除旅行
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="max-w-[1200px] mx-auto px-6 pb-24">
        <Dashboard state={state} description={currentTrip.description} total={total} done={done} />
        <Checklist state={state} editUnlocked={editUnlocked} mutate={mutate} />
        <DaysSection state={state} editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave} />
        <HotelsSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
        <CurrencySection state={state} homeCurrency={currentTrip.currency} mutate={mutate} />
        <TransportSection state={state} editUnlocked={editUnlocked} mutate={mutate} homeCurrency={currentTrip.currency} />
        <BudgetSection state={state} editUnlocked={editUnlocked} mutate={mutate} currency={currentTrip.currency} />
        <NotesSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
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
        <SettingsModal
          trip={currentTrip} slug={slug} editUnlocked={editUnlocked} editPassword={editPasswordRef.current}
          state={state} mutate={mutate}
          onClose={() => setShowSettings(false)}
          onSaved={(meta) => setCurrentTrip((prev) => (prev ? { ...prev, ...meta } : prev))}
          onChangePassword={() => { setShowSettings(false); setShowChangePw(true); }}
        />
      )}
      {showChangePw && (
        <ChangePasswordModal
          slug={slug}
          onClose={() => setShowChangePw(false)}
          onChanged={(newPw) => { editPasswordRef.current = newPw; }}
        />
      )}
    </main>
  );
}
