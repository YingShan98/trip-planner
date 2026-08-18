import { useState } from 'react';
import Modal from '../Modal';
import { uid } from '../../state';
import type { Mutate, PackingItem, TripState } from '../../types';

const CATEGORIES = ['衣物', '洗漱用品', '证件', '电子产品', '药品', '其他'] as const;
type Category = (typeof CATEGORIES)[number];

type TemplateItem = Omit<PackingItem, 'id'>;

const TEMPLATES: Record<string, TemplateItem[]> = {
  '🏖 海滩': [
    { text: '泳衣', done: false, category: '衣物' },
    { text: '短裤', done: false, category: '衣物' },
    { text: '防晒外套', done: false, category: '衣物' },
    { text: '凉鞋', done: false, category: '衣物' },
    { text: '帽子', done: false, category: '衣物' },
    { text: '防晒霜 SPF50+', done: false, category: '洗漱用品' },
    { text: '晒后修复乳', done: false, category: '洗漱用品' },
    { text: '洗发水 / 沐浴露', done: false, category: '洗漱用品' },
    { text: '护照', done: false, category: '证件' },
    { text: '机票 / 行程单', done: false, category: '证件' },
    { text: '旅行保险', done: false, category: '证件' },
    { text: '手机充电器', done: false, category: '电子产品' },
    { text: '防水相机', done: false, category: '电子产品' },
    { text: '充电宝', done: false, category: '电子产品' },
    { text: '沙滩巾', done: false, category: '其他' },
    { text: '太阳镜', done: false, category: '其他' },
  ],
  '💼 商务': [
    { text: '正装 / 西装', done: false, category: '衣物' },
    { text: '领带 / 丝巾', done: false, category: '衣物' },
    { text: '皮鞋', done: false, category: '衣物' },
    { text: '休闲备用装', done: false, category: '衣物' },
    { text: '剃须刀 / 修眉工具', done: false, category: '洗漱用品' },
    { text: '牙刷 / 牙膏', done: false, category: '洗漱用品' },
    { text: '护照 / 身份证', done: false, category: '证件' },
    { text: '名片', done: false, category: '证件' },
    { text: '公司介绍材料', done: false, category: '证件' },
    { text: '笔记本电脑', done: false, category: '电子产品' },
    { text: '电源适配器', done: false, category: '电子产品' },
    { text: '充电宝', done: false, category: '电子产品' },
    { text: '耳机', done: false, category: '电子产品' },
    { text: '雨伞', done: false, category: '其他' },
    { text: '便携熨斗', done: false, category: '其他' },
  ],
  '❄️ 冬季': [
    { text: '厚羽绒服', done: false, category: '衣物' },
    { text: '保暖内衣', done: false, category: '衣物' },
    { text: '围巾', done: false, category: '衣物' },
    { text: '手套', done: false, category: '衣物' },
    { text: '毛帽', done: false, category: '衣物' },
    { text: '雪地靴 / 防滑鞋', done: false, category: '衣物' },
    { text: '润唇膏', done: false, category: '洗漱用品' },
    { text: '护手霜', done: false, category: '洗漱用品' },
    { text: '保湿面霜', done: false, category: '洗漱用品' },
    { text: '护照', done: false, category: '证件' },
    { text: '机票 / 行程单', done: false, category: '证件' },
    { text: '签证', done: false, category: '证件' },
    { text: '手机充电器', done: false, category: '电子产品' },
    { text: '充电宝', done: false, category: '电子产品' },
    { text: '感冒药', done: false, category: '药品' },
    { text: '暖贴', done: false, category: '药品' },
  ],
  '👨‍👩‍👧 家庭': [
    { text: '儿童换洗衣物 ×3套', done: false, category: '衣物' },
    { text: '大人换洗衣物', done: false, category: '衣物' },
    { text: '儿童洗发水', done: false, category: '洗漱用品' },
    { text: '婴儿湿巾', done: false, category: '洗漱用品' },
    { text: '防晒霜', done: false, category: '洗漱用品' },
    { text: '全家护照', done: false, category: '证件' },
    { text: '儿童出生证明', done: false, category: '证件' },
    { text: '旅行保险卡', done: false, category: '证件' },
    { text: '平板电脑', done: false, category: '电子产品' },
    { text: '耳机', done: false, category: '电子产品' },
    { text: '充电器', done: false, category: '电子产品' },
    { text: '退烧药', done: false, category: '药品' },
    { text: '止泻药', done: false, category: '药品' },
    { text: '创可贴', done: false, category: '药品' },
    { text: '驱蚊液', done: false, category: '药品' },
    { text: '儿童零食', done: false, category: '其他' },
    { text: '玩具 / 绘本', done: false, category: '其他' },
  ],
};

const CATEGORY_ICONS: Record<string, string> = {
  '衣物': '👕',
  '洗漱用品': '🧴',
  '证件': '📄',
  '电子产品': '🔌',
  '药品': '💊',
  '其他': '📦',
};

export default function PackingModal({
  state, editUnlocked, mutate, onClose,
}: {
  state: TripState; editUnlocked: boolean; mutate: Mutate; onClose: () => void;
}) {
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<Category>('衣物');

  const packing = state.packing;
  const packed = packing.filter((x) => x.done).length;
  const total = packing.length;
  const pct = total === 0 ? 0 : Math.round((packed / total) * 100);

  const toggle = (i: number, done: boolean) => mutate((d) => { d.packing[i].done = done; });
  const remove = (i: number) => mutate((d) => { d.packing.splice(i, 1); });
  const add = () => {
    const v = newText.trim();
    if (!v) return;
    mutate((d) => { d.packing.push({ id: uid('p'), text: v, done: false, category: newCat }); });
    setNewText('');
  };

  const applyTemplate = (items: TemplateItem[]) => {
    if (packing.length > 0 && !confirm('应用模板将替换现有的打包清单，确认继续？')) return;
    mutate((d) => { d.packing = items.map((x) => ({ ...x, id: uid('p') })); });
  };

  const clearDone = () => mutate((d) => { d.packing = d.packing.filter((x) => !x.done); });

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: packing.map((x, i) => ({ ...x, idx: i })).filter((x) => x.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">🧳 打包清单</h2>

      {/* Progress */}
      {total > 0 && (
        <div className="mt-3 mb-4">
          <div className="flex justify-between text-[12.5px] text-muted mb-1.5">
            <span>已备好 <strong className="text-jade-dark">{packed}</strong> / {total} 件</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-jade rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="mb-4">
        <p className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.07em] mb-2">快速模板</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TEMPLATES).map(([label, items]) => (
            <button
              key={label}
              className="btn text-[12.5px] px-3 py-1.5 bg-surface-3 border-line hover:bg-surface hover:border-line-strong"
              onClick={() => applyTemplate(items)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Items by category */}
      {total === 0 ? (
        <div className="empty-state my-6">暂无物品，从模板开始或手动添加</div>
      ) : (
        <div className="flex flex-col gap-4 mb-2">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <p className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.06em] mb-1.5">
                {CATEGORY_ICONS[cat]} {cat}
                <span className="ml-1.5 normal-case font-normal">
                  ({items.filter((x) => x.done).length}/{items.length})
                </span>
              </p>
              <div className="flex flex-col gap-1.5">
                {items.map((x) => (
                  <div
                    key={x.id}
                    className={`flex items-center gap-3 border-[1.5px] rounded px-3 py-2.5 transition-all duration-150 ${
                      x.done
                        ? 'bg-surface-3 border-transparent'
                        : 'bg-surface border-line hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="custom-check editable"
                      checked={x.done}
                      onChange={(e) => toggle(x.idx, e.target.checked)}
                    />
                    <span className={`flex-1 text-[13.5px] ${x.done ? 'line-through text-muted' : ''}`}>
                      {x.text}
                    </span>
                    {editUnlocked && (
                      <button className="btn-mini edit-only" onClick={() => remove(x.idx)}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      {editUnlocked && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-line edit-only">
          <select
            className="inp w-[110px] shrink-0 text-[13px]"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            className="inp flex-1"
            placeholder="添加物品…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn-primary" onClick={add}>添加</button>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-line">
        {editUnlocked && packed > 0 ? (
          <button className="btn text-[12px] text-muted px-3 py-1.5" onClick={clearDone}>
            清除已勾选
          </button>
        ) : (
          <span />
        )}
        <button className="btn-primary" onClick={onClose}>完成</button>
      </div>
    </Modal>
  );
}
