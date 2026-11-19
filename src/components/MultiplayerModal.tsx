import React, { useState } from 'react';
import { Check, Copy, DoorOpen, Shuffle, Users, X } from 'lucide-react';
import { normalizeRoomId, type RemotePlayerState } from '../game/multiplayer';
import type { ConnectionStatus } from '../game/multiplayerClient';

interface MultiplayerModalProps {
  roomId: string;
  connectionStatus: ConnectionStatus;
  selfName: string;
  remotePlayers: RemotePlayerState[];
  onSwitchRoom: (nextRoomId: string) => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  roomId,
  connectionStatus,
  selfName,
  remotePlayers,
  onSwitchRoom,
  onClose,
}) => {
  const [roomInput, setRoomInput] = useState(roomId === 'main' ? '' : roomId);
  const [copied, setCopied] = useState(false);

  const totalOnline = remotePlayers.length + 1;
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}${
          roomId === 'main' ? '' : `?room=${encodeURIComponent(roomId)}`
        }`
      : '';

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback: select text via prompt-free inline hint
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleJoinCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const target = normalizeRoomId(roomInput);
    onSwitchRoom(target);
  };

  const handleCreatePrivateRoom = () => {
    const code = `mazu-${Math.random().toString(36).slice(2, 6)}`;
    setRoomInput(code);
    onSwitchRoom(code);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="多人線上同參與揪友進香"
    >
      <div className="temple-card w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e7be6a]/30 bg-[#32120b]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#f6d07a]" />
            <div>
              <h2 className="text-lg font-bold text-[#fbe09c]">多人線上同參 · 揪友進香</h2>
              <p className="text-xs text-[#d6ba8b] mt-0.5">
                即時同步 3D 分身走動、香客聊天、敲響平安鐘與光明燈牆
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉多人同參視窗"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#ebd2a4] hover:bg-[#542014] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto temple-scroll">
          {/* Current Hall Banner + Copy Invite */}
          <div className="rounded-xl p-4 bg-[#3d160e] border border-[#e7be6a]/35 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-[#d9ba8c]">目前所在殿宇頻道</div>
                <div className="text-base font-bold text-[#ffefc8] mt-0.5">
                  {roomId === 'main' ? '本殿大廳（公開同參 · main）' : `私人進香房：${roomId}`}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#24100b] border border-[#6ee7b7]/40 text-xs font-bold text-[#a7f3d0] tabular-nums">
                {connectionStatus === 'connected' ? `在線 ${totalOnline} 人` : '連線同步中…'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                aria-label="邀請連結"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#1d0a07] border border-[#e7be6a]/25 text-xs text-[#f2dfc0] select-all"
              />
              <button
                type="button"
                onClick={handleCopyInvite}
                className="px-3.5 py-2 rounded-lg bg-[#b42921] hover:bg-[#cc3128] text-xs font-bold text-[#fff5df] border border-[#f5cc74]/70 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '已複製連結' : '複製邀請'}
              </button>
            </div>
          </div>

          {/* Room Switcher */}
          <form onSubmit={handleJoinCustom} className="flex flex-col gap-2">
            <label htmlFor="room-code-input" className="text-xs font-semibold text-[#f3d188]">
              切換或建立親友專屬進香房（英數字房號）
            </label>
            <div className="flex items-center gap-2">
              <input
                id="room-code-input"
                type="text"
                maxLength={24}
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="輸入房號，例如 mazu888（留空為本殿大廳）"
                className="flex-1 px-3 py-2 rounded-lg bg-[#1d0a07] border border-[#e7be6a]/35 text-sm text-[#fff1d4] placeholder-[#a68761] focus:outline-none focus:border-[#fde08d]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-[#4a1c12] hover:bg-[#662618] border border-[#e7be6a]/50 text-xs font-bold text-[#ffefc8] flex items-center gap-1 cursor-pointer shrink-0"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                切換房間
              </button>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCreatePrivateRoom}
                className="px-3 py-1.5 rounded-lg bg-[#34130c] hover:bg-[#4f1d13] border border-[#e7be6a]/30 text-xs text-[#f6d99a] flex items-center gap-1.5 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                建立隨機私人進香房
              </button>
              {roomId !== 'main' && (
                <button
                  type="button"
                  onClick={() => {
                    setRoomInput('');
                    onSwitchRoom('main');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#34130c] hover:bg-[#4f1d13] border border-[#e7be6a]/30 text-xs text-[#f6d99a] cursor-pointer"
                >
                  返回本殿大廳
                </button>
              )}
            </div>
          </form>

          {/* Active Online Pilgrims List */}
          <div>
            <div className="text-xs font-semibold text-[#f3d188] mb-2">
              同殿即時香客名單（{totalOnline} 人）
            </div>
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto temple-scroll pr-1">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#471b11] border border-[#f5cc74]/45">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
                  <span className="text-sm font-bold text-[#ffefc8] truncate">{selfName}（你）</span>
                </div>
                <span className="text-[11px] text-[#f3d188]">本機連線中</span>
              </div>

              {remotePlayers.length === 0 ? (
                <div className="px-3 py-3 rounded-lg bg-[#240d08] border border-[#e7be6a]/20 text-xs text-[#cfa979] text-center">
                  目前此殿宇僅有你一位真人香客，點上方「複製邀請」或另開分頁即可體驗多人即時同殿參拜！
                </div>
              ) : (
                remotePlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2d100a] border border-[#e7be6a]/25"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#38bdf8] shrink-0" />
                      <span className="text-sm font-medium text-[#f8e6c6] truncate">
                        {p.avatar.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#d9ba8c]">
                      {p.holdingIncense ? '持香參拜中' : '殿內漫步中'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
