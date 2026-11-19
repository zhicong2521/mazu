import React from 'react';
import type { AvatarConfig } from '../game/types';

interface TitleOverlayProps {
  avatar: AvatarConfig;
  isCloudMode: boolean;
  authName?: string | null;
  authBusy: boolean;
  onStart: () => void;
  onOpenCustomize: () => void;
  onSignInGoogle: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  avatar,
  isCloudMode,
  authName,
  authBusy,
  onStart,
  onOpenCustomize,
  onSignInGoogle,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-between px-6 py-8 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 50% 42%, rgba(20, 8, 5, 0.08) 0%, rgba(18, 7, 5, 0.56) 62%, rgba(14, 5, 4, 0.88) 100%)',
      }}
    >
      {/* Top Safe Region: Bespoke Inline SVG Temple Plaque Title Lockup */}
      <div className="flex flex-col items-center mt-2 sm:mt-5">
        <svg
          viewBox="0 0 540 168"
          className="w-[320px] sm:w-[460px] h-auto drop-shadow-[0_12px_28px_rgba(0,0,0,0.75)]"
          role="img"
          aria-label="雲端天后宮"
        >
          {/* Outer Lacquer Wood Frame */}
          <rect
            x="10"
            y="14"
            width="520"
            height="136"
            rx="12"
            fill="#230d09"
            fillOpacity="0.94"
            stroke="#e8bf68"
            strokeWidth="4"
          />
          {/* Inner Carved Gold Border */}
          <rect
            x="22"
            y="26"
            width="496"
            height="112"
            rx="6"
            fill="none"
            stroke="#c9963e"
            strokeWidth="1.6"
          />
          {/* Corner Traditional Ruyi Cloud Motifs */}
          <path d="M22 44 Q38 44 38 26" fill="none" stroke="#f4d07c" strokeWidth="2.5" />
          <path d="M518 44 Q502 44 502 26" fill="none" stroke="#f4d07c" strokeWidth="2.5" />
          <path d="M22 120 Q38 120 38 138" fill="none" stroke="#f4d07c" strokeWidth="2.5" />
          <path d="M518 120 Q502 120 502 138" fill="none" stroke="#f4d07c" strokeWidth="2.5" />
          {/* Top Golden Crest Seal */}
          <circle cx="270" cy="14" r="11" fill="#8f1d17" stroke="#f4d07c" strokeWidth="2.5" />
          <circle cx="270" cy="14" r="4" fill="#f4d07c" />

          {/* Main Calligraphic Title */}
          <text
            x="270"
            y="95"
            textAnchor="middle"
            fill="#fbe09c"
            fontSize="62"
            fontWeight="900"
            letterSpacing="12"
            style={{
              fontFamily: '"Noto Serif TC", "Songti TC", serif',
              paintOrder: 'stroke fill',
              stroke: '#3a1109',
              strokeWidth: '5px',
            }}
          >
            雲端天后宮
          </text>
          {/* Subtle Subtitle carved in lower plaque */}
          <text
            x="270"
            y="126"
            textAnchor="middle"
            fill="#e5be7a"
            fontSize="14"
            fontWeight="600"
            letterSpacing="5"
            style={{ fontFamily: '"Noto Sans TC", sans-serif' }}
          >
            線上媽祖祈福 · 擲筊求籤 · 月老財神參拜
          </text>
        </svg>
      </div>

      {/* Central viewport stays wide open so the glowing 3D Mazu Main Altar & Lanterns shine */}
      <div className="flex-1" />

      {/* Bottom Safe Region: Primary Start CTA + Avatar Customizer + Cloud Sign-In */}
      <div className="flex flex-col items-center gap-3.5 mb-2 pointer-events-auto">
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="temple-action-btn px-10 py-3.5 rounded-xl text-xl font-bold tracking-widest text-[#fff5d6] font-temple cursor-pointer whitespace-nowrap"
          >
            入廟參拜
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenCustomize();
            }}
            className="px-6 py-3.5 rounded-xl text-base font-medium tracking-wider text-[#f7dca1] bg-[#2a120d]/95 border border-[#d4a34d]/60 hover:border-[#f4cd76] hover:bg-[#3b1811] transition-colors cursor-pointer whitespace-nowrap"
          >
            自訂分身（{avatar.name}）
          </button>

          {!isCloudMode ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={(e) => {
                e.currentTarget.blur();
                onSignInGoogle();
              }}
              className="px-5 py-3.5 rounded-xl text-sm font-semibold tracking-wide text-[#a7f3d0] bg-[#192c23]/95 border border-[#6ee7b7]/55 hover:border-[#a7f3d0] hover:bg-[#213b2f] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {authBusy ? '登入中…' : 'Google 登入 · 跨裝置多人'}
            </button>
          ) : (
            <span className="px-4 py-3.5 rounded-xl text-sm font-semibold text-[#a7f3d0] bg-[#192c23]/95 border border-[#6ee7b7]/45 whitespace-nowrap">
              已啟用雲端多人（{authName || avatar.name}）
            </span>
          )}
        </div>

        <p className="text-xs sm:text-sm text-[#e8d2b0]/85 tracking-wide text-center">
          WASD / 方向鍵移動 · 滑鼠拖曳旋轉視角 · Enter 聊天 · 1-4 參拜互動 · Esc 暫停
        </p>
      </div>
    </div>
  );
};
