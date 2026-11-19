import React from 'react';
import { OFFERING_CATALOG } from '../game/data';
import type { OfferingId, TempleProgressState } from '../game/types';

interface ServiceCounterModalProps {
  progress: TempleProgressState;
  feedback: string | null;
  onBuyItem: (id: OfferingId) => void;
  onBuyBundle: () => void;
  onClaimFreeCoins: () => void;
  onClose: () => void;
}

export const ServiceCounterModal: React.FC<ServiceCounterModalProps> = ({
  progress,
  feedback,
  onBuyItem,
  onBuyBundle,
  onClaimFreeCoins,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="廟宇服務處"
    >
      <div className="temple-card w-full max-w-2xl max-h-[88vh] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8bd68]/30">
          <div>
            <h2 className="text-xl font-bold text-[#fbe09c] font-temple tracking-wider">
              廟宇服務處 · 請香與供品
            </h2>
            <p className="text-xs text-[#dfc39a] mt-0.5 tabular-nums">
              目前香油幣：{progress.coins} 幣 · 清香首次結緣免費，其餘供品隨喜請購
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉服務處"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#e8cda2] bg-[#36150f] hover:bg-[#522117] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto temple-scroll p-5 space-y-4">
          {feedback && (
            <div className="px-4 py-2.5 rounded-xl bg-[#542014] border border-[#f0c56b]/60 text-sm text-[#fff1cc]">
              {feedback}
            </div>
          )}

          {/* Starter Bundle Banner */}
          <div className="rounded-xl p-4 bg-[#38160f] border border-[#e8bd68]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-[#fde08d]">
                完整參拜大禮包（清香 ×3 + 鮮花 + 四果 + 壽桃糕餅 + 金紙 + 平安符）
              </div>
              <p className="text-xs text-[#dec094] mt-0.5">
                一次備齊 11 步參拜流程所需物品，立刻省下 65 香油幣！
              </p>
            </div>
            <button
              type="button"
              onClick={onBuyBundle}
              className="temple-action-btn px-4 py-2 rounded-lg text-xs font-bold text-[#fff5d4] cursor-pointer whitespace-nowrap shrink-0"
            >
              120 幣一次請齊
            </button>
          </div>

          {/* Individual Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OFFERING_CATALOG.map((item) => {
              const owned = progress.inventory[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-xl p-3.5 bg-[#250f0b] border border-[#e8bd68]/25 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg bg-[#7f1b15] border border-[#e8bd68]/60 flex items-center justify-center text-lg font-bold font-temple text-[#ffefc2] shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#fff2d6] truncate">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-[#e8bd68] tabular-nums shrink-0">
                          持有 {owned}
                        </span>
                      </div>
                      <p className="text-xs text-[#cfb088] leading-snug mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBuyItem(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#96221a] text-[#fff4d6] border border-[#e8bd68]/65 hover:bg-[#b52a20] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {item.price === 0 ? '免費請香' : `${item.price} 幣`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with playful "拜到沒錢了" free blessing top-up */}
        <div className="px-6 py-3.5 border-t border-[#e8bd68]/25 bg-[#210d09] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClaimFreeCoins}
            className="text-xs text-[#f5cd78] hover:text-[#fff0bf] underline underline-offset-4 cursor-pointer"
          >
            香油幣快見底了？點此領取「媽祖結緣添福 +100 幣」
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-sm font-medium text-[#fff2d2] bg-[#4a1c13] hover:bg-[#612519] cursor-pointer"
          >
            返回廟內
          </button>
        </div>
      </div>
    </div>
  );
};
