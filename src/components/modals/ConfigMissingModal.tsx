import Modal from '../Modal';

export default function ConfigMissingModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">⚙️ 还差一步</h2>
      <p className="text-sm leading-relaxed mt-3">
        请复制 <code className="bg-surface-3 px-1.5 py-0.5 rounded text-[13px]">.env.example</code> 为{' '}
        <code className="bg-surface-3 px-1.5 py-0.5 rounded text-[13px]">.env</code>，填入 Supabase Project URL 和 publishable/anon key。
      </p>
      <p className="text-muted text-[13px] mt-2">
        数据库初始化请先执行 <code className="bg-surface-3 px-1.5 py-0.5 rounded text-[12px]">supabase/schema.sql</code>。
      </p>
      <div className="flex justify-end mt-5 pt-4 border-t border-line">
        <button className="btn-primary" onClick={onClose}>知道了</button>
      </div>
    </Modal>
  );
}
