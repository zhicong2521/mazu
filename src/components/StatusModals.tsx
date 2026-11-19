import React from 'react';
import { WORSHIP_STEPS } from '../game/data';
import type { TempleProgressState, ZoneId } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestartGuide: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestartGuide,
  onReturnTitle,
}) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/72 pointer-events-auto"
    role="dialog"
    aria-modal="true"
    aria-label="遊戲暫停"
  >
    <div className="temple-card w-full max-w-sm rounded-2xl p-6 text-center space-y-5">
      <div>
        <h2 className="text-2xl font-bold font-temple text-[#fde08d] tracking-widest">
          靜心歇息
        </h2>
        <p className="text-xs text-[#dfc39a] mt-1">雲端天后宮隨時敞開山門迎候</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="temple-action-btn w-full py-2.5 rounded-xl text-base font-bold text-[#fff4d4] cursor-pointer"
        >
          繼續參拜
        </button>
        <button
          type="button"
          onClick={onRestartGuide}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-[#f6dba2] bg-[#36150f] border border-[#d6a24b]/45 hover:bg-[#4f1f16] cursor-pointer"
        >
          重新開始 11 步參拜流程
        </button>
        <button
          type="button"
          onClick={onReturnTitle}
          className="w-full py-2.5 rounded-xl text-sm text-[#d9ba8b] bg-[#240e0a] hover:bg-[#38160f] cursor-pointer"
        >
          返回山門標題
        </button>
      </div>
    </div>
  </div>
);

interface NoticeModalProps {
  progress: TempleProgressState;
  onNavigateZone: (zoneId: ZoneId) => void;
  onClose: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  progress,
  onNavigateZone,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-35 flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
    role="dialog"
    aria-modal="true"
    aria-label="雲端天后宮參拜公告"
  >
    <div className="temple-card w-full max-w-xl max-h-[86vh] rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8bd68]/30">
        <div>
          <h2 className="text-xl font-bold font-temple text-[#fbe09c] tracking-wider">
            雲端天后宮 · 11 步傳統參拜流程
          </h2>
          <p className="text-xs text-[#dfc39a] mt-0.5">
            本遊戲為線上療癒體驗，供奉天上聖母、關聖帝君、玄天上帝、月老、武財神與虎爺
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉公告"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#e8cda2] bg-[#36150f] hover:bg-[#522117] cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto temple-scroll p-5 space-y-2">
        {WORSHIP_STEPS.map((step) => {
          const done = progress.completedSteps.includes(step.stepNumber);
          const isCurrent = progress.currentStepIndex === step.stepNumber - 1;
          return (
            <div
              key={step.stepNumber}
              className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 border ${
                done
                  ? 'bg-[#212b1b]/85 border-[#6cb87a]/45'
                  : isCurrent
                    ? 'bg-[#4f1d14] border-[#f4cb73]/75'
                    : 'bg-[#250f0b] border-[#e8bd68]/20'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#fbe09c] tabular-nums">
                  {done ? '✓ ' : `${step.stepNumber}. `}
                  {step.title}
                </div>
                <div className="text-xs text-[#e2c79d] mt-0.5">{step.instruction}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onNavigateZone(step.targetZone);
                  onClose();
                }}
                className="px-3 py-1 rounded-lg text-xs text-[#fff2d2] bg-[#8f2119] hover:bg-[#ab281f] cursor-pointer whitespace-nowrap shrink-0"
              >
                前往
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-3.5 border-t border-[#e8bd68]/25 bg-[#210d09] flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="temple-action-btn px-6 py-1.5 rounded-lg text-sm font-bold text-[#fff4d4] cursor-pointer"
        >
          知道了
        </button>
      </div>
    </div>
  </div>
);

interface RitualCompleteModalProps {
  progress: TempleProgressState;
  playerName: string;
  onContinueFree: () => void;
  onRestartRitual: () => void;
}

export const RitualCompleteModal: React.FC<RitualCompleteModalProps> = ({
  progress,
  playerName,
  onContinueFree,
  onRestartRitual,
}) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 pointer-events-auto"
    role="dialog"
    aria-modal="true"
    aria-label="參拜功德圓滿"
  >
    <div className="temple-card w-full max-w-md rounded-2xl p-6 text-center space-y-5">
      <div>
        <div className="text-xs tracking-[0.3em] text-[#f0c56b] mb-1">雲端天后宮 · 祈福圓滿</div>
        <h2 className="text-3xl font-black font-temple text-[#fde08d] tracking-widest">
          功德圓滿
        </h2>
        <p className="text-sm text-[#f4dfbd] mt-2 leading-relaxed">
          信眾「{playerName}」已完成全部 11 步傳統參拜科儀！願天上聖母與眾神護佑您萬事順遂、平安喜樂。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl p-3 bg-[#240e0a] border border-[#e8bd68]/35">
          <div className="text-[11px] text-[#d9ba8b]">完成步驟</div>
          <div className="text-xl font-bold text-[#fde08d] tabular-nums mt-0.5">11/11</div>
        </div>
        <div className="rounded-xl p-3 bg-[#240e0a] border border-[#e8bd68]/35">
          <div className="text-[11px] text-[#d9ba8b]">累積功德</div>
          <div className="text-xl font-bold text-[#fde08d] tabular-nums mt-0.5">{progress.merit}</div>
        </div>
        <div className="rounded-xl p-3 bg-[#240e0a] border border-[#e8bd68]/35">
          <div className="text-[11px] text-[#d9ba8b]">結緣香油幣</div>
          <div className="text-xl font-bold text-[#fde08d] tabular-nums mt-0.5">{progress.coins}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={onContinueFree}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#fbe09c] bg-[#3d1811] border border-[#e8bd68]/55 hover:bg-[#542117] cursor-pointer"
        >
          留在廟內自由參拜
        </button>
        <button
          type="button"
          data-start="true"
          onClick={onRestartRitual}
          className="flex-1 temple-action-btn py-2.5 rounded-xl text-sm font-bold text-[#fff4d4] cursor-pointer"
        >
          再次圓滿進香
        </button>
      </div>
    </div>
  </div>
);
