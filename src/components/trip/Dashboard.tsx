import type { TripState } from '../../types';

export default function Dashboard({
  state,
  description,
  total,
  done,
}: {
  state: TripState;
  description: string;
  total: number;
  done: number;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>📋 旅行速览</h2>
        <span className="muted">{description || ''}</span>
      </div>
      <div className="dash">
        <div className="dash-card">
          <small>旅行天数</small>
          <strong>{state.days.length} 天</strong>
        </div>
        <div className="dash-card">
          <small>行程项目</small>
          <strong>{total} 项</strong>
        </div>
        <div className="dash-card">
          <small>Checklist</small>
          <strong>
            {done}/{state.checklist.length}
          </strong>
        </div>
        <div className="dash-card">
          <small>酒店候选</small>
          <strong>{state.hotels.length} 个</strong>
        </div>
      </div>
    </section>
  );
}
