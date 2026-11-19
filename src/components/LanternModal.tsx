import React, { useState } from 'react';
import type { LitLantern } from '../game/types';

interface LanternModalProps {
  playerName: string;
  coins: number;
  litLanterns: LitLantern[];
  onLightLantern: (type: LitLantern['type'], wish: string) => void;
  onClose: () => void;
}

const LAMP_TYPES: Array<{ type: LitLantern['type']; desc: string }> = [
  { type: '平安燈', desc: '保佑元辰光彩、出入平安健康' },
  { type: '姻緣燈', desc: '照亮紅線桃花、人緣和合美滿' },
  { type: '財神燈', desc: '招財納福、事業興旺正財廣進' },
  { type: '文昌燈', desc: '開智慧增考運、職場思緒清明' },
];

export const LanternModal: React.FC<LanternModalProps> = ({
  playerName,
  coins,
  litLanterns,
  onLightLantern,
  onClose,
}) => {
  const [lampType, setLampType] = useState<LitLantern['type']>('平安燈');
  const [wish, setWish] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const lampCost = 30;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (coins < lampCost) {
      setNotice('香油幣不足 30 幣！可先至服務處領取免費結緣添福幣。');
      return;
    }
    onLightLantern(lampType, wish.trim() || '平安順遂、心想事成');
    setWish('');
    setNotice(`已於光明燈牆點亮專屬「${lampType}」！願您前程光明。`);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/68 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="點光明燈祈福"
    >
      <div className="temple-card w-full max-w-lg rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8bd68]/30">
          <div>
            <h2 className="text-xl font-bold text-[#fbe09c] font-temple tracking-wider">
              光明燈牆 · 點燈祈福
            </h2>
            <p className="text-xs text-[#dfc39a] mt-0.5 tabular-nums">
              每盞燈 30 幣（目前持有 {coins} 幣）· 燈位將於 3D 廟內即時點亮
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉點燈視窗"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#e8cda2] bg-[#36150f] hover:bg-[#522117] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {notice && (
            <div className="px-4 py-2.5 rounded-xl bg-[#542014] border border-[#f0c56b]/60 text-xs text-[#fff1cc]">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {LAMP_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setLampType(item.type)}
                className={`p-3 rounded-xl text-left border cursor-pointer ${
                  lampType === item.type
                    ? 'bg-[#8f1f18] border-[#fde08d] text-[#fff4d6]'
                    : 'bg-[#250f0b] border-[#e8bd68]/25 text-[#d8bc93] hover:bg-[#38160f]'
                }`}
              >
                <div className="text-sm font-bold font-temple">{item.type}</div>
                <div className="text-[11px] opacity-85 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="lantern-wish-input" className="block text-xs text-[#e3c28d] mb-1.5">
              祈福心願（燈主：{playerName}）
            </label>
            <input
              id="lantern-wish-input"
              type="text"
              maxLength={32}
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="寫下想照亮的心願，例如：闔家平安、考試順利..."
              className="w-full px-3.5 py-2 rounded-lg bg-[#180906] border border-[#d4a34d]/45 text-[#fff4de] text-sm focus:outline-none focus:border-[#f5cd75]"
            />
          </div>

          {/* Recent Lit Lanterns Wall List */}
          <div className="rounded-xl p-3 bg-[#210d09] border border-[#e8bd68]/25 max-h-36 overflow-y-auto temple-scroll space-y-1.5">
            <div className="text-[11px] font-bold text-[#e6bd6b]">
              近期點亮祈福名錄（共 {litLanterns.length} 盞）
            </div>
            {litLanterns.map((l) => (
              <div key={l.id} className="text-xs text-[#ebd5b2] flex items-center justify-between gap-2">
                <span className="truncate">
                  <strong className="text-[#fde08d]">{l.ownerName}</strong> · {l.type} — {l.wish}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[#dec094] bg-[#33140e] hover:bg-[#491e16] cursor-pointer"
            >
              返回
            </button>
            <button
              type="submit"
              className="temple-action-btn px-7 py-2 rounded-xl text-sm font-bold text-[#fff4d4] cursor-pointer"
            >
              點亮 {lampType}（30 幣）
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
