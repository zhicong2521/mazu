import React, { useState } from 'react';
import { drawFortuneSlip, resolveBweiThrow } from '../game/rules';
import type { BweiResult, FortuneSlip } from '../game/types';

interface FortuneModalProps {
  onFortuneRevealed: (slip: FortuneSlip) => void;
  onShakeSound: () => void;
  onBweiSound: (outcome: BweiResult['outcome']) => void;
  onClose: () => void;
}

export const FortuneModal: React.FC<FortuneModalProps> = ({
  onFortuneRevealed,
  onShakeSound,
  onBweiSound,
  onClose,
}) => {
  const [stage, setStage] = useState<'ready' | 'shaking' | 'confirm' | 'revealed'>('ready');
  const [drawnSlip, setDrawnSlip] = useState<FortuneSlip | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  const handleDraw = () => {
    setStage('shaking');
    setConfirmMsg(null);
    onShakeSound();
    window.setTimeout(() => {
      const slip = drawFortuneSlip(Math.random());
      setDrawnSlip(slip);
      setStage('confirm');
    }, 620);
  };

  const handleConfirmBwei = () => {
    if (!drawnSlip) return;
    // Traditional Taiwanese temple flow: confirm drawn stick via Moon Blocks
    const res = resolveBweiThrow(Math.random(), Math.random());
    onBweiSound(res.outcome);
    if (res.outcome === 'sheng') {
      setStage('revealed');
      onFortuneRevealed(drawnSlip);
    } else {
      setConfirmMsg(
        `擲得「${res.label}」（${res.summary}）— 媽祖示意可重新抽一支更有感應的籤，或直接解讀此籤。`,
      );
    }
  };

  const handleRevealDirect = () => {
    if (!drawnSlip) return;
    setStage('revealed');
    onFortuneRevealed(drawnSlip);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="媽祖靈籤求籤"
    >
      <div className="temple-card w-full max-w-xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8bd68]/30">
          <div>
            <h2 className="text-xl font-bold text-[#fbe09c] font-temple tracking-wider">
              天上聖母 · 六十甲子靈籤
            </h2>
            <p className="text-xs text-[#dfc39a] mt-0.5">
              默念所問之事，搖動籤筒抽取靈籤並擲筊確認
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉求籤視窗"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#e8cda2] bg-[#36150f] hover:bg-[#522117] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto temple-scroll p-6">
          {(stage === 'ready' || stage === 'shaking') && (
            <div className="flex flex-col items-center text-center py-4 gap-5">
              {/* Inline SVG Bamboo Fortune Tube */}
              <svg
                viewBox="0 0 180 200"
                className={`w-36 h-40 transition-transform duration-200 ${
                  stage === 'shaking' ? 'rotate-6 scale-105' : ''
                }`}
                role="img"
                aria-label="竹籤筒"
              >
                {/* Bamboo Sticks */}
                {[-26, -15, -4, 7, 18, 28].map((dx, i) => (
                  <rect
                    key={dx}
                    x={86 + dx}
                    y={24 + (i % 3) * 8}
                    width="8"
                    height="78"
                    rx="3"
                    fill="#f2cf88"
                    stroke="#8f5b24"
                    strokeWidth="1.5"
                    transform={`rotate(${dx * 0.32} ${90 + dx} 90)`}
                  />
                ))}
                {/* Crimson & Gold Tube */}
                <path
                  d="M 48 76 L 132 76 L 122 182 Q 90 192 58 182 Z"
                  fill="#8f1e18"
                  stroke="#f0c56b"
                  strokeWidth="3.5"
                />
                <ellipse cx="90" cy="76" rx="42" ry="10" fill="#52120e" stroke="#f0c56b" strokeWidth="2.5" />
                <text
                  x="90"
                  y="142"
                  textAnchor="middle"
                  fill="#fbe09c"
                  fontSize="30"
                  fontWeight="900"
                  style={{ fontFamily: '"Noto Serif TC", serif' }}
                >
                  靈籤
                </text>
              </svg>

              <p className="text-sm text-[#f2dfc0] max-w-sm leading-relaxed">
                {stage === 'shaking'
                  ? '虔誠搖動籤筒中，感應媽祖慈悲指引……'
                  : '請先靜心片刻，在心中向媽祖稟告您的姓名與想請示的問題。'}
              </p>

              <button
                type="button"
                onClick={handleDraw}
                disabled={stage === 'shaking'}
                className="temple-action-btn px-9 py-3 rounded-xl text-base font-bold font-temple tracking-widest text-[#fff4d4] cursor-pointer disabled:opacity-60"
              >
                {stage === 'shaking' ? '抽籤中...' : '誠心抽籤'}
              </button>
            </div>
          )}

          {stage === 'confirm' && drawnSlip && (
            <div className="flex flex-col items-center text-center py-3 gap-4">
              <div className="px-6 py-4 rounded-xl bg-[#260f0b] border-2 border-[#f0c56b]/75">
                <div className="text-xs text-[#e5be76] tracking-widest">抽得靈籤</div>
                <div className="text-3xl font-black font-temple text-[#fde08d] mt-1 tabular-nums">
                  第 {drawnSlip.number} 籤 · {drawnSlip.ganzhi}
                </div>
              </div>

              {confirmMsg ? (
                <p className="text-xs text-[#f6cc84] max-w-md leading-relaxed bg-[#3b170f] px-4 py-2.5 rounded-lg border border-[#e8bd68]/40">
                  {confirmMsg}
                </p>
              ) : (
                <p className="text-sm text-[#efd8b6] max-w-md">
                  依台灣傳統習俗，抽到籤支後需向媽祖「擲筊確認」是否為此籤。
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmBwei}
                  className="temple-action-btn px-6 py-2.5 rounded-xl text-sm font-bold text-[#fff4d4] cursor-pointer"
                >
                  擲筊確認此籤
                </button>
                <button
                  type="button"
                  onClick={handleRevealDirect}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#fbe09c] bg-[#3b1811] border border-[#d6a24b]/50 hover:bg-[#522117] cursor-pointer"
                >
                  直接查看籤詩
                </button>
                <button
                  type="button"
                  onClick={handleDraw}
                  className="px-4 py-2.5 rounded-xl text-sm text-[#d9ba8b] bg-[#240e0a] hover:bg-[#38160f] cursor-pointer"
                >
                  重新抽籤
                </button>
              </div>
            </div>
          )}

          {stage === 'revealed' && drawnSlip && (
            <div className="space-y-4">
              {/* Traditional Crimson & Gold Fortune Slip Card */}
              <div className="rounded-xl p-5 bg-[#7a1713] border-2 border-[#f4cb73] text-center shadow-inner">
                <div className="flex items-center justify-center gap-3 text-xs text-[#fbe09c] tracking-widest">
                  <span className="tabular-nums">第 {drawnSlip.number} 籤</span>
                  <span aria-hidden="true">·</span>
                  <span>{drawnSlip.ganzhi}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-[#fff5c4]">{drawnSlip.rank}</span>
                </div>
                <div className="mt-4 space-y-1.5 font-temple text-xl sm:text-2xl font-bold text-[#fff4d6] tracking-[0.18em]">
                  {drawnSlip.poem.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>

              {/* Plain-Language Interpretation */}
              <div className="rounded-xl p-4 bg-[#250f0b] border border-[#e8bd68]/35 space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-[#f4cb73] tracking-wider">聖意解籤</h3>
                  <p className="text-sm text-[#fff1d9] mt-1 leading-relaxed">{drawnSlip.meaning}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#e8bd68]/20 text-xs">
                  <div>
                    <span className="font-bold text-[#f4cb73]">事業：</span>
                    <span className="text-[#ead3b0]">{drawnSlip.career}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#f4cb73]">感情：</span>
                    <span className="text-[#ead3b0]">{drawnSlip.love}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#f4cb73]">財運：</span>
                    <span className="text-[#ead3b0]">{drawnSlip.wealth}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#f4cb73]">健康：</span>
                    <span className="text-[#ead3b0]">{drawnSlip.health}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDraw}
                  className="px-4 py-2 rounded-lg text-sm text-[#fbe09c] bg-[#36150f] border border-[#d6a24b]/45 hover:bg-[#4e1f16] cursor-pointer"
                >
                  再抽一籤
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="temple-action-btn px-6 py-2 rounded-lg text-sm font-bold text-[#fff4d4] cursor-pointer"
                >
                  感恩收下靈籤
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
