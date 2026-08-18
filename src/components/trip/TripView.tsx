import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { dateRange } from '../../lib/format';
import { normalize } from '../../state';
import { deleteTripBySlug } from '../../lib/tripActions';
import type { TripRow, TripState } from '../../types';
import Dashboard from './Dashboard';
import Checklist from './Checklist';
import DaysSection from './DaysSection';
import HotelsSection from './HotelsSection';
import TransportSection from './TransportSection';
import BudgetSection from './BudgetSection';
import NotesSection from './NotesSection';
import SettingsModal from '../modals/SettingsModal';
import ChangePasswordModal from '../modals/ChangePasswordModal';

export default function TripView({
  slug,
  onHome,
  onDeleted,
}: {
  slug: string;
  onHome: () => void;
  onDeleted: () => void;
}) {
  const [currentTrip, setCurrentTrip] = useState<TripRow | null>(null);
  const [state, setState] = useState<TripState | null>(null);
  const [editUnlocked, setEditUnlockedState] = useState(false);
  const [syncStatus, setSyncStatus] = useState('在线同步中');
  const [showSettings, setShowSettings] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  const editUnlockedRef = useRef(false);
  const editPasswordRef = useRef('');
  const stateRef = useRef<TripState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const saveInFlightRef = useRef(false);
  const savePendingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setEditUnlocked = (v: boolean) => {
    editUnlockedRef.current = v;
    setEditUnlockedState(v);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sb) return;
      const { data, error } = await sb.from('trip_documents').select('*').eq('slug', slug).single();
      if (cancelled) return;
      if (error) {
        toast('无法打开旅行：' + error.message);
        return;
      }
      setCurrentTrip(data as TripRow);
      setState(normalize((data as TripRow).data));
      setEditUnlocked(false);
      editPasswordRef.current = '';
      setSyncStatus('在线同步中');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    const client = sb;
    if (!client) return;
    const channel = client
      .channel('trip:' + slug)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trip_documents', filter: `slug=eq.${slug}` },
        (payload) => {
          if (editUnlockedRef.current && saveInFlightRef.current) return;
          const row = payload.new as TripRow;
          setCurrentTrip(row);
          setState(normalize(row.data));
          toast('🔄 行程已更新');
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [slug]);

  const saveRemote = useCallback(async () => {
    if (!editUnlockedRef.current || !sb) return;
    if (saveInFlightRef.current) {
      savePendingRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setSyncStatus('保存中…');
    try {
      const { data, error } = await sb.rpc('save_trip', {
        p_slug: slug,
        p_password: editPasswordRef.current,
        p_data: stateRef.current,
      });
      if (error || data !== true) throw new Error(error?.message || '保存失败');
      setSyncStatus('已同步');
      toast('已同步');
    } catch (e) {
      setSyncStatus('保存失败');
      toast('保存失败：' + (e as Error).message);
    } finally {
      saveInFlightRef.current = false;
      if (savePendingRef.current) {
        savePendingRef.current = false;
        saveRemote();
      }
    }
  }, [slug]);

  const scheduleSave = useCallback(() => {
    if (!editUnlockedRef.current) return;
    clearTimeout(saveTimerRef.current);
    setSyncStatus('等待保存…');
    saveTimerRef.current = setTimeout(saveRemote, 650);
  }, [saveRemote]);

  const mutate = useCallback(
    (fn: (draft: TripState) => void) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        fn(next);
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const mutateNoSave = useCallback((fn: (draft: TripState) => void) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const toggleEdit = async () => {
    if (editUnlocked) {
      setEditUnlocked(false);
      editPasswordRef.current = '';
      return;
    }
    const pw = prompt('请输入该旅行的编辑密码');
    if (!pw || !sb) return;
    const { data, error } = await sb.rpc('verify_trip_password', { p_slug: slug, p_password: pw });
    if (error) {
      toast(error.message);
      return;
    }
    if (data === true) {
      editPasswordRef.current = pw;
      setEditUnlocked(true);
      toast('已进入编辑模式');
    } else {
      toast('编辑密码不正确');
    }
  };

  const handleDeleteCurrent = async () => {
    if (await deleteTripBySlug(slug)) onDeleted();
  };

  const exportJSON = () => {
    if (!currentTrip || !state) return;
    const payload = {
      meta: {
        title: currentTrip.title,
        destination: currentTrip.destination,
        start_date: currentTrip.start_date,
        end_date: currentTrip.end_date,
        currency: currentTrip.currency,
        description: currentTrip.description,
      },
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (slug || 'trip') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        setState(normalize(obj.data || obj));
        if (obj.meta && editUnlockedRef.current) {
          setCurrentTrip((prev) => (prev ? { ...prev, ...obj.meta } : prev));
        }
        scheduleSave();
        toast('JSON 已导入；记得保存同步');
      } catch (e) {
        toast('JSON 格式无效：' + (e as Error).message);
      }
    };
    input.click();
  };

  if (!currentTrip || !state) {
    return (
      <main className="view">
        <div className="empty">加载中…</div>
      </main>
    );
  }

  const total = state.days.reduce((a, d) => a + d.items.length, 0);
  const done = state.checklist.filter((x) => x.done).length;

  return (
    <main className="view">
      <div className={`trip-shell${editUnlocked ? '' : ' readonly'}`}>
        <header className="trip-hero">
          <button className="ghost back" onClick={onHome}>
            ← 我的旅行
          </button>
          <h1>{currentTrip.title}</h1>
          <p>
            {currentTrip.destination || '目的地待定'} · {dateRange(currentTrip)}
          </p>
          <div className="hero-meta">
            <span className="pill">💰 {currentTrip.currency || 'MYR'}</span>
            <span className="pill">{editUnlocked ? '✏️ 可编辑' : '👀 只读查看'}</span>
            <span className="pill status">{editUnlocked ? '编辑模式' : syncStatus}</span>
          </div>
          <div className="trip-toolbar">
            <button className="ghost" onClick={toggleEdit}>
              {editUnlocked ? '🔒 锁定编辑' : '🔓 编辑'}
            </button>
            <button className="ghost" onClick={() => setShowSettings(true)}>
              ⚙️ 旅行设置
            </button>
            <button className="ghost" onClick={exportJSON}>
              ⬇️ 导出 JSON
            </button>
            <button className="ghost" onClick={importJSON}>
              ⬆️ 导入 JSON
            </button>
            <button className="ghost" onClick={() => window.print()}>
              🖨 打印
            </button>
            <span className="spacer" />
            <button className="danger" onClick={handleDeleteCurrent}>
              删除旅行
            </button>
          </div>
        </header>
        <main className="content">
          <Dashboard state={state} description={currentTrip.description} total={total} done={done} />
          <Checklist state={state} editUnlocked={editUnlocked} mutate={mutate} />
          <DaysSection state={state} editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave} />
          <HotelsSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
          <TransportSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
          <BudgetSection state={state} editUnlocked={editUnlocked} mutate={mutate} currency={currentTrip.currency} />
          <NotesSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
        </main>
        {editUnlocked && (
          <button className="sticky-save" onClick={saveRemote}>
            保存同步
          </button>
        )}
      </div>
      {showSettings && (
        <SettingsModal
          trip={currentTrip}
          slug={slug}
          editUnlocked={editUnlocked}
          editPassword={editPasswordRef.current}
          onClose={() => setShowSettings(false)}
          onSaved={(meta) => setCurrentTrip((prev) => (prev ? { ...prev, ...meta } : prev))}
          onChangePassword={() => {
            setShowSettings(false);
            setShowChangePw(true);
          }}
        />
      )}
      {showChangePw && (
        <ChangePasswordModal
          slug={slug}
          onClose={() => setShowChangePw(false)}
          onChanged={(newPw) => {
            editPasswordRef.current = newPw;
          }}
        />
      )}
    </main>
  );
}
