import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { confirmDialog } from '../../lib/confirm';
import { dateRange, dayDate, formatDateWithWeekday, todayDayIndex, tripCountdownLabel } from '../../lib/format';
import { fetchWeather, type WeatherResult } from '../../lib/weather';
import { downloadJSON } from '../../lib/download';
import { createShare, deleteTrip, getTripRole, loadSharedTrip, loadTrip, saveSharedTrip, saveTrip, SaveConflictError, updateTripMeta, verifyEditPassword, type TripMeta } from '../../lib/tripApi';
import { ensureGuestSession, getExistingGuestUser, getTripEditEvents, isAnonymousUser, setGuestName, type TripEditEvent } from '../../lib/guestAuth';
import type { TripState } from '../../types';
import { convertToLocalTrip, formatMoney, hasForeignAmounts, parseRate } from '../../lib/currency';
import { budgetBreakdown } from '../../lib/budget';
import Dashboard from './Dashboard';
import Checklist from './Checklist';
import DaysSection from './DaysSection';
import HotelsSection from './HotelsSection';
import CurrencySection from './CurrencySection';
import TransportSection from './TransportSection';
import BudgetSection from './BudgetSection';
import NotesSection from './NotesSection';
import AttachmentsSection from './AttachmentsSection';
import SettingsModal from '../modals/SettingsModal';
import Modal from '../Modal';
import GuestIdentityModal from '../modals/GuestIdentityModal';
import EditHistoryModal from '../modals/EditHistoryModal';
import PrintModal, { defaultPrintSections, type PrintSections } from '../modals/PrintModal';
import ImportIntoTripModal, { type TripMetaChanges } from '../modals/ImportIntoTripModal';

function buildShareLink(token: string): string {
  const u = new URL(location.href);
  u.searchParams.delete('trip');
  u.searchParams.delete('readonly');
  u.searchParams.set('share', token);
  return u.toString();
}

/** The trip page shows one view at a time; 行程 is the default. Phones get a bottom tab bar
 *  (the first four, plus 其他 for the rest); wider screens get the top tab bar with all of them. */
const VIEWS = [
  { id: 'itinerary',   icon: '🗓️', label: '行程', title: '行程' },
  { id: 'prepare',     icon: '☑️', label: '准备', title: '出发准备' },
  { id: 'stay',        icon: '🏨', label: '住宿', title: '住宿' },
  { id: 'budget',      icon: '💰', label: '预算', title: '预算' },
  { id: 'transport',   icon: '🚐', label: '交通', title: '交通参考' },
  { id: 'notes',       icon: '💬', label: '讨论', title: '留言板' },
  { id: 'attachments', icon: '📎', label: '附件', title: '附件与资料' },
] as const;
type ViewId = typeof VIEWS[number]['id'];
const PHONE_TABS: ViewId[] = ['itinerary', 'prepare', 'stay', 'budget'];

/** A section inside a view: a plain heading (no folding — the view already scopes what's shown). */
function ViewPanel({ id, icon, title, summary, printVisible = true, children }: {
  id: string; icon: string; title: string; summary?: string; printVisible?: boolean; children: ReactNode;
}) {
  return (
    <section id={id} className={`py-5 sm:py-7 border-b border-line last:border-b-0${printVisible ? '' : ' print-hide'}`}>
      <div className="flex justify-between items-baseline gap-x-3 gap-y-1 flex-wrap pb-3.5 mb-4 border-b-2 border-line">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark flex items-center gap-2"><span aria-hidden="true">{icon}</span> {title}</h2>
        {summary && <span className="text-muted text-[12.5px]">{summary}</span>}
      </div>
      {children}
    </section>
  );
}

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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showGuestIdentity, setShowGuestIdentity] = useState(false);
  const [guestName, setGuestNameState] = useState(() => localStorage.getItem(`trip-guest-name:${shareToken || ''}`) || '');
  const [requiresEditPassword, setRequiresEditPassword] = useState(false);
  const [editPassword, setEditPasswordState] = useState(() => sessionStorage.getItem(`trip-edit-pw:${shareToken || ''}`) || '');
  const [editEvents, setEditEvents] = useState<TripEditEvent[] | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<ViewId>('itinerary');
  const [showViewSheet, setShowViewSheet] = useState(false);
  /** Where each view was scrolled to, so coming back to 行程 lands on the same day again. */
  const viewScrollRef = useRef<Partial<Record<ViewId, number>>>({});
  const viewSwitchRef = useRef(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [printSections, setPrintSections] = useState<PrintSections>(defaultPrintSections);
  const [printHotelFilter, setPrintHotelFilter] = useState<number | 'all'>('all');
  const [printTransportFilter, setPrintTransportFilter] = useState<number | 'all'>('all');
  const [printRequestedAt, setPrintRequestedAt] = useState(0);
  const [weather, setWeather] = useState<WeatherResult | 'loading' | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [viewers, setViewers] = useState<{ name: string; editing: boolean }[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceSubscribedRef = useRef(false);

  const editUnlockedRef  = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const stateRef         = useRef<TripState | null>(null);
  const currentTripRef   = useRef<TripMeta | null>(null);
  const saveInFlightRef  = useRef(false);
  const savePendingRef   = useRef(false);
  const quickSaveInFlightRef = useRef(false);
  const quickSavePendingRef  = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { currentTripRef.current = currentTrip; }, [currentTrip]);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  const setEditUnlocked = (v: boolean) => { editUnlockedRef.current = v; setEditUnlockedState(v); };

  /* ── Keep the reader's place when switching read ⇄ edit mode ──
     Toggling swaps text for inputs (and adds a banner at the top), which shifts everything below.
     Right before the switch we note the element under a point near the top of the viewport plus its
     ancestors; after the re-render, the deepest of those React kept in the DOM is scrolled back to
     where it was. */
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<{ chain: Element[]; tops: number[] } | null>(null);

  const captureScrollAnchor = () => {
    const col = contentRef.current;
    scrollAnchorRef.current = null;
    if (!col) return;
    const rect = col.getBoundingClientRect();
    const y = Math.min(window.innerHeight - 1, Math.max(160, window.innerHeight * 0.3));
    // elementsFromPoint also sees through modals/floating buttons to the page content beneath.
    const hit = document.elementsFromPoint(rect.left + rect.width / 2, y).find((el) => el !== col && col.contains(el));
    if (!hit) return;
    const chain: Element[] = [];
    for (let el: Element | null = hit; el && el !== col; el = el.parentElement) chain.push(el);
    scrollAnchorRef.current = { chain, tops: chain.map((el) => el.getBoundingClientRect().top) };
  };

  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    scrollAnchorRef.current = null;
    if (!anchor) return;
    const i = anchor.chain.findIndex((el) => el.isConnected);
    if (i < 0) return;
    const delta = anchor.chain[i].getBoundingClientRect().top - anchor.tops[i];
    // 'instant' overrides the page-wide `scroll-behavior: smooth`, so the jump isn't visible.
    if (Math.abs(delta) >= 1) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
  }, [editUnlocked]);

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
          setMyEmail(userData.user?.email || null);
        } else setRole(null);
      } catch (error) {
        if (!cancelled) toast('无法打开旅行：' + (error as Error).message);
      }
      setEditUnlocked(false);
      setSyncStatus('在线同步中');
    })();
    return () => { cancelled = true; };
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

  /* ── Presence: who else is currently looking at this trip ── */
  const myPresenceName = guestName || (myEmail ? myEmail.split('@')[0] : null) || (role === 'owner' ? '旅行拥有者' : role === 'editor' ? '同行编辑者' : '访客');

  useEffect(() => {
    const client = sb;
    const tripId = currentTrip?.id;
    if (!client || !tripId) { setViewers([]); return; }
    const channel = client.channel(`presence:trip:${tripId}`, { config: { presence: { key: crypto.randomUUID() } } });
    presenceChannelRef.current = channel;
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState<{ name: string; editing: boolean }>();
      setViewers(Object.values(presenceState).flat());
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        presenceSubscribedRef.current = true;
        channel.track({ name: myPresenceName, editing: editUnlockedRef.current });
      }
    });
    return () => { presenceSubscribedRef.current = false; presenceChannelRef.current = null; client.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrip?.id]);

  useEffect(() => {
    if (presenceSubscribedRef.current) presenceChannelRef.current?.track({ name: myPresenceName, editing: editUnlocked });
  }, [myPresenceName, editUnlocked]);

  /* ── Save ──
     content_version is an optimistic-concurrency token (see save_trip_workspace):
     each save must state the version it was loaded from, and the RPC rejects the
     save instead of silently overwriting if someone else saved in between. */
  const saveRemote = useCallback(async () => {
    if (!editUnlockedRef.current || !hasUnsavedChanges || !sb || isSaving) return;
    if (saveInFlightRef.current) { savePendingRef.current = true; return; }
    saveInFlightRef.current = true;
    setIsSaving(true);
    setSyncStatus('保存中…');
    try {
      let force = false;
      for (;;) {
        if (!stateRef.current || !currentTripRef.current) throw new Error('没有可保存的行程');
        try {
          const version = shareToken
            ? await saveSharedTrip(shareToken, stateRef.current, currentTripRef.current.content_version, force, editPassword || undefined)
            : await saveTrip(slug, stateRef.current, currentTripRef.current.content_version, force);
          setCurrentTrip((prev) => (prev ? { ...prev, content_version: version } : prev));
          setHasUnsavedChanges(false);
          setSyncStatus('已同步');
          toast('已同步');
          break;
        } catch (e) {
          if (!(e instanceof SaveConflictError)) throw e;
          setSyncStatus('保存冲突');
          // Cancel (including Escape/backdrop, which ConfirmDialog also resolves false) must stay
          // inert: it's the keyboard default, so it can never be the branch that discards local edits.
          const overwrite = await confirmDialog(
            '有其他人已经保存了这趟旅行的更新内容，你的修改还没有保存。是否用你的修改覆盖对方的内容？',
            { title: '保存冲突', confirmLabel: '用我的修改覆盖', cancelLabel: '取消，先不保存' },
          );
          if (overwrite) { force = true; continue; }
          toast('已取消保存，你的修改还留在本地，可以稍后重试');
          break;
        }
      }
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

  /* ── Quick-check save: lets checklist/packing checkboxes persist without unlocking full edit
     mode. Independent of the edit-mode batch save above so it never interferes with hasUnsavedChanges/
     the FAB, but reuses the same in-flight/pending-retry shape to avoid racing concurrent toggles. ── */
  const canCheck = !readOnly && (shareToken
    ? sharePermission === 'edit' && Boolean(guestName) && (!requiresEditPassword || Boolean(editPassword))
    : role === 'owner' || role === 'editor');

  const quickSave = useCallback(async (payload: TripState) => {
    if (!sb || !currentTripRef.current) return;
    if (quickSaveInFlightRef.current) { quickSavePendingRef.current = true; return; }
    quickSaveInFlightRef.current = true;
    try {
      const version = shareToken
        ? await saveSharedTrip(shareToken, payload, currentTripRef.current.content_version, false, editPassword || undefined)
        : await saveTrip(slug, payload, currentTripRef.current.content_version);
      setCurrentTrip((prev) => (prev ? { ...prev, content_version: version } : prev));
    } catch (e) {
      if (e instanceof SaveConflictError) {
        toast('有其他人更新了这趟旅行，正在重新加载最新内容…');
        try {
          const workspace = shareToken ? await loadSharedTrip(shareToken) : await loadTrip(slug);
          setCurrentTrip(workspace.trip);
          setState(workspace.state);
        } catch (reloadError) { toast('重新加载失败：' + (reloadError as Error).message); }
      } else {
        toast('保存失败：' + (e as Error).message);
      }
    } finally {
      quickSaveInFlightRef.current = false;
      if (quickSavePendingRef.current) { quickSavePendingRef.current = false; if (stateRef.current) quickSave(stateRef.current); }
    }
  }, [shareToken, slug, editPassword]);

  const toggleCheck = useCallback((list: 'checklist' | 'packing', id: string, done: boolean) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const item = (list === 'checklist' ? next.checklist : next.packing).find((x) => x.id === id);
      if (item) item.done = done;
      quickSave(next);
      return next;
    });
  }, [quickSave]);

  const toggleEdit = async () => {
    if (editUnlocked) {
      if (hasUnsavedChanges && !await confirmDialog('还有未保存的修改，确定退出编辑模式吗？', { title: '退出编辑模式', confirmLabel: '退出' })) return;
      captureScrollAnchor();
      setEditUnlocked(false);
      return;
    }
    if (!sb || readOnly) return;
    if (shareToken && sharePermission !== 'edit') { toast('此链接仅可查看'); return; }
    if (shareToken && sharePermission === 'edit') {
      try {
        const guest = await getExistingGuestUser();
        const needsIdentity = (!guest || isAnonymousUser(guest)) && !guestName;
        const needsPassword = requiresEditPassword && !editPassword;
        if (!guest || needsIdentity || needsPassword) { setShowGuestIdentity(true); return; }
      } catch (error) { toast('无法开启访客编辑：' + (error as Error).message); return; }
    }
    if (!shareToken && role !== 'owner' && role !== 'editor') { toast('请先登录并获得这趟旅行的编辑权限'); return; }
    captureScrollAnchor();
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
      captureScrollAnchor();
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
    try { await deleteTrip(slug); onDeleted(); }
    catch (error) { toast('删除失败：' + (error as Error).message); }
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
    if (!showMenu) return;
    const onPointerDown = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKey); };
  }, [showMenu]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Switching views ──
     Each view remembers its scroll position. A view opened for the first time starts with its
     heading just under the sticky bars, rather than back above the trip header. Tapping the
     current view's tab again scrolls to its top, like most apps. */
  const switchView = (id: ViewId) => {
    setShowViewSheet(false);
    if (id === view) { scrollToViewTop('smooth'); return; }
    viewScrollRef.current[view] = window.scrollY;
    viewSwitchRef.current = true;
    setView(id);
  };

  const scrollToViewTop = (behavior: ScrollBehavior) => {
    const col = contentRef.current;
    if (!col) return;
    const topbar = document.querySelector<HTMLElement>('#app > header')?.offsetHeight ?? 68;
    const nav = document.querySelector<HTMLElement>('.trip-nav');
    const navHeight = nav && getComputedStyle(nav).position === 'sticky' ? nav.offsetHeight : 0;
    const top = col.getBoundingClientRect().top + window.scrollY - topbar - navHeight;
    if (window.scrollY > top || behavior === 'smooth') window.scrollTo({ top: Math.max(0, top), behavior });
  };

  useLayoutEffect(() => {
    if (!viewSwitchRef.current) return;
    viewSwitchRef.current = false;
    const saved = viewScrollRef.current[view];
    if (saved !== undefined) window.scrollTo({ top: saved, behavior: 'instant' });
    else scrollToViewTop('instant');
    // The itinerary's day-pill scroll-spy measured hidden (zero-size) cards; let it re-measure.
    window.dispatchEvent(new Event('scroll'));
  }, [view]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasUnsavedChanges]);

  /* ── Weather (fetched once here, shared by Dashboard's trip-wide strip and DaysSection's per-day badges) ── */
  useEffect(() => {
    const destination = currentTrip?.destination?.trim();
    const startDate = currentTrip?.start_date;
    if (!destination || !startDate) { setWeather(null); return; }
    let cancelled = false;
    setWeather('loading');
    fetchWeather(destination, startDate, currentTrip?.end_date || startDate).then((result) => { if (!cancelled) setWeather(result); });
    return () => { cancelled = true; };
  }, [currentTrip?.destination, currentTrip?.start_date, currentTrip?.end_date]);

  /* Opens the print-options modal, pre-selecting each section's persisted "final choice" hotel/
     transport (if one has been marked) as the default print filter. */
  const openPrintModal = () => {
    if (!state) return;
    const chosenHotelIdx = state.hotels.findIndex((h) => h.chosen);
    const chosenTransportIdx = state.transport.findIndex((t) => t.chosen);
    setPrintHotelFilter(chosenHotelIdx >= 0 ? chosenHotelIdx : 'all');
    setPrintTransportFilter(chosenTransportIdx >= 0 ? chosenTransportIdx : 'all');
    setShowPrintModal(true);
  };

  /* Wait for the browser to actually paint the section/hotel/transport filters (already applied
     via React state at this point) before printing, rather than guessing with a fixed timeout.
     Folded days stay in the DOM (hidden on screen only), so they print without unfolding. */
  const confirmPrint = () => {
    setShowPrintModal(false);
    setPrintRequestedAt(Date.now());
  };

  useEffect(() => {
    if (!printRequestedAt) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => window.print());
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [printRequestedAt]);

  const exportJSON = () => {
    if (!currentTrip || !state) return;
    downloadJSON((slug || 'trip') + '.json', {
    meta: { slug: currentTrip.slug, title: currentTrip.title, destination: currentTrip.destination, start_date: currentTrip.start_date, end_date: currentTrip.end_date, currency: currentTrip.home_currency, description: currentTrip.description, cover_image_url: currentTrip.cover_image_url, variant: currentTrip.variant_label, audience: currentTrip.audience_label },
      data: state,
    });
  };

  /* Replaces this trip's content (and optionally its info) with an exported JSON, in place — same slug,
     same share links. Trip info goes first because save_trip_workspace maps each amount's 'home'/'foreign'
     key to a currency code using the stored home currency; it's rolled back if the content save is
     cancelled on a conflict. Returns whether the import happened. */
  const importIntoTrip = async (data: TripState, metaChanges: TripMetaChanges): Promise<boolean> => {
    const trip = currentTripRef.current;
    if (!trip) return false;
    if (hasUnsavedChanges && !await confirmDialog('你还有未保存的修改，用 JSON 覆盖会丢弃这些修改。继续吗？', { title: '丢弃未保存的修改', confirmLabel: '丢弃并继续', danger: true })) return false;
    const previousMeta = Object.fromEntries(Object.keys(metaChanges).map((k) => [k, trip[k as keyof TripMeta]])) as Partial<TripMeta>;
    const hasMeta = Object.keys(metaChanges).length > 0;
    saveInFlightRef.current = true;
    try {
      if (hasMeta) await updateTripMeta(trip.id, metaChanges);
      let force = false;
      for (;;) {
        try { await saveTrip(slug, data, trip.content_version, force); break; }
        catch (e) {
          if (!(e instanceof SaveConflictError)) throw e;
          if (await confirmDialog('有其他人刚刚保存了这趟旅行的更新，仍要用 JSON 覆盖吗？', { title: '保存冲突', confirmLabel: '仍然覆盖', cancelLabel: '取消', danger: true })) { force = true; continue; }
          if (hasMeta) await updateTripMeta(trip.id, previousMeta);
          toast('已取消导入，旅行没有改动');
          return false;
        }
      }
      const workspace = await loadTrip(slug);
      setCurrentTrip(workspace.trip);
      setState(workspace.state);
      setHasUnsavedChanges(false);
      setSyncStatus('已同步');
      toast('已用 JSON 更新这趟旅行');
      return true;
    } catch (e) {
      toast('导入失败：' + (e as Error).message);
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  };

  if (!currentTrip || !state) {
    return <main className="flex items-center justify-center min-h-[60vh] text-muted">加载中…</main>;
  }

  const canToggleEdit = !readOnly && ((!shareToken && role === 'owner') || (Boolean(shareToken) && sharePermission === 'edit'));
  const hideCurrency = state.isLocal && !editUnlocked;
  const total = state.days.reduce((a, d) => a + d.items.length, 0);
  const todayIndex = todayDayIndex(currentTrip.start_date, state.days.length);
  const done  = state.checklist.filter((x) => x.done).length;

  /* One-line summaries shown on each collapsed accordion header. */
  const homeCurrency = currentTrip.home_currency || 'MYR';
  const foreignCurrency = state.foreignCurrency || '外币';
  const exchangeRateValue = parseRate(state.exchangeRate);
  // With lines shared by only some travelers, per-person is a range: everyone-lines only → every line.
  const budget = budgetBreakdown(state);
  const perPersonLabel = budget.everyone === null ? ''
    : budget.partial.length
      ? ` · 每人 ${formatMoney(budget.everyone, homeCurrency)}–${formatMoney(budget.fullParticipant, homeCurrency).replace(homeCurrency, '').trim()}`
      : ` · 每人 ${formatMoney(budget.everyone, homeCurrency)}`;
  const budgetSummary = state.budget.length ? `估算 ${formatMoney(budget.totalHome, homeCurrency)}${perPersonLabel}` : '暂无项目';
  const sectionSummary: Record<string, string> = {
    prepare: state.checklist.length ? `${done}/${state.checklist.length} 完成` : '暂无事项',
    stay: state.hotels.length ? `${state.hotels.length} 个候选` : '暂无候选',
    currency: state.isLocal ? '本地旅行，无需换算' : exchangeRateValue ? `1 ${foreignCurrency} = ${exchangeRateValue} ${homeCurrency}` : '未设置汇率',
    transport: state.transport.length ? `${state.transport.length} 个方案` : '暂无方案',
    budget: budgetSummary,
    notes: state.notes.length ? `${state.notes.length} 条留言` : '暂无留言',
    attachments: state.attachments.filter((a) => a.url.trim()).length
      ? `${state.attachments.filter((a) => a.url.trim()).length} 个附件` : '暂无附件',
  };

  return (
    <main className={`min-h-[calc(100vh-68px)] bg-bg${editUnlocked ? '' : ' readonly'}`}>

      {/* ── Banners ── */}
      {editUnlocked && (
        <div className="no-print content-gutter py-2.5 bg-gold-tint border-b border-gold-line text-gold text-[13px] font-semibold flex items-center gap-2">
          <span aria-hidden="true">✦</span> 编辑模式已开启 <span className="font-normal">· 修改后请点击右下角「保存修改」</span>
        </div>
      )}
      {readOnly && (
        <div className="no-print content-gutter py-2.5 bg-sky-tint border-b border-sky-line text-sky text-[13px] font-semibold flex items-center gap-2">
          <span aria-hidden="true">◌</span> 只读分享模式 <span className="font-normal">· 这是一个共享查看版本</span>
        </div>
      )}

      {/* ── Trip hero ── */}
      <header className="trip-hero relative bg-gradient-to-br from-jade-dark to-jade text-white content-gutter py-5 sm:py-8">
        <div className="absolute inset-0 overflow-hidden">
          {currentTrip.cover_image_url && (
            <img
              src={currentTrip.cover_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(255,255,255,0.07)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-jade-dark/70 via-transparent to-transparent" />
        </div>
        {/* Raised above the sticky trip nav (z-40) only while the menu is open, so the menu isn't drawn under it. */}
        <div className={`relative ${showMenu ? 'z-[45]' : 'z-10'}`}>
          <button
            className="no-print btn mb-3 sm:mb-5 bg-white/10 border-white/22 text-white/88 text-[13px] px-3.5 py-1.5 hover:bg-white/18 hover:border-white/45 hover:text-white hover:-translate-x-0.5"
            onClick={leaveTrip}
          >
            ← 我的旅行
          </button>

          <p className="hidden sm:block text-white/60 text-[11px] font-bold tracking-[0.16em] uppercase mb-2">TRIP WORKSPACE</p>
          <h1 className="font-serif text-[24px] sm:text-[32px] font-bold mb-1.5 leading-[1.25]">{currentTrip.title}</h1>
          <p className="text-white/72 text-[14.5px] m-0">
            {currentTrip.destination || '目的地待定'} · {dateRange(currentTrip)}
          </p>

          <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
            {currentTrip.variant_label && (
              <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">🏷️ {currentTrip.variant_label}</span>
            )}
            {currentTrip.audience_label && (
              <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">👥 {currentTrip.audience_label}</span>
            )}
            {tripCountdownLabel(currentTrip.start_date, currentTrip.end_date) && (
              <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">
                🗓️ {tripCountdownLabel(currentTrip.start_date, currentTrip.end_date)}
              </span>
            )}
            <span className="pill hidden sm:inline-flex bg-white/13 border-white/22 text-white/90 hero-pill">
              💰 {currentTrip.home_currency || 'MYR'}
              {state.isLocal
                ? ' · 本地旅行'
                : state.foreignCurrency
                ? ` · ${state.foreignCurrency}${parseRate(state.exchangeRate) ? ` @ ${parseRate(state.exchangeRate)}` : ' (未设汇率)'}`
                : ''}
            </span>
            <span className="no-print pill hidden sm:inline-flex bg-white/13 border-white/22 text-white/90 hero-pill">
              {editUnlocked ? '✏️ 可编辑' : shareToken ? '🔐 安全分享' : readOnly ? '🔗 只读查看' : '👀 只读查看'}
            </span>
            {!readOnly && !shareToken && (role === 'owner' || role === 'editor') && (
              <span className="no-print pill hidden sm:inline-flex bg-white/13 border-white/22 text-white/90 hero-pill text-[11.5px]">
                {editUnlocked ? '编辑模式' : syncStatus}
              </span>
            )}
            {viewers.length > 1 && (
              <span
                className="no-print pill bg-white/13 border-white/22 text-white/90 hero-pill"
                title={viewers.map((v) => `${v.name}${v.editing ? '（编辑中）' : ''}`).join('、')}
              >
                👀 {viewers.length} 人在线{viewers.some((v) => v.editing) ? ' · 有人正在编辑' : ''}
              </span>
            )}
          </div>

          {/* Toolbar: the everyday actions up front, the rest folded into ⋯ */}
          <div className="no-print flex flex-wrap items-center gap-2 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-white/14">
            {canToggleEdit && (
              // Phones already have the floating edit button in the corner.
              <button
                className={`btn hidden sm:inline-flex text-[13px] px-3.5 py-2 transition-all duration-150 ${
                  editUnlocked
                    ? 'bg-white/10 border-white/20 text-white/88 hover:bg-white/20 hover:border-white/40 hover:text-white'
                    : 'bg-white border-white text-jade-dark font-bold hover:bg-white/90 hover:-translate-y-px hover:shadow-md'
                }`}
                onClick={toggleEdit}
              >
                {editUnlocked ? '🔒 锁定编辑' : '🔓 开始编辑'}
              </button>
            )}
            {!shareToken && role === 'owner' && <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={() => setShowShare(true)}
            >
              📤 分享行程
            </button>}

            <div ref={menuRef} className="relative">
              <button
                className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white"
                aria-haspopup="menu" aria-expanded={showMenu}
                onClick={() => setShowMenu((v) => !v)}
              >
                ⋯ 更多
              </button>
              {showMenu && (
                <div role="menu" className="absolute left-0 top-full mt-2 min-w-[210px] py-1.5 bg-surface text-ink rounded border border-line shadow-lg animate-fade-in">
                  {([
                    [!readOnly && !shareToken, '⚙️ 旅行设置', () => setShowSettings(true)],
                    [!shareToken && role === 'owner', '🧾 编辑记录', openEditHistory],
                    [true, '🖨 打印 / 导出 PDF', openPrintModal],
                    [true, '⬇️ 导出 JSON', exportJSON],
                    [!readOnly && !shareToken && role === 'owner', '📥 导入 JSON 更新', () => setShowImport(true)],
                  ] as const).filter(([show]) => show).map(([, label, action]) => (
                    <button key={label} role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-[13.5px] hover:bg-jade-light hover:text-jade-dark"
                      onClick={() => { setShowMenu(false); action(); }}>
                      {label}
                    </button>
                  ))}
                  {!readOnly && !shareToken && role === 'owner' && (
                    <>
                      <div className="my-1.5 border-t border-line" />
                      <button role="menuitem"
                        className="w-full text-left px-4 py-2.5 text-[13.5px] text-danger hover:bg-danger-tint"
                        onClick={() => { setShowMenu(false); handleDeleteCurrent(); }}>
                        🗑 删除旅行
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav aria-label="切换页面" className="trip-nav no-print hidden sm:block sticky top-[68px] z-40 bg-surface/94 backdrop-blur-md border-b border-line shadow-xs overflow-x-auto">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-1 min-w-max">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => switchView(v.id)}
              className={`px-3.5 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                view === v.id ? 'text-jade border-jade' : 'text-muted border-transparent hover:text-jade hover:border-jade'
              }`}
            >
              <span aria-hidden="true">{v.icon}</span> {v.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <div className={`trip-layout max-w-[1200px] mx-auto px-4 sm:px-6 pb-44${view === 'itinerary' ? '' : ' single'}`}>
        <aside className="trip-sidebar" aria-label="行程侧栏">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase mb-2">每天安排</p>
          {state.days.length
            ? state.days.map((day, i) => {
                const d = dayDate(currentTrip.start_date, i);
                return <a key={i} href={`#day-${i + 1}`}>D{i + 1}{d ? ` · ${formatDateWithWeekday(d)}` : ''} · {day.title}</a>;
              })
            : <p className="text-muted text-[12.5px] px-2.5">还没有安排 Day</p>}
        </aside>
        <div className="min-w-0" ref={contentRef}>
          <div className={view === 'itinerary' ? '' : 'view-hidden'}>
            <div id="overview" className={printSections.overview ? '' : 'print-hide'}><Dashboard state={state} description={currentTrip.description} total={total} done={done} startDate={currentTrip.start_date} endDate={currentTrip.end_date} weather={weather} todayIndex={todayIndex} /></div>
            <div id="itinerary" className={printSections.itinerary ? '' : 'print-hide'}><DaysSection state={state} editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave} startDate={currentTrip.start_date} weather={weather} authorName={myPresenceName} showDiscussionInPrint={printSections.notes} todayIndex={todayIndex} destination={currentTrip.destination} /></div>
          </div>

          <div className={view === 'prepare' ? '' : 'view-hidden'}>
            <ViewPanel id="prepare" icon="☑️" title="出发准备" summary={sectionSummary.prepare} printVisible={printSections.prepare}>
              <Checklist state={state} editUnlocked={editUnlocked} mutate={mutate} canCheck={canCheck} onToggle={toggleCheck} onRequestEdit={canToggleEdit ? toggleEdit : undefined} />
            </ViewPanel>
          </div>

          <div className={view === 'stay' ? '' : 'view-hidden'}>
            <ViewPanel id="stay" icon="🏨" title="住宿" summary={sectionSummary.stay} printVisible={printSections.stay}>
              <HotelsSection state={state} editUnlocked={editUnlocked} mutate={mutate} authorName={myPresenceName} printOnlyIndex={printHotelFilter === 'all' ? null : printHotelFilter} showDiscussionInPrint={printSections.notes} />
            </ViewPanel>
          </div>

          {/* 汇率 lives with 预算: the rate only matters for the amounts there. */}
          <div className={view === 'budget' ? '' : 'view-hidden'}>
            <ViewPanel id="budget" icon="💰" title="预算" summary={sectionSummary.budget} printVisible={printSections.budget}>
              <BudgetSection state={state} editUnlocked={editUnlocked} mutate={mutate} currency={currentTrip.home_currency} />
            </ViewPanel>
            {!hideCurrency && (
              <ViewPanel id="currency" icon="💱" title="货币换算" summary={sectionSummary.currency} printVisible={printSections.currency && !state.isLocal}>
                <CurrencySection state={state} homeCurrency={currentTrip.home_currency} editUnlocked={editUnlocked} mutate={mutate} />
              </ViewPanel>
            )}
          </div>

          <div className={view === 'transport' ? '' : 'view-hidden'}>
            <ViewPanel id="transport" icon="🚐" title="交通参考" summary={sectionSummary.transport} printVisible={printSections.transport}>
              <TransportSection state={state} editUnlocked={editUnlocked} mutate={mutate} homeCurrency={currentTrip.home_currency} printOnlyIndex={printTransportFilter === 'all' ? null : printTransportFilter} />
            </ViewPanel>
          </div>

          <div className={view === 'notes' ? '' : 'view-hidden'}>
            <ViewPanel id="notes" icon="💬" title="留言板" summary={sectionSummary.notes} printVisible={printSections.notes}>
              <NotesSection state={state} editUnlocked={editUnlocked} mutate={mutate} authorName={myPresenceName} />
            </ViewPanel>
          </div>

          <div className={view === 'attachments' ? '' : 'view-hidden'}>
            <ViewPanel id="attachments" icon="📎" title="附件与资料" summary={sectionSummary.attachments} printVisible={printSections.attachments}>
              <AttachmentsSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
            </ViewPanel>
          </div>
        </div>
      </div>

      {showImport && (
        <ImportIntoTripModal trip={currentTrip} current={state} onClose={() => setShowImport(false)} onImport={importIntoTrip} />
      )}

      {showPrintModal && (
        <PrintModal
          state={state}
          sections={printSections}
          onSectionsChange={setPrintSections}
          hotelFilter={printHotelFilter}
          onHotelFilterChange={setPrintHotelFilter}
          transportFilter={printTransportFilter}
          onTransportFilterChange={setPrintTransportFilter}
          onClose={() => setShowPrintModal(false)}
          onPrint={confirmPrint}
        />
      )}

      {/* ── Floating actions: always reachable, so switching modes doesn't need a trip back to the header.
             The edit toggle sits at the bottom and never moves; save appears above it while editing. ── */}
      <div className="no-print fab-stack fixed right-4 sm:right-5 z-[60] flex flex-col items-end gap-2.5">
        {showTop && <button className="btn-primary rounded-full shadow-md" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部">↑<span className="hidden sm:inline"> 顶部</span></button>}
        {editUnlocked && (
          <button
            className={`rounded-full px-5 py-3 text-[13.5px] font-bold shadow-md transition-all duration-150 flex items-center gap-1.5 ${hasUnsavedChanges ? 'bg-coral text-white hover:bg-danger' : 'bg-jade-dark text-white hover:bg-jade'} disabled:opacity-70`}
            onClick={saveRemote}
            disabled={!hasUnsavedChanges || isSaving}
            title={hasUnsavedChanges ? '保存未保存的修改' : '当前没有未保存的修改'}
          >
            {isSaving ? '⏳ 保存中…' : hasUnsavedChanges ? '💾 保存修改' : '✓ 已保存'}
          </button>
        )}
        {canToggleEdit && (
          <button
            className={`rounded-full px-4 py-2.5 sm:px-5 sm:py-3 text-[13.5px] font-bold shadow-md border-[1.5px] transition-all duration-150 flex items-center gap-1.5 ${
              editUnlocked
                ? 'bg-surface text-ink-2 border-line-strong hover:border-jade hover:text-jade-dark'
                : 'bg-gold text-white border-gold hover:-translate-y-px'
            }`}
            onClick={toggleEdit}
            aria-pressed={editUnlocked}
            title={editUnlocked ? '退出编辑模式，回到只读查看' : '进入编辑模式，停留在当前位置'}
          >
            {editUnlocked ? '🔒 完成编辑' : '✏️ 编辑'}
          </button>
        )}
      </div>

      {/* ── Phones: bottom tab bar. 其他 opens a sheet with the remaining views (named differently from
             the header's ⋯ 更多, which holds actions, not pages). ── */}
      {showViewSheet && (
        <div className="no-print sm:hidden fixed inset-0 z-[56]" role="dialog" aria-label="其他页面">
          <button className="absolute inset-0 bg-ink/30 animate-fade-in" aria-label="关闭" onClick={() => setShowViewSheet(false)} />
          <div className="tabbar-sheet absolute inset-x-0 bg-surface rounded-t-xl shadow-lg border-t border-line px-2 pt-2 pb-3 animate-slide-up">
            <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            {VIEWS.filter((v) => !PHONE_TABS.includes(v.id)).map((v) => (
              <button key={v.id} onClick={() => switchView(v.id)} aria-current={view === v.id ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded text-left ${view === v.id ? 'bg-jade-light' : 'hover:bg-surface-2'}`}>
                <span className="text-[22px] leading-none" aria-hidden="true">{v.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-semibold ${view === v.id ? 'text-jade-dark' : 'text-ink'}`}>{v.title}</span>
                  <span className="block text-[12px] text-muted truncate">{sectionSummary[v.id]}</span>
                </span>
                <span className="text-muted" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <nav aria-label="切换页面" className="tabbar no-print sm:hidden fixed inset-x-0 bottom-0 z-[57] bg-surface/96 backdrop-blur-md border-t border-line shadow-[0_-2px_12px_rgba(24,39,30,0.06)]">
        <div className="grid grid-cols-5">
          {[...PHONE_TABS.map((id) => VIEWS.find((v) => v.id === id)!), null].map((v) => {
            const active = v ? view === v.id : !PHONE_TABS.includes(view) || showViewSheet;
            return (
              <button key={v?.id ?? 'more'}
                onClick={() => (v ? switchView(v.id) : setShowViewSheet((x) => !x))}
                aria-current={v && view === v.id ? 'page' : undefined}
                aria-expanded={v ? undefined : showViewSheet}
                className={`min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${active ? 'text-jade-dark' : 'text-muted'}`}>
                <span className={`text-[19px] leading-none ${active ? '' : 'opacity-70 grayscale'}`} aria-hidden="true">{v ? v.icon : '☰'}</span>
                {v ? v.label : (PHONE_TABS.includes(view) ? '其他' : VIEWS.find((x) => x.id === view)!.label)}
                <span className={`h-[3px] w-5 rounded-full mt-0.5 ${active ? 'bg-jade' : 'bg-transparent'}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </nav>

      {showSettings && (
        <SettingsModal
          trip={currentTrip}
          isLocal={state.isLocal}
          hasForeignAmounts={hasForeignAmounts(state)}
          onClose={() => setShowSettings(false)}
          onSaved={(changes) => {
            setCurrentTrip((prev) => (prev ? { ...prev, ...changes } : prev));
            // Settings writes the trips row directly; mirror its fields into the in-memory state too,
            // or the next content save would write the old values back.
            const sync = (d: TripState) => {
              if (changes.foreign_currency !== undefined) d.foreignCurrency = changes.foreign_currency;
              if (changes.exchange_rate !== undefined) d.exchangeRate = changes.exchange_rate ?? '';
              if (changes.traveler_count !== undefined) d.travelers = changes.traveler_count ?? '';
              if (changes.is_local === false) d.isLocal = false;
              if (changes.is_local === true && !d.isLocal) convertToLocalTrip(d);
            };
            const current = stateRef.current;
            // Switching to local converts foreign-currency amounts, which live in the trip content, not
            // the trips row — so that part still needs a content save: through the save button while
            // editing (alongside the other unsaved edits), otherwise right away.
            if (current && changes.is_local === true && !current.isLocal && hasForeignAmounts(current)) {
              if (editUnlockedRef.current) { mutate(sync); return; }
              const next = structuredClone(current);
              sync(next);
              setState(next);
              quickSave(next);
              return;
            }
            mutateNoSave(sync);
          }}
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
