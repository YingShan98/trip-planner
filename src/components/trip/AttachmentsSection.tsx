import type { Mutate, TripState } from '../../types';

export default function AttachmentsSection({
  state, editUnlocked, mutate,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate;
}) {
  const attachments = state.attachments;

  return (
    <section className="py-7 border-b border-line">
      <div className="flex justify-between items-center gap-2.5 pb-3.5 mb-4 border-b-2 border-line flex-wrap">
        <h2 className="font-serif text-[19px] font-bold text-jade-dark">📎 附件与资料</h2>
        <span className="text-muted text-[13px]">额外的行程文档、订单或参考链接</span>
      </div>

      {editUnlocked ? (
        <div className="flex flex-col gap-1.5">
          {attachments.map((a, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_auto] gap-1.5 items-center">
              <input
                className="inp editable"
                value={a.label}
                placeholder="附件名称"
                onChange={(e) => mutate((d) => { d.attachments[i].label = e.target.value; })}
              />
              <input
                className="inp editable"
                value={a.url}
                placeholder="https://..."
                onChange={(e) => mutate((d) => { d.attachments[i].url = e.target.value; })}
              />
              <button
                aria-label={`删除附件「${a.label || a.url || i + 1}」`}
                className="btn-mini edit-only"
                onClick={() => mutate((d) => { d.attachments.splice(i, 1); })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="add-btn edit-only"
            onClick={() => mutate((d) => { d.attachments.push({ label: '', url: '' }); })}
          >
            ＋ 添加附件
          </button>
        </div>
      ) : attachments.filter((a) => a.url.trim()).length === 0 ? (
        <div className="empty-state">暂无附件</div>
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.filter((a) => a.url.trim()).map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-surface border border-line rounded px-3.5 py-[11px] text-[14px] text-jade hover:border-line-strong hover:underline"
            >
              ↗ {a.label || a.url}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
