import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Send, Sparkles } from 'lucide-react';
import type { ChatMessage, EmoteType } from '../game/types';

export type ChatDockView = 'compact' | 'expanded' | 'minimized';

interface ChatAndEmotePanelProps {
  chatView: ChatDockView;
  showEmotes: boolean;
  messages: ChatMessage[];
  onlineCount: number;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeChatView: (next: ChatDockView) => void;
  onSendMessage: (text: string) => void;
  onTriggerEmote: (emote: EmoteType, label: string) => void;
  onCloseEmotes: () => void;
  onInputFocus?: () => void;
}

const QUICK_WISHES = [
  '媽祖娘娘保佑平安健康！',
  '月老爺爺賜我好姻緣！',
  '武財神與虎爺保佑發大財！',
  '關聖帝君保佑工作順遂零 Bug！',
];

const EMOTES: Array<{ id: EmoteType; label: string; desc: string }> = [
  { id: 'bow', label: '雙手合十鞠躬', desc: '誠心敬禮' },
  { id: 'kneel', label: '虔誠跪拜', desc: '於拜墊靜心祈禱' },
  { id: 'meditate', label: '打坐靜心', desc: '沉澱思緒' },
  { id: 'jump', label: '開心跳躍', desc: '慶祝擲出聖筊' },
  { id: 'wave', label: '揮手打招呼', desc: '向其他香客問好' },
  { id: 'idle', label: '自然站立', desc: '恢復站姿' },
];

export const ChatAndEmotePanel: React.FC<ChatAndEmotePanelProps> = ({
  chatView,
  showEmotes,
  messages,
  onlineCount,
  chatInputRef,
  onChangeChatView,
  onSendMessage,
  onTriggerEmote,
  onCloseEmotes,
  onInputFocus,
}) => {
  const [input, setInput] = useState('');
  const [showQuickWishes, setShowQuickWishes] = useState(false);
  const isComposingRef = useRef(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat feed when new messages arrive
  useEffect(() => {
    if (chatView !== 'minimized') {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, chatView]);

  const submitMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      chatInputRef.current?.blur();
      return;
    }
    onSendMessage(trimmed);
    setInput('');
    if (chatView === 'minimized') {
      onChangeChatView('compact');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isComposingRef.current) return;
    submitMessage();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter' && (isComposingRef.current || e.nativeEvent.isComposing)) {
      e.preventDefault();
    }
  };

  const visibleMessages = chatView === 'compact' ? messages.slice(-4) : messages;

  return (
    <>
      {/* Emotes Floating Popover (positioned cleanly above chat dock) */}
      {showEmotes && (
        <div
          className="fixed bottom-44 right-4 z-25 w-64 temple-card rounded-2xl p-4 pointer-events-auto"
          role="dialog"
          aria-label="角色動作與表情"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#fbe09c] font-temple">信眾動作互動</h3>
            <button
              type="button"
              onClick={onCloseEmotes}
              aria-label="關閉動作面板"
              className="text-xs text-[#dfc39a] hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EMOTES.map((em) => (
              <button
                key={em.id}
                type="button"
                onClick={() => onTriggerEmote(em.id, em.label)}
                className="p-2.5 rounded-xl bg-[#29100c] hover:bg-[#572015] border border-[#e8bd68]/30 text-left cursor-pointer"
              >
                <div className="text-xs font-bold text-[#fff2d6]">{em.label}</div>
                <div className="text-[10px] text-[#cfa97e] mt-0.5">{em.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Always-Ready Bottom-Right Live Chat Dock */}
      <section
        aria-label="香客聊天室與許願牆"
        className={`fixed bottom-4 right-3.5 z-20 pointer-events-auto temple-panel rounded-2xl overflow-hidden flex flex-col transition-all ${
          chatView === 'expanded'
            ? 'w-80 sm:w-96 max-h-[54vh]'
            : 'w-[280px] sm:w-[336px]'
        }`}
      >
        {/* Dock Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#e8bd68]/20 bg-[#2a100a]">
          <div className="flex items-center gap-1.5 min-w-0">
            <MessageCircle className="w-3.5 h-3.5 text-[#f4cb73] shrink-0" />
            <span className="text-xs font-bold text-[#fbe09c] font-temple truncate">
              線上香客聊天
            </span>
            <span className="text-[10px] text-[#a7f3d0] tabular-nums shrink-0">
              · {onlineCount} 人在線
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowQuickWishes((v) => !v)}
              aria-label="切換快捷祈福語"
              title="快捷祈福語"
              className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer flex items-center gap-0.5 ${
                showQuickWishes
                  ? 'bg-[#7d1f18] text-[#fff2d2] border-[#f4cb73]/70'
                  : 'bg-[#36150f] text-[#e6c794] border-[#e8bd68]/25 hover:text-white'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              快捷
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() =>
                onChangeChatView(chatView === 'expanded' ? 'compact' : 'expanded')
              }
              aria-label={chatView === 'expanded' ? '縮小聊天室' : '展開聊天室'}
              className="w-6 h-6 rounded flex items-center justify-center text-[#dfc39a] hover:bg-[#4c1c12] hover:text-white cursor-pointer"
            >
              {chatView === 'expanded' ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {chatView !== 'minimized' && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onChangeChatView('minimized')}
                aria-label="收起聊天紀錄"
                className="w-6 h-6 rounded flex items-center justify-center text-[11px] text-[#dfc39a] hover:bg-[#4c1c12] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Live Chat Feed (Compact 4-line preview or Full scrollable history) */}
        {chatView !== 'minimized' && (
          <div
            className={`overflow-y-auto temple-scroll px-3 py-2 space-y-1.5 ${
              chatView === 'expanded' ? 'min-h-[180px] max-h-[300px]' : 'max-h-[120px]'
            }`}
          >
            {visibleMessages.map((m) => (
              <div
                key={m.id}
                className={`text-[11px] leading-relaxed rounded-lg px-2.5 py-1 break-words ${
                  m.isSystem
                    ? 'bg-[#3e1a10] text-[#fde08d] border border-[#e8bd68]/25'
                    : m.isPlayer
                      ? 'bg-[#631e15] text-[#fff6df]'
                      : 'bg-[#250f0b] text-[#ecd8b8]'
                }`}
              >
                {!m.isSystem && (
                  <span className="font-bold text-[#f4cb73] mr-1">{m.sender}：</span>
                )}
                <span>{m.text}</span>
                {chatView === 'expanded' && m.timestamp && (
                  <span className="ml-1.5 text-[10px] text-[#b9956b]">{m.timestamp}</span>
                )}
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
        )}

        {/* Quick Wish Chips (shown when expanded or toggled) */}
        {(chatView === 'expanded' || showQuickWishes) && (
          <div className="px-2.5 py-1.5 border-t border-[#e8bd68]/20 flex gap-1.5 overflow-x-auto temple-scroll bg-[#240e09]">
            {QUICK_WISHES.map((w) => (
              <button
                key={w}
                type="button"
                tabIndex={-1}
                onClick={() => onSendMessage(w)}
                className="shrink-0 px-2 py-0.5 rounded-md text-[10px] bg-[#36150f] text-[#f5d79b] border border-[#e8bd68]/30 hover:bg-[#522117] cursor-pointer"
              >
                {w}
              </button>
            ))}
          </div>
        )}

        {/* Always-Ready Typing Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="p-2 border-t border-[#e8bd68]/20 flex items-center gap-1.5 bg-[#1e0b08]"
        >
          <input
            ref={chatInputRef}
            type="text"
            maxLength={120}
            value={input}
            onFocus={onInputFocus}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            placeholder="按 Enter 打字聊天、許願（頭頂顯示氣泡）…"
            aria-label="輸入聊天訊息"
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#140705] border border-[#d4a34d]/45 text-xs text-[#fff4de] placeholder-[#a98a64] focus:outline-none focus:border-[#fde08d]"
          />
          <button
            type="submit"
            aria-label="送出聊天訊息"
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#9e231b] text-[#fff4d4] border border-[#f0c56b]/65 hover:bg-[#b82c22] cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Send className="w-3 h-3" />
            送出
          </button>
        </form>
      </section>
    </>
  );
};
