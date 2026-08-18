import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { sb } from '../lib/supabase';
import { toast } from '../lib/toast';
import { dateRange } from '../lib/format';
import { downloadJSON } from '../lib/download';
import { copyTripLink, deleteTripBySlug } from '../lib/tripActions';
import { normalize, templateState } from '../state';
import type { ImportedTripMeta, TripListRow, TripState } from '../types';
import NewTripModal from './modals/NewTripModal';

export default function HomeView({
  onOpenTrip,
  onNewTrip,
}: {
  onOpenTrip: (slug: string) => void;
  onNewTrip: () => void;
}) {
  const [trips, setTrips] = useState<TripListRow[]>([]);
  const [importPayload, setImportPayload] = useState<{ meta: ImportedTripMeta; data: TripState } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTrips = async () => {
    if (!sb) {
      setTrips([]);
      return;
    }
    const { data, error } = await sb
      .from('trip_documents')
      .select('id,slug,title,destination,start_date,end_date,currency,description,updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      toast('无法读取旅行列表：' + error.message);
      return;
    }
    setTrips(data || []);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const handleDelete = async (slug: string) => {
    if (await deleteTripBySlug(slug)) await loadTrips();
  };

  const downloadTemplate = () => {
    downloadJSON('trip-template.json', {
      meta: {
        title: '旅行名称',
        destination: '目的地',
        start_date: '2027-01-01',
        end_date: '2027-01-07',
        currency: 'MYR',
        description: '旅行简介',
      },
      data: templateState(),
    });
  };

  const handleImportClick = () => fileInputRef.current?.click();

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
    <main className="view">
      <section className="hero home-hero">
        <div>
          <div className="eyebrow">YOUR TRAVEL WORKSPACE</div>
          <h1>
            把旅行计划放在一起，
            <br />
            和同行的人一起完成。
          </h1>
          <p>公开查看、密码编辑、实时同步。一个项目可以管理所有未来旅行。</p>
        </div>
        <button className="primary large" onClick={onNewTrip}>
          ＋ 创建第一趟旅行
        </button>
      </section>
      <section className="section">
        <div className="section-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h2>我的旅行</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className="muted">{trips.length} 个旅行</span>
            <button className="ghost" onClick={downloadTemplate}>
              ⬇️ 下载模板
            </button>
            <button className="ghost" onClick={handleImportClick}>
              ⬆️ 导入 JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>
        <div className="trip-grid">
          {trips.length === 0 ? (
            <div className="empty">
              还没有旅行。
              <br />
              创建第一趟旅行吧。
            </div>
          ) : (
            trips.map((t) => (
              <article className="trip-card" key={t.slug}>
                <div>
                  <h3>{t.title}</h3>
                  <div className="meta">
                    <span className="pill">📍 {t.destination || '目的地待定'}</span>
                    <span className="pill">📅 {dateRange(t)}</span>
                    <span className="pill">💰 {t.currency || 'MYR'}</span>
                  </div>
                </div>
                <p className="muted">{t.description || ''}</p>
                <div className="actions">
                  <button className="primary" onClick={() => onOpenTrip(t.slug)}>
                    进入旅行
                  </button>
                  <button className="ghost" onClick={() => copyTripLink(t.slug)}>
                    复制链接
                  </button>
                  <button className="danger" onClick={() => handleDelete(t.slug)}>
                    删除
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      {importPayload && (
        <NewTripModal
          initialMeta={importPayload.meta}
          initialData={importPayload.data}
          onClose={() => setImportPayload(null)}
          onCreated={(createdSlug) => {
            setImportPayload(null);
            onOpenTrip(createdSlug);
          }}
        />
      )}
    </main>
  );
}
