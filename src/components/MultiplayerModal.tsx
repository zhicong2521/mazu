import React, { useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  DoorOpen,
  ExternalLink,
  LogIn,
  LogOut,
  Navigation,
  Shuffle,
  Users,
  X,
} from 'lucide-react';
import type { FormattedAuthError } from '../game/authErrors';
import { normalizeRoomId, type RemotePlayerState } from '../game/multiplayer';
import type { ConnectionStatus } from '../game/multiplayerClient';

interface MultiplayerModalProps {
  roomId: string;
  connectionStatus: ConnectionStatus;
  isCloudMode: boolean;
  authUser: { displayName: string | null; email: string | null } | null;
  authBusy: boolean;
  authError: FormattedAuthError | null;
  isInIframe: boolean;
  selfName: string;
  remotePlayers: RemotePlayerState[];
  onSignInGoogle: () => void;
  onSignInRedirect: () => void;
  onSignOut: () => void;
  onSwitchRoom: (nextRoomId: string) => void;
  onWalkToPlayer: (player: RemotePlayerState) => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  roomId,
  connectionStatus,
  isCloudMode,
  authUser,
  authBusy,
  authError,
  isInIframe,
  selfName,
  remotePlayers,
  onSignInGoogle,
  onSignInRedirect,
  onSignOut,
  onSwitchRoom,
  onWalkToPlayer,
  onClose,
}) => {
  const [roomInput, setRoomInput] = useState(roomId === 'main' ? '' : roomId);
  const [copiedType, setCopiedType] = useState<'url' | 'code' | null>(null);

  const totalOnline = remotePlayers.length + 1;
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}${
          roomId === 'main' ? '' : `?room=${encodeURIComponent(roomId)}`
        }`
      : '';

  const copyText = async (text: string, kind: 'url' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: still show confirmation after select-all
    }
    setCopiedType(kind);
    window.setTimeout(() => setCopiedType(null), 2200);
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
      <div className="temple-card w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e7be6a]/30 bg-[#32120b]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#f6d07a]" />
            <div>
              <h2 className="text-lg font-bold text-[#fbe09c]">多人線上同參 · 揪友進香</h2>
              <p className="text-xs text-[#d6ba8b] mt-0.5">
                即時同步 3D 分身走動、香客打字聊天、平安鐘與光明燈牆
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
          {/* Cloud Sync Auth Card */}
          {isCloudMode && authUser ? (
            <div className="rounded-xl p-3.5 bg-[#1b2e24] border border-[#6ee7b7]/45 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Cloud className="w-5 h-5 text-[#6ee7b7] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#a7f3d0]">
                    雲端跨裝置多人同步已開啟
                  </div>
                  <div className="text-[11px] text-[#d1fae5]/85 truncate">
                    已登入：{authUser.displayName || authUser.email || 'Google 香客'} · 所有裝置與分享連結皆可同殿相見
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                disabled={authBusy}
                className="px-2.5 py-1.5 rounded-lg bg-[#122019] hover:bg-[#233d30] border border-[#6ee7b7]/35 text-[11px] text-[#d1fae5] flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                登出
              </button>
            </div>
          ) : (
            <div className="rounded-xl p-4 bg-[#45170e] border border-[#f5cc74]/60 flex flex-col gap-2.5">
              <div>
                <div className="text-sm font-bold text-[#ffe9a8] flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#f6cf7c]" />
                  登入 Google 開啟「跨裝置 / 跨連結」多人連線
                </div>
                <p className="text-xs text-[#ecd6b1] mt-1 leading-relaxed">
                  不同手機、電腦或分享連結需要透過雲端資料庫同步才能看到彼此。你與朋友都點下方登入並進入相同房號，即可立刻在 3D 殿內相見！
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="google-signin-btn"
                  onClick={() => onSignInGoogle()}
                  disabled={authBusy}
                  className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-[#b92d22] hover:bg-[#d1362a] border border-[#f8d37c] text-sm font-bold text-[#fff7e2] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow"
                >
                  <LogIn className="w-4 h-4" />
                  {authBusy ? '正在開啟 Google 登入視窗…' : '使用 Google 帳號登入 · 跨裝置同參'}
                </button>
                {isInIframe && inviteUrl && (
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-[#2a120d] hover:bg-[#3f1a12] border border-[#f5cc74]/55 text-xs font-bold text-[#ffefc8] inline-flex items-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    新分頁登入
                  </a>
                )}
              </div>

              {authError && (
                <div
                  role="alert"
                  data-testid="modal-auth-error"
                  className="text-xs text-[#fecaca] bg-[#2a0c08] border border-[#f87171]/50 rounded-lg px-3 py-2 flex flex-col gap-2"
                >
                  <p className="leading-relaxed">{authError.message}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {(authError.suggestNewTab || isInIframe) && inviteUrl && (
                      <a
                        href={inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-md bg-[#b92d22] hover:bg-[#d1362a] border border-[#f8d37c] text-[11px] font-bold text-[#fff7e2] inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        在新分頁開啟以完成登入
                      </a>
                    )}
                    {authError.suggestRedirect && !isInIframe && (
                      <button
                        type="button"
                        onClick={onSignInRedirect}
                        className="px-3 py-1.5 rounded-md bg-[#4a1c12] hover:bg-[#662618] border border-[#f5cc74]/55 text-[11px] font-bold text-[#ffefc8] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <LogIn className="w-3 h-3" />
                        改用跳轉方式登入
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Hall Banner + Copy Invite & Room Code */}
          <div className="rounded-xl p-4 bg-[#3d160e] border border-[#e7be6a]/35 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-[#d9ba8c]">目前所在殿宇頻道</div>
                <div className="text-base font-bold text-[#ffefc8] mt-0.5">
                  {roomId === 'main' ? '本殿大廳（公開同參 · main）' : `私人進香房：${roomId}`}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#24100b] border border-[#6ee7b7]/40 text-xs font-bold text-[#a7f3d0] tabular-nums shrink-0">
                {connectionStatus === 'connected'
                  ? `${isCloudMode ? '雲端' : '本機'}在線 ${totalOnline} 人`
                  : '連線同步中…'}
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
                onClick={() => copyText(inviteUrl, 'url')}
                className="px-3 py-2 rounded-lg bg-[#b42921] hover:bg-[#cc3128] text-xs font-bold text-[#fff5df] border border-[#f5cc74]/70 flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedType === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'url' ? '已複製' : '複製連結'}
              </button>
              <button
                type="button"
                onClick={() => copyText(roomId, 'code')}
                className="px-3 py-2 rounded-lg bg-[#4a1c12] hover:bg-[#662618] text-xs font-bold text-[#ffefc8] border border-[#e7be6a]/50 flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedType === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'code' ? '已複製' : '複製房號'}
              </button>
            </div>
          </div>

          {/* Room Switcher */}
          <form onSubmit={handleJoinCustom} className="flex flex-col gap-2">
            <label htmlFor="room-code-input" className="text-xs font-semibold text-[#f3d188]">
              切換或建立親友專屬進香房（雙方輸入相同英數字房號即可相見）
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
              同殿即時真人香客（{totalOnline} 人）
            </div>
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto temple-scroll pr-1">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#471b11] border border-[#f5cc74]/45">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
                  <span className="text-sm font-bold text-[#ffefc8] truncate">{selfName}（你）</span>
                </div>
                <span className="text-[11px] text-[#f3d188]">
                  {isCloudMode ? '雲端同步中' : '本機模式'}
                </span>
              </div>

              {remotePlayers.length === 0 ? (
                <div className="px-3 py-3 rounded-lg bg-[#240d08] border border-[#e7be6a]/20 text-xs text-[#cfa979] text-center leading-relaxed">
                  {isCloudMode
                    ? `目前房號「${roomId}」只有你一位香客。請把房號「${roomId}」告訴朋友，對方登入 Google 並輸入同一房號即可同殿參拜！`
                    : '目前為本機訪客模式（僅同步同一網址分頁）。點擊上方「Google 登入」即可跨裝置與朋友相見！'}
                </div>
              ) : (
                remotePlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#2d100a] border border-[#e7be6a]/25"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#38bdf8] shrink-0" />
                      <span className="text-sm font-medium text-[#f8e6c6] truncate">
                        {p.avatar.name}
                      </span>
                      <span className="text-[11px] text-[#cfa979] shrink-0">
                        {p.holdingIncense ? '持香中' : '漫步中'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onWalkToPlayer(p);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-md bg-[#4d1e14] hover:bg-[#6d2b1d] border border-[#f0c56b]/45 text-[11px] font-semibold text-[#ffe8ad] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Navigation className="w-3 h-3" />
                      前往身邊
                    </button>
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
