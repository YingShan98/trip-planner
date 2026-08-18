import type { TripState } from '../../types';

export default function Dashboard({
  state, description, total, done,
}: {
  state: TripState; description: string; total: number; done: number;
}) {
  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">📋 旅行速览</h2>
        {description && <span className="text-muted text-[13px]">{description}</span>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {[
          { label: '旅行天数', value: `${state.days.length} 天` },
          { label: '行程项目', value: `${total} 项` },
          { label: 'Checklist', value: `${done}/${state.checklist.length}` },
          { label: '酒店候选', value: `${state.hotels.length} 个` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-surface border border-line rounded p-4 shadow-xs transition-all duration-150 hover:shadow-sm hover:-translate-y-px"
          >
            <small className="block text-muted text-[11.5px] font-semibold uppercase tracking-[0.07em] mb-2">{label}</small>
            <strong className="font-serif text-[26px] font-bold text-jade-dark leading-[1.15]">{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
