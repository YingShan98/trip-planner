import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { confirmDialog } from '../../lib/confirm';
import { dateRange, dayDate, formatDateWithWeekday, tripCountdownLabel } from '../../lib/format';
import { fetchWeather, type WeatherResult } from '../../lib/weather';
import { downloadJSON } from '../../lib/download';
import { createShare, deleteTrip, getTripRole, loadSharedTrip, loadTrip, saveSharedTrip, saveTrip, SaveConflictError, updateTripMeta, verifyEditPassword, type TripMeta } from '../../lib/tripApi';
import { ensureGuestSession, getExistingGuestUser, getTripEditEvents, isAnonymousUser, setGuestName, type TripEditEvent } from '../../lib/guestAuth';
import type { TripState } from '../../types';
import { convertAmount, convertToLocalTrip, formatMoney, hasForeignAmounts, parseRate } from '../../lib/currency';
import Dashboard from './Dashboard';
import CollapsibleSection from './CollapsibleSection';
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

const SECTIONS = [
  ['overview', '概览'], ['prepare', '准备'], ['itinerary', '行程'],
  ['stay', '住宿'], ['currency', '汇率'], ['transport', '交通'], ['budget', '预算'], ['notes', '讨论'], ['attachments', '附件'],
] as const;

/** Ids whose content is wrapped in a `<CollapsibleSection>`; overview/itinerary are always visible. */
const COLLAPSIBLE_META: Record<string, { icon: string; title: string }> = {
  prepare:     { icon: '☑️', title: '出发准备' },
  stay:        { icon: '🏨', title: '酒店候选' },
  currency:    { icon: '💱', title: '货币换算' },
  transport:   { icon: '🚐', title: '交通参考' },
  budget:      { icon: '💰', title: '预算' },
  notes:       { icon: '💬', title: '留言板' },
  attachments: { icon: '📎', title: '附件与资料' },
};

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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
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

  /* Nav-pill click: open the target section (if it's collapsible) before scrolling, since a
     collapsed section has zero height and would make a plain #id jump land in the wrong place.
     Waits a frame for the expand to paint (mirrors the print flow's double-rAF below). */
  const jumpToSection = (id: string) => {
    if (id in COLLAPSIBLE_META) setOpenSections((prev) => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(id);
      const nav = document.querySelector<HTMLElement>('.trip-nav');
      if (!el) return;
      const offset = (nav?.getBoundingClientRect().bottom ?? 68) + 12;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }));
  };

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
  const navSections = SECTIONS.filter(([id]) => !(id === 'currency' && hideCurrency));
  const total = state.days.reduce((a, d) => a + d.items.length, 0);
  const done  = state.checklist.filter((x) => x.done).length;

  /* One-line summaries shown on each collapsed accordion header. */
  const homeCurrency = currentTrip.home_currency || 'MYR';
  const foreignCurrency = state.foreignCurrency || '外币';
  const exchangeRateValue = parseRate(state.exchangeRate);
  let budgetTotalHome = 0;
  for (const x of state.budget) {
    const raw = (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0);
    const conv = convertAmount(raw, state.isLocal ? 'home' : x.currency, state.isLocal ? null : exchangeRateValue);
    if (conv.home !== null) budgetTotalHome += conv.home;
  }
  const travelerCount = Number(state.travelers) || 0;
  const budgetSummary = state.budget.length
    ? `估算 ${formatMoney(budgetTotalHome, homeCurrency)}${travelerCount > 0 ? ` · 每人 ${formatMoney(budgetTotalHome / travelerCount, homeCurrency)}` : ''}`
    : '暂无项目';
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
      <header className="trip-hero relative overflow-hidden bg-gradient-to-br from-jade-dark to-jade text-white content-gutter py-8">
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
        <div className="relative z-10">
          <button
            className="no-print btn mb-5 bg-white/10 border-white/22 text-white/88 text-[13px] px-3.5 py-1.5 hover:bg-white/18 hover:border-white/45 hover:text-white hover:-translate-x-0.5"
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
            <span className="pill bg-white/13 border-white/22 text-white/90 hero-pill">
              💰 {currentTrip.home_currency || 'MYR'}
              {state.isLocal
                ? ' · 本地旅行'
                : state.foreignCurrency
                ? ` · ${state.foreignCurrency}${parseRate(state.exchangeRate) ? ` @ ${parseRate(state.exchangeRate)}` : ' (未设汇率)'}`
                : ''}
            </span>
            <span className="no-print pill bg-white/13 border-white/22 text-white/90 hero-pill">
              {editUnlocked ? '✏️ 可编辑' : shareToken ? '🔐 安全分享' : readOnly ? '🔗 只读查看' : '👀 只读查看'}
            </span>
            {!readOnly && !shareToken && (role === 'owner' || role === 'editor') && (
              <span className="no-print pill bg-white/13 border-white/22 text-white/90 hero-pill text-[11.5px]">
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

          {/* Toolbar */}
          <div className="no-print flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-white/14">
            {canToggleEdit && (
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
            {!readOnly && !shareToken && role === 'owner' && (
              <button
                className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
                onClick={() => setShowImport(true)}
              >
                📥 导入 JSON 更新
              </button>
            )}
            <button
              className="btn bg-white/10 border-white/20 text-white/88 text-[13px] px-3.5 py-2 hover:bg-white/20 hover:border-white/40 hover:text-white hover:-translate-y-px"
              onClick={openPrintModal}
            >
              🖨 打印 / 导出 PDF
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
          {navSections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => { e.preventDefault(); jumpToSection(id); }}
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
      <div className="trip-layout max-w-[1200px] mx-auto px-6 pb-44">
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
          <div id="overview" className={`scroll-mt-32${printSections.overview ? '' : ' print-hide'}`}><Dashboard state={state} description={currentTrip.description} total={total} done={done} startDate={currentTrip.start_date} endDate={currentTrip.end_date} weather={weather} /></div>

          <CollapsibleSection id="prepare" icon={COLLAPSIBLE_META.prepare.icon} title={COLLAPSIBLE_META.prepare.title} summary={sectionSummary.prepare} printVisible={printSections.prepare} open={Boolean(openSections.prepare)} onToggle={() => setOpenSections((p) => ({ ...p, prepare: !p.prepare }))}>
            <Checklist state={state} editUnlocked={editUnlocked} mutate={mutate} canCheck={canCheck} onToggle={toggleCheck} onRequestEdit={canToggleEdit ? toggleEdit : undefined} />
          </CollapsibleSection>

          <div id="itinerary" className={`scroll-mt-32${printSections.itinerary ? '' : ' print-hide'}`}><DaysSection state={state} editUnlocked={editUnlocked} mutate={mutate} mutateNoSave={mutateNoSave} startDate={currentTrip.start_date} weather={weather} authorName={myPresenceName} showDiscussionInPrint={printSections.notes} /></div>

          <CollapsibleSection id="stay" icon={COLLAPSIBLE_META.stay.icon} title={COLLAPSIBLE_META.stay.title} summary={sectionSummary.stay} printVisible={printSections.stay} open={Boolean(openSections.stay)} onToggle={() => setOpenSections((p) => ({ ...p, stay: !p.stay }))}>
            <HotelsSection state={state} editUnlocked={editUnlocked} mutate={mutate} authorName={myPresenceName} printOnlyIndex={printHotelFilter === 'all' ? null : printHotelFilter} showDiscussionInPrint={printSections.notes} />
          </CollapsibleSection>

          {!hideCurrency && (
            <CollapsibleSection id="currency" icon={COLLAPSIBLE_META.currency.icon} title={COLLAPSIBLE_META.currency.title} summary={sectionSummary.currency} printVisible={printSections.currency && !state.isLocal} open={Boolean(openSections.currency)} onToggle={() => setOpenSections((p) => ({ ...p, currency: !p.currency }))}>
              <CurrencySection state={state} homeCurrency={currentTrip.home_currency} editUnlocked={editUnlocked} mutate={mutate} />
            </CollapsibleSection>
          )}

          <CollapsibleSection id="transport" icon={COLLAPSIBLE_META.transport.icon} title={COLLAPSIBLE_META.transport.title} summary={sectionSummary.transport} printVisible={printSections.transport} open={Boolean(openSections.transport)} onToggle={() => setOpenSections((p) => ({ ...p, transport: !p.transport }))}>
            <TransportSection state={state} editUnlocked={editUnlocked} mutate={mutate} homeCurrency={currentTrip.home_currency} printOnlyIndex={printTransportFilter === 'all' ? null : printTransportFilter} />
          </CollapsibleSection>

          <CollapsibleSection id="budget" icon={COLLAPSIBLE_META.budget.icon} title={COLLAPSIBLE_META.budget.title} summary={sectionSummary.budget} printVisible={printSections.budget} open={Boolean(openSections.budget)} onToggle={() => setOpenSections((p) => ({ ...p, budget: !p.budget }))}>
            <BudgetSection state={state} editUnlocked={editUnlocked} mutate={mutate} currency={currentTrip.home_currency} />
          </CollapsibleSection>

          <CollapsibleSection id="notes" icon={COLLAPSIBLE_META.notes.icon} title={COLLAPSIBLE_META.notes.title} summary={sectionSummary.notes} printVisible={printSections.notes} open={Boolean(openSections.notes)} onToggle={() => setOpenSections((p) => ({ ...p, notes: !p.notes }))}>
            <NotesSection state={state} editUnlocked={editUnlocked} mutate={mutate} authorName={myPresenceName} />
          </CollapsibleSection>

          <CollapsibleSection id="attachments" icon={COLLAPSIBLE_META.attachments.icon} title={COLLAPSIBLE_META.attachments.title} summary={sectionSummary.attachments} printVisible={printSections.attachments} open={Boolean(openSections.attachments)} onToggle={() => setOpenSections((p) => ({ ...p, attachments: !p.attachments }))}>
            <AttachmentsSection state={state} editUnlocked={editUnlocked} mutate={mutate} />
          </CollapsibleSection>
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
      <div className="no-print fixed right-5 bottom-5 z-[60] flex flex-col items-end gap-2.5">
        {showTop && <button className="btn-primary rounded-full shadow-md" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部">↑ 顶部</button>}
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
            className={`rounded-full px-5 py-3 text-[13.5px] font-bold shadow-md border-[1.5px] transition-all duration-150 flex items-center gap-1.5 ${
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
