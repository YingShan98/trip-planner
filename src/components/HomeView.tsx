import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { toast } from '../lib/toast';
import { dateRange } from '../lib/format';
import { copyTripLink, deleteTripBySlug } from '../lib/tripActions';
import type { TripListRow } from '../types';

export default function HomeView({
  onOpenTrip,
  onNewTrip,
}: {
  onOpenTrip: (slug: string) => void;
  onNewTrip: () => void;
}) {
  const [trips, setTrips] = useState<TripListRow[]>([]);

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
        <div className="section-head">
          <h2>我的旅行</h2>
          <span className="muted">{trips.length} 个旅行</span>
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
    </main>
  );
}
