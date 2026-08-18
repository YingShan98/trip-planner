import Modal from '../Modal';

export default function ConfigMissingModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2>⚙️ 还差一步</h2>
      <p>
        请复制 <code>.env.example</code> 为 <code>.env</code>，填入 Supabase Project URL 和 publishable/anon key。
      </p>
      <p className="muted">
        数据库初始化请先执行 <code>supabase/schema.sql</code>。
      </p>
      <div className="modal-actions">
        <button className="primary" onClick={onClose}>
          知道了
        </button>
      </div>
    </Modal>
  );
}
