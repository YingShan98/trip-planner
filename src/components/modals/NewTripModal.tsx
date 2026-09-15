import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from '../../lib/toast';
import { downloadJSON } from '../../lib/download';
import { blankState, normalize, templateState } from '../../state';
import { createTrip } from '../../lib/tripApi';
import { suggestDestinationImage } from '../../lib/destinationImage';
import type { ImportedTripMeta, TripState } from '../../types';
import Modal from '../Modal';

export default function NewTripModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [pasteText, setPasteText] = useState('');
  const [importedData, setImportedData] = useState<TripState | null>(null);
  const [importedFrom, setImportedFrom] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [variantLabel, setVariantLabel] = useState('');
  const [audienceLabel, setAudienceLabel] = useState('');
  const [fetchingImage, setFetchingImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const downloadTemplate = () => {
    downloadJSON('trip-template.json', {
      meta: { title: '旅行名称', destination: '目的地', start_date: '2027-01-01', end_date: '2027-01-07', currency: 'MYR', description: '旅行简介', variant: '示例：relaxed', audience: '示例：年长人士／行动不便人士' },
      data: templateState(),
    });
  };

  const applyImportedJson = (raw: string, source: string) => {
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch (err) {
      toast('JSON 格式无效：' + (err as Error).message);
      return;
    }
    const parsed = (obj && typeof obj === 'object' ? obj : {}) as { meta?: ImportedTripMeta; data?: unknown };
    const meta = parsed.meta || {};
    setImportedData(normalize(parsed.data ?? obj));
    setImportedFrom(source);
    if (meta.title) setTitle(meta.title);
    if (meta.destination) setDestination(meta.destination);
    if (meta.currency) setCurrency(meta.currency);
    if (meta.start_date) setStart(meta.start_date);
    if (meta.end_date) setEnd(meta.end_date);
    if (meta.description) setDescription(meta.description);
    if (meta.cover_image_url) setCoverImageUrl(meta.cover_image_url);
    if (meta.variant) setVariantLabel(meta.variant);
    if (meta.audience) setAudienceLabel(meta.audience);
    toast('已从 JSON 载入行程内容，请检查下方信息并填写 Slug');
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    applyImportedJson(await file.text(), `文件「${file.name}」`);
  };

  const parsePastedJson = () => {
    if (!pasteText.trim()) { toast('请先粘贴 JSON 内容'); return; }
    applyImportedJson(pasteText, '粘贴的内容');
  };

  const clearImport = () => {
    setImportedData(null);
    setImportedFrom('');
    setPasteText('');
  };

  const fetchImage = async () => {
    if (!destination.trim()) { toast('请先填写目的地'); return; }
    setFetchingImage(true);
    try {
      const url = await suggestDestinationImage(destination.trim());
      if (url) setCoverImageUrl(url);
      else toast('没有找到合适的图片，可手动粘贴图片链接');
    } finally { setFetchingImage(false); }
  };

  const create = async () => {
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !title.trim()) { setShowValidation(true); toast('请填写旅行名称和 Slug'); return; }
    setBusy(true);
    try {
      const createdSlug = await createTrip({
        slug: cleanSlug, title: title.trim(), destination: destination.trim(), start_date: start || null,
        end_date: end || null, home_currency: currency.trim() || 'MYR', description, cover_image_url: coverImageUrl.trim(),
        variant_label: variantLabel.trim(), audience_label: audienceLabel.trim(), state: importedData || blankState(),
      });
      toast('旅行已创建');
      onClose();
      onCreated(createdSlug);
    } catch (error) { toast('创建失败：' + (error as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">创建新旅行</h2>
      <p className="text-muted text-[13px] mt-1">创建旅行需要登录账户；你将成为这趟旅行的拥有者。<span className="text-danger">*</span> 为必填项。</p>

      {/* Mode switch */}
      <div className="flex gap-1.5 mt-4 p-1 bg-surface-2 rounded-lg w-fit">
        <button
          type="button"
          className={`btn-mini !border-transparent ${mode === 'manual' ? 'bg-surface shadow-xs !text-jade-dark font-bold' : ''}`}
          onClick={() => setMode('manual')}
        >
          ✏️ 手动创建
        </button>
        <button
          type="button"
          className={`btn-mini !border-transparent ${mode === 'import' ? 'bg-surface shadow-xs !text-jade-dark font-bold' : ''}`}
          onClick={() => setMode('import')}
        >
          📥 从 JSON 导入
        </button>
      </div>

      {mode === 'import' && (
        <div className="mt-3.5 p-3.5 bg-surface-2 rounded-lg flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[12.5px] text-muted m-0">没有 JSON？先下载模板，按格式填好后再导入。</p>
            <button type="button" className="btn-ghost text-[12.5px] shrink-0" onClick={downloadTemplate}>⬇️ 下载模板</button>
          </div>

          {importedData ? (
            <div className="flex items-center justify-between gap-2 bg-jade-light border border-jade-tint rounded px-3 py-2.5">
              <span className="text-[13px] text-jade-dark font-semibold">✓ 已从{importedFrom}载入行程内容</span>
              <button type="button" className="btn-mini" onClick={clearImport}>清除</button>
            </div>
          ) : (
            <>
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
              <button type="button" className="btn-primary self-start" onClick={parsePastedJson}>解析并载入</button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
        <div className="field sm:col-span-2">
          <label>旅行名称 <span className="text-danger">*</span></label>
          <input
            className={`inp ${showValidation && !title.trim() ? 'border-danger' : ''}`}
            placeholder="例如：2027 广州亲友团"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {showValidation && !title.trim() && <span className="text-danger text-[11.5px]">请填写旅行名称</span>}
        </div>
        <div className="field"><label>目的地</label><input className="inp" placeholder="广州 / Seoul / Tokyo" value={destination} onChange={(e) => setDestination(e.target.value)} /></div>
        <div className="field"><label>本地货币</label><input className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
        <div className="field"><label>开始日期</label><input className="inp" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label>结束日期</label><input className="inp" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="field sm:col-span-2">
          <label>Slug（网址标识，只能英文/数字/短横线） <span className="text-danger">*</span></label>
          <input
            className={`inp ${showValidation && !slug.trim() ? 'border-danger' : ''}`}
            placeholder="guangzhou-family-trip-2027"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          {showValidation && !slug.trim() && <span className="text-danger text-[11.5px]">请填写 Slug</span>}
        </div>
        <div className="field sm:col-span-2">
          <label>封面图片链接</label>
          <div className="flex gap-2">
            <input className="inp flex-1" placeholder="https://…" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} />
            <button type="button" className="btn-ghost shrink-0" disabled={fetchingImage} onClick={fetchImage}>{fetchingImage ? '获取中…' : '自动获取'}</button>
          </div>
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt=""
              className="mt-2 h-24 w-full object-cover rounded border border-line bg-surface-2"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
        <div className="field"><label>版本（多个版本供不同团员选择时填写，如「轻松版」）</label><input className="inp" placeholder="例如：young / relaxed" value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} /></div>
        <div className="field"><label>适合人群</label><input className="inp" placeholder="例如：年长人士／行动不便人士" value={audienceLabel} onChange={(e) => setAudienceLabel(e.target.value)} /></div>
        <div className="field sm:col-span-2"><label>简介</label><textarea className="inp min-h-[100px] resize-y" placeholder="旅行目标、人数、注意事项……" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-line"><button className="btn-primary" disabled={busy} onClick={create}>{busy ? '创建中…' : '创建旅行'}</button></div>
    </Modal>
  );
}
