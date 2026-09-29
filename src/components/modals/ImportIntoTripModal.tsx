import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from '../../lib/toast';
import { parseTripJson } from '../../lib/tripJson';
import type { TripMeta } from '../../lib/tripApi';
import type { ImportedTripMeta, TripState } from '../../types';
import Modal from '../Modal';

/** Trip-info fields an import may overwrite: [meta key in the JSON, TripMeta column, label]. */
const META_FIELDS = [
  ['title', 'title', '旅行名称'],
  ['destination', 'destination', '目的地'],
  ['start_date', 'start_date', '开始日期'],
  ['end_date', 'end_date', '结束日期'],
  ['currency', 'home_currency', '本地货币'],
  ['description', 'description', '简介'],
  ['cover_image_url', 'cover_image_url', '封面图片'],
  ['variant', 'variant_label', '版本'],
  ['audience', 'audience_label', '适合人群'],
] as const satisfies ReadonlyArray<readonly [keyof ImportedTripMeta, keyof TripMeta, string]>;

export type TripMetaChanges = Partial<Pick<TripMeta, (typeof META_FIELDS)[number][1]>>;

/** The trip-info columns the JSON would change, skipping fields it leaves out. */
function metaChanges(meta: ImportedTripMeta, trip: TripMeta): { changes: TripMetaChanges; labels: string[] } {
  const changes: Record<string, string | null> = {};
  const labels: string[] = [];
  for (const [key, column, label] of META_FIELDS) {
    const value = meta[key];
    if (value === undefined) continue;
    const next = typeof value === 'string' ? value.trim() : value;
    if ((next || null) === (trip[column] || null)) continue;
    if (column === 'title' && !next) continue;
    changes[column] = column === 'home_currency' ? (next || 'MYR') : next;
    labels.push(label);
  }
  return { changes: changes as TripMetaChanges, labels };
}

export default function ImportIntoTripModal({ trip, current, onClose, onImport }: {
  trip: TripMeta;
  current: TripState;
  onClose: () => void;
  onImport: (data: TripState, metaChanges: TripMetaChanges) => Promise<boolean>;
}) {
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<{ meta: ImportedTripMeta; data: TripState; source: string } | null>(null);
  const [updateMeta, setUpdateMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = (raw: string, source: string) => {
    try {
      setParsed({ ...parseTripJson(raw), source });
    } catch (err) {
      toast('JSON 格式无效：' + (err as Error).message);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) load(await file.text(), `文件「${file.name}」`);
  };

  const meta = parsed ? metaChanges(parsed.meta, trip) : null;
  const otherSlug = parsed?.meta.slug && parsed.meta.slug !== trip.slug ? parsed.meta.slug : null;
  const count = (s: TripState) => ({
    天数: s.days.length,
    行程项目: s.days.reduce((a, d) => a + d.items.length, 0),
    准备事项: s.checklist.length,
    打包物品: s.packing.length,
    住宿: s.hotels.length,
    交通: s.transport.length,
    预算: s.budget.length,
    讨论: s.notes.length,
    附件: s.attachments.length,
  });

  const confirm = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      if (await onImport(parsed.data, updateMeta && meta ? meta.changes : {})) onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">📥 用 JSON 更新这趟旅行</h2>
      <p className="text-muted text-[13px] mt-1">
        用导出的 JSON 覆盖「{trip.title}」的全部行程内容。旅行网址和分享链接保持不变，不需要先删除再重新创建。
      </p>

      {!parsed ? (
        <div className="mt-4 p-3.5 bg-surface-2 rounded-lg flex flex-col gap-3">
          <div>
            <button type="button" className="btn text-[13px] px-3.5 py-2" onClick={() => fileInputRef.current?.click()}>📄 选择 JSON 文件</button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-muted uppercase tracking-[0.06em]">
            <span className="flex-1 h-px bg-line" /> 或 <span className="flex-1 h-px bg-line" />
          </div>
          <div className="field">
            <label>粘贴 JSON 内容</label>
            <textarea
              className="inp min-h-[120px] resize-y font-mono text-[12px]"
              placeholder='{"meta": {...}, "data": {...}}'
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary self-start"
            onClick={() => (pasteText.trim() ? load(pasteText, '粘贴的内容') : toast('请先粘贴 JSON 内容'))}
          >
            解析
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 bg-jade-light border border-jade-tint rounded px-3 py-2.5">
            <span className="text-[13px] text-jade-dark font-semibold">✓ 已读取{parsed.source}</span>
            <button type="button" className="btn-mini" onClick={() => setParsed(null)}>换一个</button>
          </div>

          {otherSlug && (
            <p className="text-[12.5px] bg-gold-tint border border-gold-line text-gold rounded px-3 py-2.5 m-0">
              ⚠️ 这个 JSON 是从另一趟旅行（<code>{otherSlug}</code>）导出的，而当前旅行是 <code>{trip.slug}</code>。确认要用它覆盖吗？
            </p>
          )}

          <div className="overflow-auto">
            <table className="w-full text-[12.5px] border border-line rounded">
              <thead>
                <tr className="bg-surface-3 text-muted">
                  <th className="text-left px-3 py-1.5 font-semibold">内容</th>
                  <th className="text-right px-3 py-1.5 font-semibold">现在</th>
                  <th className="text-right px-3 py-1.5 font-semibold">导入后</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const before = count(current), after = count(parsed.data);
                  return (Object.keys(before) as (keyof typeof before)[]).map((k) => (
                    <tr key={k} className="border-t border-line">
                      <td className="px-3 py-1.5">{k}</td>
                      <td className="px-3 py-1.5 text-right text-muted">{before[k]}</td>
                      <td className={`px-3 py-1.5 text-right ${before[k] !== after[k] ? 'font-bold text-jade-dark' : ''}`}>{after[k]}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {meta && meta.labels.length > 0 && (
            <label className="flex items-start gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" className="custom-check mt-0.5" checked={updateMeta} onChange={(e) => setUpdateMeta(e.target.checked)} />
              <span>同时更新旅行信息：{meta.labels.join('、')}</span>
            </label>
          )}

          <p className="text-[12.5px] text-danger m-0">覆盖后，当前的行程、清单、讨论等内容都会被 JSON 里的内容替换。建议先点「⬇️ 导出 JSON」备份一份。</p>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-line">
        <button className="btn-ghost" onClick={onClose}>取消</button>
        <button className="btn-danger" disabled={!parsed || busy} onClick={confirm}>{busy ? '更新中…' : '覆盖并保存'}</button>
      </div>
    </Modal>
  );
}
