import React, { useState } from 'react';
import { TEMPLE_ZONES } from '../game/data';
import { resolveBweiThrow } from '../game/rules';
import type { BweiResult, DeityId } from '../game/types';

interface BweiModalProps {
  defaultDeity: DeityId;
  hasRedThread: boolean;
  hasFortuneMoney: boolean;
  onResult: (deity: DeityId, result: BweiResult, wish: string) => void;
  onClose: () => void;
}

const DEITY_CHOICES: DeityId[] = ['mazu', 'yuelao', 'caishen', 'guanyu', 'xuantian', 'tiangong'];

export const BweiModal: React.FC<BweiModalProps> = ({
  defaultDeity,
  hasRedThread,
  hasFortuneMoney,
  onResult,
  onClose,
}) => {
  const [deity, setDeity] = useState<DeityId>(defaultDeity);
  const [wish, setWish] = useState('');
  const [throwing, setThrowing] = useState(false);
  const [result, setResult] = useState<BweiResult | null>(null);

  const handleToss = () => {
    if (throwing) return;
    setThrowing(true);
    setResult(null);

    window.setTimeout(() => {
      const res = resolveBweiThrow(Math.random(), Math.random());
      setThrowing(false);
      setResult(res);
      onResult(deity, res, wish.trim());
    }, 520);
  };

  const selectedZone = TEMPLE_ZONES[deity];

  const specialHint =
    deity === 'yuelao'
      ? hasRedThread
        ? '已獲月老賜予良緣紅線，仍可誠心請示感情指引。'
        : '向月下老人擲出「聖筊」即可獲賜良緣紅線！'
      : deity === 'caishen'
        ? hasFortuneMoney
          ? '已獲武財神與虎爺賜予發財金，祝您財源滾滾！'
          : '向武財神與虎爺擲出「聖筊」即可求得發財金！'
        : '誠心在心中默念姓名、心願，再點擊下方「誠心擲筊」。';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/68 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="擲筊請示"
    >
      <div className="temple-card w-full max-w-lg rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8bd68]/30">
          <div>
            <h2 className="text-xl font-bold text-[#fbe09c] font-temple tracking-wider">
              誠心擲筊 · 請示神明
            </h2>
            <p className="text-xs text-[#dfc39a] mt-0.5">{specialHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉擲筊視窗"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#e8cda2] bg-[#36150f] hover:bg-[#522117] cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Deity Selector */}
          <div>
            <span className="block text-xs text-[#e3c28d] mb-1.5">請示神尊</span>
            <div className="flex flex-wrap gap-1.5">
              {DEITY_CHOICES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setDeity(id);
                    setResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer whitespace-nowrap ${
                    deity === id
                      ? 'bg-[#9b221a] border-[#fde08d] text-[#fff4d4] font-bold'
                      : 'bg-[#260f0b] border-[#e8bd68]/25 text-[#d8bc93] hover:bg-[#3a1710]'
                  }`}
                >
                  {TEMPLE_ZONES[id].shortName}
                </button>
              ))}
            </div>
          </div>

          {/* Wish Input */}
          <div>
            <label htmlFor="bwei-wish-input" className="block text-xs text-[#e3c28d] mb-1.5">
              向 {selectedZone.shortName} 稟告心願（選填）
            </label>
            <input
              id="bwei-wish-input"
              type="text"
              maxLength={40}
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="例如：祈求今年工作升遷順遂、早日遇到好對象..."
              className="w-full px-3.5 py-2 rounded-lg bg-[#180906] border border-[#d4a34d]/45 text-[#fff4de] text-sm focus:outline-none focus:border-[#f5cd75]"
            />
          </div>

          {/* Animated SVG Moon Blocks Stage */}
          <div className="rounded-xl bg-[#220d09] border border-[#e8bd68]/30 py-6 px-4 flex flex-col items-center justify-center min-h-[175px]">
            <svg
              viewBox="0 0 280 120"
              className={`w-64 h-28 transition-transform duration-300 ${
                throwing ? 'scale-110 -translate-y-3' : 'scale-100'
              }`}
              role="img"
              aria-label="紅木筊杯"
            >
              {/* Left Moon Block */}
              <g
                transform={
                  throwing
                    ? 'translate(88, 52) rotate(-38)'
                    : result
                      ? `translate(85, 62) rotate(${result.leftFlat ? -18 : 162})`
                      : 'translate(85, 62) rotate(-14)'
                }
              >
                <path
                  d="M -42 8 C -25 -26, 25 -26, 42 8 C 20 18, -20 18, -42 8 Z"
                  fill={result && result.leftFlat ? '#d95436' : '#8f1712'}
                  stroke="#f4c96d"
                  strokeWidth="2.5"
                />
                {result?.leftFlat ? (
                  <path d="M -26 6 Q 0 -6 26 6" fill="none" stroke="#ffcf9e" strokeWidth="2.5" opacity="0.7" />
                ) : (
                  <path d="M -24 -4 Q 0 -16 24 -4" fill="none" stroke="#ff8266" strokeWidth="2" opacity="0.55" />
                )}
              </g>

              {/* Right Moon Block */}
              <g
                transform={
                  throwing
                    ? 'translate(192, 48) rotate(44)'
                    : result
                      ? `translate(195, 62) rotate(${result.rightFlat ? 18 : 198})`
                      : 'translate(195, 62) rotate(14)'
                }
              >
                <path
                  d="M -42 8 C -25 -26, 25 -26, 42 8 C 20 18, -20 18, -42 8 Z"
                  fill={result && result.rightFlat ? '#d95436' : '#8f1712'}
                  stroke="#f4c96d"
                  strokeWidth="2.5"
                />
                {result?.rightFlat ? (
                  <path d="M -26 6 Q 0 -6 26 6" fill="none" stroke="#ffcf9e" strokeWidth="2.5" opacity="0.7" />
                ) : (
                  <path d="M -24 -4 Q 0 -16 24 -4" fill="none" stroke="#ff8266" strokeWidth="2" opacity="0.55" />
                )}
              </g>
            </svg>

            {throwing ? (
              <div className="text-sm font-bold text-[#fbe09c] tracking-widest mt-1">
                筊杯落地請示中……
              </div>
            ) : result ? (
              <div className="text-center mt-1 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`text-2xl font-black font-temple tracking-widest ${
                      result.outcome === 'sheng'
                        ? 'text-[#fde08d]'
                        : result.outcome === 'xiao'
                          ? 'text-[#f8b878]'
                          : 'text-[#e0a294]'
                    }`}
                  >
                    {result.label}
                  </span>
                  <span className="text-xs text-[#e8cda2]">{result.summary}</span>
                </div>
                <p className="text-xs text-[#f5e3c6] max-w-sm leading-relaxed">
                  {result.guidance}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#d6b88e] mt-1">
                一平一凸為「聖筊」、兩平為「笑筊」、兩凸為「陰筊」
              </p>
            )}
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
              type="button"
              onClick={handleToss}
              disabled={throwing}
              className="temple-action-btn px-8 py-2.5 rounded-xl text-base font-bold font-temple tracking-widest text-[#fff5d6] cursor-pointer disabled:opacity-60"
            >
              {result ? '再擲一次' : '誠心擲筊'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
