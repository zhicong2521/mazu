import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarCustomizerModal } from './components/AvatarCustomizerModal';
import { BweiModal } from './components/BweiModal';
import { ChatAndEmotePanel, type ChatDockView } from './components/ChatAndEmotePanel';
import { FortuneModal } from './components/FortuneModal';
import { GameHud } from './components/GameHud';
import { LanternModal } from './components/LanternModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { ServiceCounterModal } from './components/ServiceCounterModal';
import { NoticeModal, PauseModal, RitualCompleteModal } from './components/StatusModals';
import { TitleOverlay } from './components/TitleOverlay';
import { templeAudio } from './game/audio';
import {
  createInitialProgress,
  DEFAULT_AVATAR,
  PLAYER_SPAWN,
  TEMPLE_ZONES,
  WORSHIP_STEPS,
} from './game/data';
import {
  appendUniqueChatMessage,
  appendUniqueLantern,
  normalizeRoomId,
  removeRemotePlayer,
  updateRemotePlayer,
  upsertRemotePlayer,
  type RemotePlayerState,
} from './game/multiplayer';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  consumeGoogleRedirectResult,
  isRunningInIframe,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signOutUser,
} from './firebase';
import {
  formatFirebaseAuthError,
  type FormattedAuthError,
} from './game/authErrors';
import {
  FirestoreMultiplayerClient,
  type MultiplayerTransport,
} from './game/firestoreMultiplayer';
import {
  TempleMultiplayerClient,
  type ConnectionStatus,
} from './game/multiplayerClient';
import {
  advanceWorshipProgress,
  purchaseOffering,
  purchaseStarterBundle,
} from './game/rules';
import {
  TempleSceneController,
  type SceneHudSnapshot,
} from './game/three/TempleSceneController';
import type {
  AvatarConfig,
  BweiResult,
  ChatMessage,
  DeityId,
  EmoteType,
  FortuneSlip,
  GamePhase,
  LitLantern,
  OfferingId,
  TempleProgressState,
  ZoneId,
} from './game/types';

type ActiveModal =
  | null
  | 'customize'
  | 'service'
  | 'bwei'
  | 'fortune'
  | 'lantern'
  | 'multiplayer'
  | 'notice';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'sys-1',
    sender: '廟祝公告',
    text: '歡迎來到《雲端天后宮》！可先到左前方「服務處」免費請香與供品，再依 11 步參拜指引誠心祈福。',
    timestamp: '剛剛',
    isSystem: true,
  },
  {
    id: 'npc-init-1',
    sender: '佛系打工人',
    text: '媽祖娘娘保佑今年準時下班、身體健康！',
    timestamp: '1 分鐘前',
  },
  {
    id: 'npc-init-2',
    sender: '早日脫單喵',
    text: '剛去月老殿擲到聖筊拿到紅線了，大家也去試試～',
    timestamp: '剛剛',
  },
];

function getInitialPhase(): GamePhase {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return 'playing';
    }
  }
  return 'title';
}

function getInitialRoomId(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return normalizeRoomId(params.get('room'));
  }
  return 'main';
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(getInitialPhase);
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [progress, setProgress] = useState<TempleProgressState>(createInitialProgress);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [chatView, setChatView] = useState<ChatDockView>('compact');
  const [showEmotes, setShowEmotes] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showNpcs, setShowNpcs] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [serviceFeedback, setServiceFeedback] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  // Real-time online multiplayer & Firebase Auth state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<FormattedAuthError | null>(null);
  const [isInIframe] = useState<boolean>(() => isRunningInIframe());
  const [roomId, setRoomId] = useState<string>(getInitialRoomId);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerState[]>([]);

  const isCloudMode = Boolean(authUser && authUser.emailVerified);

  const [hudSnapshot, setHudSnapshot] = useState<SceneHudSnapshot>({
    playerX: PLAYER_SPAWN.x,
    playerZ: PLAYER_SPAWN.z,
    playerYaw: PLAYER_SPAWN.yaw,
    nearestZone: null,
    autoWalking: false,
  });

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<TempleSceneController | null>(null);
  const mpClientRef = useRef<MultiplayerTransport | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const autoActionOnArriveRef = useRef<boolean>(false);

  // Refs for latest callbacks inside WebGL scene & transport switches
  const avatarRef = useRef(avatar);
  avatarRef.current = avatar;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const hudSnapshotRef = useRef(hudSnapshot);
  hudSnapshotRef.current = hudSnapshot;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const pushSystemLog = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev.slice(-28),
      {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: '廟祝公告',
        text,
        timestamp: '剛剛',
        isSystem: true,
      },
    ]);
  }, []);

  // Keep document.body.dataset.state strictly synced with game phase
  useEffect(() => {
    document.body.dataset.state = phase;
    sceneRef.current?.setPhase(phase);
  }, [phase]);

  // Helper to apply worship step advancement & trigger completion celebration
  const tryAdvanceStep = useCallback(
    (
      baseState: TempleProgressState,
      action: Parameters<typeof advanceWorshipProgress>[1],
      zoneId?: ZoneId,
    ): TempleProgressState => {
      const { nextState, stepCompleted, allCompletedNow } = advanceWorshipProgress(
        baseState,
        action,
        zoneId,
      );
      if (stepCompleted !== null) {
        const finishedStep = WORSHIP_STEPS[stepCompleted - 1];
        templeAudio.playBlessingFanfare();
        pushSystemLog(`已完成第 ${stepCompleted} 步「${finishedStep.title}」！獲功德 +${finishedStep.rewardMerit}、香油幣 +${finishedStep.rewardCoins}`);
        if (allCompletedNow) {
          templeAudio.playTempleBell();
          window.setTimeout(() => {
            setPhase('gameover');
            setActiveModal(null);
            setShowEmotes(false);
          }, 550);
        }
      }
      return nextState;
    },
    [pushSystemLog],
  );

  // Core Worship Button Handler ("拜 · 參拜")
  const handleWorshipAction = useCallback(
    (explicitZoneId?: ZoneId) => {
      const zone = explicitZoneId
        ? TEMPLE_ZONES[explicitZoneId]
        : hudSnapshot.nearestZone;

      if (!zone) {
        templeAudio.playWoodblock();
        sceneRef.current?.triggerEmote('bow', 2.0);
        showToast('雙手合十誠心禮拜！走近各殿宇拜墊可向指定神尊祈福。');
        return;
      }

      sceneRef.current?.faceZone(zone.id);

      // Station-specific interactions
      if (zone.id === 'service') {
        setServiceFeedback(null);
        setActiveModal('service');
        return;
      }
      if (zone.id === 'lanternwall') {
        setActiveModal('lantern');
        return;
      }
      if (zone.id === 'bell') {
        templeAudio.playTempleBell();
        sceneRef.current?.ringBell();
        sceneRef.current?.triggerEmote('bow', 2.0);
        mpClientRef.current?.sendBellRing();
        setProgress((prev) => ({
          ...prev,
          merit: prev.merit + 5,
          stamina: Math.min(100, prev.stamina + 8),
        }));
        showToast('噹——敲響平安古鐘，餘音繞樑，煩惱頓消！（功德 +5）');
        return;
      }
      if (zone.id === 'jinlu') {
        templeAudio.playBlessingFanfare();
        sceneRef.current?.triggerEmote('bow', 2.6);
        sceneRef.current?.spawnBlessingBurst(8.4, 2.5, 12.6);
        setProgress((prev) => {
          const nextInv = {
            ...prev.inventory,
            joss_paper: Math.max(0, prev.inventory.joss_paper - 1),
            blessedAmulet: true,
          };
          const updated: TempleProgressState = {
            ...prev,
            merit: prev.merit + 15,
            inventory: nextInv,
          };
          return tryAdvanceStep(updated, 'burn_joss', 'jinlu');
        });
        showToast('於招財金爐焚化金紙，並將媽祖平安符順時針過爐三圈！');
        return;
      }

      // Deity Worship (Mazu, Tiangong, Guan Yu, Xuan Tian, Yue Lao, Wealth God & Tiger Lord)
      templeAudio.playWoodblock();
      sceneRef.current?.triggerEmote(zone.id === 'tiangong' ? 'bow' : 'kneel', 2.8);
      sceneRef.current?.spawnBlessingBurst(zone.standPos.x, 1.4, zone.standPos.z);

      setProgress((prev) => {
        let next = {
          ...prev,
          worshipCount: prev.worshipCount + 1,
          merit: prev.merit + 5,
          stamina: Math.max(10, prev.stamina - 2),
        };

        // Step 2: Placing offerings at Mazu altar
        if (zone.id === 'mazu' && !prev.offeringsPlaced) {
          next.offeringsPlaced = true;
          sceneRef.current?.setOfferingsVisible(true);
          next = tryAdvanceStep(next, 'place_offerings', 'mazu');
          showToast('已於媽祖正殿供桌擺放鮮花、四果與壽桃糕餅！');
          return next;
        }

        // Standard deity worship step advancement
        next = tryAdvanceStep(next, 'worship_zone', zone.id);
        showToast(`誠心參拜「${zone.name}」：${zone.blessingQuote}`);
        return next;
      });
    },
    [hudSnapshot.nearestZone, showToast, tryAdvanceStep],
  );

  const handleAutoWalkArriveRef = useRef<(zoneId: ZoneId) => void>(() => {});
  handleAutoWalkArriveRef.current = (zoneId: ZoneId) => {
    const zone = TEMPLE_ZONES[zoneId];
    if (autoActionOnArriveRef.current) {
      autoActionOnArriveRef.current = false;
      const curStep = WORSHIP_STEPS[progressRef.current.currentStepIndex];
      if (curStep && curStep.requiredAction === 'divination') {
        setActiveModal('bwei');
        return;
      }
      handleWorshipAction(zoneId);
    } else {
      showToast(`已抵達「${zone.name}」，可點擊下方按鈕進行互動。`);
    }
  };

  // Mount Three.js WebGL scene ONCE
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const controller = new TempleSceneController(container, avatar, {
      onHudTick: (snap) => setHudSnapshot(snap),
      onAutoWalkArrive: (zoneId) => handleAutoWalkArriveRef.current(zoneId),
      onPlayerTransformTick: (t) => {
        mpClientRef.current?.sendMove(t.x, t.z, t.yaw, t.emote, t.holdingIncense);
      },
    });
    controller.setPhase(phaseRef.current);
    sceneRef.current = controller;

    return () => {
      controller.dispose();
      sceneRef.current = null;
    };
    // Intentionally mounted once so HUD state updates never tear down the WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for Firebase Google Auth state & complete any redirect sign-in result
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setAuthError(null);
      }
      if (user && user.displayName && avatarRef.current.name === DEFAULT_AVATAR.name) {
        const cleanName = user.displayName.trim().slice(0, 14);
        if (cleanName) {
          setAvatar((prev) => {
            if (prev.name !== DEFAULT_AVATAR.name) return prev;
            const updated = { ...prev, name: cleanName };
            sceneRef.current?.updatePlayerAvatar(updated);
            return updated;
          });
        }
      }
    });

    void consumeGoogleRedirectResult()
      .then((redirectUser) => {
        if (redirectUser) {
          setAuthUser(redirectUser);
          setAuthReady(true);
          setAuthError(null);
          showToast(
            `已登入「${redirectUser.displayName || redirectUser.email || '香客'}」，雲端跨裝置多人同步已開啟！`,
          );
        }
      })
      .catch((error) => {
        console.error('Google redirect sign-in result error:', error);
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(formatFirebaseAuthError(error, isInIframe, hostname));
      });

    return () => unsub();
  }, [isInIframe, showToast]);

  // Connect real-time multiplayer transport:
  // - Verified Google user -> Global Firebase Firestore sync (works across devices & URLs)
  // - Guest -> Same-host WebSocket fallback
  const cloudUid = authUser && authUser.emailVerified ? authUser.uid : null;
  useEffect(() => {
    if (!authReady) return;

    setRemotePlayers([]);
    sceneRef.current?.syncRemotePlayers([]);

    const initialJoin = {
      avatar: avatarRef.current,
      x: hudSnapshotRef.current.playerX,
      z: hudSnapshotRef.current.playerZ,
      yaw: hudSnapshotRef.current.playerYaw,
      holdingIncense: progressRef.current.holdingIncense,
    };

    const callbacks = {
      onStatusChange: (status: ConnectionStatus) => setConnectionStatus(status),
      onMessage: (msg: Parameters<ConstructorParameters<typeof TempleMultiplayerClient>[2]['onMessage']>[0]) => {
        if (msg.type === 'room:init') {
          selfIdRef.current = msg.selfId;
          setRoomId(msg.roomId);
          setRemotePlayers(msg.players);
          sceneRef.current?.syncRemotePlayers(msg.players);
          if (msg.messages.length > 0) {
            setMessages(msg.messages);
          }
          if (msg.lanterns.length > 0) {
            setProgress((prev) => {
              let merged = prev.litLanterns;
              for (const l of msg.lanterns) {
                merged = appendUniqueLantern(merged, l);
              }
              sceneRef.current?.updateLanternWall(merged.map((l) => l.slotIndex));
              return { ...prev, litLanterns: merged };
            });
          }
          return;
        }

        if (msg.type === 'player:joined') {
          if (msg.player.id === selfIdRef.current) return;
          setRemotePlayers((prev) => upsertRemotePlayer(prev, msg.player, selfIdRef.current));
          sceneRef.current?.upsertRemotePlayer(msg.player);
          return;
        }

        if (msg.type === 'player:updated') {
          if (msg.id === selfIdRef.current) return;
          setRemotePlayers((prev) => updateRemotePlayer(prev, msg));
          sceneRef.current?.updateRemotePlayerTransform(msg);
          return;
        }

        if (msg.type === 'player:left') {
          setRemotePlayers((prev) => removeRemotePlayer(prev, msg.id));
          sceneRef.current?.removeRemotePlayer(msg.id);
          return;
        }

        if (msg.type === 'chat:message') {
          const isSelf = Boolean(msg.playerId && msg.playerId === selfIdRef.current);
          setMessages((prev) =>
            appendUniqueChatMessage(prev, {
              ...msg.message,
              isPlayer: isSelf || msg.message.isPlayer,
            }),
          );
          if (msg.playerId && !isSelf) {
            sceneRef.current?.showRemotePlayerSpeechBubble(msg.playerId, msg.message.text);
          }
          return;
        }

        if (msg.type === 'lantern:lit') {
          setProgress((prev) => {
            const nextLanterns = appendUniqueLantern(prev.litLanterns, msg.lantern);
            sceneRef.current?.updateLanternWall(nextLanterns.map((l) => l.slotIndex));
            return { ...prev, litLanterns: nextLanterns };
          });
          return;
        }

        if (msg.type === 'bell:rung') {
          if (msg.playerId !== selfIdRef.current) {
            templeAudio.playTempleBell();
            sceneRef.current?.ringBell();
            showToast(`香客「${msg.byName}」敲響了平安古鐘，鐘聲迴盪整座殿宇！`);
          }
        }
      },
    };

    const client: MultiplayerTransport = cloudUid
      ? new FirestoreMultiplayerClient(cloudUid, roomIdRef.current, initialJoin, callbacks)
      : new TempleMultiplayerClient(roomIdRef.current, initialJoin, callbacks);

    mpClientRef.current = client;

    return () => {
      client.dispose();
      if (mpClientRef.current === client) {
        mpClientRef.current = null;
      }
    };
  }, [authReady, cloudUid, showToast]);

  const handleSignInGoogle = useCallback(async () => {
    // Launch popup synchronously inside the click gesture before React state updates
    const loginPromise = signInWithGoogle();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const user = await loginPromise;
      setAuthUser(user);
      setAuthReady(true);
      templeAudio.playBlessingFanfare();
      showToast(
        `已登入「${user.displayName || user.email || '香客'}」，雲端跨裝置多人同步已開啟！`,
      );
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      setAuthError(formatFirebaseAuthError(error, isInIframe, hostname));
    } finally {
      setAuthBusy(false);
    }
  }, [isInIframe, showToast]);

  const handleSignInRedirect = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (error) {
      console.error('Google Redirect Sign-In failed:', error);
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      setAuthError(formatFirebaseAuthError(error, isInIframe, hostname));
      setAuthBusy(false);
    }
  }, [isInIframe]);

  const handleSignOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOutUser();
      showToast('已登出雲端帳號，切換回本機訪客模式。');
    } catch (error) {
      console.error('Google Sign-Out failed:', error);
      setAuthError({
        code: 'auth/signout-failed',
        message: '登出時發生異常，請重試。',
        suggestNewTab: false,
        suggestRedirect: false,
      });
    } finally {
      setAuthBusy(false);
    }
  }, [showToast]);

  const handleWalkToPlayer = useCallback(
    (player: RemotePlayerState) => {
      autoActionOnArriveRef.current = false;
      sceneRef.current?.navigateToPosition(player.x, player.z);
      showToast(`正在前往香客「${player.avatar.name}」身邊…`);
    },
    [showToast],
  );

  const handleSwitchRoom = useCallback(
    (nextRoomRaw: string) => {
      const normalized = normalizeRoomId(nextRoomRaw);
      setRoomId(normalized);
      setRemotePlayers([]);
      sceneRef.current?.syncRemotePlayers([]);
      mpClientRef.current?.switchRoom(normalized);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (normalized === 'main') {
          url.searchParams.delete('room');
        } else {
          url.searchParams.set('room', normalized);
        }
        window.history.replaceState({}, '', url.toString());
      }
      showToast(
        normalized === 'main'
          ? '已切換回「本殿大廳（公開同參）」！'
          : `已進入私人進香房「${normalized}」，可複製連結邀請親友同拜！`,
      );
    },
    [showToast],
  );

  const handleStart = useCallback(() => {
    templeAudio.playTempleBell();
    setPhase('playing');
    setActiveModal(null);
    showToast('歡迎來到雲端天后宮！請先至左前方「服務處」請香與供品。');
  }, [showToast]);

  const handleToggleIncense = useCallback(() => {
    templeAudio.playChime(659.25);
    setProgress((prev) => {
      const nextHolding = !prev.holdingIncense;
      sceneRef.current?.setHoldingIncense(nextHolding);
      let next: TempleProgressState = {
        ...prev,
        holdingIncense: nextHolding,
        inventory: {
          ...prev.inventory,
          incense: nextHolding && prev.inventory.incense === 0 ? 1 : prev.inventory.incense,
        },
      };
      if (nextHolding) {
        next = tryAdvanceStep(next, 'hold_incense');
        showToast('已點燃清香並雙手合十持香，香煙裊裊上達天聽！');
      } else {
        showToast('已將清香收妥。');
      }
      return next;
    });
  }, [showToast, tryAdvanceStep]);

  const handleOneClickStep = useCallback(() => {
    const curStep = WORSHIP_STEPS[progress.currentStepIndex];
    if (!curStep) {
      sceneRef.current?.navigateToZone('mazu');
      showToast('正在前往媽祖正殿…');
      return;
    }
    if (curStep.requiredAction === 'hold_incense') {
      handleToggleIncense();
      return;
    }
    autoActionOnArriveRef.current = true;
    sceneRef.current?.navigateToZone(curStep.targetZone);
    showToast(`自動前往第 ${curStep.stepNumber} 步：${curStep.title}…`);
  }, [handleToggleIncense, progress.currentStepIndex, showToast]);

  // Global keyboard shortcuts (Title Enter/Space, Playing Enter=Chat / 1-4 / Esc / P / M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (phaseRef.current === 'title' && activeModalRef.current === null) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (e.code === 'Escape') {
        if (activeModalRef.current !== null) {
          setActiveModal(null);
        } else if (showEmotes) {
          setShowEmotes(false);
        } else if (phaseRef.current === 'playing') {
          setPhase('paused');
        } else if (phaseRef.current === 'paused') {
          setPhase('playing');
        }
        return;
      }

      if (phaseRef.current !== 'playing' || activeModalRef.current !== null) return;

      if (e.code === 'Enter') {
        e.preventDefault();
        sceneRef.current?.clearMovementKeys();
        setChatView((v) => (v === 'minimized' ? 'compact' : v));
        window.setTimeout(() => chatInputRef.current?.focus(), 0);
      } else if (e.code === 'KeyP') {
        setPhase('paused');
      } else if (e.code === 'KeyM') {
        const nextMuted = templeAudio.toggleMute();
        setMuted(nextMuted);
      } else if (e.code === 'Digit1') {
        handleWorshipAction();
      } else if (e.code === 'Digit2') {
        setActiveModal('bwei');
      } else if (e.code === 'Digit3') {
        setActiveModal('fortune');
      } else if (e.code === 'Digit4') {
        handleToggleIncense();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStart, handleToggleIncense, handleWorshipAction, showEmotes]);

  // Avatar save handler
  const handleSaveAvatar = (next: AvatarConfig, enterTemple: boolean) => {
    setAvatar(next);
    sceneRef.current?.updatePlayerAvatar(next);
    mpClientRef.current?.sendAvatarUpdate(next);
    setActiveModal(null);
    templeAudio.playChime(783.99);
    if (enterTemple) {
      handleStart();
    } else {
      showToast(`已更新分身造型：「${next.name}」`);
    }
  };

  // Service counter handlers
  const handleBuyItem = (id: OfferingId) => {
    setProgress((prev) => {
      const res = purchaseOffering(prev, id);
      setServiceFeedback(res.message);
      if (res.success) {
        templeAudio.playChime(659.25);
        if (prev.currentStepIndex === 0 && res.nextState.currentStepIndex === 1) {
          pushSystemLog('已完成第 1 步「請香與領取供品」！獲功德 +10、香油幣 +20');
        }
      }
      return res.nextState;
    });
  };

  const handleBuyBundle = () => {
    setProgress((prev) => {
      const res = purchaseStarterBundle(prev);
      setServiceFeedback(res.message);
      if (res.success) {
        templeAudio.playBlessingFanfare();
        if (prev.currentStepIndex === 0 && res.nextState.currentStepIndex === 1) {
          pushSystemLog('已完成第 1 步「請香與領取供品」！已備齊全套供品。');
        }
      }
      return res.nextState;
    });
  };

  const handleClaimFreeCoins = () => {
    templeAudio.playBlessingFanfare();
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins + 100,
      stamina: 100,
    }));
    setServiceFeedback('媽祖慈悲結緣添福！已獲贈 100 香油幣並恢復全部精力，安心參拜不破產！');
  };

  // Bwei (Moon Blocks) handler
  const handleBweiResult = (deity: DeityId, result: BweiResult, wish: string) => {
    templeAudio.playBweiClatter(result.outcome);
    if (result.outcome === 'sheng') {
      sceneRef.current?.triggerEmote('jump', 1.8);
      sceneRef.current?.spawnBlessingBurst(hudSnapshot.playerX, 1.5, hudSnapshot.playerZ);
    }

    setProgress((prev) => {
      const nextInv = { ...prev.inventory };
      let bonusCoins = 0;

      if (result.outcome === 'sheng' && deity === 'yuelao' && !nextInv.redThread) {
        nextInv.redThread = true;
        pushSystemLog(`恭喜「${avatar.name}」於月老殿擲得聖筊，獲月下老人賜予良緣紅線！`);
        showToast('恭喜擲得聖筊！月下老人已賜予您「良緣紅線」❤️');
      } else if (result.outcome === 'sheng' && deity === 'caishen' && !nextInv.fortuneMoney) {
        nextInv.fortuneMoney = true;
        bonusCoins = 88;
        pushSystemLog(`恭喜「${avatar.name}」於財神殿擲得聖筊，求得武財神與虎爺發財金 +88 幣！`);
        showToast('恭喜擲得聖筊！求得武財神與虎爺「發財金 +88 幣」💰');
      }

      let next: TempleProgressState = {
        ...prev,
        bweiCount: prev.bweiCount + 1,
        coins: prev.coins + bonusCoins,
        merit: prev.merit + (result.outcome === 'sheng' ? 10 : 3),
        inventory: nextInv,
      };
      next = tryAdvanceStep(next, 'divination');
      return next;
    });

    if (wish) {
      sceneRef.current?.showPlayerSpeechBubble(`向${TEMPLE_ZONES[deity].shortName}祈願：${wish}`);
    }
  };

  // Fortune revealed handler
  const handleFortuneRevealed = (slip: FortuneSlip) => {
    templeAudio.playBlessingFanfare();
    sceneRef.current?.spawnBlessingBurst(hudSnapshot.playerX, 1.6, hudSnapshot.playerZ);
    setProgress((prev) => {
      const updated: TempleProgressState = {
        ...prev,
        fortuneCount: prev.fortuneCount + 1,
        merit: prev.merit + 12,
      };
      return tryAdvanceStep(updated, 'divination');
    });
    const fortuneNote = `「${avatar.name}」於媽祖正殿求得第 ${slip.number} 籤（${slip.ganzhi} · ${slip.rank}）！`;
    mpClientRef.current?.sendRitualAnnounce(`ritual-slip-${Date.now()}`, fortuneNote);
  };

  // Light Blessing Lantern handler
  const handleLightLantern = (type: LitLantern['type'], wish: string) => {
    templeAudio.playBlessingFanfare();
    setProgress((prev) => {
      if (prev.coins < 30) return prev;
      const slotIndex = (prev.litLanterns.length * 4 + 1) % 30;
      const newLamp: LitLantern = {
        id: `lamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerName: avatar.name,
        type,
        wish,
        slotIndex,
      };
      const nextLanterns = appendUniqueLantern(prev.litLanterns, newLamp);
      sceneRef.current?.updateLanternWall(nextLanterns.map((l) => l.slotIndex));
      mpClientRef.current?.sendLanternLit(newLamp);
      mpClientRef.current?.sendRitualAnnounce(
        `ritual-lamp-${newLamp.id}`,
        `「${avatar.name}」於光明燈牆點亮一盞「${type}」：${wish}`,
      );
      return {
        ...prev,
        coins: prev.coins - 30,
        merit: prev.merit + 20,
        litLanterns: nextLanterns,
      };
    });
  };

  // Chat & Emote handlers
  const handleSendMessage = (text: string) => {
    templeAudio.playChime(587.33);
    sceneRef.current?.showPlayerSpeechBubble(text);
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Optimistic local append (deduplicated when echoed back from server)
    setMessages((prev) =>
      appendUniqueChatMessage(prev, {
        id: msgId,
        sender: avatar.name,
        text,
        timestamp: '剛剛',
        isPlayer: true,
      }),
    );
    mpClientRef.current?.sendChat(msgId, text);
  };

  const handleTriggerEmote = (emote: EmoteType, label: string) => {
    templeAudio.playWoodblock(1.1);
    sceneRef.current?.triggerEmote(emote, emote === 'kneel' || emote === 'meditate' ? 20 : 2.8);
    mpClientRef.current?.sendMove(
      hudSnapshot.playerX,
      hudSnapshot.playerZ,
      hudSnapshot.playerYaw,
      emote,
      progress.holdingIncense,
      true,
    );
    showToast(`角色動作：${label}`);
  };

  // Restart full 11-step ritual
  const handleRestartRitual = () => {
    const fresh = createInitialProgress();
    setProgress(fresh);
    sceneRef.current?.setHoldingIncense(false);
    sceneRef.current?.setOfferingsVisible(false);
    sceneRef.current?.resetToSpawn();
    setActiveModal(null);
    setPhase('playing');
    templeAudio.playTempleBell();
    showToast('已重設 11 步參拜指引，歡迎重新開啟圓滿進香之旅！');
  };

  const defaultBweiDeity: DeityId =
    hudSnapshot.nearestZone && hudSnapshot.nearestZone.isDeity
      ? (hudSnapshot.nearestZone.id as DeityId)
      : 'mazu';

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#1b0c09]">
      {/* Isolated Dedicated Three.js WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="temple-canvas"
        className="fixed inset-0 w-full h-full"
      />

      {/* Title Screen Overlay */}
      {phase === 'title' && activeModal !== 'customize' && (
        <TitleOverlay
          avatar={avatar}
          isCloudMode={isCloudMode}
          authName={authUser?.displayName || authUser?.email}
          authBusy={authBusy}
          authError={authError}
          isInIframe={isInIframe}
          onStart={handleStart}
          onOpenCustomize={() => setActiveModal('customize')}
          onSignInGoogle={handleSignInGoogle}
          onSignInRedirect={handleSignInRedirect}
        />
      )}

      {/* Active Playing HUD */}
      {phase === 'playing' && (
        <GameHud
          progress={progress}
          playerX={hudSnapshot.playerX}
          playerZ={hudSnapshot.playerZ}
          playerYaw={hudSnapshot.playerYaw}
          nearestZone={hudSnapshot.nearestZone}
          autoWalking={hudSnapshot.autoWalking}
          muted={muted}
          showNpcs={showNpcs}
          toastMessage={toast}
          roomId={roomId}
          onlineCount={remotePlayers.length + 1}
          isCloudMode={isCloudMode}
          remotePlayers={remotePlayers}
          onNavigateZone={(zid) => {
            autoActionOnArriveRef.current = false;
            sceneRef.current?.navigateToZone(zid);
            showToast(`正在前往「${TEMPLE_ZONES[zid].name}」…`);
          }}
          onOneClickStep={handleOneClickStep}
          onWorshipAction={() => handleWorshipAction()}
          onOpenBwei={() => setActiveModal('bwei')}
          onOpenFortune={() => setActiveModal('fortune')}
          onToggleIncense={handleToggleIncense}
          onOpenService={() => {
            setServiceFeedback(null);
            setActiveModal('service');
          }}
          onOpenLantern={() => setActiveModal('lantern')}
          onRingBell={() => handleWorshipAction('bell')}
          onOpenMultiplayer={() => setActiveModal('multiplayer')}
          onOpenNotice={() => setActiveModal('notice')}
          onToggleMute={() => setMuted(templeAudio.toggleMute())}
          onToggleChat={() => {
            setChatView((v) => (v === 'expanded' ? 'compact' : 'expanded'));
            window.setTimeout(() => chatInputRef.current?.focus(), 0);
          }}
          onToggleEmotes={() => setShowEmotes((v) => !v)}
          onOpenCustomize={() => setActiveModal('customize')}
          onToggleNpcs={() => {
            setShowNpcs((prev) => {
              const next = !prev;
              sceneRef.current?.setShowNpcs(next);
              showToast(next ? '已顯示線上香客同參' : '已開啟獨自靜心模式（隱藏其他香客）');
              return next;
            });
          }}
          onOpenPause={() => setPhase('paused')}
          onJoystickMove={(nx, ny) => sceneRef.current?.setJoystick(nx, ny)}
          onRotateCamera={(d) => sceneRef.current?.rotateCameraStep(d)}
        />
      )}

      {/* Always-Ready Bottom-Right Chat Dock & Emotes Popover */}
      {phase === 'playing' && (
        <ChatAndEmotePanel
          chatView={chatView}
          showEmotes={showEmotes}
          messages={messages}
          onlineCount={remotePlayers.length + 1}
          chatInputRef={chatInputRef}
          onChangeChatView={setChatView}
          onSendMessage={handleSendMessage}
          onTriggerEmote={handleTriggerEmote}
          onCloseEmotes={() => setShowEmotes(false)}
          onInputFocus={() => sceneRef.current?.clearMovementKeys()}
        />
      )}

      {/* Interactive Modals */}
      {activeModal === 'customize' && (
        <AvatarCustomizerModal
          avatar={avatar}
          isFromTitle={phase === 'title'}
          onSave={handleSaveAvatar}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'service' && (
        <ServiceCounterModal
          progress={progress}
          feedback={serviceFeedback}
          onBuyItem={handleBuyItem}
          onBuyBundle={handleBuyBundle}
          onClaimFreeCoins={handleClaimFreeCoins}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'bwei' && (
        <BweiModal
          defaultDeity={defaultBweiDeity}
          hasRedThread={progress.inventory.redThread}
          hasFortuneMoney={progress.inventory.fortuneMoney}
          onResult={handleBweiResult}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'fortune' && (
        <FortuneModal
          onFortuneRevealed={handleFortuneRevealed}
          onShakeSound={() => templeAudio.playFortuneShake()}
          onBweiSound={(o) => templeAudio.playBweiClatter(o)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'lantern' && (
        <LanternModal
          playerName={avatar.name}
          coins={progress.coins}
          litLanterns={progress.litLanterns}
          onLightLantern={handleLightLantern}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'multiplayer' && (
        <MultiplayerModal
          roomId={roomId}
          connectionStatus={connectionStatus}
          isCloudMode={isCloudMode}
          authUser={
            authUser
              ? { displayName: authUser.displayName, email: authUser.email }
              : null
          }
          authBusy={authBusy}
          authError={authError}
          isInIframe={isInIframe}
          selfName={avatar.name}
          remotePlayers={remotePlayers}
          onSignInGoogle={handleSignInGoogle}
          onSignInRedirect={handleSignInRedirect}
          onSignOut={handleSignOut}
          onSwitchRoom={handleSwitchRoom}
          onWalkToPlayer={handleWalkToPlayer}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'notice' && (
        <NoticeModal
          progress={progress}
          onNavigateZone={(zid) => {
            autoActionOnArriveRef.current = false;
            sceneRef.current?.navigateToZone(zid);
            showToast(`正在前往「${TEMPLE_ZONES[zid].name}」…`);
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Game Shell Status Modals (Paused & Ritual Complete) */}
      {phase === 'paused' && (
        <PauseModal
          onResume={() => setPhase('playing')}
          onRestartGuide={handleRestartRitual}
          onReturnTitle={() => {
            setActiveModal(null);
            setShowEmotes(false);
            setPhase('title');
          }}
        />
      )}

      {phase === 'gameover' && (
        <RitualCompleteModal
          progress={progress}
          playerName={avatar.name}
          onContinueFree={() => setPhase('playing')}
          onRestartRitual={handleRestartRitual}
        />
      )}
    </main>
  );
}
