import Modal from '../Modal';
import type { TripState } from '../../types';

export const PRINT_SECTIONS = [
  ['overview', '📋 概览'], ['prepare', '✅ 准备清单'], ['itinerary', '🗓️ 行程'],
  ['stay', '🏨 住宿'], ['currency', '💱 汇率'], ['transport', '🚐 交通'],
  ['budget', '💰 预算'], ['notes', '💬 讨论'], ['attachments', '📎 附件'],
] as const;

export type PrintSectionId = (typeof PRINT_SECTIONS)[number][0];
export type PrintSections = Record<PrintSectionId, boolean>;

export function defaultPrintSections(): PrintSections {
  return Object.fromEntries(PRINT_SECTIONS.map(([id]) => [id, id !== 'notes'])) as PrintSections;
}

export default function PrintModal({
  state, sections, onSectionsChange, hotelFilter, onHotelFilterChange, transportFilter, onTransportFilterChange, onClose, onPrint,
}: {
  state: TripState;
  sections: PrintSections; onSectionsChange: (next: PrintSections) => void;
  hotelFilter: number | 'all'; onHotelFilterChange: (v: number | 'all') => void;
  transportFilter: number | 'all'; onTransportFilterChange: (v: number | 'all') => void;
  onClose: () => void; onPrint: () => void;
}) {
  const toggleSection = (id: PrintSectionId) => onSectionsChange({ ...sections, [id]: !sections[id] });

  return (
    <Modal onClose={onClose}>
      <h2 className="font-serif text-[22px] text-jade-dark mb-1">🖨 打印 / 导出为 PDF</h2>
      <p className="text-muted text-[13px] mt-1">选择要包含的内容，然后在浏览器的打印对话框中选择「另存为 PDF」。</p>

      <div className="mt-5">
        <p className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.07em] mb-2">包含哪些板块</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {PRINT_SECTIONS.map(([id, label]) => (
            <label
              key={id}
              className={`flex items-center gap-2 border-[1.5px] rounded px-3 py-2 text-[13px] cursor-pointer transition-all duration-150 ${
                sections[id] ? 'bg-jade-light border-jade-tint' : 'bg-surface border-line hover:border-line-strong'
              }`}
            >
              <input type="checkbox" className="custom-check" checked={sections[id]} onChange={() => toggleSection(id)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {sections.stay && state.hotels.length > 0 && (
        <div className="mt-4">
          <p className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.07em] mb-2">住宿要打印哪些候选</p>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="radio" name="print-hotel" checked={hotelFilter === 'all'} onChange={() => onHotelFilterChange('all')} />
              打印全部候选酒店（{state.hotels.length} 个）
            </label>
            {state.hotels.map((h, i) => (
              <label key={i} className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="radio" name="print-hotel" checked={hotelFilter === i} onChange={() => onHotelFilterChange(i)} />
                只打印：{h.name || `候选 ${i + 1}`}{h.chosen ? '（✓ 最终选择）' : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      {sections.transport && state.transport.length > 0 && (
        <div className="mt-4">
          <p className="text-[11.5px] font-semibold text-muted uppercase tracking-[0.07em] mb-2">交通要打印哪些参考</p>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="radio" name="print-transport" checked={transportFilter === 'all'} onChange={() => onTransportFilterChange('all')} />
              打印全部交通参考（{state.transport.length} 个）
            </label>
            {state.transport.map((x, i) => (
              <label key={i} className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="radio" name="print-transport" checked={transportFilter === i} onChange={() => onTransportFilterChange(i)} />
                只打印：{x.type || `参考 ${i + 1}`}{x.chosen ? '（✓ 最终决定）' : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-5 pt-3 border-t border-line">
        <button className="btn text-[13px] px-3.5 py-2" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={onPrint}>🖨 打印</button>
      </div>
    </Modal>
  );
}
