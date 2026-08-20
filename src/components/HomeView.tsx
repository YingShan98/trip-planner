import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { sb } from '../lib/supabase';
import { toast } from '../lib/toast';
import { dateRange } from '../lib/format';
import { downloadJSON } from '../lib/download';
import { copyTripLink } from '../lib/tripActions';
import { deleteV2Trip } from '../lib/v2Trip';
import { normalize, templateState } from '../state';
import type { ImportedTripMeta, TripListRow, TripState } from '../types';
import NewTripModal from './modals/V2NewTripModal';

export default function HomeView({
  onOpenTrip, onNewTrip,
}: {
  onOpenTrip: (slug: string) => void;
  onNewTrip: () => void;
}) {
  const [trips, setTrips] = useState<TripListRow[]>([]);
  const [importPayload, setImportPayload] = useState<{ meta: ImportedTripMeta; data: TripState } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTrips = async () => {
    if (!sb) { setTrips([]); return; }
    const { data, error } = await sb
      .from('trips')
      .select('id,slug,title,destination,start_date,end_date,home_currency,description,updated_at')
      .order('updated_at', { ascending: false });
    if (error) { toast('无法读取旅行列表：' + error.message); return; }
    setTrips((data || []).map((trip) => ({ ...trip, currency: trip.home_currency })) as TripListRow[]);
  };

  useEffect(() => { loadTrips(); }, []);

  const handleDelete = async (slug: string) => {
    if (!confirm('删除这趟旅行？此操作不可恢复。')) return;
    try { await deleteV2Trip(slug); toast('旅行已删除'); await loadTrips(); }
    catch (error) { toast('删除失败：' + (error as Error).message); }
  };

  const downloadTemplate = () => {
    downloadJSON('trip-template.json', {
      meta: { title: '旅行名称', destination: '目的地', start_date: '2027-01-01', end_date: '2027-01-07', currency: 'MYR', description: '旅行简介' },
      data: templateState(),
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      setImportPayload({ meta: obj.meta || {}, data: normalize(obj.data || obj) });
    } catch (err) {
      toast('JSON 格式无效：' + (err as Error).message);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-jade-dark via-jade to-jade-mid text-white content-gutter py-14 flex justify-between items-end gap-8">
        <div className="relative z-10">
          <div className="text-[11px] font-bold tracking-[0.14em] text-white/60 uppercase mb-3">
            YOUR SHARED TRAVEL DESK
          </div>
          <h1 className="font-serif text-[34px] font-bold leading-[1.3] mb-3">
            把想去的地方，<br />慢慢安排成一段旅程。
          </h1>
          <p className="text-white/78 max-w-[560px] text-[15px] m-0">
            和同行的人一起整理行程、住宿、预算与出发准备。打开链接即可查看，输入密码即可共同编辑。
          </p>
        </div>
        <button
          className="btn-primary btn-lg shrink-0 bg-white/14 border-white/45 text-white hover:bg-white/24 hover:border-white/75 hover:shadow-md hover:-translate-y-0.5 relative z-10"
          onClick={onNewTrip}
        >
          ＋ 创建第一段旅程
        </button>
        {/* background radial highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06)_0%,transparent_55%)]" />
      </section>

      {/* ── Trip list ── */}
      <section className="content-gutter py-7">
        <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
          <h2 className="font-serif text-[19px] font-bold text-jade-dark">旅程收藏</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted text-[13px]">{trips.length} 个旅行</span>
            <button className="btn-ghost" onClick={downloadTemplate}>下载模板</button>
            <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>导入 JSON</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="empty-state">还没有保存的旅程。<br />创建第一段旅程，和同行的人一起开始安排吧。</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {trips.map((t) => (
              <article
                key={t.slug}
                className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm flex flex-col transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
              >
                {/* coloured top stripe */}
                <div className="h-1 bg-gradient-to-r from-jade to-jade-mid" />

                <div className="p-5 flex-1 flex flex-col gap-2.5">
                  <div>
                    <h3 className="font-serif text-[17px] font-bold text-jade-dark leading-[1.3] mb-2">{t.title}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="pill">📍 {t.destination || '目的地待定'}</span>
                      <span className="pill">📅 {dateRange(t)}</span>
                      <span className="pill">💰 {t.currency || 'MYR'}</span>
                    </div>
                  </div>
                  {t.description && (
                    <p className="text-muted text-[13px] leading-[1.55] flex-1">{t.description}</p>
                  )}
                </div>

                {/* action footer */}
                <div className="flex border-t border-line">
                  <button
                    className="flex-1 py-2.5 px-2 text-[13px] font-bold text-jade bg-surface-2 border-r border-line transition-colors hover:bg-jade-tint"
                    onClick={() => onOpenTrip(t.slug)}
                  >
                    进入旅行
                  </button>
                  <button
                    className="flex-1 py-2.5 px-2 text-[13px] text-muted transition-colors hover:bg-surface-3 hover:text-ink-2 border-r border-line"
                    onClick={() => copyTripLink(t.slug)}
                  >
                    复制链接
                  </button>
                  <button
                    className="flex-1 py-2.5 px-2 text-[13px] text-muted transition-colors hover:bg-danger-tint hover:text-danger"
                    onClick={() => handleDelete(t.slug)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {importPayload && (
        <NewTripModal
          initialMeta={importPayload.meta}
          initialData={importPayload.data}
          onClose={() => setImportPayload(null)}
          onCreated={(createdSlug) => { setImportPayload(null); onOpenTrip(createdSlug); }}
        />
      )}
    </main>
  );
}
