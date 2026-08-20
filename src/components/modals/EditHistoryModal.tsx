import type { TripEditEvent } from '../../lib/guestAuth';
import Modal from '../Modal';

export default function EditHistoryModal({ events, onClose }: { events: TripEditEvent[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">编辑记录</h2>
      <p className="text-muted text-[13px] mt-1">这里记录最近的计划更新。访客名称来自他们自己填写的参与名称。</p>
      <div className="flex flex-col gap-2 mt-5">
        {events.length === 0 ? <div className="empty-state">还没有编辑记录</div> : events.map((event) => (
          <article key={event.id} className="bg-surface-2 border border-line rounded-sm px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-[13px] text-jade-dark">{event.actor_name}</strong>
              <span className="text-muted text-[11.5px]">{new Date(event.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <p className="text-[12.5px] text-ink-2 mt-1">{event.summary}</p>
          </article>
        ))}
      </div>
    </Modal>
  );
}
