import React, { useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MapPin,
  MessageCircle,
  Pause,
  RotateCcw,
  RotateCw,
  ScrollText,
  Smile,
  Sparkles,
  UserRoundPen,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TEMPLE_ZONES, WORSHIP_STEPS } from '../game/data';
import type { RemotePlayerState } from '../game/multiplayer';
import { worldToMinimap } from '../game/rules';
import type { TempleProgressState, TempleZone, ZoneId } from '../game/types';

interface GameHudProps {
  progress: TempleProgressState;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  nearestZone: TempleZone | null;
  autoWalking: boolean;
  muted: boolean;
  showNpcs: boolean;
  toastMessage: string | null;
  roomId: string;
  onlineCount: number;
  remotePlayers: RemotePlayerState[];
  onNavigateZone: (zoneId: ZoneId) => void;
  onOneClickStep: () => void;
  onWorshipAction: () => void;
  onOpenBwei: () => void;
  onOpenFortune: () => void;
  onToggleIncense: () => void;
  onOpenService: () => void;
  onOpenLantern: () => void;
  onRingBell: () => void;
  onOpenMultiplayer: () => void;
  onOpenNotice: () => void;
  onToggleMute: () => void;
  onToggleChat: () => void;
  onToggleEmotes: () => void;
  onOpenCustomize: () => void;
  onToggleNpcs: () => void;
  onOpenPause: () => void;
  onJoystickMove: (nx: number, ny: number) => void;
  onRotateCamera: (deltaYaw: number) => void;
}

const MINIMAP_PINS: Array<{ id: ZoneId; label: string; color: string }> = [
  { id: 'mazu', label: '媽', color: '#e54538' },
  { id: 'guanyu', label: '關', color: '#2e9e64' },
  { id: 'xuantian', label: '玄', color: '#4e7bd9' },
  { id: 'yuelao', label: '月', color: '#f0719a' },
  { id: 'caishen', label: '財', color: '#f2bd3a' },
  { id: 'service', label: '服', color: '#e6b85c' },
  { id: 'lanternwall', label: '燈', color: '#ffbe42' },
  { id: 'tiangong', label: '天', color: '#f5b841' },
  { id: 'jinlu', label: '金', color: '#f07c2e' },
];

export const GameHud: React.FC<GameHudProps> = ({
  progress,
  playerX,
  playerZ,
  playerYaw,
  nearestZone,
  autoWalking,
  muted,
  showNpcs,
  toastMessage,
  roomId,
  onlineCount,
  remotePlayers,
  onNavigateZone,
  onOneClickStep,
  onWorshipAction,
  onOpenBwei,
  onOpenFortune,
  onToggleIncense,
  onOpenService,
  onOpenLantern,
  onRingBell,
  onOpenMultiplayer,
  onOpenNotice,
  onToggleMute,
  onToggleChat,
  onToggleEmotes,
  onOpenCustomize,
  onToggleNpcs,
  onOpenPause,
  onJoystickMove,
  onRotateCamera,
}) => {
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyActiveRef = useRef(false);

  const playerMM = worldToMinimap(playerX, playerZ);
  const currentStep =
    progress.currentStepIndex < WORSHIP_STEPS.length
      ? WORSHIP_STEPS[progress.currentStepIndex]
      : null;

  const updateJoystickFromEvent = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyKnob({ x: dx, y: dy });
    onJoystickMove(dx / maxR, dy / maxR);
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyActiveRef.current = true;
    updateJoystickFromEvent(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyActiveRef.current) return;
    updateJoystickFromEvent(e.clientX, e.clientY);
  };

  const handleJoyUp = () => {
    joyActiveRef.current = false;
    setJoyKnob({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const handleZonePrimaryAction = () => {
    if (!nearestZone) return;
    if (nearestZone.id === 'service') onOpenService();
    else if (nearestZone.id === 'lanternwall') onOpenLantern();
    else if (nearestZone.id === 'bell') onRingBell();
    else if (nearestZone.id === 'yuelao' || nearestZone.id === 'caishen') onOpenBwei();
    else onWorshipAction();
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* ==================== TOP-LEFT: Minimap + Stamina/Coins + 11-Step Guide ==================== */}
      <div className="absolute top-3.5 left-3.5 flex flex-col gap-2.5 max-w-[300px] sm:max-w-[320px]">
        <div className="flex items-start gap-2.5 pointer-events-auto">
          {/* Interactive Temple Minimap */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMapMenuOpen((v) => !v)}
              aria-label="開啟廟宇地圖導航"
              className="relative w-[84px] h-[84px] rounded-xl overflow-hidden border-2 border-[#e4b862]/75 bg-[#2a150f] shadow-lg cursor-pointer block"
            >
              {/* Temple Floor Plan Silhouette */}
              <div className="absolute inset-1.5 rounded-md border border-[#d6a354]/35 bg-[#3d1c14]" />
              <div className="absolute left-1.5 right-1.5 top-[64%] h-[1.5px] bg-[#d6a354]/45" />
              {/* Shrine Pins */}
              {MINIMAP_PINS.map((pin) => {
                const z = TEMPLE_ZONES[pin.id];
                const pos = worldToMinimap(z.position.x, z.position.z);
                return (
                  <span
                    key={pin.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                    style={{
                      left: `${pos.u * 100}%`,
                      top: `${pos.v * 100}%`,
                      backgroundColor: pin.color,
                    }}
                  >
                    {pin.label}
                  </span>
                );
              })}
              {/* Live Online Remote Player Dots */}
              {remotePlayers.map((rp) => {
                const pos = worldToMinimap(rp.x, rp.z);
                return (
                  <span
                    key={rp.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#38bdf8] border border-white/90"
                    style={{
                      left: `${pos.u * 100}%`,
                      top: `${pos.v * 100}%`,
                    }}
                  />
                );
              })}
              {/* Live Player Marker Arrow */}
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#fff3c4] border-2 border-[#a81e18] shadow"
                style={{
                  left: `${playerMM.u * 100}%`,
                  top: `${playerMM.v * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${-playerYaw}rad)`,
                }}
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[10px] text-[#f8d88a] text-center py-0.5 leading-none">
                地圖 · 導航
              </span>
            </button>

            {/* Quick Teleport/Walk Dropdown */}
            {mapMenuOpen && (
              <div className="temple-card absolute top-[92px] left-0 w-56 rounded-xl p-2.5 z-30">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-xs font-bold text-[#fbe09c]">選擇殿宇前往</span>
                  <button
                    type="button"
                    onClick={() => setMapMenuOpen(false)}
                    className="text-xs text-[#d9ba8c] hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(TEMPLE_ZONES) as ZoneId[]).map((zid) => {
                    const z = TEMPLE_ZONES[zid];
                    return (
                      <button
                        key={zid}
                        type="button"
                        onClick={() => {
                          onNavigateZone(zid);
                          setMapMenuOpen(false);
                        }}
                        className="px-2 py-1.5 rounded-lg text-left text-xs text-[#f6e3be] bg-[#36160f] hover:bg-[#5c2217] border border-[#e8bd68]/25 truncate cursor-pointer"
                      >
                        {z.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Stamina + Coins + Merit Compact Readout */}
          <div className="temple-panel rounded-xl px-3 py-2 flex flex-col gap-1.5 min-w-[168px]">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 rounded-full bg-[#1a0a07] border border-[#d6a451]/35 overflow-hidden">
                <div
                  className="h-full bg-[#48c768] transition-all duration-300"
                  style={{ width: `${Math.max(4, Math.min(100, progress.stamina))}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#e5f9e0] tabular-nums whitespace-nowrap">
                {progress.stamina} 精力
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#f6dc9c] tabular-nums">
              <span>香油幣 {progress.coins} 幣</span>
              <span aria-hidden="true" className="text-[#c49755]">·</span>
              <span>功德 {progress.merit}</span>
            </div>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenMultiplayer();
              }}
              aria-label="開啟多人線上同參與揪友進香"
              className="flex items-center justify-between gap-3 text-[11px] text-[#a7f3d0] hover:text-white pt-1 border-t border-[#e8bd68]/20 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-semibold tabular-nums whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                同殿在線 {onlineCount} 人
              </span>
              <span className="text-[#f3d188] underline underline-offset-2 truncate max-w-[96px]">
                {roomId === 'main' ? '揪友同拜' : `房:${roomId}`}
              </span>
            </button>
          </div>
        </div>

        {/* 11-Step Guided Worship Card (matching Sinchew screenshot!) */}
        <div className="temple-panel rounded-xl px-3.5 py-2.5 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-[#f1c76e] tabular-nums">
                {currentStep
                  ? `參拜指引 ${currentStep.stepNumber}/${WORSHIP_STEPS.length} · ${currentStep.title}`
                  : `參拜指引 ${WORSHIP_STEPS.length}/${WORSHIP_STEPS.length} · 功德圓滿`}
              </div>
              <p className="text-xs text-[#fff2d9] mt-0.5 leading-snug">
                {currentStep
                  ? currentStep.instruction
                  : '已完成全套 11 步參拜流程，可繼續自由擲筊、求籤或點燈！'}
              </p>
            </div>
            {currentStep && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onNavigateZone(currentStep.targetZone);
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-[#fff4d6] bg-[#9b231b] border border-[#f0c56b]/70 hover:bg-[#b82c22] cursor-pointer whitespace-nowrap"
              >
                {autoWalking ? '前往中' : '前往'}
              </button>
            )}
          </div>

          {/* Subtle one-click assisted worship shortcut + blessing items status */}
          <div className="mt-2 pt-2 border-t border-[#e8bd68]/20 flex items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOneClickStep();
              }}
              className="flex items-center gap-1 text-[#f6cf7c] hover:text-[#fff1c2] font-medium cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentStep ? '一鍵前往執行本步' : '前往媽祖正殿'}</span>
            </button>
            <span className="text-[#d9ba8b] truncate">
              {[
                progress.inventory.redThread ? '紅線' : null,
                progress.inventory.fortuneMoney ? '發財金' : null,
                progress.inventory.blessedAmulet ? '過爐平安符' : null,
              ]
                .filter(Boolean)
                .join(' · ') || '香火結緣中'}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== TOP-RIGHT: Collapsible Circular Utility Toolbar ==================== */}
      <div className="absolute top-3.5 right-3.5 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setRightCollapsed((c) => !c);
            }}
            aria-label={rightCollapsed ? '展開功能列' : '收起功能列'}
            className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
          >
            {rightCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {!rightCollapsed && (
            <>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenNotice();
                }}
                aria-label="宮廟公告與流程"
                className="w-10 h-10 rounded-full bg-[#b57a22] border border-[#fde08d] flex items-center justify-center text-[#fff8e6] hover:bg-[#cc8c2a] cursor-pointer shadow"
              >
                <ScrollText className="w-4 h-4" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                aria-label={muted ? '開啟音效' : '靜音'}
                className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleChat();
                }}
                aria-label="香客聊天室"
                className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleEmotes();
                }}
                aria-label="角色動作與表情"
                className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
              >
                <Smile className="w-4 h-4" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenCustomize();
                }}
                aria-label="捏臉換裝"
                className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
              >
                <UserRoundPen className="w-4 h-4" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleNpcs();
                }}
                aria-label={showNpcs ? '隱藏其他香客' : '顯示其他香客'}
                className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
              >
                {showNpcs ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenPause();
                }}
                aria-label="暫停與設定"
                className="w-10 h-10 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Quick Temple Stations Strip when expanded */}
        {!rightCollapsed && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenService();
              }}
              className="px-2.5 py-1 rounded-lg temple-panel text-[#fbe09c] hover:border-[#fde08d] cursor-pointer whitespace-nowrap"
            >
              服務處 · 供品
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenLantern();
              }}
              className="px-2.5 py-1 rounded-lg temple-panel text-[#fbe09c] hover:border-[#fde08d] cursor-pointer whitespace-nowrap"
            >
              點光明燈
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onRingBell();
              }}
              className="px-2.5 py-1 rounded-lg temple-panel text-[#fbe09c] hover:border-[#fde08d] cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <Bell className="w-3 h-3" />
              平安鐘
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenMultiplayer();
              }}
              className="px-2.5 py-1 rounded-lg temple-panel text-[#a7f3d0] hover:border-[#6ee7b7] cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <Users className="w-3 h-3" />
              揪友同拜
            </button>
          </div>
        )}
      </div>

      {/* ==================== TOP-CENTER TOAST FEEDBACK ==================== */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-md px-5 py-2.5 rounded-xl temple-card text-center text-sm font-medium text-[#ffefc8]">
          {toastMessage}
        </div>
      )}

      {/* ==================== BOTTOM-LEFT: Virtual Joystick & Camera Rotate ==================== */}
      <div className="absolute bottom-4 left-4 flex flex-col items-center gap-2.5 pointer-events-auto">
        <div
          ref={joyRef}
          onPointerDown={handleJoyDown}
          onPointerMove={handleJoyMove}
          onPointerUp={handleJoyUp}
          onPointerCancel={handleJoyUp}
          aria-label="虛擬移動搖桿"
          className="relative w-24 h-24 rounded-full bg-[#240f0b]/75 border border-[#e8bd68]/45 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-10 rounded-full bg-[#4d1e15]/80 border border-[#f0c56b]/60 pointer-events-none" />
          <div
            className="absolute w-9 h-9 rounded-full bg-[#c93529] border-2 border-[#fbe09c] shadow pointer-events-none"
            style={{
              transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRotateCamera(0.42);
            }}
            aria-label="視角向左轉"
            className="w-9 h-9 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRotateCamera(-0.42);
            }}
            aria-label="視角向右轉"
            className="w-9 h-9 rounded-full temple-panel flex items-center justify-center text-[#f7dda4] hover:border-[#fde08d] cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ==================== BOTTOM-CENTER: Contextual Location + 4 Iconic Ritual Buttons ==================== */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-auto">
        {nearestZone && (
          <div className="temple-panel rounded-xl px-4 py-1.5 flex items-center gap-3 text-xs">
            <MapPin className="w-3.5 h-3.5 text-[#f4c668] shrink-0" />
            <span className="font-bold text-[#ffefc8] whitespace-nowrap">{nearestZone.name}</span>
            <span className="hidden sm:inline text-[#d8ba8c] truncate max-w-[200px]">
              {nearestZone.subtitle}
            </span>
            {nearestZone.specialActionLabel && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleZonePrimaryAction();
                }}
                className="px-2.5 py-1 rounded-md bg-[#b62c22] text-[#fff4d4] border border-[#f5cd74]/70 hover:bg-[#cf372b] font-bold cursor-pointer whitespace-nowrap"
              >
                {nearestZone.specialActionLabel}
              </button>
            )}
          </div>
        )}

        {/* The 4 Signature Crimson-Gold Ritual Action Buttons: 拜 · 筊 · 籤 · 香 */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onWorshipAction();
            }}
            className="temple-action-btn w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-xl flex flex-col items-center justify-center cursor-pointer"
          >
            <span className="text-2xl sm:text-[26px] font-bold font-temple text-[#fff3d2] leading-none">
              拜
            </span>
            <span className="text-[11px] text-[#f5d590] mt-1 leading-none">參拜</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenBwei();
            }}
            className="temple-action-btn w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-xl flex flex-col items-center justify-center cursor-pointer"
          >
            <span className="text-2xl sm:text-[26px] font-bold font-temple text-[#fff3d2] leading-none">
              筊
            </span>
            <span className="text-[11px] text-[#f5d590] mt-1 leading-none">擲筊</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenFortune();
            }}
            className="temple-action-btn w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-xl flex flex-col items-center justify-center cursor-pointer"
          >
            <span className="text-2xl sm:text-[26px] font-bold font-temple text-[#fff3d2] leading-none">
              籤
            </span>
            <span className="text-[11px] text-[#f5d590] mt-1 leading-none">求籤</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-active={progress.holdingIncense ? 'true' : 'false'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleIncense();
            }}
            className="temple-action-btn w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-xl flex flex-col items-center justify-center cursor-pointer"
          >
            <span className="text-2xl sm:text-[26px] font-bold font-temple text-[#fff3d2] leading-none">
              香
            </span>
            <span className="text-[11px] text-[#f5d590] mt-1 leading-none">
              {progress.holdingIncense ? '持香中' : '持香'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
